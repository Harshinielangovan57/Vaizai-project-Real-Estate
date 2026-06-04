// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title  IPropertyNFT
 * @notice Minimal interface to check verification status on PropertyNFT.sol
 */
interface IPropertyNFT {
    function isVerified(uint256 tokenId) external view returns (bool);
    function ownerOf(uint256 tokenId) external view returns (address);
}

/**
 * @title  Marketplace
 * @notice Fixed-price listing, buying, cancellation, and price-update for
 *         verified Real-Estate NFTs.  Platform fee is deducted on every sale.
 *
 * Fee defaults (all configurable by owner):
 *   • Platform fee : 2.5 % (250 basis points)
 *   • Fee recipient: contract deployer
 *   • Minimum price: 0.001 ETH
 */
contract Marketplace is ReentrancyGuard, Ownable {

    // ─────────────────────────────────────────────────────────────────────────
    //  Structs
    // ─────────────────────────────────────────────────────────────────────────

    struct Listing {
        uint256 listingId;
        uint256 tokenId;
        address seller;
        uint256 price;      // in wei
        bool    active;
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  State
    // ─────────────────────────────────────────────────────────────────────────

    IPropertyNFT public propertyNFT;

    uint256 public feeBasisPoints = 250;          // 2.5 %
    address public feeRecipient;
    uint256 public minimumPrice   = 0.001 ether;

    uint256 private _nextListingId = 1;

    /// listingId → Listing
    mapping(uint256 => Listing) public listings;

    /// tokenId → active listingId  (0 = not listed)
    mapping(uint256 => uint256) public tokenToActiveListing;

    /// ordered list of all listing IDs ever created (used for pagination)
    uint256[] private _allListingIds;

    // ─────────────────────────────────────────────────────────────────────────
    //  Events
    // ─────────────────────────────────────────────────────────────────────────

    event Listed(
        uint256 indexed listingId,
        uint256 indexed tokenId,
        address indexed seller,
        uint256 price
    );

    event Sold(
        uint256 indexed listingId,
        uint256 indexed tokenId,
        address indexed buyer,
        uint256 price,
        uint256 fee
    );

    event ListingCancelled(
        uint256 indexed listingId,
        uint256 indexed tokenId,
        address indexed seller
    );

    event PriceUpdated(
        uint256 indexed listingId,
        uint256 indexed tokenId,
        uint256 newPrice
    );

    event FeeUpdated(uint256 newBasisPoints);
    event FeeRecipientUpdated(address newRecipient);
    event MinimumPriceUpdated(uint256 newMinimumPrice);

    // ─────────────────────────────────────────────────────────────────────────
    //  Constructor
    // ─────────────────────────────────────────────────────────────────────────

    constructor(address _propertyNFT) Ownable() {
        require(_propertyNFT != address(0), "Marketplace: zero address");
        propertyNFT  = IPropertyNFT(_propertyNFT);
        feeRecipient = msg.sender;
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Core: List
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice List a verified property for fixed-price sale.
     * @dev    Caller must have called NFT.approve(address(this), tokenId) first.
     *         NFT is transferred into contract custody (escrow).
     * @param  tokenId  The ERC-721 token to list.
     * @param  price    Asking price in wei (must be >= minimumPrice).
     * @return listingId The newly created listing ID.
     */
    function listProperty(uint256 tokenId, uint256 price)
        external
        nonReentrant
        returns (uint256 listingId)
    {
        require(price >= minimumPrice,                        "Marketplace: price too low");
        require(propertyNFT.isVerified(tokenId),             "Marketplace: property not verified");
        require(propertyNFT.ownerOf(tokenId) == msg.sender,  "Marketplace: not token owner");
        require(tokenToActiveListing[tokenId] == 0,          "Marketplace: already listed");

        // Pull NFT into contract custody
        IERC721(address(propertyNFT)).transferFrom(msg.sender, address(this), tokenId);

        listingId = _nextListingId++;

        listings[listingId] = Listing({
            listingId: listingId,
            tokenId:   tokenId,
            seller:    msg.sender,
            price:     price,
            active:    true
        });

        tokenToActiveListing[tokenId] = listingId;
        _allListingIds.push(listingId);

        emit Listed(listingId, tokenId, msg.sender, price);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Core: Buy
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Purchase a listed property.
     * @dev    Buyer must send msg.value >= listing.price.
     *         Platform fee deducted, remainder forwarded to seller atomically.
     *         Excess ETH returned to buyer.
     * @param  listingId  ID of the active listing.
     */
    function buyProperty(uint256 listingId)
        external
        payable
        nonReentrant
    {
        Listing storage listing = listings[listingId];
        require(listing.active,             "Marketplace: listing not active");
        require(msg.value >= listing.price, "Marketplace: insufficient ETH");

        // ── Mark inactive before transfers (CEI pattern) ──────────────────
        listing.active = false;
        tokenToActiveListing[listing.tokenId] = 0;

        uint256 fee        = (listing.price * feeBasisPoints) / 10_000;
        uint256 sellerAmt  = listing.price - fee;
        uint256 excess     = msg.value - listing.price;

        // ── Transfer NFT to buyer ─────────────────────────────────────────
        IERC721(address(propertyNFT)).safeTransferFrom(
            address(this), msg.sender, listing.tokenId
        );

        // ── Disburse ETH ──────────────────────────────────────────────────
        if (fee > 0) {
            (bool feeOk, ) = feeRecipient.call{value: fee}("");
            require(feeOk, "Marketplace: fee transfer failed");
        }

        (bool sellerOk, ) = listing.seller.call{value: sellerAmt}("");
        require(sellerOk, "Marketplace: seller transfer failed");

        // Return any overpayment
        if (excess > 0) {
            (bool excessOk, ) = msg.sender.call{value: excess}("");
            require(excessOk, "Marketplace: refund failed");
        }

        emit Sold(listingId, listing.tokenId, msg.sender, listing.price, fee);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Core: Cancel
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Cancel an active listing.  Only the original seller may cancel.
     *         NFT is returned to the seller.
     * @param  listingId  ID of the listing to cancel.
     */
    function cancelListing(uint256 listingId) external nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.active,               "Marketplace: listing not active");
        require(listing.seller == msg.sender, "Marketplace: not the seller");

        listing.active = false;
        tokenToActiveListing[listing.tokenId] = 0;

        IERC721(address(propertyNFT)).safeTransferFrom(
            address(this), listing.seller, listing.tokenId
        );

        emit ListingCancelled(listingId, listing.tokenId, msg.sender);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Core: Update Price
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Update the price of an active listing without re-listing.
     * @param  listingId  ID of the active listing.
     * @param  newPrice   New price in wei (must be >= minimumPrice).
     */
    function updatePrice(uint256 listingId, uint256 newPrice) external {
        Listing storage listing = listings[listingId];
        require(listing.active,               "Marketplace: listing not active");
        require(listing.seller == msg.sender, "Marketplace: not the seller");
        require(newPrice >= minimumPrice,     "Marketplace: price too low");

        listing.price = newPrice;

        emit PriceUpdated(listingId, listing.tokenId, newPrice);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  View: Active Listings
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Returns an array of all currently active listing IDs.
     *         Designed for frontend pagination — call off-chain.
     * @return activeIds  Array of active listing IDs.
     */
    function getActiveListingIds()
        external
        view
        returns (uint256[] memory activeIds)
    {
        uint256 total  = _allListingIds.length;
        uint256 count  = 0;

        // First pass: count actives
        for (uint256 i = 0; i < total; i++) {
            if (listings[_allListingIds[i]].active) count++;
        }

        activeIds = new uint256[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < total; i++) {
            uint256 id = _allListingIds[i];
            if (listings[id].active) {
                activeIds[idx++] = id;
            }
        }
    }

    /**
     * @notice Convenience view: return full Listing struct for a given ID.
     */
    function getListing(uint256 listingId)
        external
        view
        returns (Listing memory)
    {
        return listings[listingId];
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Owner: Fee Configuration
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Update the platform fee.  Max 10 % (1 000 bp) as a safety cap.
     * @param  newBasisPoints  Fee in basis points (e.g. 250 = 2.5 %).
     */
    function setFeeBasisPoints(uint256 newBasisPoints) external onlyOwner {
        require(newBasisPoints <= 1_000, "Marketplace: fee too high (max 10%)");
        feeBasisPoints = newBasisPoints;
        emit FeeUpdated(newBasisPoints);
    }

    /**
     * @notice Update the fee recipient address.
     * @param  newRecipient  Address that will receive platform fees.
     */
    function setFeeRecipient(address newRecipient) external onlyOwner {
        require(newRecipient != address(0), "Marketplace: zero address");
        feeRecipient = newRecipient;
        emit FeeRecipientUpdated(newRecipient);
    }

    /**
     * @notice Update the minimum listing price.
     * @param  newMin  Minimum price in wei.
     */
    function setMinimumPrice(uint256 newMin) external onlyOwner {
        minimumPrice = newMin;
        emit MinimumPriceUpdated(newMin);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  ERC-721 Receiver
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @dev Required so the contract can receive NFTs via safeTransferFrom.
     */
    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }
}

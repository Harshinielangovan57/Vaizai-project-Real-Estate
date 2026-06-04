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
 * @title  Auction
 * @notice Timed English auction with:
 *           • Pull-over-push withdrawal for outbid users (reentrancy safe)
 *           • Anti-sniping: last-5-minute bids extend the auction by 5 min
 *           • Automatic winner resolution on finalize
 *           • No-bid path: NFT returned to seller
 */
contract Auction is ReentrancyGuard, Ownable {

    // ─────────────────────────────────────────────────────────────────────────
    //  Constants
    // ─────────────────────────────────────────────────────────────────────────

    uint256 public constant ANTI_SNIPE_WINDOW     = 5 minutes;
    uint256 public constant ANTI_SNIPE_EXTENSION  = 5 minutes;

    // ─────────────────────────────────────────────────────────────────────────
    //  Structs
    // ─────────────────────────────────────────────────────────────────────────

    struct AuctionData {
        uint256 auctionId;
        uint256 tokenId;
        address seller;
        uint256 startingPrice;       // minimum first bid (wei)
        uint256 highestBid;          // current highest bid (wei)
        address highestBidder;       // address(0) if no bids yet
        uint256 endTime;             // unix timestamp
        bool    finalized;
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  State
    // ─────────────────────────────────────────────────────────────────────────

    IPropertyNFT public propertyNFT;

    uint256 private _nextAuctionId = 1;

    /// auctionId → AuctionData
    mapping(uint256 => AuctionData) public auctions;

    /// auctionId → bidder → pending ETH to withdraw (pull pattern)
    mapping(uint256 => mapping(address => uint256)) public pendingReturns;

    /// ordered list of all auction IDs
    uint256[] private _allAuctionIds;

    // ─────────────────────────────────────────────────────────────────────────
    //  Events
    // ─────────────────────────────────────────────────────────────────────────

    event AuctionCreated(
        uint256 indexed auctionId,
        uint256 indexed tokenId,
        address indexed seller,
        uint256 startingPrice,
        uint256 endTime
    );

    event BidPlaced(
        uint256 indexed auctionId,
        uint256 indexed tokenId,
        address indexed bidder,
        uint256 amount,
        uint256 newEndTime      // may have been extended
    );

    event BidWithdrawn(
        uint256 indexed auctionId,
        address indexed bidder,
        uint256 amount
    );

    event AuctionEnded(
        uint256 indexed auctionId,
        uint256 indexed tokenId,
        address winner,          // address(0) if no bids
        uint256 finalBid
    );

    // ─────────────────────────────────────────────────────────────────────────
    //  Constructor
    // ─────────────────────────────────────────────────────────────────────────

    constructor(address _propertyNFT) Ownable() {
        require(_propertyNFT != address(0), "Auction: zero address");
        propertyNFT = IPropertyNFT(_propertyNFT);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Core: Create Auction
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Create a timed auction for a verified property NFT.
     * @dev    Caller must approve this contract before calling.
     *         NFT is transferred into contract custody immediately.
     * @param  tokenId        The ERC-721 token to auction.
     * @param  startingPrice  Minimum opening bid in wei.
     * @param  duration       Auction length in seconds.
     * @return auctionId      The newly created auction ID.
     */
    function createAuction(
        uint256 tokenId,
        uint256 startingPrice,
        uint256 duration
    )
        external
        nonReentrant
        returns (uint256 auctionId)
    {
        require(startingPrice > 0,                            "Auction: starting price must be > 0");
        require(duration > 0,                                 "Auction: duration must be > 0");
        require(propertyNFT.isVerified(tokenId),             "Auction: property not verified");
        require(propertyNFT.ownerOf(tokenId) == msg.sender,  "Auction: not token owner");

        // Transfer NFT to contract
        IERC721(address(propertyNFT)).transferFrom(msg.sender, address(this), tokenId);

        auctionId = _nextAuctionId++;
        uint256 endTime = block.timestamp + duration;

        auctions[auctionId] = AuctionData({
            auctionId:     auctionId,
            tokenId:       tokenId,
            seller:        msg.sender,
            startingPrice: startingPrice,
            highestBid:    0,
            highestBidder: address(0),
            endTime:       endTime,
            finalized:     false
        });

        _allAuctionIds.push(auctionId);

        emit AuctionCreated(auctionId, tokenId, msg.sender, startingPrice, endTime);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Core: Place Bid
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Place a bid on an active auction.
     * @dev    Pull-over-push: the previous highest bidder's ETH is stored in
     *         `pendingReturns` — they must call withdraw() to retrieve it.
     *
     *         Anti-sniping: if a bid arrives within the last ANTI_SNIPE_WINDOW
     *         seconds, endTime is extended by ANTI_SNIPE_EXTENSION.
     *
     * @param  auctionId  ID of the active auction.
     */
    function placeBid(uint256 auctionId) external payable nonReentrant {
        AuctionData storage a = auctions[auctionId];

        require(!a.finalized,                  "Auction: already finalized");
        require(block.timestamp < a.endTime,   "Auction: auction has ended");
        require(a.seller != address(0),        "Auction: does not exist");
        require(msg.sender != a.seller,        "Auction: seller cannot bid");

        // Bid must exceed current highest bid (or startingPrice if first bid)
        uint256 floor = a.highestBid > 0 ? a.highestBid : a.startingPrice;
        require(msg.value > floor, "Auction: bid too low");

        // Queue previous highest bidder's ETH for withdrawal
        if (a.highestBidder != address(0)) {
            pendingReturns[auctionId][a.highestBidder] += a.highestBid;
        }

        // Record new highest bid
        a.highestBid    = msg.value;
        a.highestBidder = msg.sender;

        // ── Anti-sniping extension ─────────────────────────────────────────
        if (a.endTime - block.timestamp <= ANTI_SNIPE_WINDOW) {
            a.endTime += ANTI_SNIPE_EXTENSION;
        }

        emit BidPlaced(auctionId, a.tokenId, msg.sender, msg.value, a.endTime);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Core: Withdraw (outbid funds)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Outbid users call this to reclaim their ETH.
     *         Pull-over-push pattern prevents reentrancy and DoS attacks.
     * @param  auctionId  The auction from which to withdraw pending funds.
     */
    function withdraw(uint256 auctionId) external nonReentrant {
        uint256 amount = pendingReturns[auctionId][msg.sender];
        require(amount > 0, "Auction: nothing to withdraw");

        // Zero before transfer (CEI)
        pendingReturns[auctionId][msg.sender] = 0;

        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "Auction: ETH transfer failed");

        emit BidWithdrawn(auctionId, msg.sender, amount);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Core: Finalize Auction
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Finalize an ended auction.  Anyone may call this after endTime.
     *
     *         • If bids exist:  NFT → winner, ETH → seller.
     *         • If no bids:     NFT → seller.
     *
     * @param  auctionId  ID of the ended auction.
     */
    function finalizeAuction(uint256 auctionId) external nonReentrant {
        AuctionData storage a = auctions[auctionId];

        require(a.seller != address(0),        "Auction: does not exist");
        require(!a.finalized,                  "Auction: already finalized");
        require(block.timestamp >= a.endTime,  "Auction: not yet ended");

        a.finalized = true;

        if (a.highestBidder != address(0)) {
            // ── Winner path ───────────────────────────────────────────────
            IERC721(address(propertyNFT)).safeTransferFrom(
                address(this), a.highestBidder, a.tokenId
            );

            (bool ok, ) = a.seller.call{value: a.highestBid}("");
            require(ok, "Auction: seller payment failed");

            emit AuctionEnded(auctionId, a.tokenId, a.highestBidder, a.highestBid);
        } else {
            // ── No bids: return NFT to seller ─────────────────────────────
            IERC721(address(propertyNFT)).safeTransferFrom(
                address(this), a.seller, a.tokenId
            );

            emit AuctionEnded(auctionId, a.tokenId, address(0), 0);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Views
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Returns full AuctionData for a given auction ID.
     */
    function getAuction(uint256 auctionId)
        external
        view
        returns (AuctionData memory)
    {
        return auctions[auctionId];
    }

    /**
     * @notice Returns all auction IDs whose endTime is in the future
     *         and that have not yet been finalized.
     */
    function getActiveAuctionIds()
        external
        view
        returns (uint256[] memory activeIds)
    {
        uint256 total = _allAuctionIds.length;
        uint256 count = 0;

        for (uint256 i = 0; i < total; i++) {
            AuctionData storage a = auctions[_allAuctionIds[i]];
            if (!a.finalized && block.timestamp < a.endTime) count++;
        }

        activeIds = new uint256[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < total; i++) {
            uint256 id = _allAuctionIds[i];
            AuctionData storage a = auctions[id];
            if (!a.finalized && block.timestamp < a.endTime) {
                activeIds[idx++] = id;
            }
        }
    }

    /**
     * @notice Pending ETH a specific bidder can withdraw from an auction.
     * @param  auctionId  The auction ID.
     * @param  bidder     The bidder's address.
     * @return            Amount in wei claimable via withdraw().
     */
    function getPendingReturn(uint256 auctionId, address bidder)
        external
        view
        returns (uint256)
    {
        return pendingReturns[auctionId][bidder];
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  ERC-721 Receiver
    // ─────────────────────────────────────────────────────────────────────────

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title  PropertyNFT
 * @notice ERC-721 token representing verified real-estate properties.
 *
 * Each token stores:
 *   • On-chain metadata  : address, area (sqft), valuation (wei), verified flag
 *   • Off-chain metadata : IPFS URI pointing to the full JSON metadata + documents
 *
 * Only the contract owner (platform admin) can:
 *   • Mint new property tokens
 *   • Verify / unverify properties
 *   • Update token URIs
 */
contract PropertyNFT is ERC721, ERC721URIStorage, Ownable {

    // ─────────────────────────────────────────────────────────────────────────
    //  Structs
    // ─────────────────────────────────────────────────────────────────────────

    struct Property {
        uint256 tokenId;
        string  propertyAddress;   // physical address string
        uint256 areaSqft;          // area in square feet
        uint256 valuation;         // appraised value in wei
        bool    verified;          // admin verification flag
        uint256 mintedAt;          // block timestamp
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  State
    // ─────────────────────────────────────────────────────────────────────────

    uint256 private _nextTokenId = 1;

    /// tokenId → Property metadata
    mapping(uint256 => Property) public properties;

    // ─────────────────────────────────────────────────────────────────────────
    //  Events
    // ─────────────────────────────────────────────────────────────────────────

    event PropertyMinted(
        uint256 indexed tokenId,
        address indexed owner,
        string  propertyAddress,
        uint256 areaSqft,
        uint256 valuation
    );

    event PropertyVerified(uint256 indexed tokenId, bool verified);

    event TokenURIUpdated(uint256 indexed tokenId);

    // ─────────────────────────────────────────────────────────────────────────
    //  Constructor
    // ─────────────────────────────────────────────────────────────────────────

    constructor() ERC721("RealEstateNFT", "RENFT") Ownable() {}

    // ─────────────────────────────────────────────────────────────────────────
    //  Core: Mint
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Mint a new property token to `to`.
     * @dev    Only platform admin (owner) can mint.
     *         Token is unverified by default; admin calls verifyProperty() after KYC.
     *
     * @param  to              Recipient wallet (property owner).
     * @param  propertyAddress Physical address of the property.
     * @param  areaSqft        Area in square feet.
     * @param  valuation       Appraised value in wei.
     * @param  metadataUri     IPFS URI for the full metadata JSON.
     * @return tokenId         The newly minted token ID.
     */
    function mintProperty(
        address to,
        string  calldata propertyAddress,
        uint256 areaSqft,
        uint256 valuation,
        string  calldata metadataUri
    )
        external
        onlyOwner
        returns (uint256 tokenId)
    {
        require(to != address(0),                    "PropertyNFT: mint to zero address");
        require(bytes(propertyAddress).length > 0,   "PropertyNFT: empty address");
        require(areaSqft > 0,                        "PropertyNFT: area must be > 0");
        require(bytes(metadataUri).length > 0,       "PropertyNFT: empty URI");

        tokenId = _nextTokenId++;

        _safeMint(to, tokenId);
        _setTokenURI(tokenId, metadataUri);

        properties[tokenId] = Property({
            tokenId:         tokenId,
            propertyAddress: propertyAddress,
            areaSqft:        areaSqft,
            valuation:       valuation,
            verified:        false,
            mintedAt:        block.timestamp
        });

        emit PropertyMinted(tokenId, to, propertyAddress, areaSqft, valuation);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Core: Verify
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Mark a property as verified (or revoke verification).
     * @dev    Only admin. Verified properties can be listed on Marketplace/Auction.
     * @param  tokenId   The token to verify.
     */
    function verifyProperty(uint256 tokenId) external onlyOwner {
        require(_ownerOf(tokenId) != address(0), "PropertyNFT: token does not exist");
        properties[tokenId].verified = true;
        emit PropertyVerified(tokenId, true);
    }

    /**
     * @notice Revoke verification for a property.
     * @param  tokenId  The token to unverify.
     */
    function unverifyProperty(uint256 tokenId) external onlyOwner {
        require(_ownerOf(tokenId) != address(0), "PropertyNFT: token does not exist");
        properties[tokenId].verified = false;
        emit PropertyVerified(tokenId, false);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Core: Update URI
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Update the IPFS metadata URI for a token.
     * @dev    Only the current token owner may update their own URI.
     * @param  tokenId     The token to update.
     * @param  newUri      New IPFS URI.
     */
    function updateTokenURI(uint256 tokenId, string calldata newUri)
        external
    {
        require(ownerOf(tokenId) == msg.sender, "PropertyNFT: not token owner");
        require(bytes(newUri).length > 0,        "PropertyNFT: empty URI");
        _setTokenURI(tokenId, newUri);
        emit TokenURIUpdated(tokenId);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Views
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Returns true if the given token is verified by the platform admin.
     */
    function isVerified(uint256 tokenId) external view returns (bool) {
        return properties[tokenId].verified;
    }

    /**
     * @notice Returns the full Property struct for a given tokenId.
     */
    function getProperty(uint256 tokenId)
        external
        view
        returns (Property memory)
    {
        require(_ownerOf(tokenId) != address(0), "PropertyNFT: token does not exist");
        return properties[tokenId];
    }

    /**
     * @notice Returns the total number of tokens minted so far.
     */
    function totalMinted() external view returns (uint256) {
        return _nextTokenId - 1;
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Overrides required by Solidity for multiple inheritance
    // ─────────────────────────────────────────────────────────────────────────

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    // Required by OZ v4: ERC721URIStorage overrides _burn internally to
    // clear the stored URI, so the derived contract must explicitly resolve
    // which _burn to call when both ERC721 and ERC721URIStorage define it.
    function _burn(uint256 tokenId)
        internal
        override(ERC721, ERC721URIStorage)
    {
        super._burn(tokenId);
    }
}

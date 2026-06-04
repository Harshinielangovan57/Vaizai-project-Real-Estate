// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title  AgreementSigner
 * @notice On-chain digital deed signature for real-estate property sales.
 *
 * Flow:
 *   1. Backend (or seller) calls createAgreement() with the keccak256 hash of
 *      the PDF agreement uploaded to IPFS, linking it to a tokenId, seller,
 *      and buyer.
 *   2. Seller calls signAgreement(agreementId)  → their wallet confirms.
 *   3. Buyer  calls signAgreement(agreementId)  → their wallet confirms.
 *   4. Once both have signed, AgreementCompleted is emitted — the backend
 *      listens for this event to unlock the escrow release step.
 *
 * Document integrity:
 *   - Frontend can call verifyDocumentHash() before prompting a signature to
 *     confirm the IPFS document matches the on-chain hash.
 */
contract AgreementSigner is Ownable {

    // ─────────────────────────────────────────────────────────────────────────
    //  Structs
    // ─────────────────────────────────────────────────────────────────────────

    struct Agreement {
        uint256 agreementId;
        uint256 tokenId;            // property NFT this agreement covers
        address seller;
        address buyer;
        bytes32 documentHash;       // keccak256 of the PDF (stored on IPFS)
        string  ipfsUri;            // IPFS URI of the agreement PDF
        bool    sellerSigned;
        bool    buyerSigned;
        uint256 sellerSignedAt;     // unix timestamp of seller signature (0 if unsigned)
        uint256 buyerSignedAt;      // unix timestamp of buyer  signature (0 if unsigned)
        uint256 createdAt;
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  State
    // ─────────────────────────────────────────────────────────────────────────

    uint256 private _nextAgreementId = 1;

    /// agreementId → Agreement
    mapping(uint256 => Agreement) public agreements;

    /// tokenId → latest agreementId (convenience lookup)
    mapping(uint256 => uint256) public tokenToAgreement;

    // ─────────────────────────────────────────────────────────────────────────
    //  Events
    // ─────────────────────────────────────────────────────────────────────────

    event AgreementCreated(
        uint256 indexed agreementId,
        uint256 indexed tokenId,
        address indexed seller,
        address buyer,
        bytes32 documentHash,
        string  ipfsUri
    );

    event AgreementSigned(
        uint256 indexed agreementId,
        uint256 indexed tokenId,
        address indexed signer,
        bool    isSellerSignature
    );

    event AgreementCompleted(
        uint256 indexed agreementId,
        uint256 indexed tokenId,
        address seller,
        address buyer
    );

    // ─────────────────────────────────────────────────────────────────────────
    //  Constructor
    // ─────────────────────────────────────────────────────────────────────────

    constructor() Ownable() {}

    // ─────────────────────────────────────────────────────────────────────────
    //  Core: Create Agreement
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Create a new digital sale agreement tied to a property token.
     * @dev    Called by the backend (platform wallet) or the seller after the
     *         PDF has been uploaded to IPFS.  Only one active (unsigned) agreement
     *         per tokenId is allowed at a time.
     *
     * @param  tokenId       The property NFT this agreement covers.
     * @param  seller        Seller's wallet address.
     * @param  buyer         Buyer's wallet address.
     * @param  documentHash  keccak256 hash of the PDF agreement file.
     * @param  ipfsUri       IPFS URI where the agreement PDF is stored.
     * @return agreementId   The newly created agreement ID.
     */
    function createAgreement(
        uint256 tokenId,
        address seller,
        address buyer,
        bytes32 documentHash,
        string  calldata ipfsUri
    )
        external
        returns (uint256 agreementId)
    {
        require(seller       != address(0),  "AgreementSigner: invalid seller");
        require(buyer        != address(0),  "AgreementSigner: invalid buyer");
        require(seller       != buyer,       "AgreementSigner: seller and buyer must differ");
        require(documentHash != bytes32(0),  "AgreementSigner: invalid document hash");
        require(bytes(ipfsUri).length > 0,   "AgreementSigner: IPFS URI required");

        // Ensure no unsigned agreement already open for this token
        uint256 existing = tokenToAgreement[tokenId];
        if (existing != 0) {
            Agreement storage prev = agreements[existing];
            require(
                prev.sellerSigned && prev.buyerSigned,
                "AgreementSigner: prior agreement for this token is not yet complete"
            );
        }

        agreementId = _nextAgreementId++;

        agreements[agreementId] = Agreement({
            agreementId:    agreementId,
            tokenId:        tokenId,
            seller:         seller,
            buyer:          buyer,
            documentHash:   documentHash,
            ipfsUri:        ipfsUri,
            sellerSigned:   false,
            buyerSigned:    false,
            sellerSignedAt: 0,
            buyerSignedAt:  0,
            createdAt:      block.timestamp
        });

        tokenToAgreement[tokenId] = agreementId;

        emit AgreementCreated(agreementId, tokenId, seller, buyer, documentHash, ipfsUri);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Core: Sign Agreement
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Seller or buyer signs the agreement.
     *         Each party must sign in a separate transaction (separate wallet confirmation).
     *         Emits AgreementCompleted once both parties have signed.
     *
     * @param  agreementId  The agreement to sign.
     */
    function signAgreement(uint256 agreementId) external {
        Agreement storage a = agreements[agreementId];

        require(a.agreementId != 0,                          "AgreementSigner: agreement does not exist");
        require(!(a.sellerSigned && a.buyerSigned),          "AgreementSigner: agreement already complete");
        require(
            msg.sender == a.seller || msg.sender == a.buyer,
            "AgreementSigner: caller is not a party to this agreement"
        );

        bool isSellerSignature;

        if (msg.sender == a.seller) {
            require(!a.sellerSigned, "AgreementSigner: seller has already signed");
            a.sellerSigned   = true;
            a.sellerSignedAt = block.timestamp;
            isSellerSignature = true;
        } else {
            require(!a.buyerSigned, "AgreementSigner: buyer has already signed");
            a.buyerSigned   = true;
            a.buyerSignedAt = block.timestamp;
            isSellerSignature = false;
        }

        emit AgreementSigned(agreementId, a.tokenId, msg.sender, isSellerSignature);

        // If both parties have now signed, emit the completion event
        if (a.sellerSigned && a.buyerSigned) {
            emit AgreementCompleted(agreementId, a.tokenId, a.seller, a.buyer);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Views
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Verify that a given document hash matches the hash stored on-chain.
     *         Frontend calls this before prompting the user to sign, ensuring the
     *         IPFS document has not been tampered with.
     *
     * @param  agreementId    The agreement to check.
     * @param  documentHash   keccak256 hash of the document the frontend fetched from IPFS.
     * @return matches        true if the hashes match.
     */
    function verifyDocumentHash(uint256 agreementId, bytes32 documentHash)
        external
        view
        returns (bool matches)
    {
        return agreements[agreementId].documentHash == documentHash;
    }

    /**
     * @notice Returns the full Agreement struct for a given ID.
     */
    function getAgreement(uint256 agreementId)
        external
        view
        returns (Agreement memory)
    {
        return agreements[agreementId];
    }

    /**
     * @notice Returns the latest agreement ID for a given tokenId.
     *         Returns 0 if no agreement exists for the token.
     */
    function getAgreementByToken(uint256 tokenId)
        external
        view
        returns (uint256 agreementId)
    {
        return tokenToAgreement[tokenId];
    }

    /**
     * @notice Returns whether both parties have signed a given agreement.
     */
    function isComplete(uint256 agreementId) external view returns (bool) {
        Agreement storage a = agreements[agreementId];
        return a.sellerSigned && a.buyerSigned;
    }

    /**
     * @notice Returns individual signing status for both parties.
     */
    function getSigningStatus(uint256 agreementId)
        external
        view
        returns (
            bool sellerSigned,
            bool buyerSigned,
            uint256 sellerSignedAt,
            uint256 buyerSignedAt
        )
    {
        Agreement storage a = agreements[agreementId];
        return (a.sellerSigned, a.buyerSigned, a.sellerSignedAt, a.buyerSignedAt);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title  Escrow
 * @notice Holds ETH securely during a real-estate property sale.
 *
 * State machine per deal:
 *
 *   AWAITING_PAYMENT
 *        │
 *        ▼  (buyer deposits ETH via createDeal)
 *   AWAITING_DELIVERY ──── buyer confirms ──▶ COMPLETE
 *        │
 *        ├── either party raises dispute ──▶ DISPUTED
 *        │                                      │
 *        │                              arbiter resolves
 *        │                               ┌──────┴──────┐
 *        │                               ▼             ▼
 *        │                           COMPLETE       REFUNDED
 *        │
 *        └── timeout exceeded (seller didn't deliver) ──▶ REFUNDED
 *             (buyer calls claimRefund)
 */
contract Escrow is ReentrancyGuard, Ownable {

    // ─────────────────────────────────────────────────────────────────────────
    //  Enums & Structs
    // ─────────────────────────────────────────────────────────────────────────

    enum State {
        AWAITING_PAYMENT,   // 0  — deal created but no funds yet (unused in flow; deal starts funded)
        AWAITING_DELIVERY,  // 1  — funds locked, waiting for seller to deliver
        COMPLETE,           // 2  — buyer confirmed; funds released to seller
        DISPUTED,           // 3  — either party raised a dispute
        REFUNDED            // 4  — buyer received refund
    }

    struct Deal {
        uint256 dealId;
        uint256 tokenId;        // property NFT token ID
        address buyer;
        address seller;
        address arbiter;        // admin / platform arbiter
        uint256 amount;         // ETH locked (wei)
        State   state;
        uint256 deliveryDeadline; // unix timestamp: seller must deliver by this time
        uint256 createdAt;
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  State
    // ─────────────────────────────────────────────────────────────────────────

    /// Default delivery window (configurable by owner)
    uint256 public deliveryWindowDays = 30 days;

    uint256 private _nextDealId = 1;

    /// dealId → Deal
    mapping(uint256 => Deal) public deals;

    /// dealId → history of state-change timestamps (for audit trail)
    mapping(uint256 => uint256[]) public stateHistory; // parallel to StateLog events

    // ─────────────────────────────────────────────────────────────────────────
    //  Events
    // ─────────────────────────────────────────────────────────────────────────

    event DealCreated(
        uint256 indexed dealId,
        uint256 indexed tokenId,
        address indexed buyer,
        address seller,
        address arbiter,
        uint256 amount,
        uint256 deliveryDeadline
    );

    event FundsDeposited(
        uint256 indexed dealId,
        address indexed buyer,
        uint256 amount
    );

    event DealCompleted(
        uint256 indexed dealId,
        uint256 indexed tokenId,
        address indexed seller,
        uint256 amount
    );

    event DisputeRaised(
        uint256 indexed dealId,
        address indexed raisedBy
    );

    event DealRefunded(
        uint256 indexed dealId,
        uint256 indexed tokenId,
        address indexed buyer,
        uint256 amount
    );

    event DisputeResolved(
        uint256 indexed dealId,
        address indexed resolvedBy,
        bool    releasedToSeller   // true = seller paid, false = buyer refunded
    );

    // ─────────────────────────────────────────────────────────────────────────
    //  Constructor
    // ─────────────────────────────────────────────────────────────────────────

    constructor() Ownable() {}

    // ─────────────────────────────────────────────────────────────────────────
    //  Modifiers
    // ─────────────────────────────────────────────────────────────────────────

    modifier onlyBuyer(uint256 dealId) {
        require(deals[dealId].buyer == msg.sender, "Escrow: caller is not the buyer");
        _;
    }

    modifier onlyParticipant(uint256 dealId) {
        Deal storage d = deals[dealId];
        require(
            msg.sender == d.buyer || msg.sender == d.seller,
            "Escrow: caller is not a deal participant"
        );
        _;
    }

    modifier onlyArbiter(uint256 dealId) {
        require(deals[dealId].arbiter == msg.sender, "Escrow: caller is not the arbiter");
        _;
    }

    modifier inState(uint256 dealId, State expected) {
        require(deals[dealId].state == expected, "Escrow: invalid state for this action");
        _;
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Core: Create Deal
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Buyer creates and funds an escrow deal in a single transaction.
     * @dev    msg.value must equal the agreed sale price exactly.
     *         Deal moves straight to AWAITING_DELIVERY on creation.
     *
     * @param  tokenId   The property NFT token ID this deal covers.
     * @param  seller    The seller's wallet address.
     * @param  arbiter   The arbiter (admin) address for dispute resolution.
     * @return dealId    The newly created deal ID.
     */
    function createDeal(
        uint256 tokenId,
        address seller,
        address arbiter
    )
        external
        payable
        nonReentrant
        returns (uint256 dealId)
    {
        require(msg.value > 0,            "Escrow: must deposit ETH");
        require(seller  != address(0),    "Escrow: invalid seller address");
        require(arbiter != address(0),    "Escrow: invalid arbiter address");
        require(seller  != msg.sender,    "Escrow: buyer and seller cannot be the same");
        require(arbiter != msg.sender,    "Escrow: buyer cannot be arbiter");
        require(arbiter != seller,        "Escrow: seller cannot be arbiter");

        dealId = _nextDealId++;

        uint256 deadline = block.timestamp + deliveryWindowDays;

        deals[dealId] = Deal({
            dealId:           dealId,
            tokenId:          tokenId,
            buyer:            msg.sender,
            seller:           seller,
            arbiter:          arbiter,
            amount:           msg.value,
            state:            State.AWAITING_DELIVERY,
            deliveryDeadline: deadline,
            createdAt:        block.timestamp
        });

        _logStateChange(dealId);

        emit DealCreated(dealId, tokenId, msg.sender, seller, arbiter, msg.value, deadline);
        emit FundsDeposited(dealId, msg.sender, msg.value);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Core: Confirm Delivery (Buyer)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Buyer confirms that delivery/transfer has occurred.
     *         Releases locked ETH to the seller and marks deal COMPLETE.
     * @param  dealId  The deal to confirm.
     */
    function confirmDelivery(uint256 dealId)
        external
        nonReentrant
        onlyBuyer(dealId)
        inState(dealId, State.AWAITING_DELIVERY)
    {
        Deal storage d = deals[dealId];

        d.state = State.COMPLETE;
        _logStateChange(dealId);

        uint256 payout = d.amount;
        d.amount = 0;

        (bool ok, ) = d.seller.call{value: payout}("");
        require(ok, "Escrow: seller transfer failed");

        emit DealCompleted(dealId, d.tokenId, d.seller, payout);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Core: Raise Dispute
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Either party (buyer or seller) can raise a dispute.
     *         Locks funds until the arbiter resolves.
     * @param  dealId  The deal to dispute.
     */
    function raiseDispute(uint256 dealId)
        external
        onlyParticipant(dealId)
        inState(dealId, State.AWAITING_DELIVERY)
    {
        deals[dealId].state = State.DISPUTED;
        _logStateChange(dealId);

        emit DisputeRaised(dealId, msg.sender);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Core: Resolve Dispute (Arbiter)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Arbiter resolves a disputed deal.
     * @param  dealId          The disputed deal.
     * @param  releaseToSeller true  → pay seller (deal COMPLETE)
     *                         false → refund buyer (deal REFUNDED)
     */
    function resolveDispute(uint256 dealId, bool releaseToSeller)
        external
        nonReentrant
        onlyArbiter(dealId)
        inState(dealId, State.DISPUTED)
    {
        Deal storage d = deals[dealId];

        uint256 payout = d.amount;
        d.amount = 0;

        if (releaseToSeller) {
            d.state = State.COMPLETE;
            _logStateChange(dealId);

            (bool ok, ) = d.seller.call{value: payout}("");
            require(ok, "Escrow: seller transfer failed");

            emit DealCompleted(dealId, d.tokenId, d.seller, payout);
        } else {
            d.state = State.REFUNDED;
            _logStateChange(dealId);

            (bool ok, ) = d.buyer.call{value: payout}("");
            require(ok, "Escrow: buyer refund failed");

            emit DealRefunded(dealId, d.tokenId, d.buyer, payout);
        }

        emit DisputeResolved(dealId, msg.sender, releaseToSeller);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Core: Automatic Refund Timeout (Buyer)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice If the seller fails to deliver before `deliveryDeadline`,
     *         the buyer can claim an automatic refund without arbiter involvement.
     * @param  dealId  The deal to refund.
     */
    function claimRefund(uint256 dealId)
        external
        nonReentrant
        onlyBuyer(dealId)
        inState(dealId, State.AWAITING_DELIVERY)
    {
        Deal storage d = deals[dealId];
        require(block.timestamp > d.deliveryDeadline, "Escrow: delivery deadline not yet passed");

        d.state = State.REFUNDED;
        _logStateChange(dealId);

        uint256 payout = d.amount;
        d.amount = 0;

        (bool ok, ) = d.buyer.call{value: payout}("");
        require(ok, "Escrow: refund transfer failed");

        emit DealRefunded(dealId, d.tokenId, d.buyer, payout);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Views
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Returns the full Deal struct for a given deal ID.
     */
    function getDeal(uint256 dealId) external view returns (Deal memory) {
        return deals[dealId];
    }

    /**
     * @notice Returns the current state label as a string (for debugging).
     */
    function getDealState(uint256 dealId) external view returns (string memory) {
        State s = deals[dealId].state;
        if (s == State.AWAITING_PAYMENT)  return "AWAITING_PAYMENT";
        if (s == State.AWAITING_DELIVERY) return "AWAITING_DELIVERY";
        if (s == State.COMPLETE)          return "COMPLETE";
        if (s == State.DISPUTED)          return "DISPUTED";
        if (s == State.REFUNDED)          return "REFUNDED";
        return "UNKNOWN";
    }

    /**
     * @notice Returns the audit trail of state-change timestamps for a deal.
     */
    function getStateHistory(uint256 dealId)
        external
        view
        returns (uint256[] memory)
    {
        return stateHistory[dealId];
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Owner Config
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Update the default delivery window applied to new deals.
     * @param  windowInDays  Window length in days (stored as seconds internally).
     */
    function setDeliveryWindow(uint256 windowInDays) external onlyOwner {
        require(windowInDays > 0, "Escrow: window must be > 0");
        deliveryWindowDays = windowInDays * 1 days;
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Internal Helpers
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @dev Records a timestamp for every state transition — audit trail.
     */
    function _logStateChange(uint256 dealId) internal {
        stateHistory[dealId].push(block.timestamp);
    }
}

// test/RealEstateNFT.test.js
//
// Full test suite for the Real Estate NFT Marketplace contracts.
// Run with: npx hardhat test
// Run with gas report: REPORT_GAS=true npx hardhat test

const { expect }      = require("chai");
const { ethers }      = require("hardhat");
const { time }        = require("@nomicfoundation/hardhat-network-helpers");

// ─────────────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────────────

const toWei  = (eth) => ethers.parseEther(eth.toString());
const ZERO   = ethers.ZeroAddress;

// ─────────────────────────────────────────────────────────────────────────────
//  Shared fixture
// ─────────────────────────────────────────────────────────────────────────────

async function deployAll() {
  const [owner, seller, buyer, arbiter, other] = await ethers.getSigners();

  const PropertyNFT     = await ethers.getContractFactory("PropertyNFT");
  const Marketplace     = await ethers.getContractFactory("Marketplace");
  const Escrow          = await ethers.getContractFactory("Escrow");
  const Auction         = await ethers.getContractFactory("Auction");
  const AgreementSigner = await ethers.getContractFactory("AgreementSigner");

  const propertyNFT     = await PropertyNFT.deploy();
  const marketplace     = await Marketplace.deploy(await propertyNFT.getAddress());
  const escrow          = await Escrow.deploy();
  const auction         = await Auction.deploy(await propertyNFT.getAddress());
  const agreementSigner = await AgreementSigner.deploy();

  return { propertyNFT, marketplace, escrow, auction, agreementSigner,
           owner, seller, buyer, arbiter, other };
}

// Helper: mint + verify a property token, returns tokenId (1-indexed)
async function mintAndVerify(propertyNFT, owner, recipient) {
  const tx = await propertyNFT.connect(owner).mintProperty(
    recipient.address,
    "123 Main St",
    1500,
    toWei(400_000),
    "ipfs://QmMetadata"
  );
  const receipt = await tx.wait();
  const event   = receipt.logs
    .map((l) => { try { return propertyNFT.interface.parseLog(l); } catch { return null; } })
    .find((e) => e && e.name === "PropertyMinted");
  const tokenId = event.args.tokenId;

  await propertyNFT.connect(owner).verifyProperty(tokenId);
  return tokenId;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Test suites
// ─────────────────────────────────────────────────────────────────────────────

describe("PropertyNFT", function () {
  let ctx;
  beforeEach(async () => { ctx = await deployAll(); });

  it("owner can mint a property token", async () => {
    const { propertyNFT, owner, seller } = ctx;
    await expect(
      propertyNFT.connect(owner).mintProperty(
        seller.address, "1 Test St", 1000, toWei(300_000), "ipfs://QmTest"
      )
    ).to.emit(propertyNFT, "PropertyMinted");
  });

  it("non-owner cannot mint", async () => {
    const { propertyNFT, seller } = ctx;
    await expect(
      propertyNFT.connect(seller).mintProperty(
        seller.address, "1 Test St", 1000, toWei(300_000), "ipfs://QmTest"
      )
    ).to.be.revertedWith("Ownable: caller is not the owner");
  });

  it("admin can verify a property", async () => {
    const { propertyNFT, owner, seller } = ctx;
    const tokenId = await mintAndVerify(propertyNFT, owner, seller);
    expect(await propertyNFT.isVerified(tokenId)).to.equal(true);
  });

  it("owner can update token URI", async () => {
    const { propertyNFT, owner, seller } = ctx;
    const tokenId = await mintAndVerify(propertyNFT, owner, seller);
    await expect(
      propertyNFT.connect(seller).updateTokenURI(tokenId, "ipfs://QmUpdated")
    ).to.emit(propertyNFT, "TokenURIUpdated").withArgs(tokenId);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("Marketplace", function () {
  let ctx, tokenId;

  beforeEach(async () => {
    ctx = await deployAll();
    const { propertyNFT, marketplace, owner, seller } = ctx;
    tokenId = await mintAndVerify(propertyNFT, owner, seller);
    // Approve marketplace to hold NFT
    await propertyNFT.connect(seller).approve(await marketplace.getAddress(), tokenId);
  });

  // ── Listing ────────────────────────────────────────────────────────────────

  it("seller can list a verified property", async () => {
    const { marketplace, seller } = ctx;
    await expect(
      marketplace.connect(seller).listProperty(tokenId, toWei(1))
    ).to.emit(marketplace, "Listed");
  });

  it("cannot list an unverified property", async () => {
    const { propertyNFT, marketplace, owner, seller } = ctx;
    const tx = await propertyNFT.connect(owner).mintProperty(
      seller.address, "Unverified St", 800, toWei(200_000), "ipfs://QmUnverified"
    );
    const receipt = await tx.wait();
    const event   = receipt.logs
      .map((l) => { try { return propertyNFT.interface.parseLog(l); } catch { return null; } })
      .find((e) => e && e.name === "PropertyMinted");
    const unverifiedId = event.args.tokenId;

    await propertyNFT.connect(seller).approve(await marketplace.getAddress(), unverifiedId);

    await expect(
      marketplace.connect(seller).listProperty(unverifiedId, toWei(1))
    ).to.be.revertedWith("Marketplace: property not verified");
  });

  it("cannot list below minimum price", async () => {
    const { marketplace, seller } = ctx;
    await expect(
      marketplace.connect(seller).listProperty(tokenId, toWei(0.0001))
    ).to.be.revertedWith("Marketplace: price too low");
  });

  // ── Buying ────────────────────────────────────────────────────────────────

  it("buyer can purchase a listing and receives NFT", async () => {
    const { propertyNFT, marketplace, seller, buyer } = ctx;
    const price = toWei(1);
    const tx    = await marketplace.connect(seller).listProperty(tokenId, price);
    const rcpt  = await tx.wait();
    const ev    = rcpt.logs
      .map((l) => { try { return marketplace.interface.parseLog(l); } catch { return null; } })
      .find((e) => e && e.name === "Listed");
    const listingId = ev.args.listingId;

    await expect(
      marketplace.connect(buyer).buyProperty(listingId, { value: price })
    ).to.emit(marketplace, "Sold");

    expect(await propertyNFT.ownerOf(tokenId)).to.equal(buyer.address);
  });

  it("platform fee is deducted on sale", async () => {
    const { marketplace, seller, buyer } = ctx;
    const price     = toWei(1);
    const tx        = await marketplace.connect(seller).listProperty(tokenId, price);
    const rcpt      = await tx.wait();
    const listingId = rcpt.logs
      .map((l) => { try { return marketplace.interface.parseLog(l); } catch { return null; } })
      .find((e) => e && e.name === "Listed").args.listingId;

    const sellerBefore = await ethers.provider.getBalance(seller.address);
    await marketplace.connect(buyer).buyProperty(listingId, { value: price });
    const sellerAfter  = await ethers.provider.getBalance(seller.address);

    // Seller receives price minus 2.5% fee
    const expectedNet = price - (price * 250n / 10_000n);
    expect(sellerAfter - sellerBefore).to.equal(expectedNet);
  });

  it("excess ETH is refunded to buyer", async () => {
    const { marketplace, seller, buyer } = ctx;
    const price     = toWei(1);
    const tx        = await marketplace.connect(seller).listProperty(tokenId, price);
    const rcpt      = await tx.wait();
    const listingId = rcpt.logs
      .map((l) => { try { return marketplace.interface.parseLog(l); } catch { return null; } })
      .find((e) => e && e.name === "Listed").args.listingId;

    const buyerBefore = await ethers.provider.getBalance(buyer.address);
    const buyTx       = await marketplace.connect(buyer).buyProperty(
      listingId, { value: toWei(2) }   // overpay by 1 ETH
    );
    const buyRcpt   = await buyTx.wait();
    const gasCost   = buyRcpt.gasUsed * buyTx.gasPrice;
    const buyerAfter = await ethers.provider.getBalance(buyer.address);

    // Buyer should have only spent ~price + gas (not the 1 ETH overpay)
    expect(buyerBefore - buyerAfter).to.be.closeTo(price + gasCost, toWei(0.001));
  });

  // ── Cancel ────────────────────────────────────────────────────────────────

  it("seller can cancel a listing and gets NFT back", async () => {
    const { propertyNFT, marketplace, seller } = ctx;
    const tx        = await marketplace.connect(seller).listProperty(tokenId, toWei(1));
    const rcpt      = await tx.wait();
    const listingId = rcpt.logs
      .map((l) => { try { return marketplace.interface.parseLog(l); } catch { return null; } })
      .find((e) => e && e.name === "Listed").args.listingId;

    await expect(
      marketplace.connect(seller).cancelListing(listingId)
    ).to.emit(marketplace, "ListingCancelled");

    expect(await propertyNFT.ownerOf(tokenId)).to.equal(seller.address);
  });

  it("non-seller cannot cancel", async () => {
    const { marketplace, seller, buyer } = ctx;
    const tx        = await marketplace.connect(seller).listProperty(tokenId, toWei(1));
    const rcpt      = await tx.wait();
    const listingId = rcpt.logs
      .map((l) => { try { return marketplace.interface.parseLog(l); } catch { return null; } })
      .find((e) => e && e.name === "Listed").args.listingId;

    await expect(
      marketplace.connect(buyer).cancelListing(listingId)
    ).to.be.revertedWith("Marketplace: not the seller");
  });

  // ── Update Price ──────────────────────────────────────────────────────────

  it("seller can update listing price", async () => {
    const { marketplace, seller } = ctx;
    const tx        = await marketplace.connect(seller).listProperty(tokenId, toWei(1));
    const rcpt      = await tx.wait();
    const listingId = rcpt.logs
      .map((l) => { try { return marketplace.interface.parseLog(l); } catch { return null; } })
      .find((e) => e && e.name === "Listed").args.listingId;

    await expect(
      marketplace.connect(seller).updatePrice(listingId, toWei(2))
    ).to.emit(marketplace, "PriceUpdated").withArgs(listingId, tokenId, toWei(2));
  });

  // ── Active Listings ───────────────────────────────────────────────────────

  it("getActiveListingIds returns only active listings", async () => {
    const { marketplace, seller } = ctx;
    await marketplace.connect(seller).listProperty(tokenId, toWei(1));
    const ids = await marketplace.getActiveListingIds();
    expect(ids.length).to.equal(1);
  });

  // ── Owner Config ──────────────────────────────────────────────────────────

  it("owner can update fee basis points", async () => {
    const { marketplace, owner } = ctx;
    await marketplace.connect(owner).setFeeBasisPoints(300);
    expect(await marketplace.feeBasisPoints()).to.equal(300);
  });

  it("cannot set fee above 10%", async () => {
    const { marketplace, owner } = ctx;
    await expect(
      marketplace.connect(owner).setFeeBasisPoints(1001)
    ).to.be.revertedWith("Marketplace: fee too high (max 10%)");
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("Escrow", function () {
  let ctx, tokenId;

  beforeEach(async () => {
    ctx     = await deployAll();
    tokenId = await mintAndVerify(ctx.propertyNFT, ctx.owner, ctx.seller);
  });

  async function createDeal(amount) {
    const { escrow, buyer, seller, arbiter } = ctx;
    const tx = await escrow.connect(buyer).createDeal(
      tokenId, seller.address, arbiter.address, { value: amount }
    );
    const rcpt  = await tx.wait();
    const event = rcpt.logs
      .map((l) => { try { return escrow.interface.parseLog(l); } catch { return null; } })
      .find((e) => e && e.name === "DealCreated");
    return event.args.dealId;
  }

  it("buyer can create a deal and funds are locked", async () => {
    const { escrow } = ctx;
    const amount  = toWei(1);
    const dealId  = await createDeal(amount);
    const deal    = await escrow.getDeal(dealId);
    expect(deal.amount).to.equal(amount);
    expect(deal.state).to.equal(1); // AWAITING_DELIVERY
  });

  it("buyer can confirm delivery and seller receives funds", async () => {
    const { escrow, buyer, seller } = ctx;
    const amount        = toWei(1);
    const dealId        = await createDeal(amount);
    const sellerBefore  = await ethers.provider.getBalance(seller.address);

    await expect(
      escrow.connect(buyer).confirmDelivery(dealId)
    ).to.emit(escrow, "DealCompleted");

    const sellerAfter = await ethers.provider.getBalance(seller.address);
    expect(sellerAfter - sellerBefore).to.equal(amount);
  });

  it("either party can raise a dispute", async () => {
    const { escrow, buyer } = ctx;
    const dealId = await createDeal(toWei(1));
    await expect(
      escrow.connect(buyer).raiseDispute(dealId)
    ).to.emit(escrow, "DisputeRaised");
    expect((await escrow.getDeal(dealId)).state).to.equal(3); // DISPUTED
  });

  it("arbiter can resolve dispute in seller's favour", async () => {
    const { escrow, buyer, seller, arbiter } = ctx;
    const amount = toWei(1);
    const dealId = await createDeal(amount);
    await escrow.connect(buyer).raiseDispute(dealId);

    const sellerBefore = await ethers.provider.getBalance(seller.address);
    await escrow.connect(arbiter).resolveDispute(dealId, true);
    const sellerAfter  = await ethers.provider.getBalance(seller.address);

    expect(sellerAfter - sellerBefore).to.equal(amount);
    expect((await escrow.getDeal(dealId)).state).to.equal(2); // COMPLETE
  });

  it("arbiter can resolve dispute in buyer's favour (refund)", async () => {
    const { escrow, buyer, arbiter } = ctx;
    const amount = toWei(1);
    const dealId = await createDeal(amount);
    await escrow.connect(buyer).raiseDispute(dealId);

    const buyerBefore = await ethers.provider.getBalance(buyer.address);
    await escrow.connect(arbiter).resolveDispute(dealId, false);
    const buyerAfter  = await ethers.provider.getBalance(buyer.address);

    expect(buyerAfter - buyerBefore).to.equal(amount);
    expect((await escrow.getDeal(dealId)).state).to.equal(4); // REFUNDED
  });

  it("buyer can claim refund after delivery deadline", async () => {
    const { escrow, buyer } = ctx;
    const amount = toWei(1);
    const dealId = await createDeal(amount);

    // Fast-forward past the delivery deadline (30 days default)
    await time.increase(31 * 24 * 60 * 60);

    const buyerBefore = await ethers.provider.getBalance(buyer.address);
    const tx          = await escrow.connect(buyer).claimRefund(dealId);
    const rcpt        = await tx.wait();
    const gasCost     = rcpt.gasUsed * tx.gasPrice;
    const buyerAfter  = await ethers.provider.getBalance(buyer.address);

    expect(buyerAfter - buyerBefore + gasCost).to.equal(amount);
    expect((await escrow.getDeal(dealId)).state).to.equal(4); // REFUNDED
  });

  it("cannot claim refund before deadline", async () => {
    const { escrow, buyer } = ctx;
    const dealId = await createDeal(toWei(1));
    await expect(
      escrow.connect(buyer).claimRefund(dealId)
    ).to.be.revertedWith("Escrow: delivery deadline not yet passed");
  });

  it("third party cannot raise a dispute", async () => {
    const { escrow, other } = ctx;
    const dealId = await createDeal(toWei(1));
    await expect(
      escrow.connect(other).raiseDispute(dealId)
    ).to.be.revertedWith("Escrow: caller is not a deal participant");
  });

  it("state history is recorded on each transition", async () => {
    const { escrow, buyer } = ctx;
    const dealId  = await createDeal(toWei(1));
    await escrow.connect(buyer).confirmDelivery(dealId);
    const history = await escrow.getStateHistory(dealId);
    expect(history.length).to.equal(2); // createDeal + confirmDelivery
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("Auction", function () {
  let ctx, tokenId;

  beforeEach(async () => {
    ctx     = await deployAll();
    tokenId = await mintAndVerify(ctx.propertyNFT, ctx.owner, ctx.seller);
    await ctx.propertyNFT.connect(ctx.seller).approve(
      await ctx.auction.getAddress(), tokenId
    );
  });

  const DURATION = 60 * 60; // 1 hour in seconds

  async function createAuction(startingPrice = toWei(0.5)) {
    const { auction, seller } = ctx;
    const tx    = await auction.connect(seller).createAuction(tokenId, startingPrice, DURATION);
    const rcpt  = await tx.wait();
    const event = rcpt.logs
      .map((l) => { try { return auction.interface.parseLog(l); } catch { return null; } })
      .find((e) => e && e.name === "AuctionCreated");
    return event.args.auctionId;
  }

  it("seller can create an auction and NFT is held in contract", async () => {
    const { auction, propertyNFT } = ctx;
    const auctionId = await createAuction();
    expect(await propertyNFT.ownerOf(tokenId)).to.equal(await auction.getAddress());
    expect((await auction.getAuction(auctionId)).seller).to.equal(ctx.seller.address);
  });

  it("buyer can place a valid bid", async () => {
    const { auction, buyer } = ctx;
    const auctionId = await createAuction();
    await expect(
      auction.connect(buyer).placeBid(auctionId, { value: toWei(1) })
    ).to.emit(auction, "BidPlaced");
    expect((await auction.getAuction(auctionId)).highestBid).to.equal(toWei(1));
  });

  it("bid below floor is rejected", async () => {
    const { auction, buyer } = ctx;
    const auctionId = await createAuction(toWei(1));
    await expect(
      auction.connect(buyer).placeBid(auctionId, { value: toWei(0.5) })
    ).to.be.revertedWith("Auction: bid too low");
  });

  it("outbid funds are queued for withdrawal", async () => {
    const { auction, buyer, other } = ctx;
    const auctionId = await createAuction();
    await auction.connect(buyer).placeBid(auctionId, { value: toWei(1) });
    await auction.connect(other).placeBid(auctionId, { value: toWei(2) });

    const pending = await auction.getPendingReturn(auctionId, buyer.address);
    expect(pending).to.equal(toWei(1));
  });

  it("outbid user can withdraw their ETH", async () => {
    const { auction, buyer, other } = ctx;
    const auctionId  = await createAuction();
    await auction.connect(buyer).placeBid(auctionId, { value: toWei(1) });
    await auction.connect(other).placeBid(auctionId, { value: toWei(2) });

    const before = await ethers.provider.getBalance(buyer.address);
    const tx     = await auction.connect(buyer).withdraw(auctionId);
    const rcpt   = await tx.wait();
    const gas    = rcpt.gasUsed * tx.gasPrice;
    const after  = await ethers.provider.getBalance(buyer.address);

    expect(after - before + gas).to.equal(toWei(1));
  });

  it("anti-sniping extends endTime on late bid", async () => {
    const { auction, buyer } = ctx;
    const auctionId  = await createAuction();
    const before     = (await auction.getAuction(auctionId)).endTime;

    // Jump to 3 minutes before end (inside the 5-minute snipe window)
    await time.increase(DURATION - 3 * 60);

    await auction.connect(buyer).placeBid(auctionId, { value: toWei(1) });
    const after = (await auction.getAuction(auctionId)).endTime;

    // endTime should be strictly greater than the original endTime
    // (extended by 5 minutes from time of bid, not from auction start)
    expect(after).to.be.greaterThan(before);
  });

  it("finalize with winner: NFT goes to winner, ETH to seller", async () => {
    const { auction, propertyNFT, seller, buyer } = ctx;
    const auctionId    = await createAuction();
    const bidAmount    = toWei(2);
    await auction.connect(buyer).placeBid(auctionId, { value: bidAmount });

    await time.increase(DURATION + 1);

    const sellerBefore = await ethers.provider.getBalance(seller.address);
    await auction.connect(buyer).finalizeAuction(auctionId);
    const sellerAfter  = await ethers.provider.getBalance(seller.address);

    expect(await propertyNFT.ownerOf(tokenId)).to.equal(buyer.address);
    expect(sellerAfter - sellerBefore).to.equal(bidAmount);
  });

  it("finalize with no bids: NFT returned to seller", async () => {
    const { auction, propertyNFT, seller, buyer } = ctx;
    const auctionId = await createAuction();

    await time.increase(DURATION + 1);
    await auction.connect(buyer).finalizeAuction(auctionId);

    expect(await propertyNFT.ownerOf(tokenId)).to.equal(seller.address);
  });

  it("cannot finalize before endTime", async () => {
    const { auction, buyer } = ctx;
    const auctionId = await createAuction();
    await expect(
      auction.connect(buyer).finalizeAuction(auctionId)
    ).to.be.revertedWith("Auction: not yet ended");
  });

  it("getActiveAuctionIds returns active auctions", async () => {
    const { auction } = ctx;
    await createAuction();
    const ids = await auction.getActiveAuctionIds();
    expect(ids.length).to.equal(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("AgreementSigner", function () {
  let ctx, tokenId, docHash, ipfsUri;

  beforeEach(async () => {
    ctx     = await deployAll();
    tokenId = await mintAndVerify(ctx.propertyNFT, ctx.owner, ctx.seller);
    docHash = ethers.keccak256(ethers.toUtf8Bytes("sale-agreement-v1.pdf"));
    ipfsUri = "ipfs://QmAgreementHash";
  });

  async function createAgreement() {
    const { agreementSigner, seller, buyer } = ctx;
    const tx    = await agreementSigner.connect(seller).createAgreement(
      tokenId, seller.address, buyer.address, docHash, ipfsUri
    );
    const rcpt  = await tx.wait();
    const event = rcpt.logs
      .map((l) => { try { return agreementSigner.interface.parseLog(l); } catch { return null; } })
      .find((e) => e && e.name === "AgreementCreated");
    return event.args.agreementId;
  }

  it("can create an agreement", async () => {
    const { agreementSigner, seller, buyer } = ctx;
    await expect(
      agreementSigner.connect(seller).createAgreement(
        tokenId, seller.address, buyer.address, docHash, ipfsUri
      )
    ).to.emit(agreementSigner, "AgreementCreated");
  });

  it("seller can sign the agreement", async () => {
    const { agreementSigner, seller } = ctx;
    const agreementId = await createAgreement();
    await expect(
      agreementSigner.connect(seller).signAgreement(agreementId)
    ).to.emit(agreementSigner, "AgreementSigned");
  });

  it("AgreementCompleted emitted only after both parties sign", async () => {
    const { agreementSigner, seller, buyer } = ctx;
    const agreementId = await createAgreement();

    // Only seller signs — no completion yet
    await agreementSigner.connect(seller).signAgreement(agreementId);
    expect(await agreementSigner.isComplete(agreementId)).to.equal(false);

    // Buyer signs — now completed
    await expect(
      agreementSigner.connect(buyer).signAgreement(agreementId)
    ).to.emit(agreementSigner, "AgreementCompleted");

    expect(await agreementSigner.isComplete(agreementId)).to.equal(true);
  });

  it("third party cannot sign", async () => {
    const { agreementSigner, other } = ctx;
    const agreementId = await createAgreement();
    await expect(
      agreementSigner.connect(other).signAgreement(agreementId)
    ).to.be.revertedWith("AgreementSigner: caller is not a party to this agreement");
  });

  it("cannot sign twice", async () => {
    const { agreementSigner, seller } = ctx;
    const agreementId = await createAgreement();
    await agreementSigner.connect(seller).signAgreement(agreementId);
    await expect(
      agreementSigner.connect(seller).signAgreement(agreementId)
    ).to.be.revertedWith("AgreementSigner: seller has already signed");
  });

  it("verifyDocumentHash returns true for correct hash", async () => {
    const { agreementSigner } = ctx;
    const agreementId = await createAgreement();
    expect(
      await agreementSigner.verifyDocumentHash(agreementId, docHash)
    ).to.equal(true);
  });

  it("verifyDocumentHash returns false for wrong hash", async () => {
    const { agreementSigner } = ctx;
    const agreementId = await createAgreement();
    const wrongHash   = ethers.keccak256(ethers.toUtf8Bytes("tampered.pdf"));
    expect(
      await agreementSigner.verifyDocumentHash(agreementId, wrongHash)
    ).to.equal(false);
  });

  it("getSigningStatus tracks timestamps", async () => {
    const { agreementSigner, seller, buyer } = ctx;
    const agreementId = await createAgreement();
    await agreementSigner.connect(seller).signAgreement(agreementId);

    const status = await agreementSigner.getSigningStatus(agreementId);
    expect(status.sellerSigned).to.equal(true);
    expect(status.buyerSigned).to.equal(false);
    expect(status.sellerSignedAt).to.be.greaterThan(0n);
    expect(status.buyerSignedAt).to.equal(0n);
  });

  it("cannot open a second agreement for a token with an active one", async () => {
    const { agreementSigner, seller, buyer } = ctx;
    await createAgreement(); // first agreement (unsigned)
    await expect(
      agreementSigner.connect(seller).createAgreement(
        tokenId, seller.address, buyer.address, docHash, ipfsUri
      )
    ).to.be.revertedWith("AgreementSigner: prior agreement for this token is not yet complete");
  });
});
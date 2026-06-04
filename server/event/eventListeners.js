const ethers    = require('ethers');
const contracts = require('../config/contracts');

const Property  = require('../properties/propertyModel');
const Listing   = require('../marketplace/listingModel');
const Escrow    = require('../escrow/escrowModel');
const Auction   = require('../auction/auctionModel');
const Agreement = require('../agreements/agreementModel');
const User      = require('../auth/userModel');
const { settleAuctionInternal } = require('../auction/auctionController');

/* ─── Retry helper ───────────────────────────────────────────────────── */
const withRetry = async (label, fn, retries = 5, delayMs = 500) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries - 1) {
        console.error(`[Event:${label}] Failed after ${retries} attempts:`, err.message);
        return;
      }
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
};

module.exports = (io) => {
  const provider = new ethers.JsonRpcProvider(
    process.env.HARDHAT_RPC_URL || 'http://localhost:8545'
  );

  const {
    PropertyNFT,
    Marketplace,
    Escrow:          EscrowContract,
    Auction:         AuctionContract,
    AgreementSigner: AgreementSignerContract,
  } = contracts.getContracts(provider);

  /* ══════════════════════════════════════════════════════════════════
     PROPERTY NFT
     Real events: PropertyMinted, PropertyVerified, TokenURIUpdated
  ══════════════════════════════════════════════════════════════════ */

  PropertyNFT.on('PropertyMinted', async (tokenId, owner, tokenURI, physicalAddress, squareFeet) => {
    console.log(`[PropertyNFT] PropertyMinted — tokenId: ${tokenId}, owner: ${owner}`);
    await withRetry('PropertyMinted', async () => {
      const updated = await Property.findOneAndUpdate(
        { ownerAddress: owner.toLowerCase(), tokenized: false },
        {
          tokenId:         Number(tokenId),
          tokenized:       true,
          ipfsMetadataUri: tokenURI,
        },
        { new: true }
      );
      if (updated) {
        io.emit('property:minted', {
          tokenId:    Number(tokenId),
          owner:      owner.toLowerCase(),
          propertyId: updated._id,
        });
      }
    });
  });

  // Real signature: PropertyVerified(uint256 indexed tokenId, bool verified)
  PropertyNFT.on('PropertyVerified', async (tokenId, verified) => {
    console.log(`[PropertyNFT] PropertyVerified — tokenId: ${tokenId}`);
    await withRetry('PropertyVerified', async () => {
      const property = await Property.findOneAndUpdate(
        { tokenId: Number(tokenId) },
        { verified: Boolean(verified) },
        { new: true }
      );
      if (property) {
        io.emit('property:verified', { tokenId: Number(tokenId), propertyId: property._id });
      }
    });
  });

  /* ══════════════════════════════════════════════════════════════════
     MARKETPLACE
     Real events: Listed, Sold, ListingCancelled, PriceUpdated
  ══════════════════════════════════════════════════════════════════ */

  Marketplace.on('Listed', async (listingId, tokenId, seller, price, event) => {
    console.log(`[Marketplace] Listed — listingId: ${listingId}, tokenId: ${tokenId}`);
    await withRetry('Listed', async () => {
      await Listing.findOneAndUpdate(
        { tokenId: Number(tokenId), active: true, listingId: null },
        { listingId: Number(listingId), txHash: event.log.transactionHash },
        { new: true }
      );
      io.emit('listing:created', {
        listingId: Number(listingId),
        tokenId:   Number(tokenId),
        seller:    seller.toLowerCase(),
        priceEth:  parseFloat(ethers.formatEther(price)),
      });
    });
  });

  Marketplace.on('Sold', async (listingId, tokenId, buyer, price, event) => {
    console.log(`[Marketplace] Sold — listingId: ${listingId}, buyer: ${buyer}`);
    await withRetry('Sold', async () => {
      const listing = await Listing.findOne({ listingId: Number(listingId) });
      if (!listing || !listing.active) return;

      listing.active        = false;
      listing.soldTxHash    = event.log.transactionHash;
      listing.buyerAddress  = buyer.toLowerCase();
      listing.paymentMethod = 'crypto';
      listing.soldAt        = new Date();
      await listing.save();

      const buyerUser = await User.findOne({ walletAddress: buyer.toLowerCase() });
      await Property.findByIdAndUpdate(listing.propertyId, {
        ownerAddress: buyer.toLowerCase(),
        owner:        buyerUser?._id || listing.seller,
        forSale:      false,
      });

      io.emit('listing:sold', {
        listingId: Number(listingId),
        tokenId:   Number(tokenId),
        buyer:     buyer.toLowerCase(),
        priceEth:  parseFloat(ethers.formatEther(price)),
      });
    });
  });

  Marketplace.on('ListingCancelled', async (listingId, tokenId) => {
    console.log(`[Marketplace] ListingCancelled — listingId: ${listingId}`);
    await withRetry('ListingCancelled', async () => {
      await Listing.findOneAndUpdate({ listingId: Number(listingId) }, { active: false });
      await Property.findOneAndUpdate({ tokenId: Number(tokenId) }, { forSale: false });
      io.emit('listing:cancelled', { listingId: Number(listingId), tokenId: Number(tokenId) });
    });
  });

  Marketplace.on('PriceUpdated', async (listingId, newPrice) => {
    console.log(`[Marketplace] PriceUpdated — listingId: ${listingId}`);
    await withRetry('PriceUpdated', async () => {
      await Listing.findOneAndUpdate(
        { listingId: Number(listingId) },
        { price: newPrice.toString(), priceEth: parseFloat(ethers.formatEther(newPrice)) }
      );
      io.emit('listing:price_updated', {
        listingId: Number(listingId),
        priceEth:  parseFloat(ethers.formatEther(newPrice)),
      });
    });
  });

  /* ══════════════════════════════════════════════════════════════════
     ESCROW
     Real events: DealCreated, FundsDeposited, DealCompleted,
                  DisputeRaised, DealRefunded, DisputeResolved
  ══════════════════════════════════════════════════════════════════ */

  // DealCreated(uint256 dealId, uint256 tokenId, address buyer, address seller, address arbiter)
  EscrowContract.on('DealCreated', async (dealId, tokenId, buyer, seller, arbiter) => {
    console.log(`[Escrow] DealCreated — dealId: ${dealId}, tokenId: ${tokenId}`);
    await withRetry('DealCreated', async () => {
      await Escrow.findOneAndUpdate(
        { tokenId: Number(tokenId), escrowId: null },
        { escrowId: Number(dealId) },
        { upsert: false }
      );
      io.emit('escrow:created', {
        escrowId: Number(dealId),
        tokenId:  Number(tokenId),
        buyer:    buyer.toLowerCase(),
        seller:   seller.toLowerCase(),
      });
    });
  });

  // FundsDeposited(uint256 dealId, address buyer, uint256 amount)
  EscrowContract.on('FundsDeposited', async (dealId, buyer, amount) => {
    console.log(`[Escrow] FundsDeposited — dealId: ${dealId}`);
    await withRetry('FundsDeposited', async () => {
      const escrow = await Escrow.findOneAndUpdate(
        { escrowId: Number(dealId) },
        { status: 'funded' },
        { new: true }
      );
      io.emit('escrow:funded', {
        escrowId: Number(dealId),
        buyer:    buyer.toLowerCase(),
        amount:   parseFloat(ethers.formatEther(amount)),
      });
      if (escrow) {
        io.to(escrow.buyer.toString()).emit('escrow:funded_notify', {
          escrowId: Number(dealId),
          message:  'Your escrow has been funded successfully.',
        });
        io.to(escrow.seller.toString()).emit('escrow:funded_notify', {
          escrowId: Number(dealId),
          message:  'Buyer has funded the escrow.',
        });
      }
    });
  });

  // DealCompleted(uint256 dealId, uint256 tokenId, address seller, uint256 amount)
  EscrowContract.on('DealCompleted', async (dealId, tokenId, seller, amount) => {
    console.log(`[Escrow] DealCompleted — dealId: ${dealId}`);
    await withRetry('DealCompleted', async () => {
      const escrow = await Escrow.findOneAndUpdate(
        { escrowId: Number(dealId) },
        { status: 'completed', completedAt: new Date() },
        { new: true }
      );
      if (escrow) {
        await Property.findByIdAndUpdate(escrow.propertyId, {
          ownerAddress: escrow.buyerAddress,
          owner:        escrow.buyer,
          forSale:      false,
        });
        io.to(escrow.buyer.toString()).emit('escrow:completed_notify', {
          escrowId: Number(dealId),
          message:  'Escrow completed — property ownership transferred.',
        });
        io.to(escrow.seller.toString()).emit('escrow:completed_notify', {
          escrowId: Number(dealId),
          message:  'Escrow completed — funds released.',
        });
      }
      io.emit('escrow:completed', { escrowId: Number(dealId), tokenId: Number(tokenId) });
    });
  });

  // DisputeRaised(uint256 dealId, address raisedBy)
  EscrowContract.on('DisputeRaised', async (dealId, raisedBy) => {
    console.log(`[Escrow] DisputeRaised — dealId: ${dealId}, by: ${raisedBy}`);
    await withRetry('DisputeRaised', async () => {
      await Escrow.findOneAndUpdate(
        { escrowId: Number(dealId) },
        { status: 'disputed' }
      );
      io.emit('admin:alert', {
        type:     'dispute',
        escrowId: Number(dealId),
        raisedBy: raisedBy.toLowerCase(),
        message:  `Dispute raised on escrow #${dealId}`,
        severity: 'high',
      });
      io.emit('escrow:dispute', { escrowId: Number(dealId), raisedBy: raisedBy.toLowerCase() });
    });
  });

  // DealRefunded(uint256 dealId, uint256 tokenId, address buyer, uint256 amount)
  EscrowContract.on('DealRefunded', async (dealId, tokenId, buyer, amount) => {
    console.log(`[Escrow] DealRefunded — dealId: ${dealId}`);
    await withRetry('DealRefunded', async () => {
      const escrow = await Escrow.findOneAndUpdate(
        { escrowId: Number(dealId) },
        { status: 'refunded' },
        { new: true }
      );
      if (escrow) {
        io.to(escrow.buyer.toString()).emit('escrow:refunded_notify', {
          escrowId: Number(dealId),
          amount:   parseFloat(ethers.formatEther(amount)),
          message:  'Your escrow has been refunded.',
        });
      }
      io.emit('escrow:refunded', {
        escrowId: Number(dealId),
        buyer:    buyer.toLowerCase(),
        amount:   parseFloat(ethers.formatEther(amount)),
      });
    });
  });

  // DisputeResolved(uint256 dealId, address resolvedBy, bool releasedToSeller)
  EscrowContract.on('DisputeResolved', async (dealId, resolvedBy, releasedToSeller) => {
    console.log(`[Escrow] DisputeResolved — dealId: ${dealId}, toSeller: ${releasedToSeller}`);
    await withRetry('DisputeResolved', async () => {
      const status = releasedToSeller ? 'completed' : 'refunded';
      await Escrow.findOneAndUpdate(
        { escrowId: Number(dealId) },
        { status, 'dispute.resolvedAt': new Date() }
      );
      io.emit('escrow:dispute_resolved', {
        escrowId:        Number(dealId),
        releasedToSeller,
        resolvedBy:      resolvedBy.toLowerCase(),
      });
    });
  });

  /* ══════════════════════════════════════════════════════════════════
     AUCTION
     Real events: AuctionCreated, BidPlaced, BidWithdrawn, AuctionEnded
  ══════════════════════════════════════════════════════════════════ */

  // AuctionCreated(uint256 auctionId, uint256 tokenId, address seller, uint256 startingPrice, ...)
  AuctionContract.on('AuctionCreated', async (auctionId, tokenId, seller, startingPrice) => {
    console.log(`[Auction] AuctionCreated — auctionId: ${auctionId}, tokenId: ${tokenId}`);
    await withRetry('AuctionCreated', async () => {
      await Auction.findOneAndUpdate(
        { tokenId: Number(tokenId), auctionId: null },
        { auctionId: Number(auctionId) },
        { upsert: false }
      );
      io.emit('auction:created', {
        auctionId:     Number(auctionId),
        tokenId:       Number(tokenId),
        seller:        seller.toLowerCase(),
        startingPrice: parseFloat(ethers.formatEther(startingPrice)),
      });
    });
  });

  // BidPlaced(uint256 auctionId, uint256 tokenId, address bidder, uint256 amount, ...)
  AuctionContract.on('BidPlaced', async (auctionId, tokenId, bidder, amount) => {
    console.log(`[Auction] BidPlaced — auctionId: ${auctionId}, bidder: ${bidder}`);
    await withRetry('BidPlaced', async () => {
      const auction = await Auction.findOne({ auctionId: Number(auctionId) });
      if (!auction) return;

      const alreadyStored = auction.bids.some(
        (b) => b.bidderAddress === bidder.toLowerCase() && b.amount === amount.toString()
      );
      if (!alreadyStored) {
        const bidderUser = await User.findOne({ walletAddress: bidder.toLowerCase() });
        auction.bids.push({
          bidder:        bidderUser?._id || null,
          bidderAddress: bidder.toLowerCase(),
          amount:        amount.toString(),
          amountEth:     parseFloat(ethers.formatEther(amount)),
        });
        auction.highestBid           = amount.toString();
        auction.highestBidEth        = parseFloat(ethers.formatEther(amount));
        auction.highestBidder        = bidderUser?._id || null;
        auction.highestBidderAddress = bidder.toLowerCase();
        if (auction.reservePrice &&
            BigInt(amount.toString()) >= BigInt(auction.reservePrice)) {
          auction.reserveMet = true;
        }
        await auction.save();
      }

      // spec event name: bid:new
      io.emit('bid:new', {
        auctionId:  Number(auctionId),
        tokenId:    Number(tokenId),
        bidder:     bidder.toLowerCase(),
        amountEth:  parseFloat(ethers.formatEther(amount)),
        reserveMet: auction.reserveMet,
        endTime:    auction.endTime,
      });
    });
  });

  // BidWithdrawn(uint256 auctionId, address bidder, uint256 amount)
  AuctionContract.on('BidWithdrawn', async (auctionId, bidder, amount) => {
    console.log(`[Auction] BidWithdrawn — auctionId: ${auctionId}, bidder: ${bidder}`);
    await withRetry('BidWithdrawn', async () => {
      const auction = await Auction.findOne({ auctionId: Number(auctionId) });
      if (!auction) return;
      const bid = [...auction.bids]
        .reverse()
        .find((b) => b.bidderAddress === bidder.toLowerCase() && !b.withdrawn);
      if (bid) { bid.withdrawn = true; await auction.save(); }
      io.emit('auction:bid_withdrawn', {
        auctionId: Number(auctionId),
        bidder:    bidder.toLowerCase(),
        amountEth: parseFloat(ethers.formatEther(amount)),
      });
    });
  });

  // AuctionEnded(uint256 auctionId, uint256 tokenId, address winner, uint256 finalBid)
  AuctionContract.on('AuctionEnded', async (auctionId, tokenId, winner, finalBid) => {
    console.log(`[Auction] AuctionEnded — auctionId: ${auctionId}, winner: ${winner}`);
    await withRetry('AuctionEnded', async () => {
      const auction = await Auction.findOne({ auctionId: Number(auctionId) });
      if (!auction || auction.status === 'settled') return;

      await settleAuctionInternal(auction, io);

      if (winner !== ethers.ZeroAddress) {
        const winnerUser = await User.findOne({ walletAddress: winner.toLowerCase() });
        if (winnerUser) {
          io.to(winnerUser._id.toString()).emit('auction:won', {
            auctionId: Number(auctionId),
            amountEth: parseFloat(ethers.formatEther(finalBid)),
            tokenId:   Number(tokenId),
            message:   `Congratulations! You won auction #${auctionId}`,
          });
        }
      }

      // spec event name: auction:ended
      io.emit('auction:ended', {
        auctionId: Number(auctionId),
        tokenId:   Number(tokenId),
        winner:    winner.toLowerCase(),
        amountEth: parseFloat(ethers.formatEther(finalBid)),
      });
    });
  });

  /* ══════════════════════════════════════════════════════════════════
     AGREEMENT SIGNER
     Real events: AgreementCreated, AgreementSigned, AgreementCompleted
  ══════════════════════════════════════════════════════════════════ */

  // AgreementCreated(uint256 agreementId, uint256 tokenId, address seller, address buyer, bytes32 documentHash)
  AgreementSignerContract.on('AgreementCreated', async (agreementId, tokenId, seller, buyer, documentHash) => {
    console.log(`[AgreementSigner] AgreementCreated — agreementId: ${agreementId}`);
    await withRetry('AgreementCreated', async () => {
      await Agreement.findOneAndUpdate(
        { tokenId: Number(tokenId), agreementId: null },
        { agreementId: Number(agreementId) },
        { new: true }
      );
      io.emit('agreement:created', {
        agreementId: Number(agreementId),
        tokenId:     Number(tokenId),
        seller:      seller.toLowerCase(),
        buyer:       buyer.toLowerCase(),
      });
    });
  });

  // AgreementSigned(uint256 agreementId, uint256 tokenId, address signer, bool isSellerSignature)
  AgreementSignerContract.on('AgreementSigned', async (agreementId, tokenId, signer, isSellerSignature) => {
    console.log(`[AgreementSigner] AgreementSigned — agreementId: ${agreementId}, signer: ${signer}`);
    await withRetry('AgreementSigned', async () => {
      const agreement = await Agreement.findOne({ agreementId: Number(agreementId) });
      if (!agreement) return;

      const signatory = agreement.signatories.find(
        (s) => s.signerAddress === signer.toLowerCase()
      );
      if (signatory && !signatory.signed) {
        signatory.signed   = true;
        signatory.signedAt = new Date();
        await agreement.save();
      }

      io.emit('agreement:signed', {
        agreementId: Number(agreementId),
        tokenId:     Number(tokenId),
        signer:      signer.toLowerCase(),
        isSeller:    isSellerSignature,
      });

      io.to(agreement.createdBy.toString()).emit('agreement:signed_notify', {
        agreementId: Number(agreementId),
        signer:      signer.toLowerCase(),
        message:     `Agreement #${agreementId} signed by ${isSellerSignature ? 'seller' : 'buyer'}`,
      });
    });
  });

  // AgreementCompleted(uint256 agreementId, uint256 tokenId, address seller, address buyer)
  AgreementSignerContract.on('AgreementCompleted', async (agreementId, tokenId, seller, buyer) => {
    console.log(`[AgreementSigner] AgreementCompleted — agreementId: ${agreementId}`);
    await withRetry('AgreementCompleted', async () => {
      const agreement = await Agreement.findOneAndUpdate(
        { agreementId: Number(agreementId) },
        { status: 'on_chain', onChainAt: new Date() },
        { new: true }
      );

      if (agreement?.escrowId) {
        // Unlock escrow release step as per spec 5.1
        io.emit('agreement:completed', {
          agreementId: Number(agreementId),
          escrowId:    agreement.escrowId,
          tokenId:     Number(tokenId),
          message:     'Agreement anchored — escrow release step unlocked.',
        });
      }

      // Notify both parties
      io.to(agreement?.createdBy?.toString()).emit('agreement:completed_notify', {
        agreementId: Number(agreementId),
        message:     'Agreement fully signed and anchored on-chain.',
      });
    });
  });

  /* ─── Provider error handling ────────────────────────────────────── */
  provider.on('error', (err) => {
    console.error('[Provider] Error:', err.message);
  });

  console.log('[Events] ✅ All blockchain event listeners registered');
  console.log('[Events]    PropertyNFT    → PropertyMinted, PropertyVerified');
  console.log('[Events]    Marketplace    → Listed, Sold, ListingCancelled, PriceUpdated');
  console.log('[Events]    Escrow         → DealCreated, FundsDeposited, DealCompleted,');
  console.log('[Events]                     DisputeRaised, DealRefunded, DisputeResolved');
  console.log('[Events]    Auction        → AuctionCreated, BidPlaced, BidWithdrawn, AuctionEnded');
  console.log('[Events]    AgreementSigner→ AgreementCreated, AgreementSigned, AgreementCompleted');
};
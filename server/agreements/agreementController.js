const ethers     = require('ethers');
const { keccak256, toUtf8Bytes } = require('ethers');
const handlebars = require('handlebars');
const puppeteer  = require('puppeteer');
const Agreement  = require('./agreementModel');
const Property   = require('../properties/propertyModel');
const User       = require('../auth/userModel');
const contracts  = require('../config/contracts');
const pinata     = require('../config/pinata');
const {
  createAgreementSchema,
  signAgreementSchema,
  voidAgreementSchema,
} = require('./agreementValidation');

/* ─── Helpers ────────────────────────────────────────────────────────── */

const getProvider = () =>
  new ethers.JsonRpcProvider(process.env.HARDHAT_RPC_URL || 'http://localhost:8545');

const getPlatformWallet = () =>
  new ethers.Wallet(process.env.PLATFORM_WALLET_PRIVATE_KEY, getProvider());

// Agreement HTML template (Handlebars)
const AGREEMENT_TEMPLATE = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <style>
    body       { font-family: Arial, sans-serif; margin: 40px; color: #111; }
    h1         { text-align: center; font-size: 22px; }
    h2         { font-size: 16px; margin-top: 28px; }
    .meta      { font-size: 13px; color: #555; text-align: center; margin-bottom: 20px; }
    .field     { margin: 8px 0; font-size: 14px; }
    .label     { font-weight: bold; min-width: 160px; display: inline-block; }
    .section   { border-top: 1px solid #ddd; padding-top: 16px; margin-top: 16px; }
    .sig-block { margin-top: 40px; }
    .sig-row   { display: flex; justify-content: space-between; margin-top: 24px; }
    .sig-box   { border-top: 1px solid #333; width: 45%; padding-top: 6px; font-size: 13px; }
    .watermark { position: fixed; top: 40%; left: 10%; font-size: 80px;
                 color: rgba(0,0,0,0.04); transform: rotate(-30deg); z-index: -1; }
  </style>
</head>
<body>
  <div class="watermark">{{#if fullySignedAt}}EXECUTED{{else}}DRAFT{{/if}}</div>
  <h1>{{title}}</h1>
  <p class="meta">Agreement Type: {{type}} &nbsp;|&nbsp; Date: {{date}}</p>

  <div class="section">
    <h2>Property Details</h2>
    <div class="field"><span class="label">Address:</span> {{property.address}}, {{property.city}}, {{property.state}}</div>
    <div class="field"><span class="label">Token ID:</span> {{tokenId}}</div>
    <div class="field"><span class="label">Type:</span> {{property.propertyType}}</div>
    <div class="field"><span class="label">Area:</span> {{property.squareFeet}} sq ft</div>
    {{#if templateData.salePrice}}
    <div class="field"><span class="label">Sale Price:</span> {{templateData.salePrice}} ETH</div>
    {{/if}}
    {{#if templateData.escrowAmount}}
    <div class="field"><span class="label">Escrow Amount:</span> {{templateData.escrowAmount}} ETH</div>
    {{/if}}
  </div>

  <div class="section">
    <h2>Terms & Conditions</h2>
    <p style="font-size:13px; line-height:1.7;">
      This agreement is entered into by the parties listed below with respect to the above-described
      property. All transactions are executed on the Ethereum blockchain and are irrevocable once
      all parties have signed. The platform acts solely as a facilitator and is not a party to
      this agreement. {{#if templateData.additionalTerms}}{{templateData.additionalTerms}}{{/if}}
    </p>
  </div>

  <div class="section sig-block">
    <h2>Signatures</h2>
    {{#each signatories}}
    <div class="sig-row">
      <div class="sig-box">
        <div><span class="label">Role:</span> {{role}}</div>
        <div><span class="label">Name:</span> {{name}}</div>
        <div><span class="label">Wallet:</span> {{signerAddress}}</div>
        {{#if signed}}
        <div><span class="label">Signed:</span> {{signedAt}}</div>
        <div><span class="label">Tx Hash:</span> <small>{{txHash}}</small></div>
        {{else}}
        <div style="color:#c00;">⏳ Awaiting signature</div>
        {{/if}}
      </div>
    </div>
    {{/each}}
  </div>

  {{#if agreementId}}
  <div class="section" style="font-size:12px; color:#888;">
    <p>On-Chain Agreement ID: {{agreementId}}</p>
    <p>IPFS Document CID: {{ipfsDocumentCid}}</p>
    {{#if ipfsSignedCid}}<p>Signed Document CID: {{ipfsSignedCid}}</p>{{/if}}
  </div>
  {{/if}}
</body>
</html>
`;

const renderDocument = (data) => {
  const compiled = handlebars.compile(AGREEMENT_TEMPLATE);
  return compiled({
    ...data,
    date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
  });
};

const generatePdf = async (htmlContent) => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page    = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
  const pdfBuffer = await page.pdf({ format: 'A4', margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' } });
  await browser.close();
  return pdfBuffer;
};

/* ─── GET /api/agreements ────────────────────────────────────────────── */

exports.getAgreements = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 10);
    const skip  = (page - 1) * limit;

    const query = req.user.role === 'admin'
      ? {}
      : { 'signatories.signer': req.user.id };

    if (req.query.status) query.status = req.query.status;
    if (req.query.type)   query.type   = req.query.type;

    const [agreements, total] = await Promise.all([
      Agreement.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('propertyId', 'title city state primaryImage tokenId')
        .populate('createdBy',  'name walletAddress')
        .select('-documentContent')      // omit heavy HTML from list
        .lean(),
      Agreement.countDocuments(query),
    ]);

    res.json({ agreements, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ─── GET /api/agreements/:id ────────────────────────────────────────── */

exports.getAgreement = async (req, res) => {
  try {
    const agreement = await Agreement.findById(req.params.id)
      .populate('propertyId')
      .populate('createdBy', 'name walletAddress email')
      .populate('signatories.signer', 'name walletAddress email');

    if (!agreement) return res.status(404).json({ message: 'Agreement not found' });

    // Only signatories, createdBy, or admin can view
    const signatoryIds = agreement.signatories.map((s) => s.signer._id.toString());
    const isParty = signatoryIds.includes(req.user.id) || agreement.createdBy._id.toString() === req.user.id;
    if (!isParty && req.user.role !== 'admin')
      return res.status(403).json({ message: 'Access denied' });

    res.json(agreement);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ─── POST /api/agreements ───────────────────────────────────────────── */

exports.createAgreement = async (req, res) => {
  try {
    const { error, value } = createAgreementSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const {
      title, type, propertyId, listingId, escrowId,
      auctionId, templateData, expiresAt, signatories,
    } = value;

    const property = await Property.findOne({ _id: propertyId, isDeleted: false });
    if (!property) return res.status(404).json({ message: 'Property not found' });

    // Resolve all signatories
    const resolvedSignatories = await Promise.all(
      signatories.map(async ({ userId, role }) => {
        const user = await User.findById(userId);
        if (!user) throw new Error(`User ${userId} not found`);
        return {
          signer:        user._id,
          signerAddress: user.walletAddress,
          role,
          signed:        false,
        };
      })
    );

    // Render document HTML
    const documentContent = renderDocument({
      title,
      type,
      tokenId:      property.tokenId,
      property,
      templateData,
      signatories:  resolvedSignatories.map((s) => ({ ...s, name: null })),
    });

    // Generate PDF and upload to IPFS
    const pdfBuffer      = await generatePdf(documentContent);
    const ipfsDocumentCid = await pinata.uploadFile(
      pdfBuffer,
      `agreement-${Date.now()}.pdf`,
      'application/pdf'
    );

    const agreement = await Agreement.create({
      title,
      type,
      propertyId:   property._id,
      tokenId:      property.tokenId,
      listingId:    listingId  || null,
      escrowId:     escrowId   || null,
      auctionId:    auctionId  || null,
      createdBy:    req.user.id,
      templateData,
      documentContent,
      ipfsDocumentCid,
      signatories:  resolvedSignatories,
      expiresAt:    expiresAt || null,
      status:       'pending_signatures',
    });

    // Notify signatories via Socket.io
    req.app.get('io')?.emit('agreement:created', {
      agreementId:  agreement._id,
      title,
      signatories:  resolvedSignatories.map((s) => s.signerAddress),
    });

    res.status(201).json({ agreement, ipfsDocumentCid });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ─── POST /api/agreements/:id/sign ──────────────────────────────────── */

exports.signAgreement = async (req, res) => {
  try {
    const { error, value } = signAgreementSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const { ethSignature, txHash } = value;

    const agreement = await Agreement.findById(req.params.id);
    if (!agreement) return res.status(404).json({ message: 'Agreement not found' });

    if (['fully_signed', 'on_chain', 'voided', 'expired'].includes(agreement.status))
      return res.status(400).json({ message: `Agreement is ${agreement.status}` });

    if (agreement.expiresAt && new Date() > new Date(agreement.expiresAt)) {
      agreement.status = 'expired';
      await agreement.save();
      return res.status(400).json({ message: 'Agreement has expired' });
    }

    // Find signatory record
    const signatory = agreement.signatories.find(
      (s) => s.signer.toString() === req.user.id
    );
    if (!signatory) return res.status(403).json({ message: 'Not a signatory on this agreement' });
    if (signatory.signed) return res.status(400).json({ message: 'Already signed' });

    // Verify eth_sign signature — the signer signed the IPFS document CID
    const messageHash  = keccak256(toUtf8Bytes(agreement.ipfsDocumentCid));
    const recoveredAddr = ethers.recoverAddress(messageHash, ethSignature).toLowerCase();
    const user          = await User.findById(req.user.id);

    if (recoveredAddr !== user.walletAddress.toLowerCase())
      return res.status(401).json({ message: 'Signature does not match wallet address' });

    // Verify on-chain sign tx
    const provider = getProvider();
    const receipt  = await provider.getTransactionReceipt(txHash);
    if (!receipt || receipt.status !== 1)
      return res.status(400).json({ message: 'Sign transaction not confirmed' });

    const signatureHash = keccak256(toUtf8Bytes(ethSignature));

    signatory.signed        = true;
    signatory.ethSignature  = ethSignature;
    signatory.signatureHash = signatureHash;
    signatory.signedAt      = new Date();
    signatory.txHash        = txHash;

    // Check if all signatories have signed
    const allSigned = agreement.signatories.every((s) => s.signed);

    if (allSigned) {
      agreement.status        = 'fully_signed';
      agreement.fullySignedAt = new Date();

      // Re-render document with all signature data and upload signed version to IPFS
      const signedHtml = renderDocument({
        title:           agreement.title,
        type:            agreement.type,
        tokenId:         agreement.tokenId,
        property:        await Property.findById(agreement.propertyId),
        templateData:    agreement.templateData,
        fullySignedAt:   agreement.fullySignedAt,
        agreementId:     agreement.agreementId,
        ipfsDocumentCid: agreement.ipfsDocumentCid,
        signatories:     agreement.signatories.map((s) => ({
          ...s.toObject(),
          signedAt: s.signedAt?.toLocaleDateString(),
        })),
      });

      const signedPdf     = await generatePdf(signedHtml);
      const ipfsSignedCid = await pinata.uploadFile(
        signedPdf,
        `agreement-${agreement._id}-signed.pdf`,
        'application/pdf'
      );

      agreement.ipfsSignedCid  = ipfsSignedCid;
      agreement.documentContent = signedHtml;

      // Anchor the agreement on-chain
      const wallet = getPlatformWallet();
      const { AgreementSigner } = contracts.getContracts(wallet);

      const signatureHashes = agreement.signatories.map((s) => s.signatureHash);

      const tx = await AgreementSigner.createAgreement(
        agreement.tokenId,
        agreement.ipfsDocumentCid,
        ipfsSignedCid,
        signatureHashes,
      );
      const onChainReceipt = await tx.wait();

      // Parse AgreementCreated event
      const createdEvent = onChainReceipt.logs
        .map((log) => { try { return AgreementSigner.interface.parseLog(log); } catch { return null; } })
        .find((e) => e?.name === 'AgreementCreated');

      agreement.agreementId  = createdEvent ? Number(createdEvent.args.agreementId) : null;
      agreement.status       = 'on_chain';
      agreement.onChainAt    = new Date();
      agreement.createTxHash = onChainReceipt.hash;

      req.app.get('io')?.emit('agreement:completed', {
        agreementId:  agreement._id,
        onChainId:    agreement.agreementId,
        ipfsSignedCid,
        txHash:       onChainReceipt.hash,
      });
    } else {
      agreement.status = 'partially_signed';
      req.app.get('io')?.emit('agreement:signed', {
        agreementId:   agreement._id,
        signerAddress: user.walletAddress,
        remaining:     agreement.signatories.filter((s) => !s.signed).length,
      });
    }

    await agreement.save();

    res.json({
      message:      allSigned ? 'Agreement fully signed and anchored on-chain' : 'Signature recorded',
      status:       agreement.status,
      agreementId:  agreement.agreementId,
      txHash:       agreement.createTxHash || null,
      ipfsSignedCid:agreement.ipfsSignedCid || null,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ─── GET /api/agreements/:id/document ───────────────────────────────── */
// Stream the PDF from IPFS or regenerate on the fly

exports.getDocument = async (req, res) => {
  try {
    const agreement = await Agreement.findById(req.params.id)
      .populate('propertyId')
      .populate('signatories.signer', 'name walletAddress');

    if (!agreement) return res.status(404).json({ message: 'Agreement not found' });

    const signatoryIds = agreement.signatories.map((s) => s.signer._id.toString());
    const isParty = signatoryIds.includes(req.user.id) || agreement.createdBy.toString() === req.user.id;
    if (!isParty && req.user.role !== 'admin')
      return res.status(403).json({ message: 'Access denied' });

    // If fully signed — return IPFS URL of signed doc
    if (agreement.ipfsSignedCid) {
      return res.json({
        ipfsUrl:  agreement.ipfsSignedCid,
        signed:   true,
        status:   agreement.status,
      });
    }

    // Otherwise regenerate current state PDF
    const html      = renderDocument({
      title:        agreement.title,
      type:         agreement.type,
      tokenId:      agreement.tokenId,
      property:     agreement.propertyId,
      templateData: agreement.templateData,
      signatories:  agreement.signatories.map((s) => ({
        ...s.toObject(),
        name:     s.signer?.name,
        signedAt: s.signedAt?.toLocaleDateString(),
      })),
    });
    const pdfBuffer = await generatePdf(html);

    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `inline; filename="agreement-${agreement._id}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ─── POST /api/agreements/:id/void (admin or createdBy) ─────────────── */

exports.voidAgreement = async (req, res) => {
  try {
    const { error, value } = voidAgreementSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const agreement = await Agreement.findById(req.params.id);
    if (!agreement) return res.status(404).json({ message: 'Agreement not found' });

    const isCreator = agreement.createdBy.toString() === req.user.id;
    const isAdmin   = req.user.role === 'admin';
    if (!isCreator && !isAdmin) return res.status(403).json({ message: 'Forbidden' });

    if (['on_chain', 'voided'].includes(agreement.status))
      return res.status(400).json({ message: `Cannot void a ${agreement.status} agreement` });

    agreement.status     = 'voided';
    agreement.voidReason = value.reason;
    await agreement.save();

    req.app.get('io')?.emit('agreement:voided', {
      agreementId: agreement._id,
      reason:      value.reason,
    });

    res.json({ message: 'Agreement voided', reason: value.reason });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ─── GET /api/agreements/:id/verify ─────────────────────────────────── */
// Public endpoint — verify agreement integrity against on-chain record

exports.verifyAgreement = async (req, res) => {
  try {
    const agreement = await Agreement.findById(req.params.id);
    if (!agreement) return res.status(404).json({ message: 'Agreement not found' });

    if (agreement.status !== 'on_chain')
      return res.json({ verified: false, reason: 'Agreement not anchored on-chain yet', status: agreement.status });

    // Fetch on-chain record
    const provider = getProvider();
    const { AgreementSigner } = contracts.getContracts(provider);

    const onChainData = await AgreementSigner.getAgreement(agreement.agreementId);

    const ipfsMatch   = onChainData.signedDocCid === agreement.ipfsSignedCid;
    const tokenMatch  = Number(onChainData.tokenId) === agreement.tokenId;

    // Verify each signature hash
    const sigVerifications = agreement.signatories.map((s) => {
      const expectedHash = keccak256(toUtf8Bytes(s.ethSignature || ''));
      const matches      = onChainData.signatureHashes?.includes(s.signatureHash);
      return {
        role:          s.role,
        signerAddress: s.signerAddress,
        verified:      !!matches,
      };
    });

    const allVerified = sigVerifications.every((s) => s.verified) && ipfsMatch && tokenMatch;

    res.json({
      verified:    allVerified,
      ipfsMatch,
      tokenMatch,
      signatories: sigVerifications,
      onChainId:   agreement.agreementId,
      txHash:      agreement.createTxHash,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
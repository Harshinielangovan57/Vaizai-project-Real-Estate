// config/contracts.js
//
// Loads the deployment manifest written by scripts/deploy.js.
// Called once on server startup; exports a frozen config object used
// everywhere in the backend that needs a contract address or ABI.
//
// Usage:
//   const { getContract, getAddress, getAllAddresses } = require('./config/contracts');
//   const propertyNFT = getContract('PropertyNFT', signerOrProvider);

const fs      = require('fs');
const path    = require('path');
const { ethers } = require('ethers');

// ── Path to the deployment manifest ──────────────────────────────────────────
const MANIFEST_PATH = path.resolve(
  __dirname,
  '../../renft-blockchain/deployments/localhost.json'
);

// ── Load & validate manifest ──────────────────────────────────────────────────
let _manifest = null;

function loadManifest() {
  if (_manifest) return _manifest;           // already loaded — return cache

  if (!fs.existsSync(MANIFEST_PATH)) {
    throw new Error(
      `[ContractsConfig] Deployment manifest not found at:\n  ${MANIFEST_PATH}\n` +
      `Run: npx hardhat run scripts/deploy.js --network localhost`
    );
  }

  try {
    _manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  } catch (err) {
    throw new Error(`[ContractsConfig] Failed to parse manifest: ${err.message}`);
  }

  const required = ['PropertyNFT', 'Marketplace', 'Escrow', 'Auction', 'AgreementSigner'];
  for (const name of required) {
    if (!_manifest[name]?.address || !_manifest[name]?.abi) {
      throw new Error(
        `[ContractsConfig] Manifest is missing contract: ${name}. Re-run deploy script.`
      );
    }
  }

  console.log('[ContractsConfig] ✅ Manifest loaded');
  console.log(`[ContractsConfig]    Network  : ${_manifest.network}`);
  console.log(`[ContractsConfig]    Chain ID : ${_manifest.chainId}`);
  console.log(`[ContractsConfig]    Deployed : ${_manifest.deployedAt}`);

  return _manifest;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns the deployed address for a given contract name.
 * @param  {string} name  e.g. 'PropertyNFT'
 * @returns {string}       checksummed address
 */
function getAddress(name) {
  const manifest = loadManifest();
  if (!manifest[name]) throw new Error(`[ContractsConfig] Unknown contract: ${name}`);
  return ethers.getAddress(manifest[name].address);  // checksum
}

/**
 * Returns the ABI array for a given contract name.
 * @param  {string} name
 * @returns {Array}
 */
function getAbi(name) {
  const manifest = loadManifest();
  if (!manifest[name]) throw new Error(`[ContractsConfig] Unknown contract: ${name}`);
  return manifest[name].abi;
}

/**
 * Returns an ethers.js Contract instance ready to call.
 * @param  {string} name              Contract name e.g. 'Marketplace'
 * @param  {object} signerOrProvider  ethers Signer or Provider
 * @returns {ethers.Contract}
 */
function getContract(name, signerOrProvider) {
  return new ethers.Contract(getAddress(name), getAbi(name), signerOrProvider);
}

/**
 * Returns a plain object of { ContractName: address } for all contracts.
 * Used by GET /api/config/contracts to send to the frontend.
 */
function getAllAddresses() {
  const manifest = loadManifest();
  const names    = ['PropertyNFT', 'Marketplace', 'Escrow', 'Auction', 'AgreementSigner'];
  return names.reduce((acc, name) => {
    acc[name] = ethers.getAddress(manifest[name].address);
    return acc;
  }, {});
}

/**
 * Returns the full manifest (addresses + ABIs) for all contracts.
 * Used by GET /api/config/contracts when the frontend needs ABIs too.
 */
function getFullManifest() {
  const manifest = loadManifest();
  const names    = ['PropertyNFT', 'Marketplace', 'Escrow', 'Auction', 'AgreementSigner'];
  return names.reduce((acc, name) => {
    acc[name] = {
      address: ethers.getAddress(manifest[name].address),
      abi:     manifest[name].abi,
    };
    return acc;
  }, {});
}

/**
 * Returns network metadata from the manifest.
 */
function getNetworkInfo() {
  const manifest = loadManifest();
  return {
    network:    manifest.network,
    chainId:    manifest.chainId,
    deployedAt: manifest.deployedAt,
    deployer:   manifest.deployer,
  };
}

// ── Initialise eagerly on require so startup errors surface immediately ───────
try {
  loadManifest();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

module.exports = {
  getAddress,
  getAbi,
  getContract,
  getAllAddresses,
  getFullManifest,
  getNetworkInfo,
};
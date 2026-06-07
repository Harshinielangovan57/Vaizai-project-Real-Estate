// src/config/contractsConfig.js
//
// Fetched once on app init from GET /api/config/contracts.
// Provides ethers.js Contract instances to the rest of the frontend.
// ABIs are never hardcoded in source — always loaded from the backend.
//
// Usage:
//   import { getContract, getAddress } from '@/config/contractsConfig';
//   const marketplace = getContract('Marketplace', signer);

import { ethers } from 'ethers';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// ── Internal cache ─────────────────────────────────────────────────────────────
let _manifest  = null;      // { ContractName: { address, abi } }
let _fetchPromise = null;   // deduplicate concurrent calls

// ── Fetch manifest from backend ────────────────────────────────────────────────

/**
 * Fetches the full contract manifest from the backend once and caches it.
 * All subsequent calls return the cached value.
 * @returns {Promise<object>} manifest
 */
async function fetchManifest() {
  if (_manifest) return _manifest;

  // Deduplicate: if a fetch is already in-flight, wait for it
  if (_fetchPromise) return _fetchPromise;

  _fetchPromise = (async () => {
    const res = await fetch(`${API_URL}/api/config/contracts`);

    if (!res.ok) {
      throw new Error(
        `[ContractsConfig] Failed to fetch contract config: ${res.status} ${res.statusText}`
      );
    }

    const json = await res.json();

    if (!json.success || !json.data) {
      throw new Error('[ContractsConfig] Invalid contract config response from backend');
    }

    _manifest     = json.data;
    _fetchPromise = null;

    console.log('[ContractsConfig] ✅ Contract config loaded from backend');
    return _manifest;
  })();

  return _fetchPromise;
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Initialise the contracts config. Call this once in your app entry point
 * (e.g. main.jsx) before rendering routes so the manifest is pre-cached.
 */
export async function initContractsConfig() {
  await fetchManifest();
}

/**
 * Returns the deployed address for a contract.
 * @param  {string} name  e.g. 'PropertyNFT'
 * @returns {string}       checksummed address
 */
export async function getAddress(name) {
  const manifest = await fetchManifest();
  if (!manifest[name]) throw new Error(`[ContractsConfig] Unknown contract: ${name}`);
  return ethers.getAddress(manifest[name].address);
}

/**
 * Returns the ABI for a contract.
 * @param  {string} name
 * @returns {Array}
 */
export async function getAbi(name) {
  const manifest = await fetchManifest();
  if (!manifest[name]) throw new Error(`[ContractsConfig] Unknown contract: ${name}`);
  return manifest[name].abi;
}

/**
 * Returns a connected ethers.js Contract instance.
 * @param  {string} name              Contract name e.g. 'Marketplace'
 * @param  {object} signerOrProvider  ethers Signer or Provider
 * @returns {Promise<ethers.Contract>}
 */
export async function getContract(name, signerOrProvider) {
  const address = await getAddress(name);
  const abi     = await getAbi(name);
  return new ethers.Contract(address, abi, signerOrProvider);
}

/**
 * Returns all contract addresses as a plain object.
 * { PropertyNFT: "0x...", Marketplace: "0x...", ... }
 */
export async function getAllAddresses() {
  const manifest = await fetchManifest();
  return Object.fromEntries(
    Object.entries(manifest).map(([name, { address }]) => [
      name,
      ethers.getAddress(address),
    ])
  );
}

/**
 * Synchronous getter — only works after initContractsConfig() has resolved.
 * Useful inside non-async component code.
 * @param  {string} name
 * @returns {string}  address
 */
export function getAddressSync(name) {
  if (!_manifest) throw new Error('[ContractsConfig] Config not yet loaded. Await initContractsConfig() first.');
  if (!_manifest[name]) throw new Error(`[ContractsConfig] Unknown contract: ${name}`);
  return ethers.getAddress(_manifest[name].address);
}

/**
 * Synchronous contract factory — only works after initContractsConfig() resolves.
 */
export function getContractSync(name, signerOrProvider) {
  if (!_manifest) throw new Error('[ContractsConfig] Config not yet loaded.');
  const { address, abi } = _manifest[name];
  return new ethers.Contract(ethers.getAddress(address), abi, signerOrProvider);
}
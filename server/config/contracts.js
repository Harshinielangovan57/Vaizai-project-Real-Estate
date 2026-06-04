const fs     = require('fs');
const path   = require('path');
const ethers = require('ethers');

const deploymentsPath = path.resolve(__dirname, '../../renft-blockchain/deployments/localhost.json');

let deployments = null;

const load = () => {
  if (!deployments) {
    deployments = JSON.parse(fs.readFileSync(deploymentsPath, 'utf8'));
  }
  return deployments;
};

/**
 * Returns ethers Contract instances bound to the given signer/provider.
 */
exports.getContracts = (signerOrProvider) => {
  const d = load();
  return Object.fromEntries(
    Object.entries(d)
      .filter(([, v]) => v && v.address && v.abi)
      .map(([name, { address, abi }]) => [
        name,
        new ethers.Contract(address, abi, signerOrProvider),
      ]),
  );
};
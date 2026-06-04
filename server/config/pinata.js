const axios     = require('axios');
const FormData  = require('form-data');

const PINATA_BASE = 'https://api.pinata.cloud';

const headers = () => ({
  pinata_api_key:    process.env.PINATA_API_KEY,
  pinata_secret_api_key: process.env.PINATA_SECRET_KEY,
});

/**
 * Upload a file buffer to IPFS via Pinata.
 * Returns the public IPFS gateway URL.
 */
exports.uploadFile = async (buffer, filename, mimetype) => {
  const form = new FormData();
  form.append('file', buffer, { filename, contentType: mimetype });
  form.append('pinataMetadata', JSON.stringify({ name: filename }));

  const { data } = await axios.post(`${PINATA_BASE}/pinning/pinFileToIPFS`, form, {
    headers: { ...form.getHeaders(), ...headers() },
    maxBodyLength: Infinity,
  });

  return `https://gateway.pinata.cloud/ipfs/${data.IpfsHash}`;
};

/**
 * Upload a JSON object to IPFS via Pinata.
 * Returns the ipfs:// URI (used as tokenURI on-chain).
 */
exports.uploadJSON = async (jsonObj, name = 'metadata.json') => {
  const { data } = await axios.post(
    `${PINATA_BASE}/pinning/pinJSONToIPFS`,
    { pinataMetadata: { name }, pinataContent: jsonObj },
    { headers: { 'Content-Type': 'application/json', ...headers() } },
  );

  return `ipfs://${data.IpfsHash}`;
};
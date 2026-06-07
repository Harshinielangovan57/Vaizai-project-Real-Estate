// src/hooks/useContracts.js
//
// React hook that provides ready-to-use ethers.js contract instances
// connected to the current MetaMask signer.
//
// Usage:
//   const { contracts, loading, error } = useContracts();
//   await contracts.marketplace.listProperty(tokenId, price);

import { useState, useEffect } from 'react';
import { ethers }              from 'ethers';
import { getContractSync }     from '@/config/contractsConfig';

const CONTRACT_NAMES = [
  'PropertyNFT',
  'Marketplace',
  'Escrow',
  'Auction',
  'AgreementSigner',
];

export function useContracts() {
  const [contracts, setContracts] = useState(null);
  const [provider,  setProvider]  = useState(null);
  const [signer,    setSigner]    = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);

  useEffect(() => {
    async function connect() {
      try {
        if (!window.ethereum) {
          throw new Error('MetaMask not detected. Please install MetaMask.');
        }

        const web3Provider = new ethers.BrowserProvider(window.ethereum);
        const web3Signer   = await web3Provider.getSigner();

        // Build contract instances from the cached manifest
        const instances = {};
        for (const name of CONTRACT_NAMES) {
          instances[name.charAt(0).toLowerCase() + name.slice(1)] =
            getContractSync(name, web3Signer);
        }
        // Also expose by PascalCase for convenience
        for (const name of CONTRACT_NAMES) {
          instances[name] = getContractSync(name, web3Signer);
        }

        setProvider(web3Provider);
        setSigner(web3Signer);
        setContracts(instances);
        setError(null);
      } catch (err) {
        console.error('[useContracts]', err.message);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    connect();

    // Re-connect when MetaMask account or network changes
    const handleAccountsChanged = () => connect();
    const handleChainChanged    = () => window.location.reload();

    window.ethereum?.on('accountsChanged', handleAccountsChanged);
    window.ethereum?.on('chainChanged',    handleChainChanged);

    return () => {
      window.ethereum?.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum?.removeListener('chainChanged',    handleChainChanged);
    };
  }, []);

  return { contracts, provider, signer, loading, error };
}
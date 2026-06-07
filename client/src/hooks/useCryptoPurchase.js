import { useState } from 'react';
import { ethers }   from 'ethers';
// import { useDispatch } from 'react-redux';
import axios        from 'axios';
import toast        from 'react-hot-toast';
import { getContractSync } from '@/config/contractsConfig';

const API = import.meta.env.VITE_API_URL;

export function useCryptoPurchase() {
  const [loading, setLoading]   = useState(false);
  const [txHash,  setTxHash]    = useState(null);
  const [error,   setError]     = useState(null);

  const buyWithCrypto = async (listingDbId) => {
    setLoading(true);
    setError(null);

    try {
      // Step 1 — fetch listing data from backend
      const { data } = await axios.get(
        `${API}/api/marketplace/${listingDbId}/buy/crypto`,
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );

      const { listingId, priceWei } = data;

      // Step 2 — get MetaMask signer
      if (!window.ethereum) throw new Error('MetaMask not detected');
      const provider   = new ethers.BrowserProvider(window.ethereum);
      const signer     = await provider.getSigner();
      const marketplace = getContractSync('Marketplace', signer);

      // Step 3 — call buyProperty() on-chain with ETH value
      toast.loading('Confirm transaction in MetaMask…', { id: 'crypto-buy' });

      const tx = await marketplace.buyProperty(listingId, {
        value: BigInt(priceWei),
      });

      toast.loading('Waiting for confirmation…', { id: 'crypto-buy' });
      const receipt = await tx.wait();

      setTxHash(receipt.hash);
      toast.success('Purchase complete! 🎉', { id: 'crypto-buy' });

      return { success: true, txHash: receipt.hash };
    } catch (err) {
      const msg = err?.reason || err?.message || 'Transaction failed';
      setError(msg);
      toast.error(msg, { id: 'crypto-buy' });
      return { success: false, error: msg };
    } finally {
      setLoading(false);
    }
  };

  return { buyWithCrypto, loading, txHash, error };
}
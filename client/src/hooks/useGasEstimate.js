
import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL;

export function useGasEstimate({ price, listingType, enabled }) {
  const [estimate, setEstimate] = useState(null); // { eth: '0.002', usd: '5.40' }
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !window.ethereum) return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const feeData = await provider.getFeeData();
        const gasPrice = feeData.gasPrice || feeData.maxFeePerGas;

        // Approximate gas units: mint (~150k) + list (~80k) or auction (~100k)
        const gasUnits = listingType === 'auction' ? 250_000n : 230_000n;
        const gasCostWei = gasPrice * gasUnits;
        const gasCostEth = parseFloat(ethers.formatEther(gasCostWei));

        // Fetch ETH/USD price
        let ethUsd = 0;
        try {
          const { data } = await axios.get(`${API}/api/config/eth-price`);
          ethUsd = data.usd || 0;
        } catch {
          // fallback: skip USD conversion
        }

        if (!cancelled) {
          setEstimate({
            eth: gasCostEth.toFixed(5),
            usd: ethUsd ? (gasCostEth * ethUsd).toFixed(2) : null,
          });
        }
      } catch {
        if (!cancelled) setEstimate(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [enabled, listingType]);

  return { estimate, loading };
}
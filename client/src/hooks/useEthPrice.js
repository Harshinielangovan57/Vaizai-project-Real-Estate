// src/hooks/useEthPrice.js
import { useState, useEffect } from 'react';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL;

/**
 * Returns the current ETH/USD price.
 * Falls back to 0 if the backend or CoinGecko is unreachable.
 */
export function useEthPrice() {
  const [ethUsd, setEthUsd] = useState(0);

  useEffect(() => {
    axios
      .get(`${API}/api/config/eth-price`)
      .then((r) => setEthUsd(r.data?.usd || 0))
      .catch(() => setEthUsd(0));
  }, []);

  const toUsd = (eth) =>
    ethUsd && eth ? `≈ $${(parseFloat(eth) * ethUsd).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '';

  return { ethUsd, toUsd };
}
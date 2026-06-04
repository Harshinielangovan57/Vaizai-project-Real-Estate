// src/hooks/useDashboard.js
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL;

/**
 * useDashboard
 * Centrally fetches all dashboard data and exposes per-tab refetch.
 */
export function useDashboard(token) {
  const headers = { Authorization: `Bearer ${token}` };

  const [properties,   setProperties]   = useState([]);
  const [listings,     setListings]      = useState([]);
  const [bids,         setBids]          = useState([]);
  const [transactions, setTransactions]  = useState([]);
  const [escrowDeals,  setEscrowDeals]   = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [propsR, listR, bidsR, txR, escR] = await Promise.allSettled([
      axios.get(`${API}/api/properties?owner=me`,    { headers }),
      axios.get(`${API}/api/marketplace?seller=me`,  { headers }),
      axios.get(`${API}/api/auctions/my-bids`,       { headers }),
      axios.get(`${API}/api/transactions/my`,        { headers }),
      axios.get(`${API}/api/escrow/my-deals`,        { headers }),
    ]);
    if (propsR.status === 'fulfilled') setProperties(propsR.value.data.properties || []);
    if (listR.status  === 'fulfilled') setListings(listR.value.data.listings       || []);
    if (bidsR.status  === 'fulfilled') setBids(bidsR.value.data.bids               || []);
    if (txR.status    === 'fulfilled') setTransactions(txR.value.data.transactions || []);
    if (escR.status   === 'fulfilled') setEscrowDeals(escR.value.data.deals        || []);
    setLoading(false);
  }, [token]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Granular refetch helpers
  const refetchProperties = async () => {
    const { data } = await axios.get(`${API}/api/properties?owner=me`, { headers });
    setProperties(data.properties || []);
  };
  const refetchListings = async () => {
    const { data } = await axios.get(`${API}/api/marketplace?seller=me`, { headers });
    setListings(data.listings || []);
  };
  const refetchEscrow = async () => {
    const { data } = await axios.get(`${API}/api/escrow/my-deals`, { headers });
    setEscrowDeals(data.deals || []);
  };

  return {
    properties, listings, bids, transactions, escrowDeals,
    loading, refetchProperties, refetchListings, refetchEscrow,
  };
}
// src/hooks/useAdminData.js
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL;

export function useAdminData(token) {
  const headers = { Authorization: `Bearer ${token}` };

  const [stats,      setStats]      = useState(null);
  const [charts,     setCharts]     = useState(null);
  const [users,      setUsers]      = useState([]);
  const [userTotal,  setUserTotal]  = useState(0);
  const [properties, setProperties] = useState([]);
  const [fraudQueue, setFraudQueue] = useState([]);
  const [disputes,   setDisputes]   = useState([]);
  const [auditLog,   setAuditLog]   = useState([]);
  const [loading,    setLoading]    = useState(true);

  // ── Initial load: stats + charts + queues ──────────────────────────────
  const fetchCore = useCallback(async () => {
    setLoading(true);
    const [statsR, chartsR, fraudR, disputesR, auditR] = await Promise.allSettled([
      axios.get(`${API}/api/admin/stats`,       { headers }),
      axios.get(`${API}/api/admin/charts`,      { headers }),
      axios.get(`${API}/api/admin/fraud-queue`, { headers }),
      axios.get(`${API}/api/escrow?state=DISPUTED`, { headers }),
      axios.get(`${API}/api/admin/audit-log?limit=50`, { headers }),
    ]);
    if (statsR.status    === 'fulfilled') setStats(statsR.value.data);
    if (chartsR.status   === 'fulfilled') setCharts(chartsR.value.data);
    if (fraudR.status    === 'fulfilled') setFraudQueue(fraudR.value.data.flags  || []);
    if (disputesR.status === 'fulfilled') setDisputes(disputesR.value.data.deals || []);
    if (auditR.status    === 'fulfilled') setAuditLog(auditR.value.data.logs     || []);
    setLoading(false);
  }, [token]);

  useEffect(() => { fetchCore(); }, [fetchCore]);

  // ── User fetch (called when Users tab opens or search changes) ─────────
  const fetchUsers = useCallback(async ({ q = '', role = '', page = 1 } = {}) => {
    try {
      const { data } = await axios.get(`${API}/api/admin/users`, {
        headers,
        params: { q, role, page, limit: 20 },
      });
      setUsers(data.users   || []);
      setUserTotal(data.total || 0);
    } catch { setUsers([]); }
  }, [token]);

  // ── Unverified properties (called when Properties tab opens) ──────────
  const fetchProperties = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/api/admin/properties?verified=false`, { headers });
      setProperties(data.properties || []);
    } catch { setProperties([]); }
  }, [token]);

  const refetchFraud     = async () => {
    const { data } = await axios.get(`${API}/api/admin/fraud-queue`, { headers });
    setFraudQueue(data.flags || []);
  };
  const refetchDisputes  = async () => {
    const { data } = await axios.get(`${API}/api/escrow?state=DISPUTED`, { headers });
    setDisputes(data.deals || []);
  };
  const refetchAuditLog  = async () => {
    const { data } = await axios.get(`${API}/api/admin/audit-log?limit=50`, { headers });
    setAuditLog(data.logs || []);
  };

  return {
    stats, charts,
    users, userTotal, fetchUsers,
    properties, fetchProperties,
    fraudQueue, refetchFraud,
    disputes,   refetchDisputes,
    auditLog,   refetchAuditLog,
    loading,
  };
}
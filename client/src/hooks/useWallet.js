// src/hooks/useWallet.js
import { useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { ethers } from 'ethers';
import axios from 'axios';
import toast from 'react-hot-toast';

import {
  connectWallet,
  disconnectWallet,
  fetchBalance,
  switchToHardhat,
  setChainId,
  resetWallet,
} from '../store/slices/walletSlice';
import { setAuthFromWallet, logout } from '../store/slices/authSlice';

const API_BASE = import.meta.env.VITE_API_URL;
const HARDHAT_CHAIN_ID = 31337;

export function useWallet() {
  const dispatch = useDispatch();
  const wallet = useSelector((s) => s.wallet);

  // ─── Auto-reconnect on mount if previously connected ──────────────────────
  useEffect(() => {
    const wasConnected = localStorage.getItem('wallet_connected') === 'true';
    if (wasConnected && window.ethereum) {
      dispatch(connectWallet()).then((action) => {
        if (connectWallet.fulfilled.match(action)) {
          authenticateWallet(action.payload.address);
        }
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── MetaMask event listeners ─────────────────────────────────────────────
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts) => {
      if (accounts.length === 0) {
        // User disconnected all accounts
        dispatch(resetWallet());
        dispatch(logout());
        toast('Wallet disconnected');
      } else {
        // User switched account — log out and re-authenticate
        dispatch(resetWallet());
        dispatch(logout());
        toast('Account switched — please reconnect');
      }
    };

    const handleChainChanged = (chainIdHex) => {
      const chainId = parseInt(chainIdHex, 16);
      dispatch(setChainId(chainId));

      if (chainId !== HARDHAT_CHAIN_ID) {
        toast.error('Wrong network — please switch to Hardhat Local');
      }
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    return () => {
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum.removeListener('chainChanged', handleChainChanged);
    };
  }, [dispatch]);

  // ─── Wallet auth: get nonce → sign → POST → store JWT ─────────────────────
  const authenticateWallet = useCallback(
    async (address) => {
      try {
        // 1. Fetch nonce from backend
        const { data: nonceData } = await axios.get(
          `${API_BASE}/api/auth/nonce/${address}`
        );

        // 2. Sign nonce with MetaMask
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const signature = await signer.signMessage(nonceData.message);

        // 3. Verify signature on backend, receive JWT
        const { data: authData } = await axios.post(
          `${API_BASE}/api/auth/wallet`,
          { address, signature }
        );

        // 4. Store token in Redux (refresh token lands in httpOnly cookie automatically)
        dispatch(
          setAuthFromWallet({
            user: authData.user,
            token: authData.accessToken,
            walletAddress: address,
          })
        );

        toast.success('Wallet authenticated');
      } catch (err) {
        const msg = err?.response?.data?.message || err.message;
        toast.error(`Auth failed: ${msg}`);
      }
    },
    [dispatch]
  );

  // ─── Public connect handler ────────────────────────────────────────────────
  const handleConnect = useCallback(async () => {
    if (!window.ethereum) {
      toast.error('MetaMask not detected — please install it first', {
        duration: 6000,
        action: {
          label: 'Install',
          onClick: () => window.open('https://metamask.io/download/', '_blank'),
        },
      });
      return;
    }

    const action = await dispatch(connectWallet());
    if (connectWallet.fulfilled.match(action)) {
      await authenticateWallet(action.payload.address);
    } else {
      toast.error(action.payload || 'Failed to connect wallet');
    }
  }, [dispatch, authenticateWallet]);

  // ─── Disconnect ────────────────────────────────────────────────────────────
  const handleDisconnect = useCallback(async () => {
    await dispatch(disconnectWallet());
    dispatch(logout());
    toast('Wallet disconnected');
  }, [dispatch]);

  // ─── Refresh balance (call after every tx) ────────────────────────────────
  const refreshBalance = useCallback(() => {
    if (wallet.address) {
      dispatch(fetchBalance(wallet.address));
    }
  }, [dispatch, wallet.address]);

  // ─── Add Hardhat network / switch ─────────────────────────────────────────
  const handleSwitchNetwork = useCallback(async () => {
    const action = await dispatch(switchToHardhat());
    if (switchToHardhat.rejected.match(action)) {
      toast.error('Failed to switch network');
    }
  }, [dispatch]);

  return {
    ...wallet,
    connect: handleConnect,
    disconnect: handleDisconnect,
    switchNetwork: handleSwitchNetwork,
    refreshBalance,
  };
}
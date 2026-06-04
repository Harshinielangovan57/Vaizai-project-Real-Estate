// src/store/slices/walletSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { ethers } from 'ethers';

const HARDHAT_CHAIN_ID = 31337;
const HARDHAT_CHAIN_HEX = '0x7A69';

// ─── Thunks ───────────────────────────────────────────────────────────────────

export const connectWallet = createAsyncThunk(
  'wallet/connect',
  async (_, { rejectWithValue }) => {
    if (!window.ethereum) {
      return rejectWithValue('MetaMask is not installed');
    }

    const accounts = await window.ethereum.request({
      method: 'eth_requestAccounts',
    });

    const provider = new ethers.BrowserProvider(window.ethereum);
    const network = await provider.getNetwork();
    const balance = await provider.getBalance(accounts[0]);

    localStorage.setItem('wallet_connected', 'true');

    return {
      address: accounts[0],
      chainId: Number(network.chainId),
      balance: ethers.formatEther(balance),
    };
  }
);

export const disconnectWallet = createAsyncThunk(
  'wallet/disconnect',
  async () => {
    localStorage.removeItem('wallet_connected');
    return null;
  }
);

export const fetchBalance = createAsyncThunk(
  'wallet/fetchBalance',
  async (address, { rejectWithValue }) => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const balance = await provider.getBalance(address);
      return ethers.formatEther(balance);
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const switchToHardhat = createAsyncThunk(
  'wallet/switchNetwork',
  async (_, { rejectWithValue }) => {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: HARDHAT_CHAIN_HEX }],
      });
    } catch (switchErr) {
      // Chain not added yet — add it
      if (switchErr.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: HARDHAT_CHAIN_HEX,
              chainName: 'Hardhat Local',
              nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
              rpcUrls: ['http://localhost:8545'],
            },
          ],
        });
      } else {
        return rejectWithValue(switchErr.message);
      }
    }
  }
);

// ─── Slice ────────────────────────────────────────────────────────────────────

const walletSlice = createSlice({
  name: 'wallet',
  initialState: {
    address: null,
    chainId: null,
    balance: '0',
    isConnected: false,
    isCorrectNetwork: false,
    isConnecting: false,
    error: null,
  },
  reducers: {
    setChainId(state, action) {
      state.chainId = action.payload;
      state.isCorrectNetwork = action.payload === HARDHAT_CHAIN_ID;
    },
    setBalance(state, action) {
      state.balance = action.payload;
    },
    resetWallet(state) {
      state.address = null;
      state.chainId = null;
      state.balance = '0';
      state.isConnected = false;
      state.isCorrectNetwork = false;
      state.error = null;
      localStorage.removeItem('wallet_connected');
    },
  },
  extraReducers: (builder) => {
    builder
      // connectWallet
      .addCase(connectWallet.pending, (state) => {
        state.isConnecting = true;
        state.error = null;
      })
      .addCase(connectWallet.fulfilled, (state, action) => {
        state.isConnecting = false;
        state.address = action.payload.address;
        state.chainId = action.payload.chainId;
        state.balance = action.payload.balance;
        state.isConnected = true;
        state.isCorrectNetwork = action.payload.chainId === HARDHAT_CHAIN_ID;
      })
      .addCase(connectWallet.rejected, (state, action) => {
        state.isConnecting = false;
        state.error = action.payload;
      })
      // disconnectWallet
      .addCase(disconnectWallet.fulfilled, (state) => {
        state.address = null;
        state.chainId = null;
        state.balance = '0';
        state.isConnected = false;
        state.isCorrectNetwork = false;
      })
      // fetchBalance
      .addCase(fetchBalance.fulfilled, (state, action) => {
        state.balance = action.payload;
      })
      // switchToHardhat
      .addCase(switchToHardhat.rejected, (state, action) => {
        state.error = action.payload;
      });
  },
});

export const { setChainId, setBalance, resetWallet } = walletSlice.actions;
export default walletSlice.reducer;
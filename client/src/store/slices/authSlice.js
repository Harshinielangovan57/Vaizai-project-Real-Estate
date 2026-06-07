// src/store/slices/authSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL;

// ── Thunks ────────────────────────────────────────────────────────────────────

export const loginWithEmail = createAsyncThunk(
  'auth/loginEmail',
  async ({ email, password }, { rejectWithValue }) => {
    try {
      const { data } = await axios.post(`${API}/api/auth/login`, { email, password });
      return data; // { user, accessToken }
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const registerWithEmail = createAsyncThunk(
  'auth/register',
  async ({ name, email, password }, { rejectWithValue }) => {
    try {
      const { data } = await axios.post(`${API}/api/auth/register`, { name, email, password });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const refreshAccessToken = createAsyncThunk(
  'auth/refresh',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await axios.post(
        `${API}/api/auth/refresh`, {},
        { withCredentials: true }
      );
      return data; // { accessToken }
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const logoutFromServer = createAsyncThunk(
  'auth/logoutServer',
  async (_, { getState }) => {
    const token = getState().auth.token;
    await axios.post(`${API}/api/auth/logout`, {}, {
      headers:         { Authorization: `Bearer ${token}` },
      withCredentials: true,
    });
  }
);

// ── Slice ─────────────────────────────────────────────────────────────────────

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user:            null,
    token:           null,       // in-memory only — never localStorage
    walletAddress:   null,       // mirrored from wallet slice for convenience
    isAuthenticated: false,
    isLoading:       false,
    error:           null,
  },
  reducers: {
    /**
     * Called by useWallet after successful nonce → sign → JWT flow.
     */
    setAuthFromWallet(state, action) {
      const { user, token, walletAddress } = action.payload;
      state.user            = user;
      state.token           = token;
      state.walletAddress   = walletAddress;
      state.isAuthenticated = true;
      state.error           = null;
    },
    logout(state) {
      state.user            = null;
      state.token           = null;
      state.walletAddress   = null;
      state.isAuthenticated = false;
    },
    clearError(state) {
      state.error = null;
    },
    // Update user profile fields after PUT /api/users/me
    updateUser(state, action) {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
      }
    },
  },
  extraReducers: (builder) => {
    const handlePending = (state) => { state.isLoading = true;  state.error = null; };
    const handleAuth    = (state, action) => {
      state.isLoading       = false;
      state.user            = action.payload.user;
      state.token           = action.payload.accessToken;
      state.isAuthenticated = true;
    };
    const handleRejected = (state, action) => {
      state.isLoading = false;
      state.error     = action.payload;
    };

    builder
      .addCase(loginWithEmail.pending,   handlePending)
      .addCase(loginWithEmail.fulfilled, handleAuth)
      .addCase(loginWithEmail.rejected,  handleRejected)

      .addCase(registerWithEmail.pending,   handlePending)
      .addCase(registerWithEmail.fulfilled, handleAuth)
      .addCase(registerWithEmail.rejected,  handleRejected)

      .addCase(refreshAccessToken.fulfilled, (state, action) => {
        state.token = action.payload.accessToken;
      })
      .addCase(refreshAccessToken.rejected, (state) => {
        state.user = null; state.token = null;
        state.walletAddress = null; state.isAuthenticated = false;
      })

      .addCase(logoutFromServer.fulfilled, (state) => {
        state.user = null; state.token = null;
        state.walletAddress = null; state.isAuthenticated = false;
      });
  },
});

export const { setAuthFromWallet, logout, clearError, updateUser } = authSlice.actions;
export default authSlice.reducer;
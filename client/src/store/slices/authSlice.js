
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL;

// ─── Thunks ───────────────────────────────────────────────────────────────────

export const loginWithEmail = createAsyncThunk(
  'auth/loginEmail',
  async ({ email, password }, { rejectWithValue }) => {
    try {
      const { data } = await axios.post(`${API_BASE}/api/auth/login`, {
        email,
        password,
      });
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
      const { data } = await axios.post(`${API_BASE}/api/auth/register`, {
        name,
        email,
        password,
      });
      return data; // { user, accessToken }
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
        `${API_BASE}/api/auth/refresh`,
        {},
        { withCredentials: true } // sends httpOnly refresh cookie
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
    await axios.post(
      `${API_BASE}/api/auth/logout`,
      {},
      {
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true,
      }
    );
  }
);

// ─── Slice ────────────────────────────────────────────────────────────────────

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: null,
    token: null,               // in-memory only — never localStorage
    walletAddress: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
  },
  reducers: {
    /**
     * Called by useWallet after a successful wallet signature + JWT response.
     */
    setAuthFromWallet(state, action) {
      const { user, token, walletAddress } = action.payload;
      state.user = user;
      state.token = token;
      state.walletAddress = walletAddress;
      state.isAuthenticated = true;
      state.error = null;
    },
    logout(state) {
      state.user = null;
      state.token = null;
      state.walletAddress = null;
      state.isAuthenticated = false;
    },
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    const handlePending = (state) => {
      state.isLoading = true;
      state.error = null;
    };
    const handleAuth = (state, action) => {
      state.isLoading = false;
      state.user = action.payload.user;
      state.token = action.payload.accessToken;
      state.isAuthenticated = true;
    };
    const handleRejected = (state, action) => {
      state.isLoading = false;
      state.error = action.payload;
    };

    builder
      // loginWithEmail
      .addCase(loginWithEmail.pending, handlePending)
      .addCase(loginWithEmail.fulfilled, handleAuth)
      .addCase(loginWithEmail.rejected, handleRejected)
      // registerWithEmail
      .addCase(registerWithEmail.pending, handlePending)
      .addCase(registerWithEmail.fulfilled, handleAuth)
      .addCase(registerWithEmail.rejected, handleRejected)
      // refreshAccessToken
      .addCase(refreshAccessToken.fulfilled, (state, action) => {
        state.token = action.payload.accessToken;
      })
      .addCase(refreshAccessToken.rejected, (state) => {
        // Refresh failed — force logout
        state.user = null;
        state.token = null;
        state.walletAddress = null;
        state.isAuthenticated = false;
      })
      // logoutFromServer
      .addCase(logoutFromServer.fulfilled, (state) => {
        state.user = null;
        state.token = null;
        state.walletAddress = null;
        state.isAuthenticated = false;
      });
  },
});

export const { setAuthFromWallet, logout, clearError } = authSlice.actions;
export default authSlice.reducer;
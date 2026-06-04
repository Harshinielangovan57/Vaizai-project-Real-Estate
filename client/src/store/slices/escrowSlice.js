// src/store/slices/escrowSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL;

export const fetchMyDeals = createAsyncThunk(
  'escrow/fetchMyDeals',
  async (_, { getState, rejectWithValue }) => {
    try {
      const token = getState().auth.token;
      const { data } = await axios.get(`${API}/api/escrow/my-deals`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return data.deals || [];
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

const escrowSlice = createSlice({
  name: 'escrow',
  initialState: {
    deals:       [],
    currentDeal: null,
    loading:     false,
    error:       null,
  },
  reducers: {
    // ── Socket: escrow:stateChange ─────────────────────────────────────────
    escrowStateChanged(state, action) {
      const updatedDeal = action.payload.deal || action.payload;
      if (!updatedDeal?._id) return;

      // Update in list
      const idx = state.deals.findIndex((d) => d._id === updatedDeal._id);
      if (idx >= 0) {
        state.deals[idx] = updatedDeal;
      } else {
        state.deals.unshift(updatedDeal);
      }

      // Update currentDeal if open
      if (state.currentDeal?._id === updatedDeal._id) {
        state.currentDeal = updatedDeal;
      }
    },

    setCurrentDeal(state, action) {
      state.currentDeal = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMyDeals.pending,   (state) => { state.loading = true;  state.error = null; })
      .addCase(fetchMyDeals.fulfilled, (state, action) => {
        state.loading = false;
        state.deals   = action.payload;
      })
      .addCase(fetchMyDeals.rejected,  (state, action) => {
        state.loading = false;
        state.error   = action.payload;
      });
  },
});

export const { escrowStateChanged, setCurrentDeal } = escrowSlice.actions;
export default escrowSlice.reducer;
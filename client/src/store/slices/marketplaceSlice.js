// src/store/slices/marketplaceSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL;

export const fetchListings = createAsyncThunk(
  'marketplace/fetchListings',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await axios.get(`${API}/api/marketplace`, { params });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

const marketplaceSlice = createSlice({
  name: 'marketplace',
  initialState: {
    listings:        [],
    total:           0,
    currentListing:  null,
    loading:         false,
    error:           null,
  },
  reducers: {
    // ── Socket: listing:sold ───────────────────────────────────────────────
    listingRemoved(state, action) {
      const listingId = action.payload;
      state.listings = state.listings.filter((l) => l._id !== listingId);
      state.total    = Math.max(0, state.total - 1);
    },

    // ── Socket: agreement:signed ───────────────────────────────────────────
    agreementUpdated(state, action) {
      const updated = action.payload;
      if (!updated?._id) return;
      // If currentListing has an embedded agreement, update it
      if (state.currentListing?.agreement?._id === updated._id) {
        state.currentListing.agreement = updated;
      }
    },

    setCurrentListing(state, action) {
      state.currentListing = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchListings.pending,   (state) => { state.loading = true;  state.error = null; })
      .addCase(fetchListings.fulfilled, (state, action) => {
        state.loading  = false;
        state.listings = action.payload.listings || [];
        state.total    = action.payload.total    || 0;
      })
      .addCase(fetchListings.rejected,  (state, action) => {
        state.loading = false;
        state.error   = action.payload;
      });
  },
});

export const { listingRemoved, agreementUpdated, setCurrentListing } =
  marketplaceSlice.actions;
export default marketplaceSlice.reducer;
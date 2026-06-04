// src/store/slices/auctionSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL;

export const fetchAuctions = createAsyncThunk(
  'auction/fetchAll',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await axios.get(`${API}/api/auctions`, { params });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const fetchAuctionById = createAsyncThunk(
  'auction/fetchById',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await axios.get(`${API}/api/auctions/${id}`);
      return data.auction;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

const auctionSlice = createSlice({
  name: 'auction',
  initialState: {
    auctions:       [],   // list page
    currentAuction: null, // detail page
    bids:           [],   // bids for currentAuction
    loading:        false,
    error:          null,
  },
  reducers: {
    // ── Socket: bid:new ─────────────────────────────────────────────────────
    bidReceived(state, action) {
      const { auctionId, amount, bidder, bidCount } = action.payload;

      // Update list
      state.auctions = state.auctions.map((a) =>
        a._id === auctionId
          ? { ...a, highestBid: amount, highestBidder: bidder, bidCount }
          : a
      );

      // Update detail
      if (state.currentAuction?._id === auctionId) {
        state.currentAuction.highestBid     = amount;
        state.currentAuction.highestBidder  = bidder;
        state.currentAuction.bidCount       = bidCount;
        // Prepend to bids feed
        state.bids = [{ bidder, amount, createdAt: new Date().toISOString() }, ...state.bids];
      }
    },

    // ── Socket: auction:ended ───────────────────────────────────────────────
    auctionEnded(state, action) {
      const { auctionId, winner, finalPrice } = action.payload;

      state.auctions = state.auctions.map((a) =>
        a._id === auctionId ? { ...a, ended: true, winner, finalPrice } : a
      );

      if (state.currentAuction?._id === auctionId) {
        state.currentAuction.ended      = true;
        state.currentAuction.winner     = winner;
        state.currentAuction.finalPrice = finalPrice;
      }
    },

    clearCurrentAuction(state) {
      state.currentAuction = null;
      state.bids = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAuctions.pending,  (state) => { state.loading = true;  state.error = null; })
      .addCase(fetchAuctions.fulfilled,(state, action) => {
        state.loading  = false;
        state.auctions = action.payload.auctions || [];
      })
      .addCase(fetchAuctions.rejected, (state, action) => {
        state.loading = false;
        state.error   = action.payload;
      })
      .addCase(fetchAuctionById.fulfilled, (state, action) => {
        state.currentAuction = action.payload;
        state.bids           = action.payload?.bids || [];
      });
  },
});

export const { bidReceived, auctionEnded, clearCurrentAuction } = auctionSlice.actions;
export default auctionSlice.reducer;
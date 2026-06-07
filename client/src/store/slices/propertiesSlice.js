// src/store/slices/propertiesSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL;

// ── Thunks ────────────────────────────────────────────────────────────────────

export const fetchProperties = createAsyncThunk(
  'properties/fetchAll',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await axios.get(`${API}/api/properties`, { params });
      return data; // { properties, total, page, pages }
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const fetchPropertyById = createAsyncThunk(
  'properties/fetchById',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await axios.get(`${API}/api/properties/${id}`);
      return data.property;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const createProperty = createAsyncThunk(
  'properties/create',
  async (formData, { getState, rejectWithValue }) => {
    try {
      const token = getState().auth.token;
      const { data } = await axios.post(`${API}/api/properties`, formData, {
        headers: {
          Authorization:  `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });
      return data.property;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const updateProperty = createAsyncThunk(
  'properties/update',
  async ({ id, updates }, { getState, rejectWithValue }) => {
    try {
      const token = getState().auth.token;
      const { data } = await axios.put(
        `${API}/api/properties/${id}`,
        updates,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return data.property;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const tokenizeProperty = createAsyncThunk(
  'properties/tokenize',
  async (id, { getState, rejectWithValue }) => {
    try {
      const token = getState().auth.token;
      const { data } = await axios.post(
        `${API}/api/properties/${id}/tokenize`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return data.property;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const requestAiValuation = createAsyncThunk(
  'properties/aiValuation',
  async (propertyData, { getState, rejectWithValue }) => {
    try {
      const token = getState().auth.token;
      const { data } = await axios.post(
        `${API}/api/properties/tmp/valuate`,
        propertyData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return data; // { valuation, suggestedEth }
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

// ── Slice ─────────────────────────────────────────────────────────────────────

const DEFAULT_FILTERS = {
  q:            '',
  propertyType: 'Any',
  priceMin:     '',
  priceMax:     '',
  sqFtMin:      '',
  sqFtMax:      '',
  verified:     false,
  sort:         'date',
};

const propertiesSlice = createSlice({
  name: 'properties',
  initialState: {
    // List
    list:       [],
    total:      0,
    filters:    DEFAULT_FILTERS,
    pagination: { page: 1, pages: 1, limit: 12 },

    // Detail
    currentProperty: null,

    // AI Valuation result (used in ListPropertyPage step 4)
    aiValuation: null,   // { usd: number, eth: string }

    // Async states
    loading:          false,
    tokenizeLoading:  false,
    valuationLoading: false,
    error:            null,
  },
  reducers: {
    setFilters(state, action) {
      state.filters    = { ...state.filters, ...action.payload };
      state.pagination = { ...state.pagination, page: 1 };
    },
    resetFilters(state) {
      state.filters    = DEFAULT_FILTERS;
      state.pagination = { ...state.pagination, page: 1 };
    },
    setPage(state, action) {
      state.pagination.page = action.payload;
    },
    clearCurrentProperty(state) {
      state.currentProperty = null;
    },
    clearAiValuation(state) {
      state.aiValuation = null;
    },
    // Called by SocketProvider when PropertyVerified event fires
    propertyVerified(state, action) {
      const { propertyId } = action.payload;
      state.list = state.list.map((p) =>
        p._id === propertyId ? { ...p, verified: true } : p
      );
      if (state.currentProperty?._id === propertyId) {
        state.currentProperty.verified = true;
      }
    },
  },
  extraReducers: (builder) => {
    // fetchProperties
    builder
      .addCase(fetchProperties.pending, (state) => {
        state.loading = true;
        state.error   = null;
      })
      .addCase(fetchProperties.fulfilled, (state, action) => {
        state.loading           = false;
        state.list              = action.payload.properties || [];
        state.total             = action.payload.total      || 0;
        state.pagination.pages  = action.payload.pages      || 1;
      })
      .addCase(fetchProperties.rejected, (state, action) => {
        state.loading = false;
        state.error   = action.payload;
      });

    // fetchPropertyById
    builder
      .addCase(fetchPropertyById.pending, (state) => {
        state.loading = true;
        state.error   = null;
      })
      .addCase(fetchPropertyById.fulfilled, (state, action) => {
        state.loading         = false;
        state.currentProperty = action.payload;
      })
      .addCase(fetchPropertyById.rejected, (state, action) => {
        state.loading = false;
        state.error   = action.payload;
      });

    // createProperty
    builder
      .addCase(createProperty.pending, (state) => {
        state.loading = true;
        state.error   = null;
      })
      .addCase(createProperty.fulfilled, (state, action) => {
        state.loading = false;
        state.list.unshift(action.payload);
        state.total += 1;
      })
      .addCase(createProperty.rejected, (state, action) => {
        state.loading = false;
        state.error   = action.payload;
      });

    // updateProperty
    builder
      .addCase(updateProperty.fulfilled, (state, action) => {
        const updated = action.payload;
        state.list = state.list.map((p) =>
          p._id === updated._id ? updated : p
        );
        if (state.currentProperty?._id === updated._id) {
          state.currentProperty = updated;
        }
      });

    // tokenizeProperty
    builder
      .addCase(tokenizeProperty.pending, (state) => {
        state.tokenizeLoading = true;
      })
      .addCase(tokenizeProperty.fulfilled, (state, action) => {
        state.tokenizeLoading = false;
        const updated = action.payload;
        state.list = state.list.map((p) =>
          p._id === updated._id ? updated : p
        );
        if (state.currentProperty?._id === updated._id) {
          state.currentProperty = updated;
        }
      })
      .addCase(tokenizeProperty.rejected, (state) => {
        state.tokenizeLoading = false;
      });

    // requestAiValuation
    builder
      .addCase(requestAiValuation.pending, (state) => {
        state.valuationLoading = true;
        state.aiValuation      = null;
      })
      .addCase(requestAiValuation.fulfilled, (state, action) => {
        state.valuationLoading = false;
        state.aiValuation = {
          usd: action.payload.valuation,
          eth: action.payload.suggestedEth,
        };
      })
      .addCase(requestAiValuation.rejected, (state) => {
        state.valuationLoading = false;
      });
  },
});

export const {
  setFilters, resetFilters, setPage,
  clearCurrentProperty, clearAiValuation,
  propertyVerified,
} = propertiesSlice.actions;

export default propertiesSlice.reducer;
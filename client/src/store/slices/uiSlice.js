// src/store/slices/uiSlice.js
import { createSlice } from '@reduxjs/toolkit';

/**
 * uiSlice
 *
 * Centralises all UI state that crosses component boundaries:
 *   - Modal open/close (PaymentModal, UpdateModal, PreviewModal, etc.)
 *   - Named loading states (so any component can show a spinner for a named op)
 *   - Global toast queue (supplements react-hot-toast for persistent notices)
 *   - Mobile sidebar open/close
 *   - Any other cross-cutting UI flag
 */

// ── Initial state ─────────────────────────────────────────────────────────────

const initialState = {
  // ── Modals ──────────────────────────────────────────────────────────────────
  // Each key is a modal id; value is { open: bool, props: any }
  modals: {
    payment:         { open: false, props: {} },
    propertyUpdate:  { open: false, props: {} },
    propertyPreview: { open: false, props: {} },
    imageGallery:    { open: false, props: {} },
    confirmDelete:   { open: false, props: {} },
    kycUpload:       { open: false, props: {} },
    disputeForm:     { open: false, props: {} },
  },

  // ── Named loading states ─────────────────────────────────────────────────────
  // Map of operationName → boolean
  loadingStates: {
    // e.g. 'buyProperty', 'placeBid', 'signAgreement', 'mintProperty'
  },

  // ── Toast queue ──────────────────────────────────────────────────────────────
  // Persistent toasts (different from react-hot-toast; these survive page nav)
  toasts: [],   // [{ id, type, message, autoDismiss }]

  // ── Navigation / layout ───────────────────────────────────────────────────────
  mobileSidebarOpen: false,
  activeAdminTab:    'stats',
  activeDashboardTab:'properties',
  theme:             localStorage.getItem('theme') || 'dark',
};

// ── Slice ─────────────────────────────────────────────────────────────────────

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleTheme(state) {
      state.theme = state.theme === 'dark' ? 'light' : 'dark';
      localStorage.setItem('theme', state.theme);
    },
    // ── Modals ─────────────────────────────────────────────────────────────────

    openModal(state, action) {
      const { id, props = {} } = action.payload;
      if (state.modals[id] !== undefined) {
        state.modals[id] = { open: true, props };
      } else {
        // Dynamic modal (not pre-declared in initialState)
        state.modals[id] = { open: true, props };
      }
    },

    closeModal(state, action) {
      const id = action.payload;
      if (state.modals[id]) {
        state.modals[id].open  = false;
        state.modals[id].props = {};
      }
    },

    closeAllModals(state) {
      Object.keys(state.modals).forEach((id) => {
        state.modals[id].open  = false;
        state.modals[id].props = {};
      });
    },

    // ── Loading states ─────────────────────────────────────────────────────────

    setLoading(state, action) {
      const { key, value } = action.payload;
      state.loadingStates[key] = value;
    },

    startLoading(state, action) {
      state.loadingStates[action.payload] = true;
    },

    stopLoading(state, action) {
      state.loadingStates[action.payload] = false;
    },

    // ── Toast queue ────────────────────────────────────────────────────────────

    pushToast(state, action) {
      const { type = 'info', message, autoDismiss = true } = action.payload;
      state.toasts.push({
        id:          `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        type,
        message,
        autoDismiss,
        createdAt:   new Date().toISOString(),
      });
    },

    dismissToast(state, action) {
      state.toasts = state.toasts.filter((t) => t.id !== action.payload);
    },

    clearToasts(state) {
      state.toasts = [];
    },

    // ── Navigation ─────────────────────────────────────────────────────────────

    setMobileSidebarOpen(state, action) {
      state.mobileSidebarOpen = action.payload;
    },

    toggleMobileSidebar(state) {
      state.mobileSidebarOpen = !state.mobileSidebarOpen;
    },

    setActiveAdminTab(state, action) {
      state.activeAdminTab = action.payload;
    },

    setActiveDashboardTab(state, action) {
      state.activeDashboardTab = action.payload;
    },
  },
});

export const {
  openModal, closeModal, closeAllModals,
  setLoading, startLoading, stopLoading,
  pushToast, dismissToast, clearToasts,
  setMobileSidebarOpen, toggleMobileSidebar,
  setActiveAdminTab, setActiveDashboardTab,
  toggleTheme,
} = uiSlice.actions;

export default uiSlice.reducer;

// ── Selectors ─────────────────────────────────────────────────────────────────

export const selectModal     = (id) => (state) => state.ui.modals[id] || { open: false, props: {} };
export const selectIsLoading = (key) => (state) => !!state.ui.loadingStates[key];
export const selectToasts    = (state) => state.ui.toasts;
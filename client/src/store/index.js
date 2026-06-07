// src/store/index.js
import { configureStore } from '@reduxjs/toolkit';

import authReducer          from './slices/authSlice';
import walletReducer        from './slices/walletSlice';
import propertiesReducer    from './slices/propertiesSlice';
import marketplaceReducer   from './slices/marketplaceSlice';
import auctionReducer       from './slices/auctionSlice';
import escrowReducer        from './slices/escrowSlice';
import uiReducer            from './slices/uiSlice';
import notificationsReducer from './slices/notificationsSlice';

export const store = configureStore({
  reducer: {
    // ── Core auth & wallet ─────────────────────────────────────────────────
    auth:          authReducer,          // user, token, walletAddress, isAuthenticated
    wallet:        walletReducer,        // address, chainId, balance, isConnected

    // ── Domain slices ──────────────────────────────────────────────────────
    properties:    propertiesReducer,    // list, currentProperty, filters, pagination
    marketplace:   marketplaceReducer,   // listings, currentListing
    auction:       auctionReducer,       // auctions, currentAuction, bids
    escrow:        escrowReducer,        // deals, currentDeal

    // ── UI ─────────────────────────────────────────────────────────────────
    ui:            uiReducer,            // modals, loadingStates, toasts
    notifications: notificationsReducer, // items, unread
  },

  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      // ethers.js BigInt values are not serializable — ignore wallet state
      serializableCheck: {
        ignoredPaths: ['wallet.provider', 'wallet.signer'],
      },
    }),

  devTools: import.meta.env.DEV,
});

export default store;
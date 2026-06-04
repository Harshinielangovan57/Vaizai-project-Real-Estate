import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import walletReducer from './slices/walletSlice';

// Additional slices referenced in spec §4.9 (stubs — implement when building those features)
// import propertiesReducer from './slices/propertiesSlice';
// import marketplaceReducer from './slices/marketplaceSlice';
// import auctionReducer from './slices/auctionSlice';
// import escrowReducer from './slices/escrowSlice';
// import uiReducer from './slices/uiSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    wallet: walletReducer,
    // properties: propertiesReducer,
    // marketplace: marketplaceReducer,
    // auction: auctionReducer,
    // escrow: escrowReducer,
    // ui: uiReducer,
  },
  devTools: import.meta.env.DEV,
});

export default store;
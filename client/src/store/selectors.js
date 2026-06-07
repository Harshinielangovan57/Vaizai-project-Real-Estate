// src/store/selectors.js
/**
 * Centralised selectors for all slices.
 * Import from here rather than writing inline (s) => s.slice.field everywhere.
 *
 * Usage:
 *   import { selectUser, selectWalletAddress } from '../store/selectors';
 *   const user = useSelector(selectUser);
 */

// ── auth ──────────────────────────────────────────────────────────────────────
export const selectUser            = (s) => s.auth.user;
export const selectToken           = (s) => s.auth.token;
export const selectWalletAddress   = (s) => s.auth.walletAddress;
export const selectIsAuthenticated = (s) => s.auth.isAuthenticated;
export const selectAuthLoading     = (s) => s.auth.isLoading;
export const selectAuthError       = (s) => s.auth.error;

// ── wallet ────────────────────────────────────────────────────────────────────
export const selectAddress          = (s) => s.wallet.address;
export const selectChainId          = (s) => s.wallet.chainId;
export const selectBalance          = (s) => s.wallet.balance;
export const selectIsConnected      = (s) => s.wallet.isConnected;
export const selectIsCorrectNetwork = (s) => s.wallet.isCorrectNetwork;
export const selectIsConnecting     = (s) => s.wallet.isConnecting;

// ── properties ────────────────────────────────────────────────────────────────
export const selectPropertyList        = (s) => s.properties.list;
export const selectPropertyTotal       = (s) => s.properties.total;
export const selectPropertyFilters     = (s) => s.properties.filters;
export const selectPropertyPagination  = (s) => s.properties.pagination;
export const selectCurrentProperty     = (s) => s.properties.currentProperty;
export const selectAiValuation         = (s) => s.properties.aiValuation;
export const selectPropertiesLoading   = (s) => s.properties.loading;
export const selectTokenizeLoading     = (s) => s.properties.tokenizeLoading;
export const selectValuationLoading    = (s) => s.properties.valuationLoading;

// ── marketplace ───────────────────────────────────────────────────────────────
export const selectListings        = (s) => s.marketplace.listings;
export const selectListingTotal    = (s) => s.marketplace.total;
export const selectCurrentListing  = (s) => s.marketplace.currentListing;
export const selectMarketLoading   = (s) => s.marketplace.loading;

// ── auction ───────────────────────────────────────────────────────────────────
export const selectAuctions        = (s) => s.auction.auctions;
export const selectCurrentAuction  = (s) => s.auction.currentAuction;
export const selectBids            = (s) => s.auction.bids;
export const selectAuctionLoading  = (s) => s.auction.loading;

// ── escrow ────────────────────────────────────────────────────────────────────
export const selectDeals           = (s) => s.escrow.deals;
export const selectCurrentDeal     = (s) => s.escrow.currentDeal;
export const selectEscrowLoading   = (s) => s.escrow.loading;

// ── ui ────────────────────────────────────────────────────────────────────────
export const selectModal           = (id) => (s) => s.ui.modals[id] || { open: false, props: {} };
export const selectIsLoading       = (key) => (s) => !!s.ui.loadingStates[key];
export const selectToasts          = (s) => s.ui.toasts;
export const selectMobileSidebar   = (s) => s.ui.mobileSidebarOpen;
export const selectActiveAdminTab  = (s) => s.ui.activeAdminTab;
export const selectActiveDashTab   = (s) => s.ui.activeDashboardTab;

// ── notifications ─────────────────────────────────────────────────────────────
export const selectNotifications   = (s) => s.notifications.items;
export const selectUnreadCount     = (s) => s.notifications.unread;
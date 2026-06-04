// src/components/SocketProvider.jsx
import { useEffect, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useSocket } from '../hooks/useSocket';
import { addNotification } from '../store/slices/notificationsSlice';

// Per-feature slice actions (import from wherever you keep them)
import { bidReceived, auctionEnded } from '../store/slices/auctionSlice';
import { escrowStateChanged }        from '../store/slices/escrowSlice';
import { agreementUpdated }          from '../store/slices/marketplaceSlice';
import { listingRemoved }            from '../store/slices/marketplaceSlice';

/**
 * SocketProvider
 *
 * Mount this ONCE inside <Provider> and <BrowserRouter>, just inside App.
 * It wires every server→client Socket.io event to:
 *   1. The relevant Redux slice
 *   2. A react-hot-toast notification
 *   3. The notifications bell (notificationsSlice)
 *
 * Renders nothing — purely side-effectful.
 */
export default function SocketProvider({ children }) {
  const dispatch  = useDispatch();
  const location  = useLocation();
  const socket    = useSocket();

  // ── bid:new ──────────────────────────────────────────────────────────────
  // Updates auction bid feed on the detail page.
  const onBidNew = useCallback((data) => {
    dispatch(bidReceived(data));

    // Only toast if we're NOT on the auction's own property page
    // (the page already shows the live feed inline)
    const onDetailPage = location.pathname.includes(`/properties/${data.propertyId}`);
    if (!onDetailPage) {
      toast(
        `New bid on ${data.propertyTitle || 'an auction'}: ${data.amount} ETH`,
        {
          icon: '⚡',
          style: { background: '#1a1a1a', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.2)' },
        }
      );
    }

    dispatch(addNotification({
      id:        `bid-${data.auctionId}-${Date.now()}`,
      type:      'bid',
      message:   `New bid: ${data.amount} ETH on ${data.propertyTitle || 'an auction'}`,
      read:      false,
      createdAt: new Date().toISOString(),
      link:      data.propertyId ? `/properties/${data.propertyId}` : null,
    }));
  }, [dispatch, location.pathname]);

  // ── auction:ended ─────────────────────────────────────────────────────────
  // Shows a banner/toast; updates auction state so the bid button disappears.
  const onAuctionEnded = useCallback((data) => {
    dispatch(auctionEnded(data));

    toast(
      (t) => (
        <div className="flex items-center gap-3">
          <span className="text-xl">🏁</span>
          <div>
            <p className="font-semibold text-white text-sm">Auction ended</p>
            <p className="text-xs text-neutral-400">
              {data.propertyTitle || 'Property'} — winner:{' '}
              {data.winner ? `${data.winner.slice(0, 8)}…` : 'No bids'}
            </p>
          </div>
          <button onClick={() => toast.dismiss(t.id)} className="ml-2 text-neutral-500 hover:text-white text-xs">
            ✕
          </button>
        </div>
      ),
      {
        duration: 8000,
        style: { background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', maxWidth: 380 },
      }
    );

    dispatch(addNotification({
      id:        `auction-ended-${data.auctionId}`,
      type:      'auction',
      message:   `Auction ended: ${data.propertyTitle || 'Property'}`,
      read:      false,
      createdAt: new Date().toISOString(),
      link:      data.propertyId ? `/properties/${data.propertyId}` : null,
    }));
  }, [dispatch]);

  // ── escrow:stateChange ────────────────────────────────────────────────────
  // Updates the escrow panel on the property detail page.
  const onEscrowStateChange = useCallback((data) => {
    dispatch(escrowStateChanged(data));

    const msg = {
      AWAITING_DELIVERY: 'Payment confirmed — awaiting delivery',
      COMPLETE:          'Escrow complete — funds released to seller',
      DISPUTED:          'Dispute raised on your deal',
      REFUNDED:          'Escrow refunded to buyer',
    }[data.state] || `Escrow updated: ${data.state}`;

    toast(msg, {
      icon: '🔒',
      style: { background: '#1a1a1a', color: '#e5e5e5', border: '1px solid rgba(255,255,255,0.08)' },
    });

    dispatch(addNotification({
      id:        `escrow-${data.dealId}-${data.state}`,
      type:      'escrow',
      message:   msg,
      read:      false,
      createdAt: new Date().toISOString(),
      link:      data.propertyId ? `/properties/${data.propertyId}` : '/dashboard',
    }));
  }, [dispatch]);

  // ── agreement:signed ──────────────────────────────────────────────────────
  // Updates the agreement panel's signing status.
  const onAgreementSigned = useCallback((data) => {
    dispatch(agreementUpdated(data.agreement));

    const both = data.agreement?.sellerSigned && data.agreement?.buyerSigned;
    const msg  = both
      ? 'Both parties have signed the agreement!'
      : `${data.signerRole === 'seller' ? 'Seller' : 'Buyer'} signed the agreement`;

    toast.success(msg, {
      style: { background: '#1a1a1a', border: '1px solid rgba(52,211,153,0.2)' },
    });

    dispatch(addNotification({
      id:        `agreement-${data.agreement?._id}-signed`,
      type:      'agreement',
      message:   msg,
      read:      false,
      createdAt: new Date().toISOString(),
      link:      data.propertyId ? `/properties/${data.propertyId}` : '/dashboard',
    }));
  }, [dispatch]);

  // ── listing:sold ──────────────────────────────────────────────────────────
  // Removes the sold card from the Marketplace page in real time.
  const onListingSold = useCallback((data) => {
    dispatch(listingRemoved(data.listingId));

    toast(
      `Property sold: ${data.propertyTitle || 'A listing'}`,
      {
        icon: '🏠',
        style: { background: '#1a1a1a', color: '#a3e635', border: '1px solid rgba(163,230,53,0.15)' },
      }
    );
  }, [dispatch]);

  // ── notification:new ─────────────────────────────────────────────────────
  // Generic server-pushed notification → bell badge.
  const onNotificationNew = useCallback((data) => {
    dispatch(addNotification({
      id:        data.id || `notif-${Date.now()}`,
      type:      data.type || 'info',
      message:   data.message,
      read:      false,
      createdAt: data.createdAt || new Date().toISOString(),
      link:      data.link || null,
    }));

    toast(data.message, {
      icon: '🔔',
      style: { background: '#1a1a1a', color: '#e5e5e5', border: '1px solid rgba(255,255,255,0.08)' },
    });
  }, [dispatch]);

  // ── Register / unregister all listeners ───────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    socket.on('bid:new',            onBidNew);
    socket.on('auction:ended',      onAuctionEnded);
    socket.on('escrow:stateChange', onEscrowStateChange);
    socket.on('agreement:signed',   onAgreementSigned);
    socket.on('listing:sold',       onListingSold);
    socket.on('notification:new',   onNotificationNew);

    return () => {
      socket.off('bid:new',            onBidNew);
      socket.off('auction:ended',      onAuctionEnded);
      socket.off('escrow:stateChange', onEscrowStateChange);
      socket.off('agreement:signed',   onAgreementSigned);
      socket.off('listing:sold',       onListingSold);
      socket.off('notification:new',   onNotificationNew);
    };
  }, [socket, onBidNew, onAuctionEnded, onEscrowStateChange,
      onAgreementSigned, onListingSold, onNotificationNew]);

  return children;
}
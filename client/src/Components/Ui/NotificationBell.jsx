// src/components/ui/NotificationBell.jsx
import { useState, useRef, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { markAllRead, markRead, clearAll } from '../../store/slices/notificationsSlice';

const TYPE_META = {
  bid:       { icon: '⚡', color: 'text-amber-400'   },
  auction:   { icon: '🏁', color: 'text-red-400'     },
  escrow:    { icon: '🔒', color: 'text-blue-400'    },
  agreement: { icon: '📄', color: 'text-indigo-400'  },
  info:      { icon: '🔔', color: 'text-neutral-400' },
};

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000)  return 'just now';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  return `${Math.floor(diff / 86400_000)}d ago`;
}

export default function NotificationBell() {
  const dispatch  = useDispatch();
  const navigate  = useNavigate();
  const { items, unread } = useSelector((s) => s.notifications);

  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleOpen = () => {
    setOpen((o) => !o);
  };

  const handleClick = (notif) => {
    dispatch(markRead(notif.id));
    if (notif.link) { navigate(notif.link); setOpen(false); }
  };

  return (
    <div ref={ref} className="relative">
      {/* Bell button */}
      <button
        onClick={handleOpen}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-white/8 bg-white/5 text-neutral-400 transition hover:bg-white/10 hover:text-white"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>

        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 rounded-2xl border border-white/10 bg-neutral-900 shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
            <p className="text-sm font-semibold text-white">
              Notifications
              {unread > 0 && (
                <span className="ml-2 rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {unread}
                </span>
              )}
            </p>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button
                  onClick={() => dispatch(markAllRead())}
                  className="text-xs text-indigo-400 hover:underline"
                >
                  Mark all read
                </button>
              )}
              {items.length > 0 && (
                <button
                  onClick={() => dispatch(clearAll())}
                  className="text-xs text-neutral-500 hover:text-white"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-neutral-600">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-2 opacity-40">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                </svg>
                <p className="text-xs">No notifications yet</p>
              </div>
            ) : (
              items.map((n) => {
                const meta = TYPE_META[n.type] || TYPE_META.info;
                return (
                  <button
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={`flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-white/5 ${
                      !n.read ? 'bg-white/[0.03]' : ''
                    }`}
                  >
                    <span className="mt-0.5 shrink-0 text-base">{meta.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs leading-relaxed ${n.read ? 'text-neutral-400' : 'text-white'}`}>
                        {n.message}
                      </p>
                      <p className="mt-0.5 text-[10px] text-neutral-600">{timeAgo(n.createdAt)}</p>
                    </div>
                    {!n.read && (
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-500" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
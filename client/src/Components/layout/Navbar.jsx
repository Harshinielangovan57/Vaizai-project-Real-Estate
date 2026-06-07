// src/components/layout/Navbar.jsx
import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useSelector } from 'react-redux';
import WalletButton      from '../wallet/WalletButton';
import NotificationBell  from '../ui/NotificationBell';

export default function Navbar() {
  const { isAuthenticated, user } = useSelector((s) => s.auth);
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = [
    { to: '/marketplace', label: 'Marketplace' },
    { to: '/auctions',    label: 'Auctions'    },
    ...(isAuthenticated ? [{ to: '/dashboard', label: 'Dashboard' }] : []),
    ...(user?.role === 'admin' ? [{ to: '/admin', label: 'Admin' }] : []),
  ];

  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-white/5 bg-neutral-950/80 backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 lg:px-8">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 text-white">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-xs font-black">
            RE
          </span>
          <span
            className="hidden font-semibold tracking-tight sm:block"
            style={{ fontFamily: "'DM Serif Display', Georgia, serif" }}
          >
            RealNFT
          </span>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden items-center gap-6 md:flex">
          {navLinks.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `text-sm transition ${isActive ? 'font-medium text-white' : 'text-neutral-400 hover:text-white'}`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {/* List Property button — visible to all authenticated users */}
          {isAuthenticated && (
            <Link
              to="/list"
              className="hidden rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-500 sm:block"
            >
              + List Property
            </Link>
          )}

          {/* Notification bell — authenticated users only */}
          {isAuthenticated && <NotificationBell />}

          {/* Wallet button */}
          <WalletButton />

          {/* Mobile hamburger */}
          <button
            className="ml-1 rounded p-1 text-neutral-400 hover:text-white md:hidden"
            onClick={() => setMobileOpen((o) => !o)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {mobileOpen
                ? <path d="M18 6 6 18M6 6l12 12" />
                : <path d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-white/5 bg-neutral-950 px-4 pb-4 md:hidden">
          {navLinks.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              onClick={() => setMobileOpen(false)}
              className="block py-2.5 text-sm text-neutral-300 hover:text-white"
            >
              {l.label}
            </NavLink>
          ))}
          {isAuthenticated && (
            <Link
              to="/list"
              onClick={() => setMobileOpen(false)}
              className="mt-2 block rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white text-center"
            >
              + List Property
            </Link>
          )}
        </div>
      )}
    </header>
  );
}
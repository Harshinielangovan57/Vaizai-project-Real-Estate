import { useState } from 'react';
import { Link, NavLink} from 'react-router-dom';
import { useSelector } from 'react-redux';
import WalletButton from '../wallet/WalletButton';

export default function Navbar() {
  const { isAuthenticated, user } = useSelector((s) => s.auth);
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = [
    { to: '/marketplace', label: 'Marketplace' },
    { to: '/auctions', label: 'Auctions' },
    ...(isAuthenticated ? [{ to: '/dashboard', label: 'Dashboard' }] : []),
    ...(user?.role === 'admin' ? [{ to: '/admin', label: 'Admin' }] : []),
  ];

  return (
    <header className="fixed top-0 inset-x-0 z-40 border-b border-white/5 bg-neutral-950/80 backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 lg:px-8">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 text-white">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-xs font-black tracking-tight">RE</span>
          <span className="hidden font-semibold tracking-tight sm:block" style={{ fontFamily: "'DM Serif Display', Georgia, serif" }}>
            RealNFT
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-6 md:flex">
          {navLinks.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `text-sm transition ${isActive ? 'text-white font-medium' : 'text-neutral-400 hover:text-white'}`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {user?.role === 'seller' || user?.role === 'admin' ? (
            <Link
              to="/list"
              className="hidden rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-500 sm:block"
            >
              + List Property
            </Link>
          ) : null}
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
        </div>
      )}
    </header>
  );
}
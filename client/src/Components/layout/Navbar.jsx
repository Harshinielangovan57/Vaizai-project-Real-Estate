// src/components/layout/Navbar.jsx
import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import WalletButton      from '../wallet/WalletButton';
import NotificationBell  from '../ui/NotificationBell';
import { logoutFromServer, logout } from '../../store/slices/authSlice';
import { toggleTheme } from '../../store/slices/uiSlice';

export default function Navbar() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useSelector((s) => s.auth);
  const theme = useSelector((s) => s.ui.theme);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const handleLogout = async () => {
    setProfileOpen(false);
    try {
      await dispatch(logoutFromServer()).unwrap();
    } catch (err) {
      dispatch(logout());
    }
    navigate('/');
  };

  const navLinks = [
    { to: '/marketplace', label: 'Marketplace' },
    { to: '/auctions',    label: 'Auctions'    },
    ...(isAuthenticated ? [{ to: '/dashboard', label: 'Dashboard' }] : []),
    ...(user?.role === 'admin' ? [{ to: '/admin', label: 'Admin' }] : []),
  ];

  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-black/5 dark:border-white/5 bg-white/90 dark:bg-neutral-950/80 backdrop-blur-md transition-colors duration-300">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 lg:px-8">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 text-neutral-900 dark:text-white">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-xs font-black text-white">
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
                `text-sm transition ${
                  isActive
                    ? 'font-medium text-indigo-600 dark:text-white'
                    : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
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

          {/* Theme Toggle Button — always visible icon */}
          <button
            onClick={() => dispatch(toggleTheme())}
            aria-label="Toggle theme"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/10 backdrop-blur-sm transition-all duration-200 hover:bg-white/20 hover:border-white/40 hover:scale-110 active:scale-95 focus:outline-none cursor-pointer"
            style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.08)' }}
          >
            {theme === 'dark' ? (
              /* Sun icon — switch to Light */
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" fill="#fbbf2430" />
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              </svg>
            ) : (
              /* Moon icon — switch to Dark */
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#6366f1" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>

          {/* Auth buttons / User Profile dropdown */}
          {isAuthenticated ? (
            <div className="relative hidden md:block">
              <button
                onClick={() => setProfileOpen((o) => !o)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-sm font-black text-white hover:bg-indigo-500 transition select-none cursor-pointer focus:outline-none"
              >
                {(user?.name || user?.email || 'U')[0].toUpperCase()}
              </button>

              {profileOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
                  <div className="absolute right-0 mt-2 w-48 rounded-xl border border-white/10 bg-neutral-900 shadow-xl z-50 py-1 overflow-hidden">
                    <div className="px-4 py-2 border-b border-white/5">
                      <p className="text-[10px] text-neutral-500 font-medium tracking-wider uppercase">Signed in as</p>
                      <p className="truncate text-sm font-semibold text-white mt-0.5">{user?.name || user?.email}</p>
                    </div>
                    
                    <Link
                      to="/dashboard"
                      onClick={() => setProfileOpen(false)}
                      className="flex w-full items-center px-4 py-2 text-sm text-neutral-300 hover:bg-white/5 transition"
                    >
                      My Dashboard
                    </Link>
                    
                    {user?.role === 'admin' && (
                      <Link
                        to="/admin"
                        onClick={() => setProfileOpen(false)}
                        className="flex w-full items-center px-4 py-2 text-sm text-neutral-300 hover:bg-white/5 transition"
                      >
                        Admin Panel
                      </Link>
                    )}

                    <div className="h-px bg-white/5 my-1" />
                    
                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center px-4 py-2 text-sm text-red-400 hover:bg-white/5 transition text-left cursor-pointer"
                    >
                      Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="hidden items-center gap-3 md:flex">
              <Link
                to="/auth/login"
                className="text-sm font-medium text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white transition py-1.5"
              >
                Sign In
              </Link>
              <Link
                to="/auth/register"
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium !text-white transition hover:bg-indigo-500"
              >
                Register
              </Link>
            </div>
          )}

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
        <div className="border-t border-black/5 dark:border-white/5 bg-white dark:bg-neutral-950 px-4 pb-4 md:hidden transition-colors duration-300">
          {navLinks.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              onClick={() => setMobileOpen(false)}
              className="block py-2.5 text-sm text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white"
            >
              {l.label}
            </NavLink>
          ))}
          {isAuthenticated ? (
            <div className="mt-4 flex flex-col gap-2 border-t border-white/5 pt-4">
              <button
                onClick={() => {
                  dispatch(toggleTheme());
                  setMobileOpen(false);
                }}
                className="flex items-center justify-between rounded-lg border border-white/10 px-3 py-2 text-sm font-medium text-neutral-300 hover:text-white transition cursor-pointer"
              >
                <span>Theme</span>
                <span>{theme === 'dark' ? '🌙 Dark Mode' : '☀️ Light Mode'}</span>
              </button>
              <div className="px-3 py-1.5">
                <p className="text-[10px] text-neutral-500 font-medium tracking-wider uppercase">Signed in as</p>
                <p className="truncate text-sm font-semibold text-white mt-0.5">{user?.name || user?.email}</p>
              </div>
              <Link
                to="/list"
                onClick={() => setMobileOpen(false)}
                className="block rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white text-center"
              >
                + List Property
              </Link>
              <button
                onClick={() => {
                  setMobileOpen(false);
                  handleLogout();
                }}
                className="block w-full rounded-lg bg-neutral-900 border border-white/10 px-3 py-2 text-sm font-medium text-red-400 text-center cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <div className="mt-4 flex flex-col gap-2 border-t border-white/5 pt-4">
              <button
                onClick={() => {
                  dispatch(toggleTheme());
                  setMobileOpen(false);
                }}
                className="flex items-center justify-between rounded-lg border border-white/10 px-3 py-2 text-sm font-medium text-neutral-300 hover:text-white transition cursor-pointer"
              >
                <span>Theme</span>
                <span>{theme === 'dark' ? '🌙 Dark Mode' : '☀️ Light Mode'}</span>
              </button>
              <Link
                to="/auth/login"
                onClick={() => setMobileOpen(false)}
                className="block rounded-lg border border-white/10 py-2 text-center text-sm font-medium text-neutral-300 hover:text-white"
              >
                Sign In
              </Link>
              <Link
                to="/auth/register"
                onClick={() => setMobileOpen(false)}
                className="block rounded-lg bg-indigo-600 py-2 text-center text-sm font-medium text-white"
              >
                Register
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
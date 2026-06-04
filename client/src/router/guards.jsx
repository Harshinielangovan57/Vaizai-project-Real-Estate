// src/router/guards.jsx
import { Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';

/**
 * RequireAuth
 * Redirects unauthenticated users to /auth/login, preserving the intended path.
 */
export function RequireAuth({ children }) {
  const { isAuthenticated } = useSelector((s) => s.auth);
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  return children;
}

/**
 * RequireRole
 * Redirects users who lack the required role to the home page.
 * Roles: 'user' | 'seller' | 'admin'
 */
export function RequireRole({ role, children }) {
  const { isAuthenticated, user } = useSelector((s) => s.auth);
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  // Role hierarchy: admin > seller > user
  const ROLE_RANK = { user: 0, seller: 1, admin: 2 };
  const userRank = ROLE_RANK[user?.role] ?? -1;
  const requiredRank = ROLE_RANK[role] ?? 99;

  if (userRank < requiredRank) {
    return <Navigate to="/" replace />;
  }

  return children;
}

/**
 * RedirectIfAuth
 * Used on /auth/* routes — redirect already-logged-in users to their intended dest or home.
 */
export function RedirectIfAuth({ children }) {
  const { isAuthenticated } = useSelector((s) => s.auth);
  const location = useLocation();
  const from = location.state?.from?.pathname || '/dashboard';

  if (isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  return children;
}
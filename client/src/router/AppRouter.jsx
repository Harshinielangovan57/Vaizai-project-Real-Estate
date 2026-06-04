import { Suspense, lazy } from 'react';
import { createBrowserRouter, RouterProvider, Outlet } from 'react-router-dom';
import { RequireAuth, RequireRole, RedirectIfAuth } from './guards';
import PageLoader from '../components/ui/PageLoader';

const HomePage          = lazy(() => import('../pages/HomePage'));
const MarketplacePage   = lazy(() => import('../pages/MarketplacePage'));
const AuctionsPage      = lazy(() => import('../pages/AuctionsPage'));
const PropertyDetailPage = lazy(() => import('../pages/PropertyDetailPage'));
const ListPropertyPage  = lazy(() => import('../pages/ListPropertyPage'));
const DashboardPage     = lazy(() => import('../pages/DashboardPage'));
const AdminPage         = lazy(() => import('../pages/AdminPage'));
const LoginPage         = lazy(() => import('../pages/auth/LoginPage'));
// const RegisterPage      = lazy(() => import('../pages/auth/RegisterPage'));
// const NotFoundPage      = lazy(() => import('../pages/NotFoundPage'));


function RootLayout() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Outlet />
    </Suspense>
  );
}


const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [

      {
        path: '/',
        element: <HomePage />,
      },
      {
        path: '/marketplace',
        element: <MarketplacePage />,
      },
      {
        path: '/auctions',
        element: <AuctionsPage />,
      },
      {
        path: '/properties/:id',
        element: <PropertyDetailPage />,
      },

      // ── Auth routes (redirect away if already logged in) ───────────────────

      {
        path: '/auth/login',
        element: (
          <RedirectIfAuth>
            <LoginPage />
          </RedirectIfAuth>
        ),
      },
      // {
      //   path: '/auth/register',
      //   element: (
      //     <RedirectIfAuth>
      //       {/* <RegisterPage /> */}
      //     </RedirectIfAuth>
      //   ),
      // },

     
      {
        path: '/list',
        element: (
          <RequireRole role="seller">
            <ListPropertyPage />
          </RequireRole>
        ),
      },

      {
        path: '/dashboard',
        element: (
          <RequireAuth>
            <DashboardPage />
          </RequireAuth>
        ),
      },

    
      {
        path: '/admin',
        element: (
          <RequireRole role="admin">
            <AdminPage />
          </RequireRole>
        ),
      },

   
      // {
      //   path: '*',
      //   element: <NotFoundPage />,
      // },
    ],
  },
]);


export default function AppRouter() {
  return <RouterProvider router={router} />;
}
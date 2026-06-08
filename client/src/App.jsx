// src/App.jsx
import { Provider, useSelector }   from 'react-redux';
import { useEffect }  from 'react';
import { Toaster }    from 'react-hot-toast';
import { store }      from './store';
import AppRouter      from './router/AppRouter';

function ThemeManager() {
  const theme = useSelector((s) => s.ui.theme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  return null;
}

export default function App() {
  return (
    <Provider store={store}>
      <ThemeManager />
      {/*
        Toaster — dark-themed, top-right.
        SocketProvider is INSIDE BrowserRouter (AppRouter creates it),
        so we wrap via AppRouter's layout.
      */}
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1a1a1a',
            color:      '#e5e5e5',
            border:     '1px solid rgba(255,255,255,0.08)',
            fontSize:   '0.875rem',
          },
          success: { iconTheme: { primary: '#34d399', secondary: '#1a1a1a' } },
          error:   { iconTheme: { primary: '#f87171', secondary: '#1a1a1a' } },
        }}
      />
      <AppRouter />
    </Provider>
  );
}
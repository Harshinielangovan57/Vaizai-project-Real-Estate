import { Provider } from 'react-redux';
import { Toaster } from 'react-hot-toast';
import { store } from './store';
import AppRouter from './router/AppRouter';

export default function App() {
  return (
    <Provider store={store}>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1a1a1a',
            color: '#e5e5e5',
            border: '1px solid rgba(255,255,255,0.08)',
            fontSize: '0.875rem',
          },
          success: { iconTheme: { primary: '#34d399', secondary: '#1a1a1a' } },
          error:   { iconTheme: { primary: '#f87171', secondary: '#1a1a1a' } },
        }}
      />
      <AppRouter />
    </Provider>
  );
}
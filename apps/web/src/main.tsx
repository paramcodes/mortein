import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { Toaster } from 'sonner';
import { router } from './router';
import './styles.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 3_000, retry: 1 } },
});

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('The app root element is missing.');

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster position="bottom-right" richColors />
    </QueryClientProvider>
  </React.StrictMode>,
);

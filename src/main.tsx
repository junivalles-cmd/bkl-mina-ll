import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProveedorSesion } from './ui/contexto';
import { App } from './ui/App';
import './index.css';

const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: true } } });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={qc}>
      <HashRouter>
        <ProveedorSesion>
          <App />
        </ProveedorSesion>
      </HashRouter>
    </QueryClientProvider>
  </StrictMode>,
);

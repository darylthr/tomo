import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { loadServerConfig } from './features/server/config';
import './shared/theme/tokens.css';

// Read /tomo.config.json first (first launch only), so the shelf loads from the right address.
void loadServerConfig().finally(() =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  ),
);

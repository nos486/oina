import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import './styles.css';
import { App } from './App';
import { ContentProvider } from './state/content';
import { startSync } from './lib/sync';
import { startPwa } from './lib/pwa';

startSync();
startPwa();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ContentProvider>
        <App />
      </ContentProvider>
    </BrowserRouter>
  </StrictMode>,
);

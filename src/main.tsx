import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { mock } from './events/adapters/mockAdapter';
import { dispatchExternalEvent } from './integrations/tikfinity';
import './styles.css';

// Console helpers for experiments (all produce clearly-labelled test events):
//   TikOverlay.mock.gift('sara', 'Rose', 3)
//   TikOverlay.dispatch({ type: 'follow', username: 'sara' })
Object.assign(window, { TikOverlay: { mock, dispatch: dispatchExternalEvent } });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

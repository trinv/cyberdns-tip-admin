import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
// Bootstrap side of the app (Sidebar/Header/LoginPage/Dashboard — Phase 1
// of the Tailwind→Bootstrap migration, see the plan). Imported AFTER
// index.css so Bootstrap's rules win the cascade on the handful of class
// names both frameworks define (e.g. `.container`) — safe for these 4
// already-converted files; the other 20+ files still on pure Tailwind
// don't use Bootstrap's `.container`/`.row`/etc. classes, so this ordering
// doesn't affect them.
import './styles/bootstrap/main.scss';
import 'bootstrap-icons/font/bootstrap-icons.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

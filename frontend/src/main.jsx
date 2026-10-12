/* eslint-disable react-refresh/only-export-components */
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import App from './App.jsx';
import { DEMO, BASE_URL } from './config/env';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { ConfirmProvider } from './context/ConfirmContext';
import { AuthProvider } from './context/AuthContext';
import { SettingsProvider } from './context/SettingsContext';
import { BookmarksProvider } from './context/BookmarksContext';
import { FollowsProvider } from './context/FollowsContext';
import { ReaderProvider } from './context/ReaderContext';
import { CategoriesProvider } from './context/CategoriesContext';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './css/site.css';
import './css/admin.css';
import './css/extra.css';

// The published live preview lives under a sub-path on static hosting, so it uses hash routes.
const Router = DEMO ? HashRouter : BrowserRouter;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Router>
      <ThemeProvider>
        <ToastProvider>
          <ConfirmProvider>
            <AuthProvider>
              <SettingsProvider>
                <BookmarksProvider>
                  <FollowsProvider>
                    <ReaderProvider>
                      <CategoriesProvider>
                        <App />
                      </CategoriesProvider>
                    </ReaderProvider>
                  </FollowsProvider>
                </BookmarksProvider>
              </SettingsProvider>
            </AuthProvider>
          </ConfirmProvider>
        </ToastProvider>
      </ThemeProvider>
    </Router>
  </React.StrictMode>,
);

// Offline support: the service worker caches the app shell and the stories you read.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${BASE_URL}sw.js`).catch(() => {});
  });
}

/* eslint-disable react-refresh/only-export-components */
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import App from './App.jsx';
import { DEMO } from './config/env';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { ConfirmProvider } from './context/ConfirmContext';
import { AuthProvider } from './context/AuthContext';
import { BookmarksProvider } from './context/BookmarksContext';
import { CategoriesProvider } from './context/CategoriesContext';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './css/site.css';
import './css/admin.css';

// The published demo lives under a sub-path on static hosting, so it uses hash routes.
const Router = DEMO ? HashRouter : BrowserRouter;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Router>
      <ThemeProvider>
        <ToastProvider>
          <ConfirmProvider>
            <AuthProvider>
              <BookmarksProvider>
                <CategoriesProvider>
                  <App />
                </CategoriesProvider>
              </BookmarksProvider>
            </AuthProvider>
          </ConfirmProvider>
        </ToastProvider>
      </ThemeProvider>
    </Router>
  </React.StrictMode>,
);

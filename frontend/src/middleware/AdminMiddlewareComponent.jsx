import { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { ThemeToggle, Logo } from '../components/layouts/HeaderComponent';
import DemoBanner from '../components/layouts/DemoBanner';
import { OfflineNotice } from '../components/layouts/Banners';
import useSeo from '../hooks/useSeo';
import { Skeleton } from '../components/ui/States';

// [path, icon, label, minimum role, end-match]
const LINKS = [
  ['/admin', 'bi-speedometer2', 'Dashboard', 'author', true],
  ['/admin/show-news', 'bi-newspaper', 'Articles', 'author', false],
  ['/admin/add-news', 'bi-plus-circle', 'New article', 'author', false],
  ['/admin/review', 'bi-clipboard-check', 'Review desk', 'editor', false],
  ['/admin/comments', 'bi-chat-left-text', 'Comments', 'editor', false],
  ['/admin/alert', 'bi-megaphone', 'Alert banner', 'editor', false],
  ['/admin/newsletter', 'bi-envelope-paper', 'Newsletter', 'admin', false],
  ['/admin/manage-category', 'bi-tags', 'Sections', 'admin', false],
  ['/admin/users-list', 'bi-people', 'Users and roles', 'admin', false],
  ['/admin/settings', 'bi-gear', 'Settings', 'admin', false],
  ['/admin/audit', 'bi-journal-text', 'Audit log', 'admin', false],
  ['/admin/my-profile', 'bi-person-circle', 'My profile', 'reader', false],
];
const RANK = { reader: 0, author: 1, editor: 2, admin: 3 };

export default function AdminMiddlewareComponent() {
  useSeo({ title: 'Newsroom', noindex: true });
  const { token, user, role, logout } = useAuth();
  const { settings } = useSettings();
  const location = useLocation();
  const navigate = useNavigate();
  const [drawer, setDrawer] = useState({ open: false, at: location.pathname });
  const open = drawer.open && drawer.at === location.pathname;

  useEffect(() => {
    window.scrollTo(0, 0);
    document.getElementById('admin-main')?.focus({ preventScroll: true });
  }, [location.pathname]);

  if (!token) return <Navigate to="/login" replace />;
  if (!user) {
    return (
      <div className="container section" role="status" aria-label="Loading">
        <Skeleton className="skeleton-title" /><Skeleton className="skeleton-row" /><Skeleton className="skeleton-row" />
      </div>
    );
  }

  const links = LINKS.filter(([, , , min]) => RANK[role] >= RANK[min]);
  const signOut = async () => { await logout(); navigate('/'); };

  return (
    <div className="admin">
      <a className="skip-link" href="#admin-main" onClick={(e) => { e.preventDefault(); document.getElementById('admin-main')?.focus(); }}>Skip to content</a>
      <DemoBanner />
      <OfflineNotice />
      <header className="admin-top">
        <button type="button" className="icon-btn admin-burger" aria-expanded={open} aria-controls="admin-side" aria-label={open ? 'Close menu' : 'Open menu'} onClick={() => setDrawer({ open: !open, at: location.pathname })}>
          <i className={`bi ${open ? 'bi-x-lg' : 'bi-list'}`} aria-hidden="true" />
        </button>
        <Link to="/admin" className="brand"><Logo /> <span className="brand-name">{settings.siteName} <small>Newsroom</small></span></Link>
        <div className="admin-top-actions">
          <Link to="/" className="btn btn-secondary btn-sm"><i className="bi bi-box-arrow-up-right" aria-hidden="true" /> <span>View site</span></Link>
          <ThemeToggle />
          <button type="button" className="btn btn-secondary btn-sm" onClick={signOut}><i className="bi bi-box-arrow-right" aria-hidden="true" /> <span>Sign out</span></button>
        </div>
      </header>
      <div className="admin-body">
        <nav id="admin-side" className={`admin-side ${open ? 'is-open' : ''}`} aria-label="Newsroom">
          <p className="admin-who"><strong>{user.name}</strong><span>{role}</span></p>
          <ul>
            {links.map(([to, icon, label, , end]) => (
              <li key={to}><NavLink to={to} end={end}><i className={`bi ${icon}`} aria-hidden="true" /> {label}</NavLink></li>
            ))}
          </ul>
        </nav>
        {open && <button type="button" className="admin-scrim" aria-label="Close menu" onClick={() => setDrawer({ open: false, at: location.pathname })} />}
        <main id="admin-main" className="admin-main" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

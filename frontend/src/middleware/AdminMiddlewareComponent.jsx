import { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ThemeToggle, Logo } from '../components/layouts/HeaderComponent';
import DemoBanner from '../components/layouts/DemoBanner';
import { SITE_NAME } from '../config/env';
import useSeo from '../hooks/useSeo';
import { Skeleton } from '../components/ui/States';

const LINKS = [
  ['/admin', 'bi-speedometer2', 'Dashboard', false, true],
  ['/admin/show-news', 'bi-newspaper', 'Articles', false, false],
  ['/admin/add-news', 'bi-plus-circle', 'New article', false, false],
  ['/admin/manage-category', 'bi-tags', 'Categories', true, false],
  ['/admin/comments', 'bi-chat-left-text', 'Comments', true, false],
  ['/admin/subscribers', 'bi-envelope-paper', 'Subscribers', true, false],
  ['/admin/users-list', 'bi-people', 'Users', true, false],
  ['/admin/my-profile', 'bi-person-circle', 'My profile', false, false],
];

export default function AdminMiddlewareComponent() {
  useSeo({ title: 'Admin' });
  const { token, user, isAdmin, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [drawer, setDrawer] = useState({ open: false, at: location.pathname });
  const open = drawer.open && drawer.at === location.pathname;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  if (!token) return <Navigate to="/login" replace />;
  if (!user) {
    return (
      <div className="container section" role="status" aria-label="Loading">
        <Skeleton className="skeleton-title" /><Skeleton className="skeleton-row" /><Skeleton className="skeleton-row" />
      </div>
    );
  }

  const links = LINKS.filter(([, , , adminOnly]) => isAdmin || !adminOnly);
  const signOut = async () => { await logout(); navigate('/'); };

  return (
    <div className="admin">
      <a className="skip-link" href="#admin-main">Skip to content</a>
      <DemoBanner />
      <header className="admin-top">
        <button type="button" className="icon-btn admin-burger" aria-expanded={open} aria-controls="admin-side" aria-label={open ? 'Close menu' : 'Open menu'} onClick={() => setDrawer({ open: !open, at: location.pathname })}>
          <i className={`bi ${open ? 'bi-x-lg' : 'bi-list'}`} aria-hidden="true" />
        </button>
        <Link to="/admin" className="brand"><Logo /> <span className="brand-name">{SITE_NAME} <small>Admin</small></span></Link>
        <div className="admin-top-actions">
          <Link to="/" className="btn btn-secondary btn-sm"><i className="bi bi-box-arrow-up-right" aria-hidden="true" /> <span>View site</span></Link>
          <ThemeToggle />
          <button type="button" className="btn btn-secondary btn-sm" onClick={signOut}><i className="bi bi-box-arrow-right" aria-hidden="true" /> <span>Sign out</span></button>
        </div>
      </header>
      <div className="admin-body">
        <nav id="admin-side" className={`admin-side ${open ? 'is-open' : ''}`} aria-label="Admin">
          <p className="admin-who"><strong>{user.name}</strong><span>{user.role}</span></p>
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

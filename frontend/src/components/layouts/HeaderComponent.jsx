import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useBookmarks } from '../../context/BookmarksContext';
import { useCategories } from '../../context/CategoriesContext';
import { useTheme } from '../../context/ThemeContext';
import { SITE_NAME } from '../../config/env';

export function Logo() {
  return (
    <svg className="logo-mark" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="8" fill="currentColor" />
      <path d="M8 23V9h3.2l7.6 9.6V9H22v14h-3.1L11.2 13.4V23H8z" fill="var(--logo-ink)" />
    </svg>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const box = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const initial = (user && user.name ? user.name : '?').charAt(0).toUpperCase();
  return (
    <div className="user-menu" ref={box}>
      <button type="button" className="avatar-btn" aria-haspopup="menu" aria-expanded={open} aria-label={`Account menu for ${user ? user.name : 'user'}`} onClick={() => setOpen((o) => !o)}>
        {user && user.image && !/notfound\.png$/.test(user.image) ? <img src={user.image} alt="" /> : <span aria-hidden="true">{initial}</span>}
      </button>
      {open && (
        <div className="menu" role="menu">
          <p className="menu-head">{user ? user.name : ''}<small>{user ? user.role : ''}</small></p>
          <Link role="menuitem" to="/admin" onClick={() => setOpen(false)}><i className="bi bi-speedometer2" aria-hidden="true" /> Dashboard</Link>
          <Link role="menuitem" to="/bookmarks" onClick={() => setOpen(false)}><i className="bi bi-bookmarks" aria-hidden="true" /> Reading list</Link>
          <button role="menuitem" type="button" onClick={async () => { setOpen(false); await logout(); navigate('/'); }}>
            <i className="bi bi-box-arrow-right" aria-hidden="true" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button type="button" className="icon-btn" onClick={toggle} aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} title={theme === 'dark' ? 'Light theme' : 'Dark theme'}>
      <i className={`bi ${theme === 'dark' ? 'bi-sun' : 'bi-moon-stars'}`} aria-hidden="true" />
    </button>
  );
}

export default function HeaderComponent() {
  const navigate = useNavigate();
  const location = useLocation();
  const { token, user } = useAuth();
  const { count } = useBookmarks();
  const { categories } = useCategories();
  const [menu, setMenu] = useState({ open: false, at: location.pathname });
  // the drawer closes on navigation without an effect: compare the path it was opened on
  const open = menu.open && menu.at === location.pathname;
  const setOpen = (value) => setMenu({ open: value, at: location.pathname });

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setMenu((m) => ({ ...m, open: false })); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const submitSearch = (e) => {
    e.preventDefault();
    const q = (new FormData(e.currentTarget).get('q') || '').toString().trim();
    setOpen(false);
    navigate(q ? `/news?search=${encodeURIComponent(q)}` : '/news');
  };

  return (
    <header className="site-header">
      <div className="container header-row">
        <Link className="brand" to="/" aria-label={`${SITE_NAME} home`}>
          <Logo /> <span className="brand-name">{SITE_NAME}</span>
        </Link>

        <div id="site-nav" className={`nav-panel ${open ? 'is-open' : ''}`}>
          <nav className="main-nav" aria-label="Main">
            <NavLink to="/" end>Home</NavLink>
            <NavLink to="/news">Latest</NavLink>
            <NavLink to="/bookmarks">Reading list{count > 0 && <span className="count-badge" aria-label={`${count} saved`}>{count}</span>}</NavLink>
            <NavLink to="/about">About</NavLink>
            <NavLink to="/contact">Contact</NavLink>
          </nav>
          <form className="search-form" role="search" onSubmit={submitSearch}>
            <label htmlFor="header-search" className="visually-hidden">Search articles</label>
            <input id="header-search" className="input" type="search" name="q" placeholder="Search articles" autoComplete="off" />
            <button type="submit" className="icon-btn" aria-label="Search"><i className="bi bi-search" aria-hidden="true" /></button>
          </form>
        </div>

        <div className="header-actions">
          <ThemeToggle />
          {token && user ? <UserMenu /> : (
            <Link to="/login" className="btn btn-primary btn-sm signin-link">Sign in</Link>
          )}
          <button type="button" className="icon-btn menu-toggle" aria-expanded={open} aria-controls="site-nav" aria-label={open ? 'Close menu' : 'Open menu'} onClick={() => setOpen(!open)}>
            <i className={`bi ${open ? 'bi-x-lg' : 'bi-list'}`} aria-hidden="true" />
          </button>
        </div>
      </div>

      {categories.length > 0 && (
        <nav className="category-bar" aria-label="Categories">
          <div className="container category-bar-row">
            {categories.map((c) => (
              <NavLink key={c._id} to={`/category/${c.slug}`}>{c.name}</NavLink>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}

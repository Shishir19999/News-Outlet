import { useEffect, useId, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import API from '../../config/API';
import { useAuth } from '../../context/AuthContext';
import { useBookmarks } from '../../context/BookmarksContext';
import { useCategories } from '../../context/CategoriesContext';
import { useSettings } from '../../context/SettingsContext';
import { useTheme } from '../../context/ThemeContext';

export function Logo() {
  return (
    <svg className="logo-mark" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="8" fill="currentColor" />
      <path d="M8 23V9h3.2l7.6 9.6V9H22v14h-3.1L11.2 13.4V23H8z" fill="var(--logo-ink)" />
    </svg>
  );
}

function UserMenu() {
  const { user, logout, role, isEditor, isAuthor } = useAuth();
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
  const desk = isEditor ? 'Newsroom desk' : isAuthor ? 'My articles' : 'My account';
  return (
    <div className="user-menu" ref={box}>
      <button type="button" className="avatar-btn" aria-haspopup="menu" aria-expanded={open} aria-label={`Account menu for ${user ? user.name : 'user'}`} onClick={() => setOpen((o) => !o)}>
        {user && user.image && !/notfound\.png$/.test(user.image) ? <img src={user.image} alt="" /> : <span aria-hidden="true">{initial}</span>}
      </button>
      {open && (
        <div className="menu" role="menu">
          <p className="menu-head">{user ? user.name : ''}<small>{role}</small></p>
          <Link role="menuitem" to="/admin" onClick={() => setOpen(false)}><i className="bi bi-speedometer2" aria-hidden="true" /> {desk}</Link>
          <Link role="menuitem" to="/for-you" onClick={() => setOpen(false)}><i className="bi bi-stars" aria-hidden="true" /> For you</Link>
          <Link role="menuitem" to="/bookmarks" onClick={() => setOpen(false)}><i className="bi bi-bookmarks" aria-hidden="true" /> Library</Link>
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

// Search box with suggestions (sections, stories, "did you mean").
function SearchBox({ onDone }) {
  const navigate = useNavigate();
  const id = useId();
  const [q, setQ] = useState('');
  const [items, setItems] = useState([]);
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(false);
  const box = useRef(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return undefined;
    let cancelled = false;
    const t = setTimeout(() => {
      API.get('/search/suggest', { params: { q: term } }).then((r) => { if (!cancelled) { setItems(r.data.suggestions || []); setActive(-1); } }).catch(() => {});
    }, 180);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q]);

  useEffect(() => {
    const onDown = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const go = (item) => {
    setOpen(false);
    onDone();
    if (!item) { navigate(q.trim() ? `/news?search=${encodeURIComponent(q.trim())}` : '/news'); return; }
    if (item.type === 'article') navigate(`/news-details/${item.slug}`);
    else if (item.type === 'section') navigate(`/category/${item.slug}`);
    else navigate(`/news?search=${encodeURIComponent(item.label)}`);
    setQ('');
  };
  const onKey = (e) => {
    if (e.key === 'Escape') setOpen(false);
    else if (e.key === 'ArrowDown' && shown.length) { e.preventDefault(); setOpen(true); setActive((a) => (a + 1) % shown.length); }
    else if (e.key === 'ArrowUp' && shown.length) { e.preventDefault(); setActive((a) => (a <= 0 ? shown.length - 1 : a - 1)); }
  };
  const shown = q.trim().length < 2 ? [] : items;
  const showList = open && shown.length > 0;
  return (
    <form className="search-form" role="search" aria-label="Site search" ref={box} onSubmit={(e) => { e.preventDefault(); go(active >= 0 ? shown[active] : null); }}>
      <label htmlFor={`${id}-q`} className="visually-hidden">Search articles</label>
      <input
        id={`${id}-q`} className="input" type="search" name="q" placeholder="Search articles" autoComplete="off" value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onKeyDown={onKey}
        role="combobox" aria-expanded={showList} aria-controls={`${id}-list`} aria-autocomplete="list" aria-activedescendant={active >= 0 ? `${id}-o${active}` : undefined}
      />
      <button type="submit" className="icon-btn" aria-label="Search"><i className="bi bi-search" aria-hidden="true" /></button>
      {showList && (
        <ul className="suggest" id={`${id}-list`} role="listbox" aria-label="Suggestions">
          {shown.map((s, i) => (
            <li key={`${s.type}-${s.label}`} id={`${id}-o${i}`} role="option" aria-selected={i === active} className={i === active ? 'is-active' : ''} onMouseDown={(e) => { e.preventDefault(); go(s); }}>
              <i className={`bi ${s.type === 'section' ? 'bi-folder2' : s.type === 'query' ? 'bi-arrow-return-right' : 'bi-newspaper'}`} aria-hidden="true" />
              <span>{s.type === 'query' ? <>Did you mean <strong>{s.label}</strong>?</> : s.label}</span>
              {s.type === 'section' && <small>Section</small>}
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}

// Mega menu: every section with its description, newest stories and popular topics.
function MegaMenu({ onNavigate }) {
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(null);
  const box = useRef(null);
  const id = useId();

  useEffect(() => {
    if (!open || menu) return;
    API.get('/category/menu').then((r) => setMenu(r.data)).catch(() => setMenu([]));
  }, [open, menu]);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') { setOpen(false); box.current?.querySelector('button')?.focus(); } };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const close = () => { setOpen(false); onNavigate(); };
  return (
    <div className="mega" ref={box}>
      <button type="button" className="mega-toggle" aria-expanded={open} aria-controls={`${id}-panel`} onClick={() => setOpen((o) => !o)}>
        Sections <i className={`bi ${open ? 'bi-chevron-up' : 'bi-chevron-down'}`} aria-hidden="true" />
      </button>
      {open && (
        <div className="mega-panel" id={`${id}-panel`}>
          {!menu ? <p className="muted">Loading sections…</p> : (
            <ul className="mega-grid">
              {menu.map((s) => (
                <li key={s._id} className="mega-col">
                  <Link to={`/category/${s.slug}`} className="mega-title" onClick={close}>{s.name}</Link>
                  {s.description && <p className="mega-desc">{s.description}</p>}
                  <ul className="mega-links">
                    {s.latest.map((n) => <li key={n._id}><Link to={`/news-details/${n.slug}`} onClick={close}>{n.title}</Link></li>)}
                  </ul>
                  {s.tags.length > 0 && (
                    <p className="mega-tags">
                      {s.tags.map((t) => <Link key={t} to={`/news?tag=${t}`} className="tag" onClick={close}>#{t}</Link>)}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default function HeaderComponent() {
  const location = useLocation();
  const { token, user } = useAuth();
  const { count } = useBookmarks();
  const { categories } = useCategories();
  const { settings } = useSettings();
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

  return (
    <header className="site-header">
      <div className="container header-row">
        <Link className="brand" to="/" aria-label={`${settings.siteName} home`}>
          <Logo /> <span className="brand-name">{settings.siteName}</span>
        </Link>

        <div id="site-nav" className={`nav-panel ${open ? 'is-open' : ''}`}>
          <nav className="main-nav" aria-label="Main">
            <NavLink to="/" end>Home</NavLink>
            <MegaMenu onNavigate={() => setOpen(false)} />
            <NavLink to="/news">Latest</NavLink>
            <NavLink to="/for-you">For you</NavLink>
            <NavLink to="/archive">Archive</NavLink>
            <NavLink to="/bookmarks">Library{count > 0 && <span className="count-badge" aria-label={`${count} saved`}>{count}</span>}</NavLink>
          </nav>
          <SearchBox onDone={() => setOpen(false)} />
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
        <nav className="category-bar" aria-label="Browse sections">
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

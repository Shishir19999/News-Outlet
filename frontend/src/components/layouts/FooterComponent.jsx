import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import NewsletterForm from '../ui/NewsletterForm';
import { useCategories } from '../../context/CategoriesContext';
import { useSettings } from '../../context/SettingsContext';
import { DEMO, BASE_URL, API_URL } from '../../config/env';
import { Logo } from './HeaderComponent';

// Feeds are generated files: at build time for the live preview, by the API in real mode.
const feedUrl = (kind, slug) => {
  const root = DEMO ? BASE_URL : `${API_URL}/`;
  if (slug) return `${root}${kind}/${slug}.xml`;
  return `${root}${kind === 'atom' ? 'atom' : 'feed'}.xml`;
};

function InstallButton() {
  const [evt, setEvt] = useState(null);
  useEffect(() => {
    const on = (e) => { e.preventDefault(); setEvt(e); };
    window.addEventListener('beforeinstallprompt', on);
    return () => window.removeEventListener('beforeinstallprompt', on);
  }, []);
  if (!evt) return null;
  return (
    <button type="button" className="btn btn-secondary btn-sm install-btn" onClick={async () => { evt.prompt(); await evt.userChoice.catch(() => {}); setEvt(null); }}>
      <i className="bi bi-download" aria-hidden="true" /> Install the app
    </button>
  );
}

export default function FooterComponent() {
  const { categories } = useCategories();
  const { settings } = useSettings();
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div className="footer-about">
          <Link className="brand" to="/"><Logo /> <span className="brand-name">{settings.siteName}</span></Link>
          <p>{settings.tagline || 'Independent reporting and clear explanations, written to be read in a few minutes.'}</p>
          <InstallButton />
        </div>
        <nav aria-label="Footer sections">
          <h2 className="footer-title">Sections</h2>
          <ul>
            {categories.map((c) => <li key={c._id}><Link to={`/category/${c.slug}`}>{c.name}</Link></li>)}
          </ul>
        </nav>
        <nav aria-label="Footer links">
          <h2 className="footer-title">More</h2>
          <ul>
            <li><Link to="/about">About us</Link></li>
            <li><Link to="/contact">Contact</Link></li>
            <li><Link to="/authors">Our writers</Link></li>
            <li><Link to="/archive">Archive</Link></li>
            <li><Link to="/bookmarks">Library</Link></li>
            <li><Link to="/login">Sign in</Link></li>
          </ul>
        </nav>
        <div>
          <h2 className="footer-title">Newsletter</h2>
          <p className="footer-note">A short summary of the best stories. Pick your topics and confirm by e-mail.</p>
          <NewsletterForm idPrefix="footer-nl" />
          <h2 className="footer-title feeds-title">Feeds</h2>
          <p className="footer-note feeds">
            <a href={feedUrl('rss')}>RSS</a> · <a href={feedUrl('atom')}>Atom</a>
            {categories.slice(0, 3).map((c) => <span key={c._id}> · <a href={feedUrl('rss', c.slug)}>{c.name}</a></span>)}
          </p>
        </div>
      </div>
      <div className="container footer-bottom">
        <p>&copy; {new Date().getFullYear()} {settings.siteName}. All rights reserved.</p>
      </div>
    </footer>
  );
}

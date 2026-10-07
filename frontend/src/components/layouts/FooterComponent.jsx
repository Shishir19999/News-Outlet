import { Link } from 'react-router-dom';
import NewsletterForm from '../ui/NewsletterForm';
import { useCategories } from '../../context/CategoriesContext';
import { SITE_NAME } from '../../config/env';
import { Logo } from './HeaderComponent';

export default function FooterComponent() {
  const { categories } = useCategories();
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div className="footer-about">
          <Link className="brand" to="/"><Logo /> <span className="brand-name">{SITE_NAME}</span></Link>
          <p>Independent reporting and clear explanations, written to be read in a few minutes.</p>
        </div>
        <nav aria-label="Sections">
          <h2 className="footer-title">Sections</h2>
          <ul>
            {categories.map((c) => <li key={c._id}><Link to={`/category/${c.slug}`}>{c.name}</Link></li>)}
          </ul>
        </nav>
        <nav aria-label="Company">
          <h2 className="footer-title">Company</h2>
          <ul>
            <li><Link to="/about">About us</Link></li>
            <li><Link to="/contact">Contact</Link></li>
            <li><Link to="/bookmarks">Reading list</Link></li>
            <li><Link to="/login">Sign in</Link></li>
          </ul>
        </nav>
        <div>
          <h2 className="footer-title">Newsletter</h2>
          <p className="footer-note">A short weekly summary of the best stories.</p>
          <NewsletterForm idPrefix="footer-nl" />
        </div>
      </div>
      <div className="container footer-bottom">
        <p>&copy; {new Date().getFullYear()} {SITE_NAME}. All rights reserved.</p>
      </div>
    </footer>
  );
}

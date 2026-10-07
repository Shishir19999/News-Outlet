import { Link, useNavigate } from 'react-router-dom';
import { DEMO } from '../../config/env';
import { resetDemoData } from '../../demo/adapter';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../context/ConfirmContext';

// Explains that the browser-only demo keeps everything on the visitor's device.
export default function DemoBanner() {
  const confirm = useConfirm();
  const navigate = useNavigate();
  const { logout } = useAuth();
  if (!DEMO) return null;

  const reset = async () => {
    const ok = await confirm({
      title: 'Reset demo data?',
      message: 'This removes everything you added in this browser (articles, comments, accounts, bookmarks) and restores the original sample content.',
      confirmLabel: 'Reset demo data',
      danger: true,
    });
    if (!ok) return;
    resetDemoData();
    localStorage.removeItem('news-bookmarks');
    await logout();
    navigate('/');
    window.location.reload();
  };

  return (
    <div className="demo-banner" role="region" aria-label="Demo mode notice">
      <div className="container demo-banner-row">
        <p>
          <strong>Demo mode.</strong> Everything you do is stored only in your browser. No server, no e-mail.{' '}
          <Link to="/login">See demo logins</Link>
        </p>
        <button type="button" className="btn btn-secondary btn-sm" onClick={reset}>
          <i className="bi bi-arrow-counterclockwise" aria-hidden="true" /> Reset demo data
        </button>
      </div>
    </div>
  );
}

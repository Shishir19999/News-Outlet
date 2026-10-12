import { Link, useNavigate } from 'react-router-dom';
import { DEMO } from '../../config/env';
import { resetDemoData } from '../../demo/adapter';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../context/ConfirmContext';

// Explains that the browser-only live preview keeps everything on the visitor's device.
export default function DemoBanner() {
  const confirm = useConfirm();
  const navigate = useNavigate();
  const { logout } = useAuth();
  if (!DEMO) return null;

  const reset = async () => {
    const ok = await confirm({
      title: 'Reset the live preview?',
      message: 'This removes everything you added in this browser (articles, comments, accounts, bookmarks, preview inbox) and restores the original sample content.',
      confirmLabel: 'Reset preview data',
      danger: true,
    });
    if (!ok) return;
    resetDemoData();
    for (const k of ['news-bookmarks', 'news-follows', 'news-history', 'news-listen-queue', 'news-offline-articles']) localStorage.removeItem(k);
    await logout();
    navigate('/');
    window.location.reload();
  };

  return (
    <div className="demo-banner" role="region" aria-label="Live preview notice">
      <div className="container demo-banner-row">
        <p>
          <strong>Live preview.</strong> Everything you do is stored only in your browser. No server and no real e-mail: messages go to the <Link to="/inbox">Preview inbox</Link>.{' '}
          <Link to="/login">See the sample logins</Link>
        </p>
        <button type="button" className="btn btn-secondary btn-sm" onClick={reset}>
          <i className="bi bi-arrow-counterclockwise" aria-hidden="true" /> Reset preview data
        </button>
      </div>
    </div>
  );
}

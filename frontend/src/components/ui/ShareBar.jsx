import { useToast } from '../../context/ToastContext';

export default function ShareBar({ title, summary }) {
  const toast = useToast();
  const url = window.location.href;
  const enc = encodeURIComponent;
  const targets = [
    ['X', 'bi-twitter-x', `https://twitter.com/intent/tweet?text=${enc(title)}&url=${enc(url)}`],
    ['Facebook', 'bi-facebook', `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`],
    ['LinkedIn', 'bi-linkedin', `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`],
    ['WhatsApp', 'bi-whatsapp', `https://wa.me/?text=${enc(`${title} ${url}`)}`],
    ['Email', 'bi-envelope', `mailto:?subject=${enc(title)}&body=${enc(`${summary}\n\n${url}`)}`],
  ];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied to the clipboard');
    } catch {
      // clipboard blocked: fall back to a selection the visitor can copy manually
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      const copied = document.execCommand && document.execCommand('copy');
      input.remove();
      if (copied) toast.success('Link copied to the clipboard');
      else toast.error('Could not copy automatically. Copy the address from the browser bar.');
    }
  };

  const nativeShare = navigator.share ? async () => {
    try {
      await navigator.share({ title, text: summary, url });
    } catch {
      // cancelled by the reader
    }
  } : null;

  return (
    <div className="share-bar" role="group" aria-label="Share this article">
      <span className="share-label">Share</span>
      <button type="button" className="btn btn-secondary btn-sm" onClick={copy}><i className="bi bi-link-45deg" aria-hidden="true" /> Copy link</button>
      {nativeShare && <button type="button" className="btn btn-secondary btn-sm" onClick={nativeShare}><i className="bi bi-box-arrow-up" aria-hidden="true" /> Share…</button>}
      {targets.map(([name, icon, href]) => (
        <a key={name} className="icon-btn" href={href} target="_blank" rel="noopener noreferrer" aria-label={`Share on ${name}`} title={name}>
          <i className={`bi ${icon}`} aria-hidden="true" />
        </a>
      ))}
    </div>
  );
}

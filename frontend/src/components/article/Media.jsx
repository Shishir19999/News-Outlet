import { useEffect, useRef, useState } from 'react';
import { parseEmbed } from '../../shared/rules';

// Privacy-friendly embeds: nothing is requested from the video host until the reader presses play.
export function Embed({ embed }) {
  const [loaded, setLoaded] = useState(false);
  const info = embed && parseEmbed(embed.url);
  if (!info) return null;
  const title = embed.title || `${info.provider} ${info.kind}`;
  if (info.kind === 'audio') {
    return (
      <figure className="embed embed-audio">
        <figcaption>{title}</figcaption>
        <audio controls preload="none" src={info.src}>Your browser does not support audio playback.</audio>
      </figure>
    );
  }
  return (
    <figure className="embed">
      {loaded ? (
        <div className="embed-frame">
          <iframe
            src={`${info.src}${info.src.includes('?') ? '&' : '?'}autoplay=1`} title={title} loading="lazy" referrerPolicy="no-referrer"
            allow="autoplay; fullscreen; picture-in-picture" allowFullScreen sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
          />
        </div>
      ) : (
        <div className="embed-placeholder">
          <button type="button" className="btn btn-primary" onClick={() => setLoaded(true)}><i className="bi bi-play-circle" aria-hidden="true" /> Play video: {title}</button>
          <p className="muted small">Loads from {info.provider} only after you press play, in privacy-enhanced mode. <a href={info.watchUrl} target="_blank" rel="noopener noreferrer">Open on {info.provider}</a></p>
        </div>
      )}
    </figure>
  );
}

// Photo gallery with a keyboard-friendly lightbox.
export function Gallery({ items }) {
  const [open, setOpen] = useState(-1);
  const dialog = useRef(null);
  const opener = useRef(null);
  useEffect(() => {
    if (open < 0) return undefined;
    dialog.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(-1);
      else if (e.key === 'ArrowRight') setOpen((i) => (i + 1) % items.length);
      else if (e.key === 'ArrowLeft') setOpen((i) => (i - 1 + items.length) % items.length);
      else if (e.key === 'Tab') {
        const f = dialog.current?.querySelectorAll('button');
        if (!f || !f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); opener.current?.focus(); };
  }, [open, items.length]);
  if (!items || !items.length) return null;
  const cur = open >= 0 ? items[open] : null;
  return (
    <section className="gallery" aria-label="Photo gallery">
      <ul className="gallery-grid">
        {items.map((g, i) => (
          <li key={g.src.slice(-40) + i}>
            <button type="button" className="gallery-thumb" onClick={(e) => { opener.current = e.currentTarget; setOpen(i); }} aria-label={`Open picture ${i + 1} of ${items.length}: ${g.alt}`}>
              <img src={g.src} alt="" loading="lazy" />
            </button>
          </li>
        ))}
      </ul>
      {cur && (
        <div className="modal-backdrop lightbox" role="dialog" aria-modal="true" aria-label={`Picture ${open + 1} of ${items.length}`} tabIndex={-1} ref={dialog}>
          <figure className="lightbox-fig">
            <img src={cur.src} alt={cur.alt} />
            <figcaption>{cur.caption || cur.alt} <span className="muted">({open + 1}/{items.length})</span></figcaption>
          </figure>
          <div className="lightbox-actions">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen((open - 1 + items.length) % items.length)}><i className="bi bi-chevron-left" aria-hidden="true" /> Previous</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen((open + 1) % items.length)}>Next <i className="bi bi-chevron-right" aria-hidden="true" /></button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setOpen(-1)}>Close</button>
          </div>
        </div>
      )}
    </section>
  );
}

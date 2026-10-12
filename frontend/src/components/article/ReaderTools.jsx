/* eslint-disable react-refresh/only-export-components */
import { useCallback, useEffect, useRef, useState } from 'react';
import { stripMarkdown } from '../../shared/rules';
import { useReader, SIZES, LEADINGS } from '../../context/ReaderContext';

// Reading progress (0-100) of an element as it scrolls through the viewport.
export function useReadingProgress(ref, active = true) {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    if (!active) return undefined;
    let raf = 0;
    const calc = () => {
      raf = 0;
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const total = r.height - window.innerHeight * 0.5;
      const done = Math.min(Math.max(-r.top + window.innerHeight * 0.5, 0), Math.max(total, 1));
      setPct(Math.round((done / Math.max(total, 1)) * 100));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(calc); };
    calc();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); if (raf) cancelAnimationFrame(raf); };
  }, [ref, active]);
  return pct;
}

export function ProgressBar({ pct }) {
  return (
    <div className="read-progress" role="progressbar" aria-label="Reading progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

// Text size and line height controls (remembered on this device).
export function TextControls() {
  const { prefs, setPrefs, resetPrefs } = useReader();
  const idx = Math.max(SIZES.indexOf(prefs.size), 0);
  return (
    <div className="reader-tools" role="group" aria-label="Reading comfort">
      <button type="button" className="icon-btn" aria-label="Smaller text" disabled={idx === 0} onClick={() => setPrefs({ size: SIZES[idx - 1] })}><i className="bi bi-dash-lg" aria-hidden="true" /></button>
      <span className="reader-size" aria-live="polite">Text {Math.round(SIZES[idx] * 100)}%</span>
      <button type="button" className="icon-btn" aria-label="Larger text" disabled={idx === SIZES.length - 1} onClick={() => setPrefs({ size: SIZES[idx + 1] })}><i className="bi bi-plus-lg" aria-hidden="true" /></button>
      <label className="visually-hidden" htmlFor="leading">Line spacing</label>
      <select id="leading" className="input input-sm" value={prefs.leading} onChange={(e) => setPrefs({ leading: Number(e.target.value) })}>
        {LEADINGS.map(([v, l]) => <option key={v} value={v}>{l} spacing</option>)}
      </select>
      <button type="button" className="btn btn-secondary btn-sm" onClick={resetPrefs}>Reset</button>
    </div>
  );
}

const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';

function chunk(text, max = 220) {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const out = [];
  let cur = '';
  for (const s of sentences) {
    if ((cur + ' ' + s).trim().length > max && cur) { out.push(cur.trim()); cur = s; } else cur = `${cur} ${s}`;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

// Speaks text with the browser's own speech engine (nothing is sent anywhere).
export function useSpeech() {
  const [state, setState] = useState('idle'); // idle | playing | paused
  const [rate, setRate] = useState(1);
  const token = useRef(0);
  const stop = useCallback(() => {
    token.current += 1;
    if (canSpeak()) window.speechSynthesis.cancel();
    setState('idle');
  }, []);
  const play = useCallback((text, onEnd) => {
    if (!canSpeak()) return;
    window.speechSynthesis.cancel();
    const mine = ++token.current;
    const parts = chunk(stripMarkdown(text));
    let i = 0;
    const next = () => {
      if (mine !== token.current) return;
      if (i >= parts.length) { setState('idle'); if (onEnd) onEnd(); return; }
      const u = new SpeechSynthesisUtterance(parts[i++]);
      u.rate = rate;
      u.onend = next;
      u.onerror = () => { if (mine === token.current) setState('idle'); };
      window.speechSynthesis.speak(u);
    };
    setState('playing');
    next();
  }, [rate]);
  const pause = useCallback(() => { if (canSpeak()) { window.speechSynthesis.pause(); setState('paused'); } }, []);
  const resume = useCallback(() => { if (canSpeak()) { window.speechSynthesis.resume(); setState('playing'); } }, []);
  useEffect(() => () => { token.current += 1; if (canSpeak()) window.speechSynthesis.cancel(); }, []);
  return { state, rate, setRate, play, pause, resume, stop, supported: canSpeak() };
}

export function ReadAloud({ article }) {
  const sp = useSpeech();
  const text = `${article.title}. ${article.summary}. ${article.description || ''}`;
  if (!sp.supported) return <p className="muted small">Read aloud is not available in this browser.</p>;
  return (
    <div className="read-aloud" role="group" aria-label="Read aloud">
      {sp.state === 'idle' && <button type="button" className="btn btn-secondary btn-sm" onClick={() => sp.play(text)}><i className="bi bi-volume-up" aria-hidden="true" /> Listen</button>}
      {sp.state === 'playing' && <button type="button" className="btn btn-secondary btn-sm" onClick={sp.pause}><i className="bi bi-pause-fill" aria-hidden="true" /> Pause</button>}
      {sp.state === 'paused' && <button type="button" className="btn btn-secondary btn-sm" onClick={sp.resume}><i className="bi bi-play-fill" aria-hidden="true" /> Resume</button>}
      {sp.state !== 'idle' && <button type="button" className="btn btn-secondary btn-sm" onClick={sp.stop}><i className="bi bi-stop-fill" aria-hidden="true" /> Stop</button>}
      <label className="visually-hidden" htmlFor="tts-rate">Speaking speed</label>
      <select id="tts-rate" className="input input-sm" value={sp.rate} onChange={(e) => sp.setRate(Number(e.target.value))} disabled={sp.state !== 'idle'}>
        {[0.8, 1, 1.25, 1.5].map((r) => <option key={r} value={r}>{r}x speed</option>)}
      </select>
    </div>
  );
}

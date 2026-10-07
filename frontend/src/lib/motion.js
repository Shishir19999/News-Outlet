// Scroll motion helpers. Everything here only touches transform/opacity, is driven by
// IntersectionObserver + requestAnimationFrame, never captures the scroll, and turns off for
// visitors who prefer reduced motion and for small or low-power devices.

const mq = (q) => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(q) : null);

export function prefersReducedMotion() {
  const m = mq('(prefers-reduced-motion: reduce)');
  return !!(m && m.matches);
}

// Parallax is the most expensive effect: skip it on narrow screens and weak devices.
export function parallaxAllowed() {
  if (typeof window === 'undefined' || prefersReducedMotion()) return false;
  const narrow = mq('(max-width: 767px)');
  if (narrow && narrow.matches) return false;
  const nav = window.navigator || {};
  if (nav.connection && nav.connection.saveData) return false;
  if (nav.deviceMemory && nav.deviceMemory <= 2) return false;
  if (nav.hardwareConcurrency && nav.hardwareConcurrency <= 2) return false;
  return true;
}

export function revealAllowed() {
  return typeof window !== 'undefined' && 'IntersectionObserver' in window && !prefersReducedMotion();
}

// ---- parallax controller: one scroll listener and one rAF loop for every layer ----------
const layers = new Map(); // layer element -> { speed }
const frames = new Map(); // frame (observed parent) -> layer element
const visible = new Set();
let observer = null;
let frame = 0;
let listening = false;

function paint() {
  frame = 0;
  const vh = window.innerHeight || 1;
  const reads = [];
  visible.forEach((el) => {
    const rect = el.parentElement.getBoundingClientRect();
    reads.push([el, (rect.top + rect.height / 2 - vh / 2) * -layers.get(el).speed]);
  });
  // all reads first, then all writes: no layout thrash
  reads.forEach(([el, y]) => {
    el.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)`;
  });
}

function schedule() {
  if (!frame) frame = requestAnimationFrame(paint);
}

function start() {
  if (listening) return;
  listening = true;
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
}

function stop() {
  if (!listening || layers.size) return;
  listening = false;
  window.removeEventListener('scroll', schedule);
  window.removeEventListener('resize', schedule);
}

// Registers a decorative layer. Its parent's position decides the offset.
export function addParallax(el, speed) {
  if (!parallaxAllowed() || !el.parentElement) return () => {};
  if (!observer) {
    observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const layer = frames.get(entry.target);
        if (!layer) return;
        if (entry.isIntersecting) visible.add(layer);
        else visible.delete(layer);
      });
      schedule();
    }, { rootMargin: '100px 0px' });
  }
  layers.set(el, { speed });
  frames.set(el.parentElement, el);
  observer.observe(el.parentElement);
  start();
  schedule();
  return () => {
    layers.delete(el);
    visible.delete(el);
    if (observer && el.parentElement) observer.unobserve(el.parentElement);
    frames.delete(el.parentElement);
    el.style.transform = '';
    stop();
  };
}

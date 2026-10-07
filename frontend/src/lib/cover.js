// Deterministic cover art, so articles without an uploaded image still look good
// and nothing has to be downloaded.
export function hashString(input) {
  let h = 2166136261;
  const s = String(input || '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Small seeded generator (mulberry32).
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CATEGORY_HUES = { world: 212, technology: 262, business: 28, science: 168, sports: 142, culture: 330 };

export function hueFor(category, seed) {
  const key = String(category || '').toLowerCase();
  if (CATEGORY_HUES[key] !== undefined) return CATEGORY_HUES[key];
  return hashString(key || seed) % 360;
}

export function coverSpec(seed, category) {
  const r = rng(hashString(`${seed}|${category}`));
  const hue = hueFor(category, seed);
  const shapes = Array.from({ length: 5 }, () => ({
    cx: Math.round(r() * 800),
    cy: Math.round(r() * 450),
    r: Math.round(60 + r() * 180),
    opacity: Number((0.08 + r() * 0.16).toFixed(2)),
    kind: r() > 0.5 ? 'circle' : 'ring',
  }));
  return {
    hue,
    from: `hsl(${hue} 62% 30%)`,
    to: `hsl(${(hue + 38) % 360} 68% 20%)`,
    shapes,
    wave: Math.round(250 + r() * 110),
    letter: String(category || 'N').trim().charAt(0).toUpperCase() || 'N',
  };
}

export const hasImage = (src) => !!src && !/\/icons\/notfound\.png$/.test(src);

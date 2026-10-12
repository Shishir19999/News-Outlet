// Headline tests: each browser sees a stable variant per article; impressions are reported once per
// session in small batches, clicks are reported when the article opens.
import { useEffect, useRef } from 'react';
import API, { clientId } from '../config/API';
import { abActive, abVariant, headlineFor } from '../shared/rules';

const seen = new Set();
let queue = [];
let timer = null;

function flush() {
  timer = null;
  if (!queue.length) return;
  const items = queue;
  queue = [];
  API.post('/news/ab/impressions', { items }).catch(() => {});
}

export function variantFor(article) {
  return abActive(article) ? abVariant(clientId(), article._id) : 'a';
}
export const titleFor = (article) => headlineFor(article, variantFor(article));

// Reports one impression the first time the element is on screen.
export function useImpression(article) {
  const ref = useRef(null);
  const active = abActive(article);
  const id = article._id;
  useEffect(() => {
    const el = ref.current;
    if (!active || !el || seen.has(id) || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting) && !seen.has(id)) {
        seen.add(id);
        queue.push({ id, variant: abVariant(clientId(), id) });
        if (!timer) timer = setTimeout(flush, 1500);
        io.disconnect();
      }
    }, { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, [active, id]);
  return ref;
}

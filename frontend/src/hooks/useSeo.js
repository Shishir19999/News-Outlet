import { useEffect } from 'react';
import { SITE_NAME } from '../config/env';

const DEFAULT_DESCRIPTION = 'News Outlet: independent reporting on technology, business, science, sports, culture and the world.';

function setMeta(attr, key, content) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!content) {
    if (el) el.remove();
    return;
  }
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

// Sets the document title, description, Open Graph / Twitter tags and optional JSON-LD structured data.
export default function useSeo({ title, description, image, type = 'website', jsonLd, noindex = false } = {}) {
  const ld = jsonLd ? JSON.stringify(jsonLd) : '';
  useEffect(() => {
    const fullTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME}: news, features and analysis`;
    const desc = description || DEFAULT_DESCRIPTION;
    const shareable = image && /^https?:/i.test(image);
    document.title = fullTitle;
    setMeta('name', 'description', desc);
    setMeta('name', 'robots', noindex ? 'noindex' : '');
    setMeta('property', 'og:title', fullTitle);
    setMeta('property', 'og:description', desc);
    setMeta('property', 'og:type', type);
    setMeta('property', 'og:site_name', SITE_NAME);
    setMeta('property', 'og:url', window.location.href);
    // data: URLs are not valid share images
    setMeta('property', 'og:image', shareable ? image : '');
    setMeta('name', 'twitter:card', shareable ? 'summary_large_image' : 'summary');
    setMeta('name', 'twitter:title', fullTitle);
    setMeta('name', 'twitter:description', desc);
    let script = document.head.querySelector('script[data-seo-ld]');
    if (ld) {
      if (!script) {
        script = document.createElement('script');
        script.type = 'application/ld+json';
        script.dataset.seoLd = '1';
        document.head.appendChild(script);
      }
      script.textContent = ld;
    } else if (script) {
      script.remove();
    }
    return () => { const s = document.head.querySelector('script[data-seo-ld]'); if (s) s.remove(); };
  }, [title, description, image, type, ld, noindex]);
}

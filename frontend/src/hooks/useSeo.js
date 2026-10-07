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

// Sets the document title, description and Open Graph / Twitter tags for the current page.
export default function useSeo({ title, description, image, type = 'website' } = {}) {
  useEffect(() => {
    const fullTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME}: news, features and analysis`;
    const desc = description || DEFAULT_DESCRIPTION;
    document.title = fullTitle;
    setMeta('name', 'description', desc);
    setMeta('property', 'og:title', fullTitle);
    setMeta('property', 'og:description', desc);
    setMeta('property', 'og:type', type);
    setMeta('property', 'og:site_name', SITE_NAME);
    setMeta('property', 'og:url', window.location.href);
    // data: URLs are not valid share images
    setMeta('property', 'og:image', image && /^https?:/i.test(image) ? image : '');
    setMeta('name', 'twitter:card', image && /^https?:/i.test(image) ? 'summary_large_image' : 'summary');
    setMeta('name', 'twitter:title', fullTitle);
    setMeta('name', 'twitter:description', desc);
  }, [title, description, image, type]);
}

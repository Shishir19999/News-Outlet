// Minimal, safe markdown renderer. All input is HTML-escaped first, so the output only
// contains the tags produced here. Supports headings, paragraphs, bold, italic, inline
// code, fenced code, links, images, blockquotes, ordered/unordered lists and rules.

const escapeHtml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const SAFE_LINK = /^(https?:\/\/|mailto:|\/|#)/i;
const SAFE_IMAGE = /^(https?:\/\/|\/|data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,)/i;

function inline(text) {
  let out = escapeHtml(text);
  const codes = [];
  out = out.replace(/`([^`]+)`/g, (_, c) => {
    codes.push(c);
    return `\u0000${codes.length - 1}\u0000`;
  });
  out = out.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (m, alt, src) => {
    const url = src.replace(/&amp;/g, '&');
    return SAFE_IMAGE.test(url) ? `<img src="${escapeHtml(url)}" alt="${alt}" loading="lazy">` : m;
  });
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, href) => {
    const url = href.replace(/&amp;/g, '&');
    if (!SAFE_LINK.test(url)) return m;
    const external = /^https?:/i.test(url);
    return `<a href="${escapeHtml(url)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${label}</a>`;
  });
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|[^*\w])\*([^*\s][^*]*)\*(?!\w)/g, '$1<em>$2</em>');
  out = out.replace(/(^|[^\w])_([^_\s][^_]*)_(?!\w)/g, '$1<em>$2</em>');
  // eslint-disable-next-line no-control-regex
  return out.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[Number(i)]}</code>`);
}

export function renderMarkdown(src) {
  const lines = String(src || '').replace(/\r\n?/g, '\n').split('\n');
  const html = [];
  let i = 0;
  const startsBlock = (l) => /^(#{1,6}\s|>|\s*[-*+]\s|\s*\d+\.\s|```|(-{3,}|\*{3,})\s*$)/.test(l);

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    if (line.startsWith('```')) {
      const buf = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) buf.push(lines[i++]);
      i++;
      html.push(`<pre><code>${escapeHtml(buf.join('\n'))}</code></pre>`);
      continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      // article title is the page h1, so body headings start at h2
      const level = Math.min(h[1].length + 1, 6);
      html.push(`<h${level}>${inline(h[2].trim())}</h${level}>`);
      i++;
      continue;
    }
    if (/^(-{3,}|\*{3,})\s*$/.test(line)) {
      html.push('<hr>');
      i++;
      continue;
    }
    if (line.startsWith('>')) {
      const buf = [];
      while (i < lines.length && lines[i].startsWith('>')) buf.push(lines[i++].replace(/^>\s?/, ''));
      html.push(`<blockquote>${buf.map((l) => inline(l)).join('<br>')}</blockquote>`);
      continue;
    }
    const ul = /^\s*[-*+]\s+/;
    const ol = /^\s*\d+\.\s+/;
    if (ul.test(line) || ol.test(line)) {
      const ordered = ol.test(line);
      const re = ordered ? ol : ul;
      const items = [];
      while (i < lines.length && re.test(lines[i])) items.push(`<li>${inline(lines[i++].replace(re, ''))}</li>`);
      html.push(`<${ordered ? 'ol' : 'ul'}>${items.join('')}</${ordered ? 'ol' : 'ul'}>`);
      continue;
    }
    const buf = [];
    while (i < lines.length && lines[i].trim() && !(buf.length && startsBlock(lines[i]))) buf.push(lines[i++]);
    html.push(`<p>${buf.map((l) => inline(l.trim())).join('<br>')}</p>`);
  }
  return html.join('\n');
}

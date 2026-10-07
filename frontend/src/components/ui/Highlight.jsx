import { highlightParts } from '../../lib/text';

// Wraps every match of `query` in <mark>. Built from text nodes, so it is injection safe.
export default function Highlight({ text, query }) {
  return highlightParts(text, query).map((part, i) => (part.match ? <mark key={i}>{part.text}</mark> : part.text));
}

import { useState } from 'react';
import { Link } from 'react-router-dom';
import API, { errorMessage } from '../../config/API';
import { useToast } from '../../context/ToastContext';
import { useCategories } from '../../context/CategoriesContext';
import { useSettings } from '../../context/SettingsContext';
import { DEMO } from '../../config/env';
import { isEmail } from '../../shared/rules';

// Double opt-in: the address is only stored as pending until the e-mailed link is opened.
export default function NewsletterForm({ idPrefix = 'nl', topics = false }) {
  const toast = useToast();
  const { categories } = useCategories();
  const { settings } = useSettings();
  const [email, setEmail] = useState('');
  const [picked, setPicked] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  if (!settings.newsletterEnabled) return <p className="newsletter-done">The newsletter is not open for sign-ups right now.</p>;

  const submit = async (e) => {
    e.preventDefault();
    if (!isEmail(email)) {
      setError('Enter a valid email address, for example you@example.com');
      return;
    }
    setError('');
    setBusy(true);
    try {
      const res = await API.post('/newsletter', { email: email.trim(), topics: picked });
      setDone(res.data);
      setEmail('');
      toast.success(res.data.message);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <p className="newsletter-done" role="status">
        <i className="bi bi-envelope-check" aria-hidden="true" />
        <span>{done.message}{' '}
          {DEMO ? <>In the live preview the e-mail arrives in the <Link to="/inbox">Preview inbox</Link>.</> : 'The link is valid until you use it.'}</span>
      </p>
    );
  }

  return (
    <form className="newsletter-form" onSubmit={submit} noValidate>
      <label htmlFor={`${idPrefix}-email`} className="visually-hidden">Email address</label>
      <input
        id={`${idPrefix}-email`} type="email" className={`input ${error ? 'is-invalid' : ''}`} placeholder="you@example.com"
        autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
        aria-invalid={!!error} aria-describedby={error ? `${idPrefix}-error` : undefined}
      />
      <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Subscribing…' : 'Subscribe'}</button>
      {topics && categories.length > 0 && (
        <fieldset className="nl-topics">
          <legend>Topics (leave empty for everything)</legend>
          {categories.map((c) => (
            <label key={c._id} className="chip chip-check">
              <input type="checkbox" checked={picked.includes(c._id)} onChange={(e) => setPicked(e.target.checked ? [...picked, c._id] : picked.filter((x) => x !== c._id))} /> {c.name}
            </label>
          ))}
        </fieldset>
      )}
      {error && <p id={`${idPrefix}-error`} className="field-error" role="alert">{error}</p>}
    </form>
  );
}

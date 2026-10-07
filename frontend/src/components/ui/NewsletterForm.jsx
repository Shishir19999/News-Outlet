import { useState } from 'react';
import API, { errorMessage } from '../../config/API';
import { useToast } from '../../context/ToastContext';
import { DEMO } from '../../config/env';

const EMAIL_RE = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;

export default function NewsletterForm({ idPrefix = 'nl' }) {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) {
      setError('Enter a valid email address, for example you@example.com');
      return;
    }
    setError('');
    setBusy(true);
    try {
      const res = await API.post('/newsletter', { email: email.trim() });
      setDone(true);
      setEmail('');
      toast.success(res.data.message || 'You are subscribed');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <p className="newsletter-done" role="status">
        <i className="bi bi-check-circle-fill" aria-hidden="true" /> Thanks for subscribing.
        {DEMO ? ' In this demo the address is only stored in your browser.' : ''}
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
      {error && <p id={`${idPrefix}-error`} className="field-error" role="alert">{error}</p>}
    </form>
  );
}

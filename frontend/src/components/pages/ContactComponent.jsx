import { useState } from 'react';
import API, { errorMessage } from '../../config/API';
import { DEMO } from '../../config/env';
import useSeo from '../../hooks/useSeo';
import { useToast } from '../../context/ToastContext';
import Breadcrumbs from '../ui/Breadcrumbs';

const EMAIL_RE = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;
const EMPTY = { name: '', email: '', subject: '', message: '' };

function validate(v) {
  const e = {};
  if (!v.name.trim()) e.name = 'Please enter your name';
  if (!v.email.trim()) e.email = 'Please enter your email address';
  else if (!EMAIL_RE.test(v.email.trim())) e.email = 'Enter a valid email address, for example you@example.com';
  if (!v.subject.trim()) e.subject = 'Please add a subject';
  if (v.message.trim().length < 10) e.message = 'Please write at least 10 characters';
  return e;
}

export default function ContactComponent() {
  useSeo({ title: 'Contact', description: 'Send a tip, a correction or a question to the newsroom.' });
  const toast = useToast();
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }));
  const field = (k, label, props = {}) => (
    <div className="field">
      <label htmlFor={`c-${k}`}>{label}</label>
      {k === 'message'
        ? <textarea id={`c-${k}`} className={`input ${errors[k] ? 'is-invalid' : ''}`} rows="6" value={values[k]} onChange={set(k)} aria-invalid={!!errors[k]} aria-describedby={errors[k] ? `c-${k}-err` : undefined} />
        : <input id={`c-${k}`} className={`input ${errors[k] ? 'is-invalid' : ''}`} value={values[k]} onChange={set(k)} aria-invalid={!!errors[k]} aria-describedby={errors[k] ? `c-${k}-err` : undefined} {...props} />}
      {errors[k] && <p id={`c-${k}-err`} className="field-error">{errors[k]}</p>}
    </div>
  );

  const submit = async (ev) => {
    ev.preventDefault();
    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      await API.post('/contact', values);
      setSent(true);
      setValues(EMPTY);
      toast.success('Thanks, your message was received');
    } catch (err) {
      toast.error(errorMessage(err, 'Your message could not be sent. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container section page-narrow">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Contact' }]} />
      <h1 className="page-title">Contact the newsroom</h1>
      <p className="lead">Tips, corrections and questions are all welcome.</p>
      {DEMO && <p className="notice"><i className="bi bi-info-circle" aria-hidden="true" /> In this demo the message is kept in your browser only. Nothing is e-mailed.</p>}
      {sent ? (
        <div className="state" role="status">
          <i className="bi bi-check-circle state-icon" aria-hidden="true" />
          <h2 className="state-title">Message received</h2>
          <p className="state-text">We read every message and reply when we can.</p>
          <button type="button" className="btn btn-secondary" onClick={() => setSent(false)}>Send another</button>
        </div>
      ) : (
        <form className="card form-card" onSubmit={submit} noValidate>
          <div className="form-row">
            {field('name', 'Your name', { autoComplete: 'name' })}
            {field('email', 'Email', { type: 'email', autoComplete: 'email', placeholder: 'you@example.com' })}
          </div>
          {field('subject', 'Subject')}
          {field('message', 'Message')}
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Sending…' : 'Send message'}</button>
        </form>
      )}
    </div>
  );
}

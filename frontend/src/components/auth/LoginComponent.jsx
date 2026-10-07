import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { errorMessage } from '../../config/API';
import { DEMO } from '../../config/env';
import { DEMO_ADMIN, DEMO_USER } from '../../demo/seed';
import { useAuth } from '../../context/AuthContext';
import useSeo from '../../hooks/useSeo';

const LOGINS = [['Administrator', DEMO_ADMIN], ['Reader', DEMO_USER]];

export default function LoginComponent() {
  useSeo({ title: 'Sign in' });
  const { login } = useAuth();
  const navigate = useNavigate();
  const [values, setValues] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const found = {};
    if (!values.email.trim()) found.email = 'Enter your email address';
    if (!values.password) found.password = 'Enter your password';
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      await login(values.email.trim(), values.password);
      navigate('/admin');
    } catch (err) {
      const data = err.response && err.response.data;
      if (data && (data.email || data.password)) setErrors({ email: data.email, password: data.password });
      else setErrors({ form: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container section auth-wrap">
      <form className="card form-card auth-card" onSubmit={submit} noValidate>
        <h1 className="page-title">Sign in</h1>
        {errors.form && <p className="field-error" role="alert">{errors.form}</p>}
        <div className="field">
          <label htmlFor="l-email">Email</label>
          <input id="l-email" type="email" className={`input ${errors.email ? 'is-invalid' : ''}`} autoComplete="username" value={values.email} onChange={(e) => setValues({ ...values, email: e.target.value })} aria-invalid={!!errors.email} aria-describedby={errors.email ? 'l-email-err' : undefined} />
          {errors.email && <p id="l-email-err" className="field-error">{errors.email}</p>}
        </div>
        <div className="field">
          <label htmlFor="l-pass">Password</label>
          <input id="l-pass" type="password" className={`input ${errors.password ? 'is-invalid' : ''}`} autoComplete="current-password" value={values.password} onChange={(e) => setValues({ ...values, password: e.target.value })} aria-invalid={!!errors.password} aria-describedby={errors.password ? 'l-pass-err' : undefined} />
          {errors.password && <p id="l-pass-err" className="field-error">{errors.password}</p>}
        </div>
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        <p className="form-foot">No account yet? <Link to="/register">Create one</Link></p>
        {DEMO && (
          <div className="demo-logins" aria-label="Demo logins">
            <h2>Demo logins</h2>
            <p>Pick an account to fill in the form. These accounts only exist in this browser.</p>
            {LOGINS.map(([label, c]) => (
              <button type="button" key={label} className="demo-login" onClick={() => setValues({ email: c.email, password: c.password })}>
                <strong>{label}</strong>
                <span>{c.email} / {c.password}</span>
              </button>
            ))}
          </div>
        )}
      </form>
    </div>
  );
}

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import API, { errorMessage } from '../../config/API';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import useSeo from '../../hooks/useSeo';

const EMAIL_RE = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;

export default function RegisterComponent() {
  useSeo({ title: 'Create account' });
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [v, setV] = useState({ name: '', email: '', password: '', gender: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setV((x) => ({ ...x, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const f = {};
    if (!v.name.trim()) f.name = 'Enter your name';
    if (!EMAIL_RE.test(v.email.trim())) f.email = 'Enter a valid email address, for example you@example.com';
    if (v.password.length < 6) f.password = 'Use at least 6 characters';
    if (!v.gender) f.gender = 'Choose one option';
    setErrors(f);
    if (Object.keys(f).length) return;
    setBusy(true);
    try {
      await API.post('/user', { name: v.name.trim(), email: v.email.trim(), password: v.password, gender: v.gender });
      await login(v.email.trim(), v.password);
      toast.success('Welcome aboard! Your account is ready.');
      navigate('/admin');
    } catch (err) {
      const data = err.response && err.response.data;
      if (data && data.email) setErrors({ email: data.email });
      else setErrors({ form: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  const text = (k, label, props = {}) => (
    <div className="field">
      <label htmlFor={`r-${k}`}>{label}</label>
      <input id={`r-${k}`} className={`input ${errors[k] ? 'is-invalid' : ''}`} value={v[k]} onChange={set(k)} aria-invalid={!!errors[k]} aria-describedby={errors[k] ? `r-${k}-err` : undefined} {...props} />
      {errors[k] && <p id={`r-${k}-err`} className="field-error">{errors[k]}</p>}
    </div>
  );

  return (
    <div className="container section auth-wrap">
      <form className="card form-card auth-card" onSubmit={submit} noValidate>
        <h1 className="page-title">Create account</h1>
        {errors.form && <p className="field-error" role="alert">{errors.form}</p>}
        {text('name', 'Name', { autoComplete: 'name' })}
        {text('email', 'Email', { type: 'email', autoComplete: 'email', placeholder: 'you@example.com' })}
        {text('password', 'Password', { type: 'password', autoComplete: 'new-password' })}
        <div className="field">
          <label htmlFor="r-gender">Gender</label>
          <select id="r-gender" className={`input ${errors.gender ? 'is-invalid' : ''}`} value={v.gender} onChange={set('gender')} aria-invalid={!!errors.gender}>
            <option value="">Select…</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
          {errors.gender && <p className="field-error">{errors.gender}</p>}
        </div>
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
        <p className="form-foot">Already registered? <Link to="/login">Sign in</Link></p>
      </form>
    </div>
  );
}

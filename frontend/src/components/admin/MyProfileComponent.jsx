import { useState } from 'react';
import API, { authHeaders, errorMessage } from '../../config/API';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../context/ConfirmContext';
import { useToast } from '../../context/ToastContext';
import Avatar from '../ui/Avatar';
import { formatDate } from '../../lib/text';

export default function MyProfileComponent() {
  const { user, refresh } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [form, setForm] = useState({ name: user.name, gender: user.gender || 'male', password: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    const f = {};
    if (!form.name.trim()) f.name = 'Your name is required';
    if (form.password && form.password.length < 6) f.password = 'Use at least 6 characters, or leave it empty to keep the current one';
    setErrors(f);
    if (Object.keys(f).length) return;
    setBusy(true);
    try {
      const body = { name: form.name.trim(), gender: form.gender };
      if (form.password) body.password = form.password;
      await API.put(`/user/${user._id}`, body, { headers: authHeaders() });
      await refresh();
      setForm((x) => ({ ...x, password: '' }));
      toast.success('Profile saved');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const upload = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please choose an image file'); return; }
    if (file.size > 8 * 1024 * 1024) { toast.error('The image is larger than 8 MB'); return; }
    const data = new FormData();
    data.append('image', file);
    try {
      await API.put(`/user/upload-profile/${user._id}`, data, { headers: authHeaders() });
      await refresh();
      toast.success('Photo updated');
    } catch (err) {
      toast.error(errorMessage(err, 'The photo could not be uploaded.'));
    }
  };

  const removePhoto = async () => {
    if (!await confirm({ title: 'Remove your photo?', message: 'Your initial will be shown instead.', confirmLabel: 'Remove' })) return;
    try {
      await API.delete(`/user/delete-profile/${user._id}`, { headers: authHeaders() });
      await refresh();
      toast.success('Photo removed');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const hasPhoto = user.image && !/notfound\.png$/.test(user.image);
  return (
    <>
      <div className="page-head"><h1>My profile</h1></div>
      <div className="admin-grid two">
        <div className="panel profile-card">
          <Avatar user={user} size="lg" />
          <dl className="details">
            <dt>Email</dt><dd>{user.email}</dd>
            <dt>Role</dt><dd>{user.role}</dd>
            <dt>Joined</dt><dd>{formatDate(user.createdAt)}</dd>
          </dl>
          <div className="editor-actions">
            <label htmlFor="p-photo" className="btn btn-secondary btn-sm">Change photo</label>
            <input id="p-photo" type="file" accept="image/*" className="visually-hidden" onChange={upload} />
            {hasPhoto && <button type="button" className="btn btn-secondary btn-sm" onClick={removePhoto}>Remove photo</button>}
          </div>
        </div>
        <form className="panel" onSubmit={save} noValidate>
          <h2>Edit details</h2>
          <div className="field">
            <label htmlFor="p-name">Name</label>
            <input id="p-name" className={`input ${errors.name ? 'is-invalid' : ''}`} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} aria-invalid={!!errors.name} />
            {errors.name && <p className="field-error">{errors.name}</p>}
          </div>
          <div className="field">
            <label htmlFor="p-gender">Gender</label>
            <select id="p-gender" className="input" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
              <option value="male">Male</option><option value="female">Female</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="p-pass">New password</label>
            <input id="p-pass" type="password" autoComplete="new-password" className={`input ${errors.password ? 'is-invalid' : ''}`} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} aria-invalid={!!errors.password} />
            {errors.password && <p className="field-error">{errors.password}</p>}
          </div>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button>
        </form>
      </div>
    </>
  );
}

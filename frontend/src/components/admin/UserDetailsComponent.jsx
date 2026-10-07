import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import API, { authHeaders, errorMessage } from '../../config/API';
import useAsync from '../../hooks/useAsync';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../context/ConfirmContext';
import { useToast } from '../../context/ToastContext';
import { ErrorState, Skeleton } from '../ui/States';
import Avatar from '../ui/Avatar';
import { formatDate } from '../../lib/text';

function RoleForm({ user, onSaved }) {
  const toast = useToast();
  const [role, setRole] = useState(user.role);
  const [busy, setBusy] = useState(false);
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await API.put(`/user/${user._id}`, { role }, { headers: authHeaders() });
      toast.success('Role updated');
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={save} className="inline-form">
      <div className="field">
        <label htmlFor="u-role">Role</label>
        <select id="u-role" className="input" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="user">User (can write articles)</option>
          <option value="admin">Admin (full access)</option>
        </select>
      </div>
      <button type="submit" className="btn btn-primary" disabled={busy || role === user.role}>Save role</button>
    </form>
  );
}

export default function UserDetailsComponent() {
  const { id } = useParams();
  const { isAdmin } = useAuth();
  const confirm = useConfirm();
  const toast = useToast();
  const navigate = useNavigate();
  const detail = useAsync(() => (isAdmin ? API.get(`/user/${id}`, { headers: authHeaders() }).then((r) => r.data) : null), [id, isAdmin]);

  if (!isAdmin) return <ErrorState title="Admins only" message="Only administrators can view other users." />;
  if (detail.error) return <ErrorState onRetry={detail.reload} message="This user could not be loaded." />;
  if (!detail.data) return <div role="status" aria-label="Loading"><Skeleton className="skeleton-title" /><Skeleton className="skeleton-row" /></div>;
  const u = detail.data;

  const remove = async () => {
    if (!await confirm({ title: `Delete ${u.name}?`, message: 'The account is removed permanently.', confirmLabel: 'Delete', danger: true })) return;
    try {
      await API.delete(`/user/${u._id}`, { headers: authHeaders() });
      toast.success('User deleted');
      navigate('/admin/users-list');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <>
      <div className="page-head"><h1>{u.name}</h1><Link to="/admin/users-list" className="btn btn-secondary btn-sm">Back to users</Link></div>
      <div className="panel profile-card">
        <Avatar user={u} size="lg" />
        <dl className="details">
          <dt>Email</dt><dd>{u.email}</dd>
          <dt>Gender</dt><dd>{u.gender}</dd>
          <dt>Joined</dt><dd>{formatDate(u.createdAt)}</dd>
        </dl>
      </div>
      <div className="panel">
        <RoleForm user={u} onSaved={detail.reload} />
      </div>
      <div className="panel">
        <h2>Danger zone</h2>
        <button type="button" className="btn btn-danger" onClick={remove}><i className="bi bi-trash" aria-hidden="true" /> Delete this user</button>
      </div>
    </>
  );
}

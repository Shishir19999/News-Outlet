import { Link } from 'react-router-dom';
import API, { authHeaders, errorMessage } from '../../config/API';
import useAsync from '../../hooks/useAsync';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../context/ConfirmContext';
import { useToast } from '../../context/ToastContext';
import { EmptyState, ErrorState, TableSkeleton } from '../ui/States';
import Avatar from '../ui/Avatar';
import { formatDate } from '../../lib/text';
import { ROLES, ROLE_INFO } from '../../shared/rules';

export default function UsersListComponent() {
  const { isAdmin } = useAuth();
  const confirm = useConfirm();
  const toast = useToast();
  const list = useAsync(() => (isAdmin ? API.get('/user', { headers: authHeaders() }).then((r) => r.data) : []), [isAdmin]);

  if (!isAdmin) return <ErrorState title="Admins only" message="Only administrators can manage users." />;

  const setRole = async (u, role) => {
    try {
      await API.put(`/user/${u._id}`, { role }, { headers: authHeaders() });
      toast.success(`${u.name} is now ${role}`);
      list.reload();
    } catch (err) {
      toast.error(errorMessage(err));
      list.reload();
    }
  };

  const remove = async (u) => {
    if (!await confirm({ title: `Delete ${u.name}?`, message: 'The account is removed permanently. Their articles stay on the site.', confirmLabel: 'Delete', danger: true })) return;
    try {
      await API.delete(`/user/${u._id}`, { headers: authHeaders() });
      toast.success('User deleted');
      list.reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <>
      <div className="page-head"><h1>Users</h1><p className="muted">Change roles here. The role changes apply the next time the person signs in.</p></div>
      <div className="panel">
        {list.error ? <ErrorState onRetry={list.reload} /> : !list.data ? <TableSkeleton /> : list.data.length === 0 ? (
          <EmptyState icon="bi-people" title="No other users yet">New registrations appear here.</EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <caption className="visually-hidden">Users</caption>
              <thead><tr><th scope="col">User</th><th scope="col">Role</th><th scope="col">Joined</th><th scope="col"><span className="visually-hidden">Actions</span></th></tr></thead>
              <tbody>
                {list.data.map((u) => (
                  <tr key={u._id}>
                    <td data-label="User"><span className="user-cell"><Avatar user={u} /><span><span className="cell-title">{u.name}</span><span className="meta">{u.email}</span></span></span></td>
                    <td data-label="Role"><label className="visually-hidden" htmlFor={`role-${u._id}`}>Role of {u.name}</label><select id={`role-${u._id}`} className="input input-sm" value={u.role} title={ROLE_INFO[u.role]} onChange={(e) => setRole(u, e.target.value)}>{ROLES.map((r) => <option key={r} value={r}>{r}</option>)}</select></td>
                    <td data-label="Joined">{formatDate(u.createdAt)}</td>
                    <td className="row-actions">
                      <Link to={`/admin/user-details/${u._id}`} className="btn btn-secondary btn-sm" aria-label={`Open ${u.name}`}><i className="bi bi-eye" aria-hidden="true" /> Open</Link>
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => remove(u)} aria-label={`Delete ${u.name}`}><i className="bi bi-trash" aria-hidden="true" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

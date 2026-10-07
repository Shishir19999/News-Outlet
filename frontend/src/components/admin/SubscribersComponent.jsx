import API, { authHeaders, errorMessage } from '../../config/API';
import useAsync from '../../hooks/useAsync';
import { useConfirm } from '../../context/ConfirmContext';
import { useToast } from '../../context/ToastContext';
import { EmptyState, ErrorState, TableSkeleton } from '../ui/States';
import { formatDate } from '../../lib/text';

export default function SubscribersComponent() {
  const confirm = useConfirm();
  const toast = useToast();
  const list = useAsync(() => API.get('/newsletter', { headers: authHeaders() }).then((r) => r.data), []);

  const remove = async (s) => {
    if (!await confirm({ title: 'Remove subscriber?', message: `${s.email} will no longer be on the list.`, confirmLabel: 'Remove', danger: true })) return;
    try {
      await API.delete(`/newsletter/${s._id}`, { headers: authHeaders() });
      toast.success('Subscriber removed');
      list.reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <>
      <div className="page-head"><h1>Newsletter subscribers</h1><p className="muted">{list.data ? `${list.data.length} in total` : ''}</p></div>
      <div className="panel">
        {list.error ? <ErrorState onRetry={list.reload} /> : !list.data ? <TableSkeleton /> : list.data.length === 0 ? (
          <EmptyState icon="bi-envelope-paper" title="No subscribers yet">Sign-ups from the newsletter forms appear here.</EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <caption className="visually-hidden">Subscribers</caption>
              <thead><tr><th scope="col">Email</th><th scope="col">Joined</th><th scope="col"><span className="visually-hidden">Actions</span></th></tr></thead>
              <tbody>
                {list.data.map((s) => (
                  <tr key={s._id}>
                    <td data-label="Email">{s.email}</td>
                    <td data-label="Joined">{formatDate(s.createdAt)}</td>
                    <td className="row-actions"><button type="button" className="btn btn-danger btn-sm" onClick={() => remove(s)} aria-label={`Remove ${s.email}`}><i className="bi bi-trash" aria-hidden="true" /></button></td>
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

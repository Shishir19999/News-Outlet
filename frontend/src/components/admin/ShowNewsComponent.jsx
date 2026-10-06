import { useEffect, useState, useCallback } from 'react';
import Swal from 'sweetalert2'
import API from '../../config/API'

const authHeaders = () => ({ authorization: localStorage.getItem('token') })

export default function ShowNewsComponent() {
  const [news, setNews] = useState([])
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState(null)
  const [profile, setProfile] = useState(null)

  const load = useCallback(() => {
    API.get('/news', { params: { page, limit: 10, search: query } }).then((res) => {
      setNews(res.data.news)
      setPages(res.data.pages)
    }).catch((e) => console.log(e))
  }, [page, query])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    API.get('/user/profile/user', { headers: authHeaders() }).then((res) => setProfile(res.data)).catch(() => {})
  }, [])

  const isAdmin = profile && profile.role === 'admin'

  const remove = async (item) => {
    const ok = await Swal.fire({ icon: 'warning', title: `Delete "${item.title}"?`, showCancelButton: true })
    if (!ok.isConfirmed) return
    API.delete(`/news/${item._id}`, { headers: authHeaders() })
      .then(() => load())
      .catch((e) => Swal.fire({ icon: 'error', title: e.response?.data?.message || 'Delete failed' }))
  }

  const save = (e) => {
    e.preventDefault()
    const data = new FormData()
    data.append('title', editing.title)
    data.append('summary', editing.summary)
    data.append('description', editing.description || '')
    API.put(`/news/${editing._id}`, data, { headers: authHeaders() })
      .then(() => { setEditing(null); load() })
      .catch((err) => Swal.fire({ icon: 'error', title: err.response?.data?.message || 'Update failed' }))
  }

  return (
    <div className='card'>
      <div className='card-header'>
        <h4>Show News</h4>
      </div>
      <div className='card-body'>
        <form className='d-flex mb-3' onSubmit={(e) => { e.preventDefault(); setPage(1); setQuery(search) }}>
          <input className='form-control me-2' placeholder='Search title or summary' value={search} onChange={(e) => setSearch(e.target.value)} />
          <button className='btn btn-primary'>Search</button>
        </form>

        {editing && (
          <form className='border rounded p-3 mb-3' onSubmit={save}>
            <h5>Edit news</h5>
            <input className='form-control mb-2' value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
            <textarea className='form-control mb-2' value={editing.summary} onChange={(e) => setEditing({ ...editing, summary: e.target.value })} />
            <textarea className='form-control mb-2' value={editing.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
            <button className='btn btn-success me-2'>Save</button>
            <button type='button' className='btn btn-secondary' onClick={() => setEditing(null)}>Cancel</button>
          </form>
        )}

        <table className='table'>
          <thead>
            <tr><th>Image</th><th>Title</th><th>Slug</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {news.length === 0 && <tr><td colSpan={4}>No news found</td></tr>}
            {news.map((item) => (
              <tr key={item._id}>
                <td><img src={item.image} alt='' width={60} /></td>
                <td>{item.title}</td>
                <td>{item.slug}</td>
                <td>
                  {isAdmin ? (
                    <>
                      <button className='btn btn-sm btn-primary me-2' onClick={() => setEditing(item)}>Edit</button>
                      <button className='btn btn-sm btn-danger' onClick={() => remove(item)}>Delete</button>
                    </>
                  ) : <span className='text-muted'>Admin only</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className='d-flex align-items-center gap-2'>
          <button className='btn btn-outline-secondary btn-sm' disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</button>
          <span>Page {page} of {pages}</span>
          <button className='btn btn-outline-secondary btn-sm' disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      </div>
    </div>
  )
}

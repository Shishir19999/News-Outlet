import {useEffect,useState} from 'react';
import HeaderComponent from '../layouts/HeaderComponent'
import FooterComponent from '../layouts/FooterComponent'
import PaginationComponent from '../layouts/PaginationComponent'
import { useSearchParams } from 'react-router-dom'
import API from '../../config/API'

export default function NewsComponent() {
  const [news, setNews] = useState([])
  const [searchParams] = useSearchParams()
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)

  useEffect(() => {
    // debounce typing so each keystroke does not hit the API
    const timer = setTimeout(() => {
      API.get('/news', { params: { page, limit: 9, search: search || undefined } }).then((res) => {
        setNews(res.data.news)
        setPages(res.data.pages)
      }).catch((e) => {
        console.log(e)
      })
    }, 250);
    return () => clearTimeout(timer);
  },[page, search]);

  // Re-sync the box and page when the URL query changes (adjusting state during render, not in an effect)
  const [prevSearchParams, setPrevSearchParams] = useState(searchParams)
  if (prevSearchParams !== searchParams) {
    setPrevSearchParams(searchParams)
    setSearch(searchParams.get('search') || '')
    setPage(1)
  }

  const searchNews = (e) => {
    setSearch(e.target.value)
    setPage(1)
  }

  return (
    <div className='container'>
      <HeaderComponent />
      <div className="row mt-3 mb-3">
        <div className="col-md-12">
          <h1>News List</h1>
          <hr />
          <input type="search" value={search} onChange={searchNews} placeholder='enter any keywords' className='form-control' />
        </div>
      </div>
      <div className="row">
      {news && news.map((item) => (
          <div className="col-md-4 mb-3" key={item._id}>
            <div className="card">
              <img src={item.image} className="card-img-top" height="200" alt="..." />
              <div className="card-body">
                <h5 className="card-title">{item.title}</h5>
                <p className="card-text">{item.summary}</p>
                <a href={`/news-details/${item.slug}`} className="btn btn-primary">Read more</a>
              </div>
            </div>
          </div>
        ))}
        {news && news.length === 0 && <p>No news found.</p>}
      </div>
      <PaginationComponent page={page} pages={pages} onChange={setPage} />
      <FooterComponent />

    </div>
  )
}

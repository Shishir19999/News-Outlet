import React,{useEffect,useState} from 'react'
import HeaderComponent from '../layouts/HeaderComponent'
import FooterComponent from '../layouts/FooterComponent'
import API from '../../config/API'

export default function NewsComponent() {
  const [news, setNews] = useState([])
  const [search, setSearch] = useState('')

  const getNews = () => {
    API.get('/news').then((res) => {
      setNews(res.data)
    }).catch((e) => {
      console.log(e)
    })
  }

  const searchNews = (e) => {
    setSearch(e.target.value)
    if(search.length > 0) {
      API.get(`/news?search=${e.target.value}`).then((res) => {
        setNews(res.data)
      }).catch((e) => {
        console.log(e)
      })
    }else{
      getNews()
    }
  

  }

  useEffect(() => {
    getNews()
  },[]);
  return (
    <div className='container'>
      <HeaderComponent />
      <div className="row mt-3 mb-3">
        <div className="col-md-12">
          <h1>News List</h1>
          <hr />
          <input type="search" onChange={searchNews} placeholder='enter any keywords' className='form-control' />
        </div>
      </div>
      <div className="row">
      {news && news.map((item,index) => (
          <div className="col-md-4" key={index}>
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
        
       
      </div>
      <FooterComponent />

    </div>
  )
}
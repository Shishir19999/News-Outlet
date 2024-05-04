import React,{useEffect,useState} from 'react'
import HeaderComponent from '../layouts/HeaderComponent'
import FooterComponent from '../layouts/FooterComponent'
import API from '../../config/API'

export default function HomeComponent() {
  const [news, setNews] = useState([])

  const getNews = () => {
    API.get('/news').then((res) => {
      setNews(res.data)
    }).catch((e) => {
      console.log(e)
    })
  }

  useEffect(() => {
    getNews()
  },[]);
  return (
    <div className='container'>
      <HeaderComponent />
      <div className="row">
        <div className="col-md-12">
          <div id="carouselExampleAutoplaying" className="carousel slide" data-bs-ride="carousel">
            <div className="carousel-inner">
              <div className="carousel-item active">
                <img src="https://picsum.photos/seed/picsum/200/300" height="450" className="d-block w-100" alt="..." />
              </div>
              <div className="carousel-item">
                <img src="https://picsum.photos/id/237/200/300" height="450" className="d-block w-100" alt="..." />
              </div>
              <div className="carousel-item">
                <img src="https://picsum.photos/200/300?grayscale" height="450" className="d-block w-100" alt="..." />
              </div>
            </div>
            <button className="carousel-control-prev" type="button" data-bs-target="#carouselExampleAutoplaying" data-bs-slide="prev">
              <span className="carousel-control-prev-icon" aria-hidden="true" />
              <span className="visually-hidden">Previous</span>
            </button>
            <button className="carousel-control-next" type="button" data-bs-target="#carouselExampleAutoplaying" data-bs-slide="next">
              <span className="carousel-control-next-icon" aria-hidden="true" />
              <span className="visually-hidden">Next</span>
            </button>
          </div>
        </div>
      </div>
      <div className="row mt-4 mb-4">
        <div className="col-md-12">
          <h1>Latest news</h1>
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
                <a href={`/news/${item.slug}`} className="btn btn-primary">Read more</a>
              </div>
            </div>
          </div>
          
        ))}
      
      </div>
      <FooterComponent />
    </div>
  )
}
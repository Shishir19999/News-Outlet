import React,{useEffect,useState} from 'react'
import HeaderComponent from '../layouts/HeaderComponent'
import FooterComponent from '../layouts/FooterComponent'
import {Link, useParams} from 'react-router-dom'
import API from '../../config/API'

export default function NewsDetatilsComponent() {
  let {slug} = useParams();
  const  [news, setNews] = useState({})
  const [relatedNews, setRelatedNews] = useState([])


  const getNews = () => {
    API.get(`/news/news-details/${slug}`).then((res) => {
      setNews(res.data.findNews)
      setRelatedNews(res.data.relatedNews)
    }).catch((e) => {
      console.log(e)
    })
  }

  useEffect(() => {
    getNews()
  },[news]);
  
  return (
    <div className='container'>
      <HeaderComponent/>
          <div className="row mt-4">
            <div className="col-md-9">
              <h1>{news.title}</h1>
              <img src={news.image} className='img-fluid' alt="" />
              <p>
                {news.description}
              </p>

            </div>
            <div className="col-md-3">
              <h1>Related news</h1>
              <ul>
              {relatedNews && relatedNews.map((item,index) => (
                <li key={index}>
                <Link to={`/news-details/${item.slug}`} key={index}>{item.title}</Link>
                </li>
              ))}
              </ul>
            </div>
          </div>
        <FooterComponent/>
      
    </div>
  )
}
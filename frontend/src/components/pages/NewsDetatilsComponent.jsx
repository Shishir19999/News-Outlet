import React from 'react'
import HeaderComponent from '../layouts/HeaderComponent'
import FooterComponent from '../layouts/FooterComponent'

export default function NewsDetatilsComponent() {
  return (
    <div className='container'>
      <HeaderComponent/>
          <div className="row mt-4">
            <div className="col-md-9">
              <img src="https://picsum.photos/seed/picsum/200/300" alt="" />
              <p>
                Lorem ipsum, dolor sit amet consectetur adipisicing elit. Enim ipsam dolores obcaecati aliquid numquam corporis deserunt doloremque assumenda, fuga nesciunt rerum similique culpa totam aut blanditiis tempore quaerat ex id.
              </p>

            </div>
            <div className="col-md-3">
              <h1>Related news</h1>
            </div>
          </div>
        <FooterComponent/>
      
    </div>
  )
}

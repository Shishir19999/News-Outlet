import React from 'react'
import HeaderComponent from '../layouts/HeaderComponent'
import FooterComponent from '../layouts/FooterComponent'

export default function ContactComponent() {
  return (
    <div className='container'>
      <HeaderComponent />
      <div className="row mt-3 mb-3">
        <div className="col-md-12">
          <h1>Contact</h1>
        </div>
      </div>
      <div className="row">
        <div className="col-md-8">
          <form action="">
            <div className="form-group mb-2">
              <label htmlFor="name">Name</label>
              <input type="text" className="form-control" id="name" />
            </div>
            <div className="form-group mb-2">
              <label htmlFor="email">Email</label>
              <input type="email" className="form-control" id="email" />
            </div>
            <div className="form-group mb-2">
              <label htmlFor="subject">Subject</label>
              <input type="text" className="form-control" id="subject" />
            </div>
            <div className="form-group mb-2">
              <label htmlFor="message">Message</label>
              <textarea className="form-control" id="message" rows="3"></textarea>
            </div>
            <div className="form-group">
              <button  className="btn btn-primary">Submit</button>
            </div>
          </form>
        </div>
        <div className="col-md-4">
         
          <iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3958.154007198524!2d112.75272531477368!3d-7.257472994764192!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x2dd7fcf5d2f9c4e5%3A0x1b3f1d1b7d2f9a3b!2sJl.%20Raya%20Tlogomas%2C%20Tlogomas%2C%20Kec.%20Lowokwaru%2C%20Kota%20Malang%2C%20Jawa%20Timur%2065141!5e0!3m2!1sid!2sid!4v1630213041748!5m2!1sid!2sid" width="100%" height="300" style={{border:0}} allowfullscreen="" loading="lazy"></iframe>
          
       
        </div>
      </div>

      <FooterComponent />

    </div>
  )
}

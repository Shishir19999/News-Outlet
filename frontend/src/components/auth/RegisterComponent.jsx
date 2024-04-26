import React from 'react'
import { Link } from 'react-router-dom'
import HeaderComponent from '../layouts/HeaderComponent'
import FooterComponent from '../layouts/FooterComponent'

export default function RegisterComponent() {
  return (
    <div className='container'>
      <HeaderComponent />
      <div className="row mt-3 mb-3">
        <div className="col-md-12">
          <h1>Register </h1>
        </div>
      </div>
      <div className="row">
        <div className="col-md-12">
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
              <label htmlFor="password">Password</label>
              <input type="password" className="form-control" id="password" />
            </div>
            <div className="form-group mb-2">
              <label htmlFor="gender">Gender</label>
              <select className="form-control" name="gender">
                <option value="">Male</option>
                <option value="">Female</option>
              </select>
            </div>
            <div className="form-group mb-2">
              <label htmlFor="image">Image</label>
              <input type="file" name='image' className="form-control" id="image" />
            </div>
            <div className="form-group">
              <button className="btn btn-primary">Register</button>
              <Link to="/login" className="btn btn-link float-end">Login</Link>
            </div>
          </form>
        </div>
      </div>


      <FooterComponent />

    </div>
  )
}

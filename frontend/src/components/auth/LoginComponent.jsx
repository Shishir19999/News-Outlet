import React from 'react';
import * as yup from 'yup';
import {useForm} from "react-hook-form";
import {yupResolver} from "@hookform/resolvers/yup";

import HeaderComponent from '../layouts/HeaderComponent'
import FooterComponent from '../layouts/FooterComponent'
import { Link } from 'react-router-dom'

let loginSchema = yup.object().shape({
  email: yup.string().email().required(),
  password: yup.string().required(),
});


export default function LoginComponent() {

  const {setError, register, handleSubmit, formState: {errors}} =
        useForm({
            resolver: yupResolver(loginSchema)
        });


  const login = (data) => {
    e.preventDefault();
    console.log(data)

  }
  return (
    <div className='container'>
      <HeaderComponent />
      <div className="row mt-3 mb-3">
        <div className="col-md-12">
          <h1>Login </h1>
        </div>
      </div>
      <div className="row">
        <div className="col-md-12">
          <form action="" onSubmit={handleSubmit(login)}>           
            <div className="form-group mb-2">
              <label htmlFor="email">Email:
              {errors.email && <span className='text-danger' >{errors.email.message}</span>}
              </label>
              <input type="email" name="email" 
                {...register("email")}
              className="form-control"  id="email" />
            </div>
            <div className="form-group mb-2">
              <label htmlFor="password">Password:
              {errors.password && <span className='text-danger' >{errors.password.message}</span>}
              </label>
              <input type="password" name='password'
                {...register("password")}
              className="form-control" id="password" />
              </div>
            <div className="form-group">
              <button  className="btn btn-primary">Login</button>
              <Link to="/register" className="btn btn-link float-end">Register</Link>
            </div>
          </form>
        </div>        
      </div>
     
      <FooterComponent />

    </div>
  )
}

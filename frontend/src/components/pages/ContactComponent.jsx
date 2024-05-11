import React from 'react'
import * as yup from 'yup';
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import Swal from 'sweetalert2'
import HeaderComponent from '../layouts/HeaderComponent'
import FooterComponent from '../layouts/FooterComponent'
import API from '../../config/API'

let contactSchema = yup.object().shape({
  name: yup.string().required(),
  email: yup.string().email().required(),
  subject: yup.string().required(),
  message: yup.string().required()

});

export default function ContactComponent() {

  const { setError, register, reset, handleSubmit, formState: { errors } } =
    useForm({
      resolver: yupResolver(contactSchema)
    });

    const sendMail = (data) => {
      API.post('/contact', data).then((res) => {
        Swal.fire({
          icon: 'success',
          title: 'Success',
          text: res.data.message
        })
        reset()
      }).catch((e) => {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: e.response.data.message
        })
      })

    }


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
          <form action="" onSubmit={handleSubmit(sendMail)}>
            <div className="form-group mb-2">
              <label htmlFor="name">Name:
                {errors.name && <span className='text-danger' >{errors.name.message}</span>}
              </label>
              <input type="text"
                {...register("name")}
                className="form-control" id="name" />
            </div>
            <div className="form-group mb-2">
              <label htmlFor="email">Email:
                {errors.email && <span className='text-danger' >{errors.email.message}</span>}
              </label>
              <input type="email" name="email"
                {...register("email")}
                className="form-control" id="email" />
            </div>
            <div className="form-group mb-2">
              <label htmlFor="subject">Subject:
                {errors.subject && <span className='text-danger' >{errors.subject.message}</span>}
              </label>
              <input type="text" name='subject'
                {...register("subject")}
                className="form-control" id="subject" />
            </div>
            <div className="form-group mb-2">
              <label htmlFor="message">Message:
                {errors.message && <span className='text-danger' >{errors.message.message}</span>}
              </label>
              <textarea name='message'
                {...register('message')}
                className="form-control" id="message" ></textarea>
            </div>
            <div className="form-group">
              <button className="btn btn-primary">Submit</button>
            </div>
          </form>
        </div>
        <div className="col-md-4">

          
        </div>
      </div>

      <FooterComponent />

    </div>
  )
}
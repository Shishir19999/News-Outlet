import React, { useEffect, useState } from 'react'
import * as yup from 'yup';
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import Swal from 'sweetalert2'

import API from '../../config/API';

let newsSchema = yup.object().shape({
  categoryId: yup.string().required(),
  title: yup.string().required(),
  slug: yup.string().required(),
  summary: yup.string().required(),

});

export default function AddNewsComponent() {
  const [categories, setCategories] = useState([]);
  const { setError, register, reset, handleSubmit, formState: { errors } } =
    useForm({
      resolver: yupResolver(newsSchema)
    });


  const getCategories = () => {
    API.get('/category').then((res) => {
      setCategories(res.data);
    }).catch((e) => {
      console.log(e)
    })
  }

  useEffect(() => {
    getCategories();
  }, []);

  const addNews = (data) => {
    let sendData = new FormData();
    sendData.append('categoryId', data.categoryId);
    sendData.append('title', data.title);
    sendData.append('slug', data.slug);
    sendData.append('summary', data.summary);
    sendData.append('description', data.description);
    sendData.append('image', data.image[0]);
    API.post('/news', sendData,{
      headers: {
        'authorization': localStorage.getItem('token')
      }
    }).then((res) => {
        if(res.data.success){
          Swal.fire({
            icon: 'success',
            title: res.data.message
          })
        }

        reset();
      
    }).catch((error) => {
      if (error.response.data.email) {
        setError('email', { message: error.response.data.email });
      }
      console.log(error.response.data)
    });
  }

  return (
    <div className="card">
      <div className="card-body">
        <div className='container'>
          <div className="row mt-3 mb-3">
            <div className="col-md-12">
              <h1>Add News </h1>
            </div>
          </div>
          <div className="row">
            <div className="col-md-12">
              <form action="" onSubmit={handleSubmit(addNews)}>
                <div className="form-group mb-2">
                  <label htmlFor="categoryId">Category:
                    {errors.categoryId && <span className='text-danger' >
                      {errors.categoryId.message}</span>}
                  </label>
                  <select
                    {...register("categoryId")}
                    className="form-control" id="categoryId">
                    <option value="">Select Category</option>
                    {categories && categories.map((category, index) => {
                      return <option key={index} value={category._id}>{category.name}</option>
                    })}
                  </select>
                </div>

                <div className="form-group mb-2">
                  <label htmlFor="title">Title:
                    {errors.title && <span className='text-danger' >
                      {errors.title.message}</span>}
                  </label>
                  <input type="text"
                    {...register("title")}
                    className="form-control" id="title" />
                </div>
                <div className="form-group mb-2">
                  <label htmlFor="slug">Slug:
                    {errors.slug && <span className='text-danger' >
                      {errors.slug.message}</span>}
                  </label>
                  <input type="text"
                    {...register("slug")}
                    className="form-control" id="slug" />
                </div>
                <div className="form-group mb-2">
                  <label htmlFor="summary">Summary:
                    {errors.summary && <span className='text-danger' >
                      {errors.summary.message}</span>}
                  </label>
                  <textarea
                    {...register("summary")} className='form-control'></textarea>
                </div>
                <div className="form-group mb-2">
                  <label htmlFor="description">Description:</label>
                  <textarea
                    {...register("description")} className='form-control'></textarea>
                </div>



                <div className="form-group mb-2">
                  <label htmlFor="image">Image</label>
                  <input type="file" name='image'
                    {...register('image')}
                    className="form-control" id="image" />
                </div>
                <div className="form-group">
                  <button className="btn btn-primary">Add News</button>

                </div>
              </form>
            </div>
          </div>


        </div>
      </div>
    </div>
  )
}
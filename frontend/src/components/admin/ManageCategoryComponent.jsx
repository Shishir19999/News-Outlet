import React, { useEffect, useState } from 'react';
import * as yup from 'yup';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import API from '../../config/API';
import Swal from 'sweetalert2';

let categorySchema = yup.object().shape({
  name: yup.string().required(),
  description: yup.string().required(),
});

export default function ManageCategoryComponent() {
  const [categories, setCategories] = useState([]);
  const {
    setError,
    register,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(categorySchema),
  });

  const addCategory = (data) => {
    API.post('/category', data, {
      headers: {
        authorization: localStorage.getItem('token'),
      },
    })
      .then((res) => {
        if (res.data.success) {
          Swal.fire({
            icon: 'success',
            title: res.data.message,
          });
          getCategories();
          reset();
        }
      })
      .catch((e) => {
        if (e.response.data.message) {
          setError('name', {
            type: 'manual',
            message: e.response.data.message,
          });
        }
        console.log(e);
      });
  };

  const getCategories = () => {
    API.get('/category')
      .then((res) => {
        setCategories(res.data);
      })
      .catch((e) => {
        console.log(e);
      });
  };

  useEffect(() => {
    getCategories();
  }, []);

  const deleteCategory = (id) => {
    API.delete(`/category/${id}`, {
      headers: {
        authorization: localStorage.getItem('token'),
      },
    })
      .then((res) => {
        if (res.data.success) {
          Swal.fire({
            icon: 'success',
            title: res.data.message,
          });
          getCategories();
        }
      })
      .catch((e) => {
        console.log(e);
      });
  };

  return (
    <div className="card">
      <div className="card-body">
        <div className="container">
          <div className="row">
            <div className="col-md-12">
              <h1>Manage Category</h1>
            </div>
          </div>
          <div className="row">
            <div className="col-md-4">
              <form action="" onSubmit={handleSubmit(addCategory)}>
                <div className="form-group mb-2">
                  <label htmlFor="name">
                    Name:
                    {errors.name && (
                      <span className="text-danger">{errors.name.message}</span>
                    )}
                  </label>
                  <input
                    type="text"
                    name="name"
                    {...register('name')}
                    className="form-control"
                    id="name"
                  />
                </div>
                <div className="form-group mb-2">
                  <label htmlFor="description">
                    Description:
                    {errors.description && (
                      <span className="text-danger">
                        {errors.description.message}
                      </span>
                    )}
                  </label>
                  <textarea
                    name="description"
                    className="form-control"
                    {...register('description')}
                  ></textarea>
                </div>
                <div className="form-group">
                  <button className="btn btn-primary">Add Category</button>
                </div>
              </form>
            </div>
            <div className="col-md-8">
              <table className="table">
                <thead>
                  <tr>
                    <th>Id</th>
                    <th>Name</th>
                    <th>Description</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {categories &&
                    categories.map((category, index) => {
                      return (
                        <tr key={index}>
                          <td>{++index}</td>
                          <td>{category.name}</td>
                          <td>{category.description}</td>
                          <td>
                            <button className="btn btn-info">Edit</button>
                            <button
                              onClick={(e) => deleteCategory(category._id)}
                              className="btn btn-danger"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

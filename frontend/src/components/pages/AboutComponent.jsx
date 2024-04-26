import React from 'react'
import HeaderComponent from '../layouts/HeaderComponent'
import FooterComponent from '../layouts/FooterComponent'

export default function AboutComponent() {
  return (
    <div className='container'>
    <HeaderComponent/>
     <div className="row mt-3 mb-3">
      <div className="col-md-12">
        <h1>About Us</h1>
      </div>
     </div>
     <div className="row">
      <div className="col-md-8">
        <p>
          Lorem ipsum dolor sit amet consectetur adipisicing elit. Nihil porro fuga repellat veniam provident placeat dolores fugiat
           nobis enim necessitatibus, nulla earum fugit, quae dolorum nam sit distinctio at debitis.
        </p>
        <p>
          Lorem ipsum dolor sit amet consectetur adipisicing elit. Nihil porro fuga repellat veniam provident placeat dolores fugiat
           nobis enim necessitatibus, nulla earum fugit, quae dolorum nam sit distinctio at debitis.
        </p>
        <p>
          Lorem ipsum dolor sit amet consectetur adipisicing elit. Nihil porro fuga repellat veniam provident placeat dolores fugiat
           nobis enim necessitatibus, nulla earum fugit, quae dolorum nam sit distinctio at debitis.
        </p>
        <p>
          Lorem ipsum dolor sit amet consectetur adipisicing elit. Nihil porro fuga repellat veniam provident placeat dolores fugiat
           nobis enim necessitatibus, nulla earum fugit, quae dolorum nam sit distinctio at debitis.
        </p>
      </div>
      <div className="col-md-4">
        <img src="https://picsum.photos/seed/picsum/200/300" className='img-fluid' alt="" />
      </div>
     </div>
      <FooterComponent/>
    </div>
  )
}

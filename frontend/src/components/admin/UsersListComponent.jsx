import React,{useEffect,useState} from 'react'
import API from '../../config/API';
import { Link } from 'react-router-dom';
export default function UsersListComponent() {
    const [users,setUsers]=useState([]);

    const getUsers=()=>{
        API.get('/user',{
            headers:{
                'authorization':localStorage.getItem('token')
            }
        }).then((res)=>{
            setUsers(res.data);
        }).catch((e)=>{
            console.log(e);
        })
    }


    useEffect(()=>{
        getUsers();
    },[]);




    return (
        <div className='card'>
            <div className='card-body'>
                <div className="row">
                    <div className="col-md-12 mb-3">
                        <h2> <i className="bi bi-people"></i> Users List</h2>
                        <hr />
                    </div>
                    <div className="col-md-12">
                    <table className='table table-bordered'>
                    <thead>
                        <tr>
                            <th>S.n</th>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Gender</th>
                            <th>Role</th>
                            <th>Image</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users && users.map((user,index)=>{
                            return(
                                <tr key={index}>
                                    <td>{++index}</td>
                                    <td>{user.name}</td>
                                    <td>{user.email}</td>
                                    <td>{user.gender}</td>
                                    <td>{user.role}</td>
                                    <td><img src={user.image} alt={user.name} style={{width:100}}/></td>
                                    <td>
                                        <Link to={`/admin/user-details/${user._id}`} className='btn btn-primary'>View</Link>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
                    </div>
                </div>
               
              
            </div>
        </div>
    )
}
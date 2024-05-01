import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import API from '../../config/API';

export default function UserDetailsComponent() {
    const [Profile, setProfile] = useState({});
    const {id} = useParams();
    const getProfile = () => {
        API.get(`/user/${id}`, {
            headers: {
                'authorization': localStorage.getItem('token')
            }
        }).then((res) => {
            setProfile(res.data);
        }).catch((e) => {
            console.log(e);
        })
    }

    useEffect(() => {
        getProfile();
    }, []);

    return (
        <div className='card'>
            <div className='card-body'>
                <div className="row">
                    <div className="col-md-12 mb-3">
                        <h1>User Details</h1>
                    <hr />
                    </div>
                </div>
                <div className="row">
                    <div className="col-md-8">
                        <table>
                            <tbody>
                            <tr>
                                <th>Name</th>
                                <td>{Profile && Profile.name}</td>
                            </tr>
                            <tr>
                                <th>Email</th>
                                <td>{Profile && Profile.email}</td>
                            </tr>
                            <tr>
                                <th>Gender</th>
                                <td>{Profile && Profile.gender}</td>
                            </tr>
                            <tr>
                                <th>Role</th>
                                <td>{Profile && Profile.role}</td>
                            </tr>
                            </tbody>
                        </table>
                    </div>
                    <div className="col-md-4">
                        <img src={Profile && Profile.image} className='img-fluid' alt="" />
                    </div>
                </div>
            </div>
        </div>
    )
}

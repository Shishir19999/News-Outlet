import React, { useEffect, useState } from 'react';
import API from '../../config/API';

export default function MyProfileComponent() {
    const [Profile, setProfile] = useState({});
    const getProfile = () => {
        API.get('/user/profile/user', {
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
                        <h1>My Profle</h1>
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
                        <img src={Profile && Profile.image} alt="" />
                    </div>
                </div>
            </div>
        </div>
    )
}
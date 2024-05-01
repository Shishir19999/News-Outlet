import React, { useEffect, useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import "../css/admin.css";
import API from '../config/API';

export default function AdminMiddlewareComponent() {
  let token = localStorage.getItem('token');
  const [getToken, setToken] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [Profile, setProfile] = useState({});

  const checkToken = () => {
    let sendData = {
      'token': token
    }
    API.post('/login/toke-check', sendData).then((res) => {
      if (res.data.success) {
        setToken(res.data.success);
        setIsLoading(false);
      } else {
        setToken(false);
        setIsLoading(false);
      }
    }).catch((e) => {
      console.log(e);
    })
  }

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
    checkToken();
    getProfile();
  }, []);

  const logout = () => {
    localStorage.clear('token');
    window.location = "/login";
  }


  if (isLoading) {
    return <h1>Loading...</h1>
  } else {
    if (getToken) {
      return (
        <div>
          <div>
            <header id="header" className="header fixed-top d-flex align-items-center">
              <div className="d-flex align-items-center justify-content-between">
                <Link to="/admin" className="logo d-flex align-items-center">
                  <span className="d-none d-lg-block">Admin Panel</span>
                </Link>
                <Link to="/">Visit Web Site</Link>
                
              </div>
              <nav className="header-nav ms-auto">
                <ul className="d-flex align-items-center">
                  <li className="nav-item d-block d-lg-none">
                    <Link className="nav-link nav-icon search-bar-toggle " to="#">
                      <i className="bi bi-search" />
                    </Link>
                   
                  </li>

                  <li className="nav-item dropdown pe-3">
                    <Link className="nav-link nav-profile d-flex align-items-center pe-0" to="#" data-bs-toggle="dropdown">
                      <img src={Profile && Profile.image} alt="Profile" className="rounded-circle" />
                      <span className="d-none d-md-block dropdown-toggle ps-2">
                        <span>{Profile && Profile.name}</span>
                      </span>
                    </Link>
                    <ul className="dropdown-menu dropdown-menu-end dropdown-menu-arrow profile">
                      <li className="dropdown-header">
                        <h6>Role</h6>
                        <span>{Profile && Profile.role }</span>
                      </li>
                      <li>
                        <hr className="dropdown-divider" />
                      </li>
                      <li>
                        <Link className="dropdown-item d-flex align-items-center" to="/admin/my-profile">
                          <i className="bi bi-person" />
                          <span>My Profile</span>
                        </Link>
                      </li>
                      <li>
                        <hr className="dropdown-divider" />
                      </li>
                      <li>
                        <Link className="dropdown-item d-flex align-items-center" href="users-profile.html">
                          <i className="bi bi-gear" />
                          <span>Account Settings</span>
                        </Link>
                      </li>
                      <li>
                        <hr className="dropdown-divider" />
                      </li>
                      <li>
                        <button className="dropdown-item d-flex align-items-center"
                          onClick={logout} >
                          <i className="bi bi-box-arrow-right" />
                          <span>Sign Out</span>
                        </button>
                      </li>
                    </ul>
                  </li>
                </ul>
              </nav>
            </header>

            <aside id="sidebar" className="sidebar">
              <ul className="sidebar-nav" id="sidebar-nav">
                <li className="nav-item">
                  <Link className="nav-link " to="/admin">
                    <i className="bi bi-grid" />
                    <span>Dashboard</span>
                  </Link>
                </li>
                <li className="nav-item">
                  <Link className="nav-link " to="/admin/users-list">
                    <i className="bi bi-people" />
                    <span>Users List</span>
                  </Link>
                </li>
                <li className="nav-item">
                  <Link className="nav-link collapsed" data-bs-target="#components-nav" data-bs-toggle="collapse" to="#">
                    <i className="bi bi-newspaper" /><span>News</span><i className="bi bi-chevron-down ms-auto" />
                  </Link>
                  <ul id="components-nav" className="nav-content collapse " data-bs-parent="#sidebar-nav">
                    <li>
                      <Link to="/admin/add-news">
                        <i className="bi bi-circle" /><span>Add news</span>
                      </Link>
                    </li>
                    <li>
                      <Link to="/admin/show-news">
                        <i className="bi bi-circle" /><span>Show news</span>
                      </Link>
                    </li>

                  </ul>
                </li>

              </ul>
            </aside>
            <main id="main" className="main">
              <Outlet />

            </main>

            <footer id="footer" className="footer">
              <div className="copyright">
                © Copyright <strong><span>Admin</span></strong>. All Rights Reserved
              </div>
              <div className="credits">
                Designed by <Link to="/admin">MERN_NEWS</Link>
              </div>
            </footer>
            <Link to="/admin" className="back-to-top d-flex align-items-center justify-content-center"><i className="bi bi-arrow-up-short" /></Link>
          </div>

        </div>
      )
    } else {
      window.location = "/login"
    }
  }



}
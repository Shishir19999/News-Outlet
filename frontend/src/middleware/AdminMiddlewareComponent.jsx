import React from 'react';
import { Link, Outlet } from 'react-router-dom';
import "../css/admin.css";

export default function AdminMiddlewareComponent() {
  return (
    <div>
       <div>
        <header id="header" className="header fixed-top d-flex align-items-center">
          <div className="d-flex align-items-center justify-content-between">
            <Link to="/admin" className="logo d-flex align-items-center">              
              <span className="d-none d-lg-block">Admin Panel</span>
            </Link>
            <i className="bi bi-list toggle-sidebar-btn" />
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
                  <img src="" alt="Profile" className="rounded-circle" />
                  <span className="d-none d-md-block dropdown-toggle ps-2">Admin</span>
                </Link>
                <ul className="dropdown-menu dropdown-menu-end dropdown-menu-arrow profile">
                  <li className="dropdown-header">
                    <h6>Kevin Anderson</h6>
                    <span>Web Designer</span>
                  </li>
                  <li>
                    <hr className="dropdown-divider" />
                  </li>
                  <li>
                    <a className="dropdown-item d-flex align-items-center" href="users-profile.html">
                      <i className="bi bi-person" />
                      <span>My Profile</span>
                    </a>
                  </li>
                  <li>
                    <hr className="dropdown-divider" />
                  </li>
                  <li>
                    <a className="dropdown-item d-flex align-items-center" href="users-profile.html">
                      <i className="bi bi-gear" />
                      <span>Account Settings</span>
                    </a>
                  </li>
                  <li>
                    <hr className="dropdown-divider" />
                  </li>
                  <li>
                    <a className="dropdown-item d-flex align-items-center" href="#">
                      <i className="bi bi-box-arrow-right" />
                      <span>Sign Out</span>
                    </a>
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
              <Link className="nav-link collapsed" data-bs-target="#components-nav" data-bs-toggle="collapse" to="#">
              <i class="bi bi-newspaper"/><span>News</span><i className="bi bi-chevron-down ms-auto" />
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
            <Outlet/>
          
        </main>
        
        <footer id="footer" className="footer">
          <div className="copyright">
            © Copyright <strong><span>NiceAdmin</span></strong>. All Rights Reserved
          </div>
          <div className="credits">
            Designed by <Link to="/admin">MERN7AM</Link>
          </div>
        </footer>
        <Link to="/admin" className="back-to-top d-flex align-items-center justify-content-center"><i className="bi bi-arrow-up-short" /></Link>
      </div>
       
    </div>
  )
}

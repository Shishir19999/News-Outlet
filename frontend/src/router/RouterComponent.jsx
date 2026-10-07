import { Routes, Route } from 'react-router-dom';
import PublicLayout from '../components/layouts/PublicLayout';
import HomeComponent from '../components/pages/HomeComponent';
import AboutComponent from '../components/pages/AboutComponent';
import ContactComponent from '../components/pages/ContactComponent';
import NewsComponent from '../components/pages/NewsComponent';
import CategoryComponent from '../components/pages/CategoryComponent';
import BookmarksComponent from '../components/pages/BookmarksComponent';
import NewsDetatilsComponent from '../components/pages/NewsDetatilsComponent';
import PageNotFoundComponent from '../components/error/PageNotFoundComponent';
import AdminMiddlewareComponent from '../middleware/AdminMiddlewareComponent';
import DashboardComponent from '../components/admin/DashboardComponent';
import AddNewsComponent from '../components/admin/AddNewsComponent';
import ShowNewsComponent from '../components/admin/ShowNewsComponent';
import CommentsComponent from '../components/admin/CommentsComponent';
import SubscribersComponent from '../components/admin/SubscribersComponent';
import LoginComponent from '../components/auth/LoginComponent';
import RegisterComponent from '../components/auth/RegisterComponent';
import UsersListComponent from '../components/admin/UsersListComponent';
import MyProfileComponent from '../components/admin/MyProfileComponent';
import UserDetailsComponent from '../components/admin/UserDetailsComponent';
import ManageCategoryComponent from '../components/admin/ManageCategoryComponent';

export default function RouterComponent() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<HomeComponent />} />
        <Route path="about" element={<AboutComponent />} />
        <Route path="contact" element={<ContactComponent />} />
        <Route path="news" element={<NewsComponent />} />
        <Route path="category/:slug" element={<CategoryComponent />} />
        <Route path="bookmarks" element={<BookmarksComponent />} />
        <Route path="login" element={<LoginComponent />} />
        <Route path="register" element={<RegisterComponent />} />
        <Route path="news-details/:slug" element={<NewsDetatilsComponent />} />
        <Route path="*" element={<PageNotFoundComponent />} />
      </Route>

      <Route path="/admin" element={<AdminMiddlewareComponent />}>
        <Route index element={<DashboardComponent />} />
        <Route path="users-list" element={<UsersListComponent />} />
        <Route path="my-profile" element={<MyProfileComponent />} />
        <Route path="user-details/:id" element={<UserDetailsComponent />} />
        <Route path="manage-category" element={<ManageCategoryComponent />} />
        <Route path="add-news" element={<AddNewsComponent />} />
        <Route path="edit-news/:id" element={<AddNewsComponent />} />
        <Route path="show-news" element={<ShowNewsComponent />} />
        <Route path="comments" element={<CommentsComponent />} />
        <Route path="subscribers" element={<SubscribersComponent />} />
      </Route>
    </Routes>
  );
}

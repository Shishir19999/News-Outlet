import { Routes, Route } from 'react-router-dom';
import PublicLayout from '../components/layouts/PublicLayout';
import HomeComponent from '../components/pages/HomeComponent';
import AboutComponent from '../components/pages/AboutComponent';
import ContactComponent from '../components/pages/ContactComponent';
import NewsComponent from '../components/pages/NewsComponent';
import CategoryComponent from '../components/pages/CategoryComponent';
import NewsDetatilsComponent from '../components/pages/NewsDetatilsComponent';
import {
  ArchivePage, AuthorPage, AuthorsPage, ForYouPage, LibraryPage, NewsletterConfirmPage, NewsletterPreferencesPage, InboxPage,
} from '../components/pages/ReaderPages';
import PageNotFoundComponent from '../components/error/PageNotFoundComponent';
import AdminMiddlewareComponent from '../middleware/AdminMiddlewareComponent';
import DashboardComponent from '../components/admin/DashboardComponent';
import AddNewsComponent from '../components/admin/AddNewsComponent';
import ShowNewsComponent from '../components/admin/ShowNewsComponent';
import ReviewDeskComponent from '../components/admin/ReviewDeskComponent';
import CommentsComponent from '../components/admin/CommentsComponent';
import SubscribersComponent from '../components/admin/SubscribersComponent';
import { SettingsPage, AuditPage } from '../components/admin/SiteAdmin';
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
        <Route path="archive" element={<ArchivePage />} />
        <Route path="authors" element={<AuthorsPage />} />
        <Route path="author/:id" element={<AuthorPage />} />
        <Route path="for-you" element={<ForYouPage />} />
        <Route path="bookmarks" element={<LibraryPage />} />
        <Route path="library" element={<LibraryPage />} />
        <Route path="newsletter/confirm" element={<NewsletterConfirmPage />} />
        <Route path="newsletter/preferences" element={<NewsletterPreferencesPage />} />
        <Route path="inbox" element={<InboxPage />} />
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
        <Route path="review" element={<ReviewDeskComponent />} />
        <Route path="comments" element={<CommentsComponent />} />
        <Route path="alert" element={<SettingsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="newsletter" element={<SubscribersComponent />} />
        <Route path="subscribers" element={<SubscribersComponent />} />
        <Route path="audit" element={<AuditPage />} />
      </Route>
    </Routes>
  );
}

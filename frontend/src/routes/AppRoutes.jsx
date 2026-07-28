import { Route, Routes } from 'react-router-dom'
import ProtectedRoute from '../components/ProtectedRoute'
import SiteLayout from '../layouts/SiteLayout'
import { LoginPage, RegisterPage } from '../pages/AuthPages'
import HomePage from '../pages/HomePage'
import { PrivacyPage, TermsPage } from '../pages/LegalPages'
import NotFoundPage from '../pages/NotFoundPage'
import PlaceDetailPage from '../pages/PlaceDetailPage'
import PlaceFormPage from '../pages/PlaceFormPage'
import PlacesPage from '../pages/PlacesPage'
import PrefectureDetailPage from '../pages/PrefectureDetailPage'
import PrefecturesPage from '../pages/PrefecturesPage'
import ProfileEditPage from '../pages/ProfileEditPage'
import ProfilePage from '../pages/ProfilePage'
import RegionDetailPage from '../pages/RegionDetailPage'
import RegionsPage from '../pages/RegionsPage'
import ReviewFormPage from '../pages/ReviewFormPage'
import SearchPage from '../pages/SearchPage'
import MyTravelPage from '../pages/MyTravelPage'
import ContactPage, { SupportSuccessPage } from '../pages/ContactPage'
import SupportJapan47Page from '../pages/SupportJapan47Page'
import { CheckEmailPage, ForgotPasswordPage, PasswordResetSuccessPage, ResetPasswordPage, VerifyEmailPage } from '../pages/AccountRecoveryPages'

const protectedPage = (element) => <ProtectedRoute>{element}</ProtectedRoute>

export default function AppRoutes() {
  return <Routes><Route element={<SiteLayout />}>
    <Route index element={<HomePage />} /><Route path="regions" element={<RegionsPage />} /><Route path="regions/:name" element={<RegionDetailPage />} /><Route path="prefectures" element={<PrefecturesPage />} /><Route path="prefectures/:name" element={<PrefectureDetailPage />} /><Route path="places" element={<PlacesPage />} /><Route path="places/:id/:slug?" element={<PlaceDetailPage />} /><Route path="places/new" element={protectedPage(<PlaceFormPage />)} /><Route path="places/:id/edit" element={protectedPage(<PlaceFormPage />)} /><Route path="places/:placeId/reviews/new" element={protectedPage(<ReviewFormPage />)} /><Route path="reviews/:reviewId/edit" element={protectedPage(<ReviewFormPage />)} /><Route path="contributors/:id" element={<ProfilePage />} /><Route path="profile/edit" element={protectedPage(<ProfileEditPage />)} /><Route path="my-travel" element={protectedPage(<MyTravelPage />)} /><Route path="search" element={<SearchPage />} /><Route path="support" element={<SupportJapan47Page />} /><Route path="contact" element={protectedPage(<ContactPage />)} /><Route path="contact/success/:ticketId" element={protectedPage(<SupportSuccessPage />)} /><Route path="login" element={<LoginPage />} /><Route path="register" element={<RegisterPage />} /><Route path="check-email" element={<CheckEmailPage />} /><Route path="verify-email/:token" element={<VerifyEmailPage />} /><Route path="forgot-password" element={<ForgotPasswordPage />} /><Route path="reset-password/:uid/:token" element={<ResetPasswordPage />} /><Route path="password-reset-success" element={<PasswordResetSuccessPage />} /><Route path="privacy" element={<PrivacyPage />} /><Route path="terms" element={<TermsPage />} /><Route path="*" element={<NotFoundPage />} />
  </Route></Routes>
}

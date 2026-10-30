import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppShell } from './app/AppShell'
import { LandingPage } from './app/LandingPage'
import { TransactionDetailsPage, TransactionsPage } from './app/TransactionsPage'
import { WalletPage, WalletRequestPage, WalletStatementPage, WalletTransactionsPage } from './app/WalletPage'
import { VerifyCardPage } from './app/VerifyCardPage'
import { MembershipCardPage } from './app/MembershipCardPage'
import { StatementsPage } from './app/StatementsPage'
import { LimitsPage } from './app/LimitsPage'
import { DashboardPage } from './app/DashboardPage'
import { SupportPage } from './app/SupportPage'
import { NotificationsPage } from './app/NotificationsPage'
import { GiftsPage } from './app/GiftsPage'
import { useSession } from './stores/session'
import {
  ActivityPage, BranchesPage, ForgotPasswordPage, ForexPage,
  LoginPage, MoneyTransferPage, NotFoundPage,
  PlaceholderPage, ProfilePage, RegisterPage, SettingsPage,
} from './app/pages'
import { Banknote, CalendarDays, FileText, Send, UserRound } from 'lucide-react'

function Protected() {
  const authenticated = useSession((s) => s.isAuthenticated)
  const location = useLocation()
  return authenticated ? <AppShell /> : <Navigate to="/login" replace state={{ from: location }} />
}

export default function App() {
  const isReady = useSession((s) => s.isReady)
  const restoreSession = useSession((s) => s.restoreSession)

  useEffect(() => { void restoreSession() }, [restoreSession])
  if (!isReady) return <div className="session-loading">Loading secure session…</div>

  return <Routes>
    <Route path="/" element={<LandingPage />} />
    <Route path="/login" element={<LoginPage />} />
    <Route path="/register" element={<RegisterPage />} />
    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
    <Route path="/verify-card/:token" element={<VerifyCardPage />} />
    <Route element={<Protected />}>
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/profile/kyc" element={<ProfilePage kyc />} />
      <Route path="/membership-card" element={<MembershipCardPage />} />
      <Route path="/forex" element={<ForexPage />} />
      <Route path="/forex/buy" element={<ForexPage mode="buy" />} />
      <Route path="/forex/sell" element={<ForexPage mode="sell" />} />
      <Route path="/forex/bookings" element={<PlaceholderPage title="Forex bookings" description="Track draft, payment, compliance, approval and collection statuses returned by the backend." icon={CalendarDays} />} />
      <Route path="/forex/bookings/:id" element={<PlaceholderPage title="Booking details" description="Review the quote, charges, branch appointment, payment and backend-confirmed status timeline." icon={Banknote} />} />
      <Route path="/money-transfer" element={<MoneyTransferPage />} />
      <Route path="/money-transfer/new" element={<MoneyTransferPage detail />} />
      <Route path="/money-transfer/beneficiaries" element={<PlaceholderPage title="Beneficiaries" description="Manage destination-specific recipient information through backend-configured fields." icon={UserRound} />} />
      <Route path="/money-transfer/history" element={<PlaceholderPage title="Transfer history" description="Review internal and provider references with backend-confirmed progress." icon={Send} />} />
      <Route path="/money-transfer/:id" element={<PlaceholderPage title="Transfer details" description="Follow KYC, compliance, payment and authorised provider status transitions." icon={Send} />} />
      <Route path="/gifts" element={<GiftsPage />} />
      <Route path="/wallet" element={<WalletPage />} />
      <Route path="/wallet/add-money" element={<WalletRequestPage />} />
      <Route path="/wallet/withdraw" element={<WalletRequestPage requestType="Withdrawal" />} />
      <Route path="/wallet/transactions" element={<WalletTransactionsPage />} />
      <Route path="/wallet/statement" element={<WalletStatementPage />} />
      <Route path="/transactions" element={<TransactionsPage />} />
      <Route path="/transactions/:id" element={<TransactionDetailsPage />} />
      <Route path="/statements" element={<StatementsPage />} />
      <Route path="/limits" element={<LimitsPage />} />
      <Route path="/activity" element={<ActivityPage />} />
      <Route path="/branches" element={<BranchesPage />} />
      <Route path="/appointments" element={<BranchesPage appointments />} />
      <Route path="/notifications" element={<NotificationsPage />} />
      <Route path="/support" element={<SupportPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/receipts" element={<PlaceholderPage title="Receipts" description="Download receipts generated from authoritative backend records." icon={FileText} />} />
    </Route>
    <Route path="*" element={<NotFoundPage />} />
  </Routes>
}

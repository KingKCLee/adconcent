import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { PrivateRoute } from '@/components/layout/PrivateRoute';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { LandingPage } from '@/pages/LandingPage';
import { LoginPage } from '@/pages/LoginPage';
import { SignupPage } from '@/pages/SignupPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { ClickFraudPage } from '@/pages/ClickFraudPage';
import { AutoBidPage } from '@/pages/AutoBidPage';
import { ShoppingPage } from '@/pages/ShoppingPage';
import { AnalyticsPage } from '@/pages/AnalyticsPage';
import { StatsPage } from '@/pages/StatsPage';
import { ReportPage } from '@/pages/ReportPage';
import { MetaPage } from '@/pages/MetaPage';
import { YoutubePage } from '@/pages/YoutubePage';
import { SettingsPage } from '@/pages/SettingsPage';
import { BillingPage } from '@/pages/BillingPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />

        <Route element={<PrivateRoute />}>
          <Route element={<DashboardLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/dashboard/autobid" element={<AutoBidPage />} />
            <Route path="/dashboard/shopping" element={<ShoppingPage />} />
            <Route path="/dashboard/click-fraud" element={<ClickFraudPage />} />
            <Route path="/dashboard/analytics" element={<AnalyticsPage />} />
            <Route path="/dashboard/stats" element={<StatsPage />} />
            <Route path="/dashboard/report" element={<ReportPage />} />
            <Route path="/dashboard/meta" element={<MetaPage />} />
            <Route path="/dashboard/youtube" element={<YoutubePage />} />
            <Route path="/dashboard/settings" element={<SettingsPage />} />
            <Route path="/dashboard/billing" element={<BillingPage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

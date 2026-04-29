import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { PrivateRoute } from '@/components/layout/PrivateRoute';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { LandingPage } from '@/pages/LandingPage';
import { LoginPage } from '@/pages/LoginPage';
import { SignupPage } from '@/pages/SignupPage';
import { TermsPage } from '@/pages/TermsPage';
import { PrivacyPage } from '@/pages/PrivacyPage';
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
import CampaignDetailPage from '@/pages/CampaignDetailPage';
import { OnboardingPage } from '@/pages/OnboardingPage';
import { ConnectPage } from '@/pages/ConnectPage';

// /admin/* — 매체별 분리 (네이버 6 + 구글 5 + 통합 4 + AI/결제 2 = 17 페이지)
const AdminHome = lazy(() => import('@/pages/admin/AdminHome'));
const AdminCampaigns = lazy(() => import('@/pages/admin/AdminCampaigns'));
const AdminLeads = lazy(() => import('@/pages/admin/AdminLeads'));
const AdminSites = lazy(() => import('@/pages/admin/AdminSites'));
const AdminBilling = lazy(() => import('@/pages/admin/AdminBilling'));
const AIPage = lazy(() => import('@/pages/admin/AIPage'));
const NaverDashboard = lazy(() => import('@/pages/admin/naver/NaverDashboard'));
const NaverAutoBid = lazy(() => import('@/pages/admin/naver/NaverAutoBid'));
const NaverKeywords = lazy(() => import('@/pages/admin/naver/NaverKeywords'));
const NaverClickFraud = lazy(() => import('@/pages/admin/naver/NaverClickFraud'));
const NaverStats = lazy(() => import('@/pages/admin/naver/NaverStats'));
const NaverSettings = lazy(() => import('@/pages/admin/naver/NaverSettings'));
const GoogleDashboard = lazy(() => import('@/pages/admin/google/GoogleDashboard'));
const GoogleCampaigns = lazy(() => import('@/pages/admin/google/GoogleCampaigns'));
const GoogleAudit = lazy(() => import('@/pages/admin/google/GoogleAudit'));
const GoogleStats = lazy(() => import('@/pages/admin/google/GoogleStats'));
const GoogleSettings = lazy(() => import('@/pages/admin/google/GoogleSettings'));

const AdminFallback = () => (
  <div className="p-8 text-sm text-gray-400">로드 중...</div>
);

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />

        <Route element={<PrivateRoute />}>
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route element={<DashboardLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/dashboard/connect" element={<ConnectPage />} />
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
            <Route path="/dashboard/campaigns/:id" element={<CampaignDetailPage />} />
          </Route>

          {/* /admin/* — 매체별 분리 (Phase Admin Media) */}
          <Route element={<AdminLayout />}>
            <Route path="/workspace" element={<Suspense fallback={<AdminFallback />}><AdminHome /></Suspense>} />
            <Route path="/workspace/campaigns" element={<Suspense fallback={<AdminFallback />}><AdminCampaigns /></Suspense>} />
            <Route path="/workspace/leads" element={<Suspense fallback={<AdminFallback />}><AdminLeads /></Suspense>} />
            <Route path="/workspace/sites" element={<Suspense fallback={<AdminFallback />}><AdminSites /></Suspense>} />
            <Route path="/workspace/naver" element={<Suspense fallback={<AdminFallback />}><NaverDashboard /></Suspense>} />
            <Route path="/workspace/naver/autobid" element={<Suspense fallback={<AdminFallback />}><NaverAutoBid /></Suspense>} />
            <Route path="/workspace/naver/keywords" element={<Suspense fallback={<AdminFallback />}><NaverKeywords /></Suspense>} />
            <Route path="/workspace/naver/click-fraud" element={<Suspense fallback={<AdminFallback />}><NaverClickFraud /></Suspense>} />
            <Route path="/workspace/naver/stats" element={<Suspense fallback={<AdminFallback />}><NaverStats /></Suspense>} />
            <Route path="/workspace/naver/settings" element={<Suspense fallback={<AdminFallback />}><NaverSettings /></Suspense>} />
            <Route path="/workspace/google" element={<Suspense fallback={<AdminFallback />}><GoogleDashboard /></Suspense>} />
            <Route path="/workspace/google/campaigns" element={<Suspense fallback={<AdminFallback />}><GoogleCampaigns /></Suspense>} />
            <Route path="/workspace/google/audit" element={<Suspense fallback={<AdminFallback />}><GoogleAudit /></Suspense>} />
            <Route path="/workspace/google/stats" element={<Suspense fallback={<AdminFallback />}><GoogleStats /></Suspense>} />
            <Route path="/workspace/google/settings" element={<Suspense fallback={<AdminFallback />}><GoogleSettings /></Suspense>} />
            <Route path="/workspace/ai" element={<Suspense fallback={<AdminFallback />}><AIPage /></Suspense>} />
            <Route path="/workspace/billing" element={<Suspense fallback={<AdminFallback />}><AdminBilling /></Suspense>} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

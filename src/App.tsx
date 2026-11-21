import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import type { Role } from './lib/supabase';
import { ToastProvider, ListSkeleton } from './components/ui';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

const Families = lazy(() => import('./pages/Families'));
const FamilyForm = lazy(() => import('./pages/FamilyForm'));
const FamilyView = lazy(() => import('./pages/FamilyView'));
const Finance = lazy(() => import('./pages/Finance'));
const DonationForm = lazy(() => import('./pages/DonationForm'));
const ExpenseForm = lazy(() => import('./pages/ExpenseForm'));
const Receipt = lazy(() => import('./pages/Receipt'));
const Approvals = lazy(() => import('./pages/Approvals'));
const Inventory = lazy(() => import('./pages/Inventory'));
const Campaigns = lazy(() => import('./pages/Campaigns'));
const CampaignForm = lazy(() => import('./pages/CampaignForm'));
const CampaignView = lazy(() => import('./pages/CampaignView'));
const RoutePage = lazy(() => import('./pages/RoutePage'));
const FamiliesMap = lazy(() => import('./pages/FamiliesMap'));
const Team = lazy(() => import('./pages/Team'));
const Reports = lazy(() => import('./pages/Reports'));
const Activity = lazy(() => import('./pages/Activity'));
const Account = lazy(() => import('./pages/Account'));

function Guard({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { profile, loading } = useAuth();
  if (loading) return <div className="p-6"><ListSkeleton /></div>;
  if (!profile) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(profile.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const OFFICE: Role[] = ['admin', 'accountant', 'auditor'];

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Suspense fallback={<div className="p-6"><ListSkeleton /></div>}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route element={<Guard><Layout /></Guard>}>
                <Route index element={<Dashboard />} />
                <Route path="families" element={<Families />} />
                <Route path="families/new" element={<Guard roles={['admin', 'researcher']}><FamilyForm /></Guard>} />
                <Route path="families/:id" element={<FamilyView />} />
                <Route path="families/:id/edit" element={<Guard roles={['admin', 'researcher']}><FamilyForm /></Guard>} />
                <Route path="finance" element={<Guard roles={[...OFFICE, 'warehouse']}><Finance /></Guard>} />
                <Route path="finance/donation" element={<Guard roles={['admin', 'accountant']}><DonationForm /></Guard>} />
                <Route path="finance/expense" element={<Guard roles={['admin', 'accountant', 'warehouse']}><ExpenseForm /></Guard>} />
                <Route path="finance/receipt/:id" element={<Guard roles={OFFICE}><Receipt /></Guard>} />
                <Route path="approvals" element={<Guard roles={['admin']}><Approvals /></Guard>} />
                <Route path="inventory" element={<Guard roles={[...OFFICE, 'warehouse']}><Inventory /></Guard>} />
                <Route path="campaigns" element={<Campaigns />} />
                <Route path="campaigns/new" element={<Guard roles={['admin']}><CampaignForm /></Guard>} />
                <Route path="campaigns/:id" element={<CampaignView />} />
                <Route path="route" element={<Guard roles={['distributor', 'admin']}><RoutePage /></Guard>} />
                <Route path="map" element={<FamiliesMap />} />
                <Route path="team" element={<Guard roles={['admin', 'auditor']}><Team /></Guard>} />
                <Route path="reports" element={<Guard roles={OFFICE}><Reports /></Guard>} />
                <Route path="activity" element={<Guard roles={['admin', 'auditor']}><Activity /></Guard>} />
                <Route path="account" element={<Account />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}

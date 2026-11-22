import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import type { Role } from './lib/supabase';
import type { Perm } from './lib/perms';
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
const Platform = lazy(() => import('./pages/Platform'));
const OrgSettings = lazy(() => import('./pages/OrgSettings'));
const MemberCard = lazy(() => import('./pages/MemberCard'));
const Verify = lazy(() => import('./pages/Verify'));
const Attendance = lazy(() => import('./pages/Attendance'));

function Guard({ roles, perms, allowOwner, children }: { roles?: Role[]; perms?: Perm[]; allowOwner?: boolean; children: ReactNode }) {
  const { profile, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="p-6"><ListSkeleton /></div>;
  if (!profile) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname)}`} replace />;
  if (profile.role === 'volunteer') {
    const ok = allowOwner || roles?.includes('volunteer') || (perms ?? []).some((x) => (profile.perms ?? []).includes(x));
    return ok ? <>{children}</> : <Navigate to="/attendance" replace />;
  }
  if (profile.role === 'owner' && !allowOwner && !roles?.includes('owner')) return <Navigate to="/platform" replace />;
  if (roles && !roles.includes(profile.role)) return <Navigate to={profile.role === 'owner' ? '/platform' : '/'} replace />;
  return <>{children}</>;
}

const OFFICE: Role[] = ['admin', 'accountant', 'auditor'];
const STAFF: Role[] = ['admin', 'accountant', 'auditor', 'warehouse', 'researcher'];
const EVERYONE: Role[] = ['admin', 'accountant', 'auditor', 'warehouse', 'researcher', 'distributor', 'volunteer'];

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Suspense fallback={<div className="p-6"><ListSkeleton /></div>}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/verify/:token" element={<Verify />} />
              <Route element={<Guard allowOwner><Layout /></Guard>}>
                <Route index element={<Guard><Dashboard /></Guard>} />
                <Route path="platform" element={<Guard roles={['owner']}><Platform /></Guard>} />
                <Route path="settings" element={<Guard roles={['admin']}><OrgSettings /></Guard>} />
                <Route path="my-card" element={<Guard roles={EVERYONE}><MemberCard self /></Guard>} />
                <Route path="attendance" element={<Guard roles={EVERYONE}><Attendance /></Guard>} />
                <Route path="team/:id/card" element={<Guard roles={['admin']}><MemberCard /></Guard>} />
                <Route path="families" element={<Guard perms={['families_view', 'families_add']}><Families /></Guard>} />
                <Route path="families/new" element={<Guard roles={['admin', 'researcher']} perms={['families_add']}><FamilyForm /></Guard>} />
                <Route path="families/:id" element={<Guard perms={['families_view', 'families_add', 'distribute']}><FamilyView /></Guard>} />
                <Route path="families/:id/edit" element={<Guard roles={['admin', 'researcher']} perms={['families_add']}><FamilyForm /></Guard>} />
                <Route path="finance" element={<Guard roles={[...OFFICE, 'warehouse']}><Finance /></Guard>} />
                <Route path="finance/donation" element={<Guard roles={['admin', 'accountant']}><DonationForm /></Guard>} />
                <Route path="finance/expense" element={<Guard roles={['admin', 'accountant', 'warehouse']}><ExpenseForm /></Guard>} />
                <Route path="finance/receipt/:id" element={<Guard roles={OFFICE}><Receipt /></Guard>} />
                <Route path="approvals" element={<Guard roles={['admin']}><Approvals /></Guard>} />
                <Route path="inventory" element={<Guard roles={[...OFFICE, 'warehouse']} perms={['inventory_view']}><Inventory /></Guard>} />
                <Route path="campaigns" element={<Guard roles={STAFF} perms={['campaigns_view']}><Campaigns /></Guard>} />
                <Route path="campaigns/new" element={<Guard roles={['admin']}><CampaignForm /></Guard>} />
                <Route path="campaigns/:id" element={<Guard roles={STAFF} perms={['campaigns_view']}><CampaignView /></Guard>} />
                <Route path="route" element={<Guard roles={['distributor', 'admin']} perms={['distribute']}><RoutePage /></Guard>} />
                <Route path="map" element={<Guard perms={['families_view']}><FamiliesMap /></Guard>} />
                <Route path="team" element={<Guard roles={['admin', 'auditor']}><Team /></Guard>} />
                <Route path="reports" element={<Guard roles={OFFICE}><Reports /></Guard>} />
                <Route path="activity" element={<Guard roles={['admin', 'auditor']}><Activity /></Guard>} />
                <Route path="account" element={<Guard allowOwner><Account /></Guard>} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}

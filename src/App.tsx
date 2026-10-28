import { lazy, Suspense } from "react";
import { HashRouter, Route, Routes, Outlet } from "react-router-dom";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "@/components/layout/AppShell";
import { HomeRedirect, RequireAuth, RoleGate } from "@/components/layout/guards";
import { PageLoader } from "@/components/shared/PageLoader";
import { ScrollToTop } from "@/components/shared/ScrollToTop";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { useLocation } from "react-router-dom";
import { useUIStore } from "@/store/ui";

const p = <T extends Record<string, unknown>>(f: () => Promise<T>) => lazy(f as never);

// public
const Landing = p(() => import("@/pages/public/Landing"));
const Login = p(() => import("@/pages/public/Login"));
const Register = p(() => import("@/pages/public/Register"));
const RoleSelect = p(() => import("@/pages/public/RoleSelect"));
const ForgotPassword = p(() => import("@/pages/public/ForgotPassword"));
const ReferralLanding = p(() => import("@/pages/public/ReferralLanding"));
const Legal = p(() => import("@/pages/public/Legal"));
const NotFound = p(() => import("@/pages/public/NotFound"));
// dashboards
const AdminDashboard = p(() => import("@/pages/dashboards/AdminDashboard"));
const BrandDashboard = p(() => import("@/pages/dashboards/BrandDashboard"));
const ShopDashboard = p(() => import("@/pages/dashboards/ShopDashboard"));
const MechanicDashboard = p(() => import("@/pages/dashboards/MechanicDashboard"));
const CustomerPortal = p(() => import("@/pages/dashboards/CustomerPortal"));
// app
const Network = p(() => import("@/pages/app/Network"));
const ShopDirectory = p(() => import("@/pages/app/ShopDirectory"));
const MechanicDirectory = p(() => import("@/pages/app/MechanicDirectory"));
const Products = p(() => import("@/pages/app/Products"));
const Campaigns = p(() => import("@/pages/app/Campaigns"));
const CampaignDetails = p(() => import("@/pages/app/CampaignDetails"));
const CampaignForm = p(() => import("@/pages/app/CampaignForm"));
const Referrals = p(() => import("@/pages/app/Referrals"));
const Rewards = p(() => import("@/pages/app/Rewards"));
const Loyalty = p(() => import("@/pages/app/Loyalty"));
const Analytics = p(() => import("@/pages/app/Analytics"));
const AIInsights = p(() => import("@/pages/app/AIInsights"));
const FraudMonitor = p(() => import("@/pages/app/FraudMonitor"));
const Notifications = p(() => import("@/pages/app/Notifications"));
const Settings = p(() => import("@/pages/app/Settings"));
const Approvals = p(() => import("@/pages/app/Approvals"));
const AuditLog = p(() => import("@/pages/app/AuditLog"));

function Gated() {
  const { pathname } = useLocation();
  return <RoleGate><ErrorBoundary resetKey={pathname}><Suspense fallback={<PageLoader />}><Outlet /></Suspense></ErrorBoundary></RoleGate>;
}

export default function App() {
  const theme = useUIStore((s) => s.theme);
  return (
    <TooltipProvider delayDuration={250}>
      <HashRouter>
        <ScrollToTop />
        <Suspense fallback={<PageLoader full />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/select-role" element={<RoleSelect />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/r/:code" element={<ReferralLanding />} />
            <Route path="/legal/:doc" element={<Legal />} />

            <Route path="/app" element={<RequireAuth />}>
              <Route element={<AppShell />}>
                <Route index element={<HomeRedirect />} />
                <Route element={<Gated />}>
                  <Route path="admin" element={<AdminDashboard />} />
                  <Route path="brand" element={<BrandDashboard />} />
                  <Route path="shop" element={<ShopDashboard />} />
                  <Route path="mechanic" element={<MechanicDashboard />} />
                  <Route path="customer" element={<CustomerPortal />} />
                  <Route path="network" element={<Network />} />
                  <Route path="shops" element={<ShopDirectory />} />
                  <Route path="mechanics" element={<MechanicDirectory />} />
                  <Route path="products" element={<Products />} />
                  <Route path="campaigns" element={<Campaigns />} />
                  <Route path="campaigns/new" element={<CampaignForm />} />
                  <Route path="campaigns/:id" element={<CampaignDetails />} />
                  <Route path="campaigns/:id/edit" element={<CampaignForm />} />
                  <Route path="referrals" element={<Referrals />} />
                  <Route path="rewards" element={<Rewards />} />
                  <Route path="loyalty" element={<Loyalty />} />
                  <Route path="analytics" element={<Analytics />} />
                  <Route path="ai" element={<AIInsights />} />
                  <Route path="fraud" element={<FraudMonitor />} />
                  <Route path="notifications" element={<Notifications />} />
                  <Route path="settings" element={<Settings />} />
                  <Route path="approvals" element={<Approvals />} />
                  <Route path="audit" element={<AuditLog />} />
                  <Route path="*" element={<NotFound inApp />} />
                </Route>
              </Route>
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </HashRouter>
      <Toaster position="bottom-right" richColors closeButton theme={theme} toastOptions={{ className: "font-sans" }} />
    </TooltipProvider>
  );
}

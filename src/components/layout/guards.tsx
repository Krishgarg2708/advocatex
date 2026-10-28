import { Navigate, Outlet, useLocation } from "react-router-dom";
import { ShieldOff } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { useAuthStore, ROLE_HOME, ROLE_LABEL } from "@/store/auth";
import { rolesForPath } from "./nav";

/** Frontend-only route protection for the demo. Real access control must be enforced server-side. */
export function RequireAuth() {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <Outlet />;
}

export function RoleGate({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)!;
  const { pathname } = useLocation();
  const allowed = rolesForPath(pathname);
  if (allowed && !allowed.includes(user.role)) {
    return (
      <EmptyState icon={ShieldOff} title="This area isn't available for your role"
        description={`You're signed in as ${ROLE_LABEL[user.role]}. Switch demo role to explore this page.`}
        action={<div className="flex gap-2"><Button asChild variant="outline"><Link to={ROLE_HOME[user.role]}>Go to my overview</Link></Button><Button asChild><Link to="/select-role">Switch role</Link></Button></div>} />
    );
  }
  return <>{children}</>;
}

export function HomeRedirect() {
  const user = useAuthStore((s) => s.user);
  return <Navigate to={user ? ROLE_HOME[user.role] : "/login"} replace />;
}

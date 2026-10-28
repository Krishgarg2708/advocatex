import { Link } from "react-router-dom";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/EmptyState";
import { Logo } from "@/components/layout/Logo";

export default function NotFound({ inApp }: { inApp?: boolean }) {
  if (inApp) {
    return (
      <Card>
        <EmptyState icon={Compass} title="Page not found" description="This page doesn't exist in the workspace. It may have moved, or the link may be mistyped."
          action={<Button asChild><Link to="/app">Back to my overview</Link></Button>} />
      </Card>
    );
  }
  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-50 [mask-image:radial-gradient(ellipse_at_center,black_10%,transparent_65%)]" aria-hidden />
      <header className="relative mx-auto flex h-16 w-full max-w-6xl items-center px-4 sm:px-6"><Logo /></header>
      <main className="relative flex flex-1 items-center justify-center px-4 pb-20 text-center">
        <div>
          <p className="num bg-gradient-to-br from-brand to-action bg-clip-text text-7xl font-semibold tracking-tight text-transparent sm:text-8xl">404</p>
          <h1 className="mt-4 text-xl font-semibold tracking-tight sm:text-2xl">We couldn't find that page</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">The link may be broken or the page may have moved.</p>
          <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
            <Button asChild><Link to="/">Back to home</Link></Button>
            <Button asChild variant="outline"><Link to="/select-role">Launch demo</Link></Button>
          </div>
        </div>
      </main>
    </div>
  );
}

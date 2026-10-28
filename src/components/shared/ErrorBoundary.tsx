import { Component, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface State { error: Error | null }
/** Catches render errors so one broken widget never blanks the whole demo. */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error): State { return { error }; }
  componentDidCatch(error: Error) { console.error("[AdvocateX] render error:", error); }
  componentDidUpdate(prev: { resetKey?: string }) { if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null }); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div data-testid="error-boundary" className="mx-auto my-16 flex max-w-md flex-col items-center text-center">
        <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-destructive/10 text-destructive"><AlertTriangle className="h-5 w-5" /></span>
        <h2 className="text-base font-semibold">Something went wrong on this screen</h2>
        <p className="mt-1 text-sm text-muted-foreground">The rest of the demo still works. Try again, or reset demo data from Settings if the problem persists.</p>
        <div className="mt-4 flex gap-2">
          <Button variant="outline" onClick={() => this.setState({ error: null })}>Try again</Button>
          <Button onClick={() => { window.location.hash = "#/app"; this.setState({ error: null }); }}>Go to overview</Button>
        </div>
      </div>
    );
  }
}

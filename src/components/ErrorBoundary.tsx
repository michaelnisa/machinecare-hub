import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { captureReactError } from "@/lib/sentry";

interface Props {
  children: ReactNode;
  /** When false, renders the fallback contained (no min-h-screen wrapper) for nesting inside a page shell. */
  fullScreen?: boolean;
  /** When this value changes, a previously-caught error is cleared — use e.g. the route pathname so navigating away recovers. */
  resetKey?: unknown;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled error caught by ErrorBoundary", error, info.componentStack);
    captureReactError(error, info.componentStack);
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      const fullScreen = this.props.fullScreen ?? true;
      return (
        <div
          className={
            fullScreen
              ? "flex min-h-screen items-center justify-center bg-background px-4"
              : "flex items-center justify-center px-4 py-16"
          }
        >
          <div className="flex flex-col items-center rounded-xl border border-border bg-card px-8 py-10 text-center shadow-sm">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h1 className="text-lg font-semibold text-slate-800">Something went wrong</h1>
            <p className="mt-1 max-w-sm text-sm text-slate-600">
              An unexpected error occurred. Try reloading the page — if it keeps happening, contact support.
            </p>
            <div className="mt-3 max-w-xl text-left bg-red-950/10 border border-red-500/20 text-red-700 dark:text-red-300 p-3 rounded text-xs font-mono overflow-auto max-h-48">
              <strong>Error:</strong> {this.state.error?.message}<br/>
              <pre className="mt-1 text-[10px] whitespace-pre-wrap">{this.state.error?.stack}</pre>
            </div>
            <Button className="mt-6" onClick={() => window.location.reload()}>
              Reload page
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

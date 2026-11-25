import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ErrorState } from '../components/ui/StateCards';

interface PageErrorBoundaryProps {
  children: ReactNode;
  /** When this changes (the route, for example) a page that crashed gets another try. */
  resetKey?: string;
}

interface PageErrorBoundaryState {
  hasError: boolean;
  resetKey?: string;
}

/**
 * Keeps one page's crash from blanking the whole app: the sidebar and header stay, and the page
 * says something went wrong with a way to try again, instead of a white screen.
 */
export class PageErrorBoundary extends Component<PageErrorBoundaryProps, PageErrorBoundaryState> {
  state: PageErrorBoundaryState = { hasError: false, resetKey: this.props.resetKey };

  static getDerivedStateFromError(): Partial<PageErrorBoundaryState> {
    return { hasError: true };
  }

  static getDerivedStateFromProps(
    props: PageErrorBoundaryProps,
    state: PageErrorBoundaryState,
  ): Partial<PageErrorBoundaryState> | null {
    // Moving to another page clears the error so that page is not stuck on the old failure.
    return props.resetKey !== state.resetKey ? { hasError: false, resetKey: props.resetKey } : null;
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('A page failed to render', error, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="p-4 sm:p-8" data-testid="page-error-boundary">
        <ErrorState
          title="This page could not be shown"
          message="Something went wrong while showing this page. The rest of the app still works. Try again, or open another page."
          onRetry={() => this.setState({ hasError: false })}
        />
      </div>
    );
  }
}

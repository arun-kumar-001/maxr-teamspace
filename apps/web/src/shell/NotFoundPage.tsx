import { EmptyState } from '../components/ui';

export interface NotFoundPageProps {
  onBackToDashboard: () => void;
  path?: string;
}

export function NotFoundPage({ onBackToDashboard, path }: NotFoundPageProps) {
  return (
    <div className="p-6 md:p-12 max-w-2xl mx-auto" data-testid="not-found-page">
      <EmptyState
        title="Page Not Found"
        description={
          path
            ? `The route "${path}" could not be found.`
            : 'The page you requested does not exist or has been moved.'
        }
        actionLabel="Go to Dashboard"
        onAction={onBackToDashboard}
      />
    </div>
  );
}

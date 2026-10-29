import { useState, type ReactNode } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { PageContainer } from '../components/ui';

export interface AppShellProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  children: ReactNode;
}

export function AppShell({ currentPath, onNavigate, children }: AppShellProps) {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  return (
    <div className="min-h-screen bg-surface-muted flex flex-col md:flex-row overflow-x-hidden">
      {/* Desktop / Tablet Persistent Sidebar */}
      <Sidebar currentPath={currentPath} onNavigate={onNavigate} className="lg:w-64 md:w-20" />

      {/* Mobile Drawer & Bottom Bar */}
      <MobileNav
        isOpen={isMobileNavOpen}
        onClose={() => setIsMobileNavOpen(false)}
        currentPath={currentPath}
        onNavigate={onNavigate}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header onToggleMobileNav={() => setIsMobileNavOpen(true)} activePath={currentPath} />

        {/* Dynamic Page Container: phone bottom nav offset included */}
        <main className="flex-1 pb-20 sm:pb-8">
          <PageContainer maxWidth="dashboard" className="py-6 sm:py-8">
            {children}
          </PageContainer>
        </main>
      </div>
    </div>
  );
}

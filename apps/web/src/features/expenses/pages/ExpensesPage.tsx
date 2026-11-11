import React from 'react';
import { PageContainer } from '../../../components/ui/PageContainer';

export const ExpensesPage: React.FC = () => {
  return (
    <PageContainer maxWidth="dashboard" className="py-6 sm:py-10">
      <div
        className="flex flex-col items-center justify-center min-h-[60vh] px-4"
        data-testid="expenses-coming-soon"
      >
        <div
          className="w-full max-w-2xl rounded-[24px] p-8 sm:p-12 text-center border transition-all"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.78)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderColor: 'rgba(255, 255, 255, 0.85)',
            boxShadow: '0 18px 42px rgba(85, 205, 179, 0.12), 0 4px 12px rgba(8, 11, 12, 0.05)',
          }}
        >
          <div className="flex justify-center mb-5">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-sm"
              style={{
                backgroundColor: 'rgba(85, 205, 179, 0.2)',
                color: 'rgb(15, 118, 110)',
                border: '1px solid rgba(85, 205, 179, 0.4)',
              }}
              aria-hidden="true"
            >
              <svg
                className="w-8 h-8"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <line x1="2" y1="10" x2="22" y2="10" />
                <line x1="6" y1="15" x2="10" y2="15" />
              </svg>
            </div>
          </div>

          <span
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border mb-4"
            style={{
              backgroundColor: 'rgba(73, 53, 72, 0.08)',
              color: 'rgb(73, 53, 72)',
              borderColor: 'rgba(73, 53, 72, 0.22)',
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: 'rgb(85, 205, 179)' }}
              aria-hidden="true"
            />
            Expenses
          </span>

          <h1
            className="font-display text-3xl sm:text-4xl font-bold tracking-tight mb-3"
            style={{ color: 'rgb(8, 11, 12)' }}
          >
            Coming Soon...
          </h1>

          <p className="text-sm sm:text-base text-text-muted max-w-md mx-auto leading-relaxed">
            The Expenses &amp; Claims workspace is currently under development. Expense submissions,
            receipt uploads, and reimbursement tracking will be available here soon.
          </p>
        </div>
      </div>
    </PageContainer>
  );
};

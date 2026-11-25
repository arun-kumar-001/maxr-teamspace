// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PageErrorBoundary } from '../PageErrorBoundary';

let shouldCrash = true;
function Crashy() {
  if (shouldCrash) throw new Error('boom');
  return <p>page content</p>;
}

describe('PageErrorBoundary', () => {
  beforeEach(() => {
    shouldCrash = true;
    // React logs a caught render error; keep the test output readable.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('shows a message instead of a blank page, and the content when nothing fails', () => {
    shouldCrash = false;
    render(
      <PageErrorBoundary resetKey="/a">
        <Crashy />
      </PageErrorBoundary>,
    );
    expect(screen.getByText('page content')).toBeInTheDocument();
  });

  it('catches a crash and offers a retry that works once the cause is gone', () => {
    render(
      <PageErrorBoundary resetKey="/a">
        <Crashy />
      </PageErrorBoundary>,
    );
    expect(screen.getByTestId('page-error-boundary')).toBeInTheDocument();
    expect(screen.getByText('This page could not be shown')).toBeInTheDocument();

    shouldCrash = false;
    fireEvent.click(screen.getByRole('button', { name: /retry|try again/i }));
    expect(screen.getByText('page content')).toBeInTheDocument();
  });

  it('gives the next page a clean start after one crashed', () => {
    const { rerender } = render(
      <PageErrorBoundary resetKey="/broken">
        <Crashy />
      </PageErrorBoundary>,
    );
    expect(screen.getByTestId('page-error-boundary')).toBeInTheDocument();

    shouldCrash = false;
    rerender(
      <PageErrorBoundary resetKey="/other">
        <Crashy />
      </PageErrorBoundary>,
    );
    expect(screen.getByText('page content')).toBeInTheDocument();
  });
});

// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { StatCard } from '../StatCard.js';
import { SegmentedControl } from '../SegmentedControl.js';

afterEach(cleanup);

describe('StatCard', () => {
  it('shows label, value and caption, and hides the decorative icon', () => {
    render(
      <StatCard
        label="Present Today"
        value="108"
        caption="Checked in by 10:00"
        icon={<svg data-testid="icon" />}
      />,
    );
    expect(screen.getByText('Present Today')).toBeInTheDocument();
    expect(screen.getByText('108')).toBeInTheDocument();
    expect(screen.getByText('Checked in by 10:00')).toBeInTheDocument();
    expect(screen.getByTestId('icon').parentElement).toHaveAttribute('aria-hidden', 'true');
  });

  it('shows a loading placeholder instead of the value', () => {
    render(<StatCard label="On Leave" value="7" isLoading />);
    expect(screen.queryByText('7')).toBeNull();
    expect(screen.getByText('On Leave').closest('[aria-busy]')).toHaveAttribute(
      'aria-busy',
      'true',
    );
  });
});

describe('SegmentedControl', () => {
  function Harness() {
    const [value, setValue] = useState('7');
    return (
      <SegmentedControl
        ariaLabel="Date range"
        value={value}
        onChange={setValue}
        options={[
          { value: '7', label: '7 Days' },
          { value: '30', label: '30 Days' },
          { value: '90', label: '90 Days' },
        ]}
      />
    );
  }

  it('is a named radio group with one checked option and one tab stop', () => {
    render(<Harness />);
    expect(screen.getByRole('radiogroup', { name: 'Date range' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '7 Days' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: '30 Days' })).toHaveAttribute('tabindex', '-1');
  });

  it('arrow keys, Home and End move the selection and the focus', () => {
    render(<Harness />);
    fireEvent.keyDown(screen.getByRole('radio', { name: '7 Days' }), { key: 'ArrowRight' });
    const thirty = screen.getByRole('radio', { name: '30 Days' });
    expect(thirty).toHaveAttribute('aria-checked', 'true');
    expect(document.activeElement).toBe(thirty);
    fireEvent.keyDown(thirty, { key: 'End' });
    expect(screen.getByRole('radio', { name: '90 Days' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'ArrowRight' });
    expect(screen.getByRole('radio', { name: '7 Days' })).toHaveAttribute('aria-checked', 'true');
  });

  it('clicking an option selects it', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('radio', { name: '90 Days' }));
    expect(screen.getByRole('radio', { name: '90 Days' })).toHaveAttribute('aria-checked', 'true');
  });
});

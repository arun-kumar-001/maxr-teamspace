// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { StatCard } from '../StatCard.js';
import { SegmentedControl } from '../SegmentedControl.js';
import { DeltaChip } from '../DeltaChip.js';
import { MetricStrip } from '../MetricStrip.js';
import { IconButton } from '../IconButton.js';

afterEach(cleanup);

describe('StatCard', () => {
  it('shows the delta chip and comparison', () => {
    render(
      <StatCard
        label="Orders"
        value="2,705"
        delta={{ label: '+12.4%', direction: 'up' }}
        comparison="vs 2,407"
      />,
    );
    expect(screen.getByText('+12.4%')).toBeInTheDocument();
    expect(screen.getByText('vs 2,407')).toBeInTheDocument();
  });

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

describe('DeltaChip', () => {
  it('says the direction in words, not only colour', () => {
    render(<DeltaChip label="+11.9%" direction="up" />);
    expect(screen.getByText('Up')).toHaveClass('sr-only');
    expect(screen.getByText('+11.9%').closest('span')).toHaveClass('bg-positive-soft');
  });

  it('marks a rise as bad when isGood is false (for example more late check-ins)', () => {
    render(<DeltaChip label="+6" direction="up" isGood={false} />);
    expect(screen.getByText('+6').closest('span')).toHaveClass('bg-negative-soft');
  });
});

describe('MetricStrip', () => {
  const metrics = [
    {
      id: 'a',
      label: 'Attendance rate',
      value: '94.2%',
      delta: { label: '+1.8%', direction: 'up' as const },
      comparison: 'vs 92.4%',
    },
    { id: 'b', label: 'Hours logged', value: '18,406' },
    { id: 'c', label: 'Late check-ins', value: '31' },
  ];

  function Harness() {
    const [selected, setSelected] = useState('a');
    return (
      <MetricStrip
        ariaLabel="Metric shown in the chart"
        metrics={metrics}
        selected={selected}
        onSelect={setSelected}
      />
    );
  }

  it('is a named radio group; the selected tile is the only tab stop', () => {
    render(<Harness />);
    expect(
      screen.getByRole('radiogroup', { name: 'Metric shown in the chart' }),
    ).toBeInTheDocument();
    const radios = screen.getAllByRole('radio');
    expect(radios.map((r) => r.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false']);
    expect(radios.map((r) => r.getAttribute('tabindex'))).toEqual(['0', '-1', '-1']);
    expect(radios[0]).toHaveTextContent('vs 92.4%');
  });

  it('arrow keys move the selection and focus, and wrap around', () => {
    render(<Harness />);
    const [first] = screen.getAllByRole('radio');
    fireEvent.keyDown(first as HTMLElement, { key: 'ArrowLeft' });
    const last = screen.getAllByRole('radio')[2] as HTMLElement;
    expect(last).toHaveAttribute('aria-checked', 'true');
    expect(document.activeElement).toBe(last);
  });
});

describe('IconButton', () => {
  it('has an accessible name, shows the count and announces it', () => {
    const onClick = vi.fn();
    render(<IconButton aria-label="Notifications" icon={<svg />} count={3} onClick={onClick} />);
    const button = screen.getByRole('button', { name: /Notifications/ });
    expect(button).toHaveTextContent('3 unread');
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('caps large counts and hides the badge at zero', () => {
    const { rerender } = render(
      <IconButton aria-label="Notifications" icon={<svg />} count={120} />,
    );
    expect(screen.getByRole('button')).toHaveTextContent('99+');
    rerender(<IconButton aria-label="Notifications" icon={<svg />} count={0} />);
    expect(screen.getByRole('button')).not.toHaveTextContent('unread');
  });
});

// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DonutChart, type DonutChartSegment } from '../DonutChart';

afterEach(cleanup);

const sampleData: DonutChartSegment[] = [
  { label: 'Present', value: 80, color: 'var(--primary)' },
  { label: 'Late', value: 15, color: 'var(--warning)' },
  { label: 'Absent', value: 5, color: 'var(--danger)' },
  { label: 'Empty', value: 0, color: 'var(--border)' },
];

describe('DonutChart', () => {
  it('renders active segments, skips zero-value slices, and renders centerContent', () => {
    render(
      <DonutChart
        data={sampleData}
        aria-label="Attendance breakdown"
        centerContent={<span>80%</span>}
      />,
    );

    expect(screen.getByRole('img', { name: 'Attendance breakdown' })).toBeInTheDocument();
    expect(screen.getByText('80%')).toBeInTheDocument();
    expect(screen.getByLabelText('Present: 80')).toBeInTheDocument();
    expect(screen.getByLabelText('Late: 15')).toBeInTheDocument();
    expect(screen.getByLabelText('Absent: 5')).toBeInTheDocument();
    expect(screen.queryByLabelText('Empty: 0')).toBeNull();
  });

  it('invokes onSegmentHover on mouse enter, focus, and mouse leave', () => {
    const onSegmentHover = vi.fn();
    render(<DonutChart data={sampleData} onSegmentHover={onSegmentHover} />);

    const lateSlice = screen.getByLabelText('Late: 15');
    fireEvent.mouseEnter(lateSlice);
    expect(onSegmentHover).toHaveBeenLastCalledWith(sampleData[1]);

    fireEvent.blur(lateSlice);
    expect(onSegmentHover).toHaveBeenLastCalledWith(null);

    fireEvent.focus(screen.getByLabelText('Present: 80'));
    expect(onSegmentHover).toHaveBeenLastCalledWith(sampleData[0]);
  });
});

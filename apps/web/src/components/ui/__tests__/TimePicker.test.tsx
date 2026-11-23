// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TimePicker } from '../TimePicker';

describe('TimePicker Component', () => {
  it('renders initial formatted time display', () => {
    render(<TimePicker value="09:00" />);
    expect(screen.getByText('09:00 AM')).toBeInTheDocument();
  });

  it('renders 12-hour PM time accurately', () => {
    render(<TimePicker value="19:30" />);
    expect(screen.getByText('07:30 PM')).toBeInTheDocument();
  });

  it('opens modern time picker dialog on click', () => {
    render(<TimePicker value="09:00" />);
    const trigger = screen.getByRole('button', { name: /Time:/i });
    fireEvent.click(trigger);

    expect(screen.getByRole('dialog', { name: /clock time picker/i })).toBeInTheDocument();
    expect(screen.getByText('Now')).toBeInTheDocument();
  });

  it('updates hour and minute, then applies time on Apply', () => {
    const handleChange = vi.fn();
    render(<TimePicker value="09:00" onChange={handleChange} />);

    // Open popover
    fireEvent.click(screen.getByRole('button', { name: /Time:/i }));

    // Click hour '10'
    const hour10Btn = screen.getByRole('button', { name: 'Hour 10' });
    fireEvent.click(hour10Btn);

    // Click minute '30'
    const min30Btn = screen.getByRole('button', { name: 'Minute 30' });
    fireEvent.click(min30Btn);

    // Click Apply
    const applyBtn = screen.getByRole('button', { name: 'Apply' });
    fireEvent.click(applyBtn);

    expect(handleChange).toHaveBeenCalledWith('10:30');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('toggles AM to PM correctly', () => {
    const handleChange = vi.fn();
    render(<TimePicker value="09:15" onChange={handleChange} />);

    fireEvent.click(screen.getByRole('button', { name: /Time:/i }));

    // Click PM button
    const pmBtn = screen.getByRole('button', { name: 'PM' });
    fireEvent.click(pmBtn);

    // Click Apply
    const applyBtn = screen.getByRole('button', { name: 'Apply' });
    fireEvent.click(applyBtn);

    expect(handleChange).toHaveBeenCalledWith('21:15');
  });

  it('closes dialog on Cancel without applying changes', () => {
    const handleChange = vi.fn();
    render(<TimePicker value="09:00" onChange={handleChange} />);

    fireEvent.click(screen.getByRole('button', { name: /Time:/i }));

    const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
    fireEvent.click(cancelBtn);

    expect(handleChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

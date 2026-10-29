// @vitest-environment jsdom
import { useState } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen, act } from '@testing-library/react';
import { Modal } from '../Modal.js';
import { Tabs, TabPanel } from '../Tabs.js';
import { Toast } from '../Toast.js';
import { DataTable } from '../DataTable.js';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function ModalHarness({ onClose = () => {} }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open</button>
      <Modal
        isOpen={open}
        onClose={() => {
          setOpen(false);
          onClose();
        }}
        title="Edit"
        footer={<button>Save</button>}
      >
        <input aria-label="Name" />
      </Modal>
    </>
  );
}

describe('Modal interactions (#55 S1)', () => {
  it('moves focus into the dialog, traps Tab and returns focus on close', () => {
    render(<ModalHarness />);
    const opener = screen.getByText('Open');
    opener.focus();
    fireEvent.click(opener);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toContainElement(document.activeElement as HTMLElement);

    const save = screen.getByText('Save');
    save.focus();
    fireEvent.keyDown(window, { key: 'Tab' });
    expect(document.activeElement).toBe(screen.getByLabelText('Close modal'));

    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(save);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('restores the previous body overflow and gives each dialog its own title id', () => {
    document.body.style.overflow = 'scroll';
    const { unmount } = render(
      <>
        <Modal isOpen onClose={() => {}} title="A">
          a
        </Modal>
        <Modal isOpen onClose={() => {}} title="B">
          b
        </Modal>
      </>,
    );
    const labels = screen.getAllByRole('dialog').map((d) => d.getAttribute('aria-labelledby'));
    expect(new Set(labels).size).toBe(2);
    unmount();
    expect(document.body.style.overflow).toBe('scroll');
    document.body.style.overflow = '';
  });
});

describe('Tabs interactions (#55 S2)', () => {
  const tabs = [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B', disabled: true },
    { id: 'c', label: 'C' },
  ];

  function TabsHarness() {
    const [active, setActive] = useState('a');
    return (
      <>
        <Tabs tabs={tabs} activeTab={active} onChange={setActive} />
        <TabPanel tabId="a" activeTab={active}>
          panel a
        </TabPanel>
        <TabPanel tabId="c" activeTab={active}>
          panel c
        </TabPanel>
      </>
    );
  }

  it('only the active tab is a tab stop and the panel is linked to it', () => {
    render(<TabsHarness />);
    expect(screen.getByRole('tab', { name: 'A' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: 'C' })).toHaveAttribute('tabindex', '-1');
    const panel = screen.getByRole('tabpanel');
    expect(panel).toHaveAttribute('aria-labelledby', 'tab-a');
    expect(document.getElementById('panel-a')).toBe(panel);
  });

  it('arrow, Home and End keys move between enabled tabs and skip disabled ones', () => {
    render(<TabsHarness />);
    const a = screen.getByRole('tab', { name: 'A' });
    fireEvent.keyDown(a, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'C' })).toHaveAttribute('aria-selected', 'true');
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'C' }));
    expect(screen.getByRole('tabpanel')).toHaveTextContent('panel c');

    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Home' });
    expect(screen.getByRole('tab', { name: 'A' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'End' });
    expect(screen.getByRole('tab', { name: 'C' })).toHaveAttribute('aria-selected', 'true');
  });
});

describe('Toast interactions (#55 S7)', () => {
  it('calls onClose from the dismiss button', () => {
    const onClose = vi.fn();
    render(<Toast title="Saved" onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Dismiss notification'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('auto-dismisses after the given time and not before', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(<Toast title="Saved" onClose={onClose} autoDismissMs={3000} />);
    act(() => {
      vi.advanceTimersByTime(2999);
    });
    expect(onClose).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('DataTable accessibility and sorting (#55 S3)', () => {
  type Row = { id: string; name: string } & Record<string, unknown>;
  const rows: Row[] = [
    { id: '1', name: 'Bob' },
    { id: '2', name: 'Alice' },
  ];

  it('names the table, scopes headers and reports sort state', () => {
    const onSort = vi.fn();
    render(
      <DataTable<Row>
        ariaLabel="Employees"
        data={rows}
        keyExtractor={(r) => r.id}
        columns={[{ key: 'name', header: 'Name', sortable: true }]}
        sortKey="name"
        sortDirection="asc"
        onSortChange={onSort}
      />,
    );
    expect(screen.getByRole('table', { name: 'Employees' })).toBeInTheDocument();
    const header = screen.getByRole('columnheader', { name: /Name/ });
    expect(header).toHaveAttribute('scope', 'col');
    expect(header).toHaveAttribute('aria-sort', 'ascending');

    fireEvent.click(screen.getByRole('button', { name: /Name/ }));
    expect(onSort).toHaveBeenCalledWith('name', 'desc');
  });
});

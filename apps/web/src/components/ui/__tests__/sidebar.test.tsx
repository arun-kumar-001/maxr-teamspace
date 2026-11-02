// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { Sidebar, SidebarDrawer, type SidebarGroup } from '../Sidebar.js';

afterEach(cleanup);

const groups: SidebarGroup[] = [
  {
    id: 'main',
    label: 'Workforce',
    items: [
      { id: 'overview', label: 'Overview', icon: <svg /> },
      {
        id: 'attendance',
        label: 'Attendance',
        icon: <svg />,
        children: [
          { id: 'attendance-mine', label: 'My attendance' },
          { id: 'attendance-team', label: 'Team attendance' },
        ],
      },
      { id: 'leave', label: 'Leave', icon: <svg />, count: 8, countTone: 'attention' },
    ],
  },
  { id: 'support', label: 'Support', items: [{ id: 'help', label: 'Help centre', icon: <svg /> }] },
];
const brand = { name: 'MAXR Teamspace', subtitle: 'Staff management', logo: <svg /> };
const user = { name: 'Arun Kumar', role: 'Technical Lead', initials: 'AK' };

function Harness({ initialCollapsed = false, initialActive = 'overview' }) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [active, setActive] = useState(initialActive);
  return (
    <Sidebar
      brand={brand}
      groups={groups}
      activeId={active}
      collapsed={collapsed}
      onCollapsedChange={setCollapsed}
      onNavigate={(id, e) => {
        e.preventDefault();
        setActive(id);
      }}
      user={user}
      onUserMenu={() => undefined}
    />
  );
}

describe('Sidebar (expanded)', () => {
  it('marks the current page and moves it on click', () => {
    render(<Harness />);
    expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
    fireEvent.click(screen.getByRole('link', { name: /Leave/ }));
    expect(screen.getByRole('link', { name: /Leave/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Overview' })).not.toHaveAttribute('aria-current');
  });

  it('active item is the solid teal pill', () => {
    render(<Harness />);
    expect(screen.getByRole('link', { name: 'Overview' })).toHaveClass(
      'bg-primary',
      'text-sidebar',
    );
  });

  it('announces counts in words and shows the badge', () => {
    render(<Harness />);
    const leave = screen.getByRole('link', { name: /Leave/ });
    expect(leave).toHaveAccessibleName('Leave, 8 new');
    expect(within(leave).getByText('8')).toHaveClass('bg-sidebar-attention');
  });

  it('opens and closes a group with aria-expanded', () => {
    render(<Harness />);
    const group = screen.getByRole('button', { name: 'Attendance' });
    expect(group).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(group);
    expect(group).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(screen.getByRole('link', { name: 'Team attendance' }));
    expect(screen.getByRole('link', { name: 'Team attendance' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    fireEvent.click(group);
    expect(screen.queryByRole('link', { name: 'Team attendance' })).toBeNull();
  });

  it('starts with the group of the current page open', () => {
    render(<Harness initialActive="attendance-team" />);
    expect(screen.getByRole('button', { name: 'Attendance' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('shows group labels, brand and user', () => {
    render(<Harness />);
    expect(screen.getByText('Workforce')).toBeVisible();
    expect(screen.getByText('MAXR Teamspace')).toBeInTheDocument();
    expect(screen.getByText('Technical Lead')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Account menu' })).toBeInTheDocument();
  });
});

describe('Sidebar (rail)', () => {
  it('collapse button toggles the rail and says what it will do', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    const expand = screen.getByRole('button', { name: 'Expand sidebar' });
    expect(expand).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Technical Lead')).toBeNull();
  });

  it('icons keep their names, and keyboard focus shows the tooltip', () => {
    render(<Harness initialCollapsed />);
    const overview = screen.getByRole('link', { name: 'Overview' });
    fireEvent.focus(overview);
    expect(
      screen.getAllByText('Overview').some((el) => el.getAttribute('aria-hidden') === 'true'),
    ).toBe(true);
    fireEvent.blur(overview);
    expect(
      screen.queryAllByText('Overview').filter((el) => el.getAttribute('aria-hidden') === 'true'),
    ).toHaveLength(0);
  });

  it('a parent with sub-pages opens the full sidebar with its group expanded', () => {
    render(<Harness initialCollapsed />);
    fireEvent.click(screen.getByRole('button', { name: 'Attendance' }));
    expect(screen.getByRole('button', { name: 'Collapse sidebar' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'My attendance' })).toBeInTheDocument();
  });

  it('a parent is highlighted when one of its pages is current', () => {
    render(<Harness initialCollapsed initialActive="attendance-mine" />);
    expect(screen.getByRole('button', { name: 'Attendance' })).toHaveClass('bg-primary');
  });

  it('counts become dots but stay in the accessible name', () => {
    render(<Harness initialCollapsed />);
    expect(screen.getByRole('link', { name: /Leave/ })).toHaveTextContent('8 new');
  });
});

describe('SidebarDrawer', () => {
  it('opens as a modal, closes on Escape and after navigating, and returns focus', () => {
    const onClose = vi.fn();
    function DrawerHarness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>Menu</button>
          <SidebarDrawer
            open={open}
            onClose={() => {
              setOpen(false);
              onClose();
            }}
            brand={brand}
            groups={groups}
            activeId="overview"
            onNavigate={(_id, e) => e.preventDefault()}
          />
        </>
      );
    }
    render(<DrawerHarness />);
    const opener = screen.getByText('Menu');
    opener.focus();
    fireEvent.click(opener);
    const dialog = screen.getByRole('dialog', { name: 'Navigation' });
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);

    fireEvent.click(opener);
    fireEvent.click(screen.getByRole('link', { name: /Leave/ }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe('Sidebar rail tooltip', () => {
  it('disappears when the page scrolls', () => {
    render(<Harness initialCollapsed />);
    fireEvent.mouseEnter(screen.getByRole('link', { name: 'Overview' }));
    const visibleTips = () =>
      screen.queryAllByText('Overview').filter((el) => el.getAttribute('aria-hidden') === 'true');
    expect(visibleTips()).toHaveLength(1);
    fireEvent.scroll(window);
    expect(visibleTips()).toHaveLength(0);
  });
});

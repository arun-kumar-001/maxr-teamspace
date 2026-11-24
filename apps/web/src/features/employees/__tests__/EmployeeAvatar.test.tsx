// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { AuthContext } from '../../../auth/AuthContext';
import { EmployeeAvatar } from '../components/EmployeeAvatar';

type AuthValue = ComponentProps<typeof AuthContext.Provider>['value'];

function withPermissions(permissions: string[], ui: React.ReactElement) {
  const value = { user: { permissions } } as unknown as AuthValue;
  return <AuthContext.Provider value={value}>{ui}</AuthContext.Provider>;
}

describe('EmployeeAvatar', () => {
  afterEach(cleanup);

  it('shows initials when there is no photo and nothing to look one up with', () => {
    const { container } = render(<EmployeeAvatar name="Ananya Sen" />);
    expect(container).toHaveTextContent('AS');
    expect(container.querySelector('img')).toBeNull();
  });

  it('uses the photo URL it is given, and keeps the initials until the photo has loaded', () => {
    const photoUrl = '/api/v1/employees/emp-9/photo?v=123';
    const { container } = render(<EmployeeAvatar name="Ananya Sen" photoUrl={photoUrl} />);
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('src', photoUrl);
    expect(img).toHaveAttribute('alt', 'Ananya Sen');
    expect(container.querySelector('.sr-only')).toBeNull();

    fireEvent.load(img as HTMLImageElement);
    expect(container.querySelector('.sr-only')).toHaveTextContent('AS');
  });

  it('asks the photo endpoint by id for people who may read employees', () => {
    const { container } = render(
      withPermissions(['employees.read'], <EmployeeAvatar name="Ravi K" employeeId="emp-21" />),
    );
    expect(container.querySelector('img')?.getAttribute('src')).toMatch(
      /^\/api\/v1\/employees\/emp-21\/photo\?v=\d+$/,
    );
  });

  it('does not look a photo up by id without the employees.read permission', () => {
    const { container } = render(
      withPermissions(['leave.read'], <EmployeeAvatar name="Ravi K" employeeId="emp-22" />),
    );
    expect(container.querySelector('img')).toBeNull();
    expect(container).toHaveTextContent('RK');
  });

  it('falls back to initials when the photo cannot be loaded, and does not ask again for that id', () => {
    const first = render(
      withPermissions(['employees.read'], <EmployeeAvatar name="Meena S" employeeId="emp-30" />),
    );
    fireEvent.error(first.container.querySelector('img') as HTMLImageElement);
    expect(first.container.querySelector('img')).toBeNull();
    expect(first.container).toHaveTextContent('MS');

    const second = render(
      withPermissions(['employees.read'], <EmployeeAvatar name="Meena S" employeeId="emp-30" />),
    );
    expect(second.container.querySelector('img')).toBeNull();
  });

  it('is hidden from screen readers when the name is written next to it', () => {
    const { container } = render(
      <EmployeeAvatar name="Ananya Sen" photoUrl="/p.png" decorative title="Ananya" />,
    );
    const circle = container.firstElementChild as HTMLElement;
    expect(circle).toHaveAttribute('aria-hidden', 'true');
    expect(circle).toHaveAttribute('title', 'Ananya');
    expect(container.querySelector('img')).toHaveAttribute('alt', '');
  });
});

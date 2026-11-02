// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as onboardingApi from '../api/onboarding';
import { OnboardingBoard } from '../components/OnboardingBoard';
import { OnboardingChecklistDetail } from '../components/OnboardingChecklistDetail';
import { OnboardingItemRow } from '../components/OnboardingItemRow';
import { OnboardingStepBadge } from '../components/OnboardingStepBadge';
import { SetPasswordPage } from '../pages/SetPasswordPage';
import type {
  OnboardingChecklistDetail as OnboardingDetailType,
  OnboardingChecklistSummary,
  OnboardingItem,
} from '../types/onboarding';

afterEach(cleanup);

const MOCK_ITEM: OnboardingItem = {
  id: 'item-1',
  checklistId: 'chk-1',
  step: 'hr',
  itemKey: 'id_proof',
  title: 'Identity Verification (ID Proof)',
  description: 'Valid government identity proof document',
  isVerified: false,
  verifiedAt: null,
  verifiedBy: null,
  notes: null,
  createdAt: '2026-10-30T10:00:00Z',
  updatedAt: '2026-10-30T10:00:00Z',
};

const MOCK_SUMMARY: OnboardingChecklistSummary = {
  id: 'chk-1',
  employeeId: 'emp-1',
  employeeCode: 'EMP-001',
  firstName: 'Asha',
  lastName: 'Rao',
  email: 'asha@example.com',
  departmentId: 'dept-1',
  departmentName: 'Engineering',
  designationId: 'desig-1',
  designationTitle: 'Software Engineer',
  managerId: null,
  joiningDate: '2026-11-01',
  employeeStatus: 'pending',
  userActive: false,
  status: 'in_progress',
  currentStep: 'hr',
  completedAt: null,
  createdAt: '2026-10-30T10:00:00Z',
  updatedAt: '2026-10-30T10:00:00Z',
  totalItems: 14,
  verifiedItems: 2,
};

const MOCK_DETAIL: OnboardingDetailType = {
  ...MOCK_SUMMARY,
  items: [
    MOCK_ITEM,
    {
      ...MOCK_ITEM,
      id: 'item-2',
      itemKey: 'offer_accepted',
      title: 'Offer Letter Signed',
      isVerified: true,
      verifiedAt: '2026-10-30T11:00:00Z',
      verifiedBy: 'HR Admin',
    },
  ],
};

describe('Onboarding UI Components', () => {
  describe('OnboardingStepBadge', () => {
    it('renders correct labels for all step variants', () => {
      const { rerender } = render(<OnboardingStepBadge step="hr" />);
      expect(screen.getByText('HR Setup')).toBeDefined();

      rerender(<OnboardingStepBadge step="system" />);
      expect(screen.getByText('System Access')).toBeDefined();

      rerender(<OnboardingStepBadge step="it_admin" />);
      expect(screen.getByText('IT / Admin')).toBeDefined();

      rerender(<OnboardingStepBadge step="employee" />);
      expect(screen.getByText('Employee Step')).toBeDefined();

      rerender(<OnboardingStepBadge step="completed" />);
      expect(screen.getByText('Completed')).toBeDefined();
    });
  });

  describe('OnboardingItemRow', () => {
    it('renders unverified item with verify button when canVerify is true', () => {
      const handleVerify = vi.fn();
      const handleUnverify = vi.fn();

      render(
        <OnboardingItemRow
          item={MOCK_ITEM}
          canVerify={true}
          canUnverify={false}
          onVerify={handleVerify}
          onUnverify={handleUnverify}
          isSubmitting={false}
        />,
      );

      expect(screen.getByText('Identity Verification (ID Proof)')).toBeDefined();
      expect(screen.getByText('Pending')).toBeDefined();

      const verifyBtn = screen.getByRole('button', { name: 'Verify' });
      fireEvent.click(verifyBtn);

      // Notes input appears
      expect(screen.getByPlaceholderText('Add optional verification note...')).toBeDefined();
      const confirmBtn = screen.getByRole('button', { name: 'Confirm Verify' });
      fireEvent.click(confirmBtn);

      expect(handleVerify).toHaveBeenCalledWith('id_proof', undefined);
    });

    it('renders verified item with unverify button when canUnverify is true', () => {
      const handleVerify = vi.fn();
      const handleUnverify = vi.fn();

      const verifiedItem: OnboardingItem = {
        ...MOCK_ITEM,
        isVerified: true,
        verifiedAt: '2026-10-30T11:00:00Z',
      };

      render(
        <OnboardingItemRow
          item={verifiedItem}
          canVerify={false}
          canUnverify={true}
          onVerify={handleVerify}
          onUnverify={handleUnverify}
          isSubmitting={false}
        />,
      );

      expect(screen.getByText('Verified')).toBeDefined();
      const unverifyBtn = screen.getByRole('button', { name: 'Unverify' });
      fireEvent.click(unverifyBtn);

      expect(handleUnverify).toHaveBeenCalledWith('id_proof');
    });
  });

  describe('OnboardingBoard', () => {
    it('renders empty state when no checklists match', () => {
      render(<OnboardingBoard checklists={[]} isLoading={false} onSelectEmployee={vi.fn()} />);

      expect(screen.getByText('No Onboarding In Progress')).toBeDefined();
    });

    it('renders employee card and fires selection callback', () => {
      const handleSelect = vi.fn();

      render(
        <OnboardingBoard
          checklists={[MOCK_SUMMARY]}
          isLoading={false}
          onSelectEmployee={handleSelect}
        />,
      );

      // Check text exists
      expect(screen.getAllByText('Asha Rao').length).toBeGreaterThan(0);
      expect(screen.getAllByText('EMP-001').length).toBeGreaterThan(0);

      const cards = screen.getAllByTestId('onboarding-card-emp-1');
      expect(cards.length).toBeGreaterThan(0);
      fireEvent.click(cards[0]!);
      expect(handleSelect).toHaveBeenCalledWith('emp-1');
    });
  });

  describe('SetPasswordPage', () => {
    it('validates password complexity and rejects short passwords', async () => {
      render(
        <MemoryRouter initialEntries={['/set-password?token=valid-token-123']}>
          <SetPasswordPage />
        </MemoryRouter>,
      );

      const passwordInput = screen.getByLabelText(/^New Password/i);
      const confirmInput = screen.getByLabelText(/^Confirm Password/i);
      const submitBtn = screen.getByRole('button', { name: /Set Password/i });

      // Enter short password
      fireEvent.change(passwordInput, { target: { value: 'short123' } });
      fireEvent.change(confirmInput, { target: { value: 'short123' } });
      fireEvent.click(submitBtn);

      expect(screen.getByText('Password must be at least 12 characters.')).toBeDefined();
    });

    it('rejects mismatching passwords', async () => {
      render(
        <MemoryRouter initialEntries={['/set-password?token=valid-token-123']}>
          <SetPasswordPage />
        </MemoryRouter>,
      );

      const passwordInput = screen.getByLabelText(/^New Password/i);
      const confirmInput = screen.getByLabelText(/^Confirm Password/i);
      const submitBtn = screen.getByRole('button', { name: /Set Password/i });

      fireEvent.change(passwordInput, { target: { value: 'CorrectHorseBattery123!' } });
      fireEvent.change(confirmInput, { target: { value: 'DifferentPassword123!' } });
      fireEvent.click(submitBtn);

      expect(
        screen.getByText('Passwords do not match. Please re-enter your password.'),
      ).toBeDefined();
    });

    it('successfully calls setOnboardingPassword and shows confirmation message', async () => {
      const setPasswordSpy = vi
        .spyOn(onboardingApi, 'setOnboardingPassword')
        .mockResolvedValueOnce({ success: true, employeeId: 'emp-1' });

      render(
        <MemoryRouter initialEntries={['/set-password?token=valid-token-123']}>
          <SetPasswordPage />
        </MemoryRouter>,
      );

      const passwordInput = screen.getByLabelText(/^New Password/i);
      const confirmInput = screen.getByLabelText(/^Confirm Password/i);
      const submitBtn = screen.getByRole('button', { name: /Set Password/i });

      fireEvent.change(passwordInput, { target: { value: 'CorrectHorseBattery123!' } });
      fireEvent.change(confirmInput, { target: { value: 'CorrectHorseBattery123!' } });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(setPasswordSpy).toHaveBeenCalledWith('valid-token-123', 'CorrectHorseBattery123!');
        expect(screen.getByText('Password Set Successfully')).toBeDefined();
      });
    });
  });

  describe('OnboardingChecklistDetail', () => {
    it('renders detail view and milestones correctly', async () => {
      vi.spyOn(onboardingApi, 'fetchOnboardingDetail').mockResolvedValueOnce(MOCK_DETAIL);

      render(
        <OnboardingChecklistDetail employeeId="emp-1" onBack={vi.fn()} userRole="hr_manager" />,
      );

      await waitFor(() => {
        expect(screen.getByText('Asha Rao')).toBeDefined();
        expect(screen.getByText('Onboarding Milestones')).toBeDefined();
        expect(screen.getByText('Identity Verification (ID Proof)')).toBeDefined();
        expect(screen.getByText('Offer Letter Signed')).toBeDefined();
      });
    });
  });
});

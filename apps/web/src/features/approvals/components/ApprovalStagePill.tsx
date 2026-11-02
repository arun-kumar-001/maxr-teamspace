import React from 'react';
import type { ApprovalStage } from '../types';

export interface ApprovalStagePillProps {
  stage?: ApprovalStage;
  stageIndex?: number;
  totalStages?: number;
  isComplete?: boolean;
}

const STAGE_LABELS: Record<ApprovalStage, string> = {
  manager: 'Manager Review',
  hr: 'HR Review',
};

export const ApprovalStagePill: React.FC<ApprovalStagePillProps> = ({
  stage,
  stageIndex,
  totalStages,
  isComplete = false,
}) => {
  if (isComplete) {
    return (
      <span
        data-testid="stage-pill-complete"
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" aria-hidden="true" />
        Completed
      </span>
    );
  }

  if (!stage) {
    return null;
  }

  const label = STAGE_LABELS[stage] ?? stage;
  const stepIndicator =
    totalStages && totalStages > 1 && stageIndex !== undefined
      ? ` (Step ${stageIndex + 1}/${totalStages})`
      : '';

  return (
    <span
      data-testid={`stage-pill-${stage}`}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-primary-soft text-primary-ink border border-teal-200"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-primary-strong" aria-hidden="true" />
      {label}
      {stepIndicator}
    </span>
  );
};

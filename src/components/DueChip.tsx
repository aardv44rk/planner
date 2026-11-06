import React from 'react';
import { Tag, type TagRole } from './ui/controls';

export interface DueChipProps {
  dueDate?: string | null;
  status?: string;
  completed?: boolean | number;
  className?: string;
}

export interface DeadlineUrgency {
  tone: TagRole;
  label: string;
  overdue: boolean;
  daysRemaining: number;
}

/**
 * Parses diverse deadline string formats (ISO, YYYY-MM-DD, Moodle dates)
 * and computes urgency tier relative to current system time.
 */
export function calculateDeadlineUrgency(dueDateStr?: string | null): DeadlineUrgency | null {
  if (!dueDateStr || !dueDateStr.trim()) return null;

  const parsed = new Date(dueDateStr);
  if (isNaN(parsed.getTime())) {
    // If invalid Date parse (e.g. custom text format), show as neutral
    return {
      tone: 'neutral',
      label: dueDateStr,
      overdue: false,
      daysRemaining: 999,
    };
  }

  const now = new Date();
  const diffMs = parsed.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  const diffDays = Math.ceil(diffHours / 24);

  const isToday =
    parsed.getFullYear() === now.getFullYear() &&
    parsed.getMonth() === now.getMonth() &&
    parsed.getDate() === now.getDate();

  if (diffHours < 0) {
    const absDays = Math.abs(Math.floor(diffHours / 24));
    return {
      tone: 'danger',
      label: absDays === 0 ? 'Overdue' : `${absDays}d overdue`,
      overdue: true,
      daysRemaining: diffDays,
    };
  }

  if (isToday) {
    return {
      tone: 'danger',
      label: 'Due today',
      overdue: false,
      daysRemaining: 0,
    };
  }

  if (diffDays === 1) {
    return {
      tone: 'warn',
      label: 'Due tomorrow',
      overdue: false,
      daysRemaining: 1,
    };
  }

  if (diffDays <= 3) {
    return {
      tone: 'warn',
      label: `${diffDays}d left`,
      overdue: false,
      daysRemaining: diffDays,
    };
  }

  if (diffDays <= 7) {
    return {
      tone: 'accent',
      label: `${diffDays}d left`,
      overdue: false,
      daysRemaining: diffDays,
    };
  }

  const month = parsed.getMonth() + 1;
  const day = parsed.getDate();
  return {
    tone: 'neutral',
    label: `${month}/${day}`,
    overdue: false,
    daysRemaining: diffDays,
  };
}

/**
 * Urgency badge component matching academic deadlines.
 * Automatically changes tones between danger (overdue/today),
 * warn (soon), accent (this week), and ok (submitted/graded).
 */
export const DueChip: React.FC<DueChipProps> = ({
  dueDate,
  status,
  completed,
  className = '',
}) => {
  const isDone = Boolean(completed) || status === 'done';
  const isSubmitted = status === 'submitted';
  const isGraded = status === 'graded';

  if (isGraded) {
    return (
      <Tag tone="accent" variant="soft" className={`dueChip ${className}`}>
        Graded
      </Tag>
    );
  }

  if (isSubmitted || isDone) {
    return (
      <Tag tone="ok" variant="soft" className={`dueChip ${className}`}>
        Submitted
      </Tag>
    );
  }

  const urgency = calculateDeadlineUrgency(dueDate);
  if (!urgency) return null;

  return (
    <Tag
      tone={urgency.tone}
      variant="soft"
      className={`dueChip ${urgency.overdue ? 'overdue animate-pulse' : ''} ${className}`}
    >
      {urgency.label}
    </Tag>
  );
};

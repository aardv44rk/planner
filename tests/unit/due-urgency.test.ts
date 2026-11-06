import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { calculateDeadlineUrgency } from '../../src/components/DueChip';

describe('calculateDeadlineUrgency', () => {
  const fixedNow = new Date(2026, 10, 10, 10, 0, 0);

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(fixedNow);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null on empty or null inputs', () => {
    expect(calculateDeadlineUrgency(null)).toBeNull();
    expect(calculateDeadlineUrgency('')).toBeNull();
    expect(calculateDeadlineUrgency('   ')).toBeNull();
  });

  it('flags past deadlines as danger overdue', () => {
    const twoDaysAgo = new Date(2026, 10, 8, 10, 0, 0).toISOString();
    const urgency = calculateDeadlineUrgency(twoDaysAgo);
    expect(urgency).not.toBeNull();
    expect(urgency?.tone).toBe('danger');
    expect(urgency?.overdue).toBe(true);
    expect(urgency?.label).toContain('overdue');
  });

  it('flags deadlines today as danger Due today', () => {
    const todayEvening = new Date(2026, 10, 10, 23, 59, 0).toISOString();
    const urgency = calculateDeadlineUrgency(todayEvening);
    expect(urgency).not.toBeNull();
    expect(urgency?.tone).toBe('danger');
    expect(urgency?.overdue).toBe(false);
    expect(urgency?.label).toBe('Due today');
  });

  it('flags deadlines tomorrow as warn Due tomorrow', () => {
    const tomorrow = new Date(2026, 10, 11, 10, 0, 0).toISOString();
    const urgency = calculateDeadlineUrgency(tomorrow);
    expect(urgency).not.toBeNull();
    expect(urgency?.tone).toBe('warn');
    expect(urgency?.label).toBe('Due tomorrow');
  });

  it('flags deadlines within 3 days as warn Xd left', () => {
    const in3Days = new Date(2026, 10, 13, 10, 0, 0).toISOString();
    const urgency = calculateDeadlineUrgency(in3Days);
    expect(urgency).not.toBeNull();
    expect(urgency?.tone).toBe('warn');
    expect(urgency?.label).toBe('3d left');
  });

  it('flags deadlines within 7 days as accent Xd left', () => {
    const in6Days = new Date(2026, 10, 16, 10, 0, 0).toISOString();
    const urgency = calculateDeadlineUrgency(in6Days);
    expect(urgency).not.toBeNull();
    expect(urgency?.tone).toBe('accent');
    expect(urgency?.label).toBe('6d left');
  });

  it('flags deadlines further out as neutral date display', () => {
    const in18Days = new Date(2026, 10, 28, 10, 0, 0).toISOString();
    const urgency = calculateDeadlineUrgency(in18Days);
    expect(urgency).not.toBeNull();
    expect(urgency?.tone).toBe('neutral');
    expect(urgency?.label).toBe('11/28');
  });
});

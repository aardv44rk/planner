import { describe, it, expect } from 'vitest';
import {
  courseMatchesQuarter,
  getAvailableAcademicYears,
  addCivilDays,
  civilWeekday,
  isCivilDate,
} from '../../src/utils/academic';

describe('academic calendar & quarter matching', () => {
  it('correctly matches direct single quarter courses', () => {
    expect(courseMatchesQuarter('2026-3Q', '3Q', '2026')).toBe(true);
    expect(courseMatchesQuarter('2026-3Q', '4Q', '2026')).toBe(false);
  });

  it('correctly matches compound quarter ranges (e.g. 3Q-4Q)', () => {
    const courseTerm = '2026-3Q-4Q';
    expect(courseMatchesQuarter(courseTerm, '3Q', '2026')).toBe(true);
    expect(courseMatchesQuarter(courseTerm, '4Q', '2026')).toBe(true);
    expect(courseMatchesQuarter(courseTerm, '1Q', '2026')).toBe(false);
    expect(courseMatchesQuarter(courseTerm, '2Q', '2026')).toBe(false);
  });

  it('correctly matches comma-separated quarters', () => {
    const multiTerm = '2026-1Q, 2026-2Q';
    expect(courseMatchesQuarter(multiTerm, '1Q', '2026')).toBe(true);
    expect(courseMatchesQuarter(multiTerm, '2Q', '2026')).toBe(true);
    expect(courseMatchesQuarter(multiTerm, '3Q', '2026')).toBe(false);
  });

  it('prevents cross-academic-year pollution', () => {
    // Catches bug where 2025-3Q leaked into the 2026 active semester
    expect(courseMatchesQuarter('2025-3Q', '3Q', '2026')).toBe(false);
    expect(courseMatchesQuarter('2026-3Q', '3Q', '2025')).toBe(false);
    expect(courseMatchesQuarter('2025-3Q', '3Q', 'All')).toBe(true);
  });

  it('extracts unique descending academic years', () => {
    const courses = [
      { term: '2024-1Q' },
      { term: '2026-3Q' },
      { term: '2025-2Q' },
      { term: '2026-4Q' },
      { term: 'Unscheduled' },
    ];
    const years = getAvailableAcademicYears(courses);
    expect(years).toEqual(['2026', '2025', '2024']);
  });

  it('computes civil dates without DST timezone displacement', () => {
    expect(isCivilDate('2026-11-06')).toBe(true);
    expect(isCivilDate('invalid-date')).toBe(false);
    expect(addCivilDays('2026-11-06', 5)).toBe('2026-11-11');
    expect(addCivilDays('2026-11-06', -7)).toBe('2026-10-30');
    // Monday = 1 ... Sunday = 7
    // 2026-11-06 is Friday -> 5
    expect(civilWeekday('2026-11-06')).toBe(5);
  });
});

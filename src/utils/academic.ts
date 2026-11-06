/**
 * Academic calendar and civil date utilities for Science Tokyo / Tokyo Tech LMS.
 * Mirrored and adapted from isct-companion civil-date.ts and academic.ts.
 */

export const JST = 'Asia/Tokyo';

export interface CivilDate {
  year: number;
  month: number; // 1-12
  day: number;   // 1-31
  dateStr: string; // YYYY-MM-DD
}

export type AcademicQuarter = '1Q' | '2Q' | '3Q' | '4Q';

export interface AcademicTerm {
  academicYear: number;
  quarter: AcademicQuarter;
  termId: string; // e.g. "2026-3Q"
}

/**
 * Parses machine timestamp with explicit offset into Date.
 */
export function parseIsoTimestamp(value: unknown): Date | undefined {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value,
    ) ||
    !isCivilDate(value.slice(0, 10))
  )
    return undefined;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : undefined;
}

/**
 * Validates ISO-shaped civil date YYYY-MM-DD.
 */
export function isCivilDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

/**
 * Shifts a validated ISO-shaped civil date without involving the host timezone.
 */
export function addCivilDays(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/**
 * Monday = 1 ... Sunday = 7, for timetable navigation and slots.
 */
export function civilWeekday(date: string): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay() || 7;
}

/**
 * Returns date components in Japan Standard Time (Asia/Tokyo) regardless of host timezone.
 */
export function getTokyoCivilDate(date: Date = new Date()): CivilDate {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: JST,
    calendar: 'gregory',
    numberingSystem: 'latn',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = Number(parts.find((p) => p.type === 'year')?.value ?? 2026);
  const month = Number(parts.find((p) => p.type === 'month')?.value ?? 1);
  const day = Number(parts.find((p) => p.type === 'day')?.value ?? 1);
  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  return { year, month, day, dateStr };
}

/**
 * Computes the active Academic Year and Academic Quarter in Japan time.
 * In Japan university calendar:
 * - Academic year begins April 1 and ends March 31 of next calendar year.
 * - 1Q: April – May
 * - 2Q: June – September
 * - 3Q: October – November
 * - 4Q: December – March (December is calendar year Y; January–March is calendar year Y+1, but still academic year Y)
 */
export function getCurrentAcademicTerm(date: Date = new Date()): AcademicTerm {
  const tokyo = getTokyoCivilDate(date);

  // In January, February, March (month < 4), academic year = calendar year - 1
  const academicYear = tokyo.month < 4 ? tokyo.year - 1 : tokyo.year;

  let quarter: AcademicQuarter;
  if (tokyo.month === 4 || tokyo.month === 5) {
    quarter = '1Q';
  } else if (tokyo.month >= 6 && tokyo.month <= 9) {
    quarter = '2Q';
  } else if (tokyo.month === 10 || tokyo.month === 11) {
    quarter = '3Q';
  } else {
    // 12 (December), 1 (January), 2 (February), 3 (March)
    quarter = '4Q';
  }

  return {
    academicYear,
    quarter,
    termId: `${academicYear}-${quarter}`,
  };
}

/**
 * Checks whether a course term string matches target quarter and target academic year.
 * Handles:
 * - Single quarter: "2026-3Q" matches "3Q"
 * - Comma-separated multi-quarters: "2026-3Q, 2026-4Q" matches both "3Q" and "4Q"
 * - Range quarters: "2026-3Q-4Q" or "3Q-4Q" matches both "3Q" and "4Q"
 * - Academic year prefix matching ("2026-..." vs "2025-...")
 */
export function courseMatchesQuarter(
  courseTerm: string | undefined,
  targetQuarter: string,
  targetYear?: string | number,
): boolean {
  if (!courseTerm) return false;
  const termStr = courseTerm.trim();

  // If target academic year specified and not 'All', check year prefix
  if (targetYear && targetYear !== 'All') {
    const yearPrefix = `${targetYear}-`;
    if (!termStr.startsWith(yearPrefix) && !termStr.includes(`[${targetYear}]`)) {
      return false;
    }
  }

  if (targetQuarter === 'All') return true;

  // Split term tokens by commas or spaces
  const tokens = termStr.split(/[\s,]+/);
  for (const token of tokens) {
    // 1. Direct match with target quarter (e.g. "2026-3Q" or "3Q" matching "3Q")
    if (token.includes(targetQuarter)) return true;

    // 2. Range match (e.g. "3Q-4Q" or "1Q-2Q")
    const rangeMatch = token.match(/([1-4])Q-([1-4])Q/i);
    if (rangeMatch) {
      const startQ = parseInt(rangeMatch[1], 10);
      const endQ = parseInt(rangeMatch[2], 10);
      const targetQNum = parseInt(targetQuarter.replace('Q', ''), 10);
      if (targetQNum >= startQ && targetQNum <= endQ) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Extracts all unique academic years present in a course list.
 */
export function getAvailableAcademicYears(courses: { term?: string }[]): string[] {
  const years = new Set<string>();
  for (const c of courses) {
    if (!c.term) continue;
    const match = c.term.match(/^(\d{4})-/);
    if (match) {
      years.add(match[1]);
    }
  }
  const sorted = Array.from(years).sort().reverse();
  return sorted.length > 0 ? sorted : ['2026'];
}

/**
 * Sorts courses for display:
 * 1. Timetable-scheduled courses first, ordered by weekday (Mon -> Sat) and start time
 * 2. On-Demand / Project / Unscheduled courses next
 * 3. Ties broken alphabetically by course code (e.g. "TSE.A301")
 */
export function sortCoursesForDisplay<T extends { code: string; schedule?: string }>(courses: T[]): T[] {
  const dayOrder: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  };

  return [...courses].sort((a, b) => {
    const aIsOnDemand = !a.schedule || a.schedule.includes('On-Demand') || a.schedule.includes('Project');
    const bIsOnDemand = !b.schedule || b.schedule.includes('On-Demand') || b.schedule.includes('Project');

    // Scheduled classes come before on-demand
    if (aIsOnDemand && !bIsOnDemand) return 1;
    if (!aIsOnDemand && bIsOnDemand) return -1;

    // If both scheduled, sort by day of week then time
    if (!aIsOnDemand && !bIsOnDemand && a.schedule && b.schedule) {
      const aDayKey = Object.keys(dayOrder).find((d) => a.schedule!.includes(d));
      const bDayKey = Object.keys(dayOrder).find((d) => b.schedule!.includes(d));
      const aDay = aDayKey ? dayOrder[aDayKey] : 99;
      const bDay = bDayKey ? dayOrder[bDayKey] : 99;

      if (aDay !== bDay) return aDay - bDay;

      const aTime = a.schedule.match(/\d{2}:\d{2}/)?.[0] || '';
      const bTime = b.schedule.match(/\d{2}:\d{2}/)?.[0] || '';
      if (aTime && bTime && aTime !== bTime) {
        return aTime.localeCompare(bTime);
      }
    }

    // Default alphabetical by course code
    return a.code.localeCompare(b.code);
  });
}

export type WarrantyState = "active" | "expiring_soon" | "expired" | "unknown";

export type WarrantyWarningCode = "WARRANTY_FACTS_MISSING" | "WARRANTY_END_CONFLICT";

export interface WarrantyWarning {
  code: WarrantyWarningCode;
  message: string;
}

export interface WarrantyFacts {
  purchaseDate?: string;
  warrantyEndDate?: string;
  warrantyMonths?: number;
}

export interface WarrantyStateInput extends WarrantyFacts {
  referenceDate: string;
  expiringSoonDays?: number;
}

export interface WarrantyStateResult {
  state: WarrantyState;
  effectiveEndDate?: string;
  derivedEndDate?: string;
  directEndDate?: string;
  daysUntilEnd?: number;
  warnings: WarrantyWarning[];
}

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const millisecondsPerDay = 24 * 60 * 60 * 1000;

export function calculateWarrantyState(input: WarrantyStateInput): WarrantyStateResult {
  const expiringSoonDays = input.expiringSoonDays ?? 45;
  const directEndDate = input.warrantyEndDate;
  const derivedEndDate =
    input.purchaseDate !== undefined && input.warrantyMonths !== undefined
      ? addCalendarMonths(input.purchaseDate, input.warrantyMonths)
      : undefined;

  if (directEndDate !== undefined && derivedEndDate !== undefined && directEndDate !== derivedEndDate) {
    return {
      state: "unknown",
      directEndDate,
      derivedEndDate,
      warnings: [
        {
          code: "WARRANTY_END_CONFLICT",
          message: `Direct warranty end ${directEndDate} conflicts with derived warranty end ${derivedEndDate}.`
        }
      ]
    };
  }

  const effectiveEndDate = directEndDate ?? derivedEndDate;
  if (effectiveEndDate === undefined) {
    return {
      state: "unknown",
      warnings: [
        {
          code: "WARRANTY_FACTS_MISSING",
          message: "Warranty end date or purchase date plus warranty duration is required."
        }
      ]
    };
  }

  const daysUntilEnd = differenceInCalendarDays(effectiveEndDate, input.referenceDate);
  if (daysUntilEnd < 0) {
    return { state: "expired", effectiveEndDate, derivedEndDate, directEndDate, daysUntilEnd, warnings: [] };
  }

  if (daysUntilEnd <= expiringSoonDays) {
    return { state: "expiring_soon", effectiveEndDate, derivedEndDate, directEndDate, daysUntilEnd, warnings: [] };
  }

  return { state: "active", effectiveEndDate, derivedEndDate, directEndDate, daysUntilEnd, warnings: [] };
}

export function addCalendarMonths(dateText: string, months: number): string {
  assertIsoDate(dateText);
  if (!Number.isInteger(months) || months < 0) {
    throw new Error("Warranty months must be a non-negative integer.");
  }

  const { year, month, day } = parseIsoDateParts(dateText);
  const targetMonthIndex = month - 1 + months;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const normalizedMonthIndex = modulo(targetMonthIndex, 12);
  const targetMonth = normalizedMonthIndex + 1;
  const clampedDay = Math.min(day, daysInMonth(targetYear, targetMonth));

  return formatIsoDate(targetYear, targetMonth, clampedDay);
}

function differenceInCalendarDays(leftDateText: string, rightDateText: string): number {
  const left = parseUtcDate(leftDateText);
  const right = parseUtcDate(rightDateText);
  return Math.round((left.getTime() - right.getTime()) / millisecondsPerDay);
}

function parseUtcDate(dateText: string): Date {
  const { year, month, day } = parseIsoDateParts(dateText);
  return new Date(Date.UTC(year, month - 1, day));
}

function parseIsoDateParts(dateText: string): { year: number; month: number; day: number } {
  assertIsoDate(dateText);
  const [yearText, monthText, dayText] = dateText.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    throw new Error(`Invalid date: ${dateText}`);
  }

  return { year, month, day };
}

function assertIsoDate(dateText: string): void {
  if (!isoDatePattern.test(dateText)) {
    throw new Error(`Expected date in YYYY-MM-DD format: ${dateText}`);
  }
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function formatIsoDate(year: number, month: number, day: number): string {
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day
    .toString()
    .padStart(2, "0")}`;
}

function modulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}


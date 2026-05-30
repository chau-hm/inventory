import { describe, expect, it } from "vitest";
import { addCalendarMonths, calculateWarrantyState } from "../../src/domain/warranty.js";

describe("calculateWarrantyState", () => {
  it("returns active when direct end is outside the expiring-soon window", () => {
    const result = calculateWarrantyState({
      warrantyEndDate: "2026-12-31",
      referenceDate: "2026-05-30",
      expiringSoonDays: 45
    });

    expect(result.state).toBe("active");
    expect(result.effectiveEndDate).toBe("2026-12-31");
    expect(result.warnings).toEqual([]);
  });

  it("returns expiring soon when direct end is inside the configured window", () => {
    const result = calculateWarrantyState({
      warrantyEndDate: "2026-06-20",
      referenceDate: "2026-05-30",
      expiringSoonDays: 45
    });

    expect(result.state).toBe("expiring_soon");
    expect(result.daysUntilEnd).toBe(21);
  });

  it("treats the warranty end date as inclusive", () => {
    const result = calculateWarrantyState({
      warrantyEndDate: "2026-05-30",
      referenceDate: "2026-05-30"
    });

    expect(result.state).toBe("expiring_soon");
    expect(result.daysUntilEnd).toBe(0);
  });

  it("returns expired when direct end is before the reference date", () => {
    const result = calculateWarrantyState({
      warrantyEndDate: "2026-05-29",
      referenceDate: "2026-05-30"
    });

    expect(result.state).toBe("expired");
    expect(result.daysUntilEnd).toBe(-1);
  });

  it("derives warranty end from purchase date and warranty months", () => {
    const result = calculateWarrantyState({
      purchaseDate: "2026-05-30",
      warrantyMonths: 24,
      referenceDate: "2026-05-30"
    });

    expect(result.state).toBe("active");
    expect(result.derivedEndDate).toBe("2028-05-30");
    expect(result.effectiveEndDate).toBe("2028-05-30");
  });

  it("returns unknown when warranty facts are missing", () => {
    const result = calculateWarrantyState({
      referenceDate: "2026-05-30"
    });

    expect(result.state).toBe("unknown");
    expect(result.warnings).toEqual([
      {
        code: "WARRANTY_FACTS_MISSING",
        message: "Warranty end date or purchase date plus warranty duration is required."
      }
    ]);
  });

  it("returns unknown with a conflict warning when direct and derived end dates disagree", () => {
    const result = calculateWarrantyState({
      purchaseDate: "2026-05-30",
      warrantyMonths: 24,
      warrantyEndDate: "2029-05-30",
      referenceDate: "2026-05-30"
    });

    expect(result.state).toBe("unknown");
    expect(result.effectiveEndDate).toBeUndefined();
    expect(result.directEndDate).toBe("2029-05-30");
    expect(result.derivedEndDate).toBe("2028-05-30");
    expect(result.warnings[0]?.code).toBe("WARRANTY_END_CONFLICT");
  });
});

describe("addCalendarMonths", () => {
  it("clamps month-end dates to the target month's last day", () => {
    expect(addCalendarMonths("2026-01-31", 1)).toBe("2026-02-28");
  });

  it("handles leap-day anniversaries deterministically", () => {
    expect(addCalendarMonths("2024-02-29", 12)).toBe("2025-02-28");
  });
});


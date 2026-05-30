import { describe, expect, it } from "vitest";
import { validateItemDraft } from "../../src/domain/item.js";

describe("validateItemDraft", () => {
  it("validates a minimal item and defaults status to active", () => {
    expect(validateItemDraft({ name: "MacBook Pro", category: "laptop" })).toEqual({
      name: "MacBook Pro",
      category: "laptop",
      status: "active"
    });
  });

  it("trims user-facing string fields", () => {
    expect(
      validateItemDraft({
        name: "  AirPods Pro  ",
        category: "  audio  ",
        brand: "  Apple  ",
        serialNumber: "  ABC123  "
      })
    ).toMatchObject({
      name: "AirPods Pro",
      category: "audio",
      brand: "Apple",
      serialNumber: "ABC123"
    });
  });

  it("rejects missing required fields", () => {
    expect(() => validateItemDraft({ category: "laptop" })).toThrow();
    expect(() => validateItemDraft({ name: "MacBook Pro" })).toThrow();
    expect(() => validateItemDraft({ name: "   ", category: "laptop" })).toThrow();
  });

  it("rejects invalid dates and timestamps", () => {
    expect(() =>
      validateItemDraft({
        name: "Camera",
        category: "camera",
        purchaseDate: "30/05/2026"
      })
    ).toThrow();

    expect(() =>
      validateItemDraft({
        name: "Camera",
        category: "camera",
        createdAt: "2026-05-30"
      })
    ).toThrow();
  });

  it("requires currency when purchase price is present", () => {
    expect(() =>
      validateItemDraft({
        name: "Washing Machine",
        category: "appliance",
        purchasePriceMinor: 650000
      })
    ).toThrow(/Currency is required/);
  });

  it("rejects invalid currency, price, and warranty months", () => {
    expect(() => validateItemDraft({ name: "Phone", category: "phone", currency: "hkd" })).toThrow();
    expect(() => validateItemDraft({ name: "Phone", category: "phone", purchasePriceMinor: -1, currency: "HKD" })).toThrow();
    expect(() => validateItemDraft({ name: "Phone", category: "phone", warrantyMonths: 12.5 })).toThrow();
  });

  it("requires deletedAt for deleted items", () => {
    expect(() =>
      validateItemDraft({
        name: "Old iPhone",
        category: "phone",
        status: "deleted"
      })
    ).toThrow(/deletedAt is required/);
  });

  it("rejects deletedAt for non-deleted items", () => {
    expect(() =>
      validateItemDraft({
        name: "Old iPhone",
        category: "phone",
        status: "archived",
        deletedAt: "2026-05-30T12:00:00Z"
      })
    ).toThrow(/deletedAt must be omitted/);
  });

  it("accepts deleted items with deletedAt", () => {
    expect(
      validateItemDraft({
        name: "Old iPhone",
        category: "phone",
        status: "deleted",
        deletedAt: "2026-05-30T12:00:00Z"
      })
    ).toMatchObject({
      status: "deleted",
      deletedAt: "2026-05-30T12:00:00Z"
    });
  });
});


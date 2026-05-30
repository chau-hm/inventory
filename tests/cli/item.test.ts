import { afterEach, describe, expect, it, vi } from "vitest";
import { createProgram } from "../../src/cli/program.js";

describe("item validate command", () => {
  const output: string[] = [];

  afterEach(() => {
    output.length = 0;
    vi.restoreAllMocks();
  });

  it("prints concise text output for a valid item draft", async () => {
    vi.spyOn(console, "log").mockImplementation((message?: unknown) => {
      output.push(String(message));
    });

    await createProgram().parseAsync(
      ["node", "inventory", "item", "validate", "--name", "MacBook Pro", "--category", "laptop"],
      { from: "node" }
    );

    expect(output).toEqual(["Item draft valid: MacBook Pro (laptop, active)"]);
  });

  it("prints stable JSON output with normalized fields", async () => {
    vi.spyOn(console, "log").mockImplementation((message?: unknown) => {
      output.push(String(message));
    });

    await createProgram().parseAsync(
      [
        "node",
        "inventory",
        "item",
        "validate",
        "--name",
        "  AirPods Pro  ",
        "--category",
        "  audio  ",
        "--brand",
        "  Apple  ",
        "--purchase-price-minor",
        "189900",
        "--currency",
        "HKD",
        "--format",
        "json"
      ],
      { from: "node" }
    );

    expect(JSON.parse(output[0] ?? "")).toEqual({
      ok: true,
      item: {
        name: "AirPods Pro",
        category: "audio",
        status: "active",
        brand: "Apple",
        purchasePriceMinor: 189900,
        currency: "HKD"
      }
    });
  });
});


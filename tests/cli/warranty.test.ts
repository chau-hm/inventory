import { afterEach, describe, expect, it, vi } from "vitest";
import { createProgram } from "../../src/cli/program.js";

describe("warranty check command", () => {
  const output: string[] = [];

  afterEach(() => {
    output.length = 0;
    vi.restoreAllMocks();
  });

  it("prints concise text output", async () => {
    vi.spyOn(console, "log").mockImplementation((message?: unknown) => {
      output.push(String(message));
    });

    await createProgram().parseAsync(
      ["node", "inventory", "warranty", "check", "--warranty-end", "2026-12-31", "--as-of", "2026-05-30"],
      { from: "node" }
    );

    expect(output).toEqual(["Warranty: active (ends 2026-12-31)"]);
  });

  it("prints stable JSON output", async () => {
    vi.spyOn(console, "log").mockImplementation((message?: unknown) => {
      output.push(String(message));
    });

    await createProgram().parseAsync(
      [
        "node",
        "inventory",
        "warranty",
        "check",
        "--purchase-date",
        "2026-05-30",
        "--warranty-months",
        "24",
        "--as-of",
        "2026-05-30",
        "--format",
        "json"
      ],
      { from: "node" }
    );

    expect(JSON.parse(output[0] ?? "")).toMatchObject({
      ok: true,
      result: {
        state: "active",
        effectiveEndDate: "2028-05-30",
        derivedEndDate: "2028-05-30",
        warnings: []
      }
    });
  });
});


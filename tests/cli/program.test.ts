import { describe, expect, it } from "vitest";
import { createProgram } from "../../src/cli/program.js";

describe("inventory CLI program", () => {
  it("exposes the inventory command name", () => {
    const program = createProgram();

    expect(program.name()).toBe("inventory");
  });

  it("registers the health command", () => {
    const program = createProgram();

    expect(program.commands.map((command) => command.name())).toContain("health");
  });
});

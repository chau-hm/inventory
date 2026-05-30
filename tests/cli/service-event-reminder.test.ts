import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createProgram } from "../../src/cli/program.js";

describe("service-event and reminder commands", () => {
  let tempDir: string;
  let itemStore: string;
  let eventStore: string;
  const output: string[] = [];

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "inventory-reminder-cli-"));
    itemStore = join(tempDir, "items.json");
    eventStore = join(tempDir, "events.json");
    vi.spyOn(console, "log").mockImplementation((message?: unknown) => {
      output.push(String(message));
    });
  });

  afterEach(async () => {
    output.length = 0;
    vi.restoreAllMocks();
    process.exitCode = undefined;
    await rm(tempDir, { force: true, recursive: true });
  });

  it("adds, lists, and deletes service events", async () => {
    await run(
      "service-event",
      "add",
      "--item",
      "itm_1",
      "--kind",
      "maintenance",
      "--title",
      "Clean filter",
      "--due-on",
      "2026-06-05",
      "--events-store",
      eventStore,
      "--format",
      "json"
    );
    const added = JSON.parse(output.pop() ?? "{}") as { event: { id: string } };

    await run("service-event", "list", "--item", "itm_1", "--events-store", eventStore, "--format", "json");
    expect(JSON.parse(output.pop() ?? "{}")).toMatchObject({
      events: [{ id: added.event.id, itemId: "itm_1", kind: "maintenance", status: "active" }]
    });

    await run("service-event", "delete", added.event.id, "--events-store", eventStore, "--format", "json");
    expect(JSON.parse(output.pop() ?? "{}")).toMatchObject({ event: { id: added.event.id, status: "deleted" } });
  });

  it("lists warranty and service-event due reminders with dedupe keys", async () => {
    await run(
      "item",
      "add",
      "--store",
      itemStore,
      "--name",
      "MacBook Pro",
      "--category",
      "laptop",
      "--warranty-end",
      "2026-06-10",
      "--format",
      "json"
    );
    const itemId = (JSON.parse(output.pop() ?? "{}") as { item: { id: string } }).item.id;

    await run(
      "service-event",
      "add",
      "--item",
      itemId,
      "--kind",
      "maintenance",
      "--title",
      "Clean keyboard",
      "--due-on",
      "2026-06-05",
      "--events-store",
      eventStore,
      "--format",
      "json"
    );
    output.pop();

    await run(
      "reminder",
      "due",
      "--store",
      itemStore,
      "--events-store",
      eventStore,
      "--as-of",
      "2026-05-30",
      "--within",
      "45d",
      "--format",
      "json"
    );

    const result = JSON.parse(output.pop() ?? "{}");
    expect(result).toMatchObject({
      ok: true,
      reminders: [
        { kind: "service_event_due", dueOn: "2026-06-05" },
        { kind: "warranty_expiring", dueOn: "2026-06-10" }
      ]
    });
    expect(result.reminders[0].dedupeKey).toMatch(/^service-event:/);
    expect(result.reminders[1].dedupeKey).toBe(`warranty:${itemId}:2026-06-10`);
  });

  async function run(...args: string[]): Promise<void> {
    await createProgram().parseAsync(["node", "inventory", ...args], { from: "node" });
  }
});


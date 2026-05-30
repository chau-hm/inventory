import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createProgram } from "../../src/cli/program.js";

describe("item CRUD commands", () => {
  let tempDir: string;
  let storePath: string;
  let dbPath: string;
  const output: string[] = [];

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "inventory-cli-"));
    storePath = join(tempDir, "items.json");
    dbPath = join(tempDir, "inventory.sqlite");
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

  it("adds, lists, details, edits, deletes, and restores an item", async () => {
    await run("item", "add", "--store", storePath, "--name", "MacBook Pro", "--category", "laptop", "--format", "json");
    const added = JSON.parse(output.pop() ?? "{}") as { item: { id: string } };
    const id = added.item.id;
    expect(id).toMatch(/^itm_/);

    await run("item", "list", "--store", storePath, "--format", "json");
    expect(JSON.parse(output.pop() ?? "{}")).toMatchObject({ items: [{ id, name: "MacBook Pro", status: "active" }] });

    await run("item", "detail", id, "--store", storePath, "--format", "json");
    expect(JSON.parse(output.pop() ?? "{}")).toMatchObject({ item: { id, category: "laptop" } });

    await run("item", "edit", id, "--store", storePath, "--location", "Study", "--format", "json");
    expect(JSON.parse(output.pop() ?? "{}")).toMatchObject({ item: { id, location: "Study" } });

    await run("item", "delete", id, "--store", storePath, "--format", "json");
    expect(JSON.parse(output.pop() ?? "{}")).toMatchObject({ item: { id, status: "deleted" } });

    await run("item", "list", "--store", storePath, "--format", "json");
    expect(JSON.parse(output.pop() ?? "{}")).toMatchObject({ items: [] });

    await run("item", "restore", id, "--store", storePath, "--format", "json");
    expect(JSON.parse(output.pop() ?? "{}")).toMatchObject({ item: { id, status: "active" } });
  });

  it("returns ambiguous target candidates and does not mutate", async () => {
    await run("item", "add", "--store", storePath, "--name", "Sony Headphones", "--category", "audio");
    await run("item", "add", "--store", storePath, "--name", "Sony Speaker", "--category", "audio");

    await run("item", "delete", "Sony", "--store", storePath, "--format", "json");

    const result = JSON.parse(output.pop() ?? "{}");
    expect(result).toMatchObject({
      ok: false,
      error: {
        code: "AMBIGUOUS_ITEM",
        candidates: [{ name: "Sony Headphones" }, { name: "Sony Speaker" }]
      }
    });

    const stored = JSON.parse(await readFile(storePath, "utf8")) as { items: Array<{ status: string }> };
    expect(stored.items.map((item) => item.status)).toEqual(["active", "active"]);
  });

  it("runs item commands against SQLite when --db is supplied", async () => {
    await run("item", "add", "--db", dbPath, "--name", "Nintendo Switch", "--category", "console", "--format", "json");
    const added = JSON.parse(output.pop() ?? "{}") as { item: { id: string } };

    await run("item", "list", "--db", dbPath, "--format", "json");

    expect(JSON.parse(output.pop() ?? "{}")).toMatchObject({
      items: [{ id: added.item.id, name: "Nintendo Switch", category: "console", status: "active" }]
    });
  });

  async function run(...args: string[]): Promise<void> {
    await createProgram().parseAsync(["node", "inventory", ...args], { from: "node" });
  }
});

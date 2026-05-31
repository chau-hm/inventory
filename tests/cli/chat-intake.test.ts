import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createProgram } from "../../src/cli/program.js";

describe("chat intake commands", () => {
  const output: string[] = [];
  let tempDir: string;
  let storePath: string;

  afterEach(async () => {
    output.length = 0;
    vi.restoreAllMocks();
    process.exitCode = undefined;
    if (tempDir !== undefined) {
      await rm(tempDir, { force: true, recursive: true });
    }
  });

  it("parses natural-language item text into a JSON add draft without saving", async () => {
    vi.spyOn(console, "log").mockImplementation((message?: unknown) => {
      output.push(String(message));
    });

    await createProgram().parseAsync(
      [
        "node",
        "inventory",
        "chat",
        "parse",
        "記低",
        "MacBook Pro，2026-05-30 買，AppleCare 到 2029-05-30，放書房",
        "--format",
        "json"
      ],
      { from: "node" }
    );

    expect(JSON.parse(output[0] ?? "{}")).toEqual({
      kind: "draft",
      draft: expect.objectContaining({
        name: "MacBook Pro",
        category: "laptop",
        purchaseDate: "2026-05-30",
        warrantyEnd: "2029-05-30",
        location: "書房",
        needsConfirmation: true,
        commandArgs: expect.arrayContaining(["item", "add", "--name", "MacBook Pro"])
      })
    });
  });

  it("prints a concise text draft with equivalent CLI", async () => {
    vi.spyOn(console, "log").mockImplementation((message?: unknown) => {
      output.push(String(message));
    });

    await createProgram().parseAsync(["node", "inventory", "chat", "parse", "記低 AirPods Pro，放睡房"], {
      from: "node"
    });

    expect(output[0]).toContain("Draft item (confirm before saving)");
    expect(output[0]).toContain("Name: AirPods Pro");
    expect(output[0]).toContain("Category: audio");
    expect(output[0]).toContain("CLI: item add");
  });

  it("routes natural-language list and search to saved items", async () => {
    await setupStore();
    vi.spyOn(console, "log").mockImplementation((message?: unknown) => {
      output.push(String(message));
    });

    await run("item", "add", "--store", storePath, "--name", "Sony Headphones", "--category", "audio");
    await run("item", "add", "--store", storePath, "--name", "Nintendo Switch", "--category", "console");
    output.length = 0;

    await run("chat", "items", "搵", "Sony", "--store", storePath, "--format", "json");

    expect(JSON.parse(output.pop() ?? "{}")).toMatchObject({
      kind: "item_search",
      query: "Sony",
      items: [{ name: "Sony Headphones", category: "audio" }]
    });
  });

  it("mutates only an unambiguous natural-language target", async () => {
    await setupStore();
    vi.spyOn(console, "log").mockImplementation((message?: unknown) => {
      output.push(String(message));
    });

    await run("item", "add", "--store", storePath, "--name", "Sony Headphones", "--category", "audio");
    await run("item", "add", "--store", storePath, "--name", "Nintendo Switch", "--category", "console");
    output.length = 0;

    await run("chat", "mutate", "edit", "Sony", "改做", "location: 書房", "--store", storePath, "--format", "json");

    expect(JSON.parse(output.pop() ?? "{}")).toMatchObject({
      kind: "updated_item",
      action: "edit",
      item: { name: "Sony Headphones", location: "書房" }
    });
  });

  it("returns ambiguous mutation candidates without changing saved items", async () => {
    await setupStore();
    vi.spyOn(console, "log").mockImplementation((message?: unknown) => {
      output.push(String(message));
    });

    await run("item", "add", "--store", storePath, "--name", "Sony Headphones", "--category", "audio");
    await run("item", "add", "--store", storePath, "--name", "Sony Speaker", "--category", "audio");
    output.length = 0;

    await run("chat", "mutate", "delete", "Sony", "--store", storePath, "--format", "json");

    expect(JSON.parse(output.pop() ?? "{}")).toMatchObject({
      ok: false,
      error: {
        code: "AMBIGUOUS_ITEM",
        candidates: [{ name: "Sony Headphones" }, { name: "Sony Speaker" }]
      }
    });
    expect(process.exitCode).toBe(2);

    const stored = JSON.parse(await readFile(storePath, "utf8")) as { items: Array<{ status: string }> };
    expect(stored.items.map((item) => item.status)).toEqual(["active", "active"]);
  });

  it("confirms a parsed draft into a saved item", async () => {
    await setupStore();
    vi.spyOn(console, "log").mockImplementation((message?: unknown) => {
      output.push(String(message));
    });

    await run(
      "chat",
      "parse",
      "記低",
      "MacBook Pro，2026-05-30 買，AppleCare 到 2029-05-30，放書房",
      "--format",
      "json"
    );
    const parsedDraft = output.pop() ?? "{}";

    await run("chat", "confirm", "--draft-json", parsedDraft, "--store", storePath, "--format", "json");

    const confirmed = JSON.parse(output.pop() ?? "{}");
    expect(confirmed).toMatchObject({
      kind: "confirmed_item",
      item: {
        name: "MacBook Pro",
        category: "laptop",
        purchaseDate: "2026-05-30",
        warrantyEnd: "2029-05-30",
        location: "書房",
        status: "active"
      }
    });

    await run("item", "list", "--store", storePath, "--format", "json");
    expect(JSON.parse(output.pop() ?? "{}")).toMatchObject({
      items: [{ id: confirmed.item.id, name: "MacBook Pro" }]
    });
  });

  async function setupStore(): Promise<void> {
    tempDir = await mkdtemp(join(tmpdir(), "inventory-chat-cli-"));
    storePath = join(tempDir, "items.json");
  }

  async function run(...args: string[]): Promise<void> {
    await createProgram().parseAsync(["node", "inventory", ...args], { from: "node" });
  }
});

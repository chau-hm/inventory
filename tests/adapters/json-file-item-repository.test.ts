import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { JsonFileItemRepository } from "../../src/adapters/json-file-item-repository.js";

describe("JsonFileItemRepository", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "inventory-json-repo-"));
  });

  afterEach(async () => {
    await rm(tempDir, { force: true, recursive: true });
  });

  it("treats a missing store file as empty", async () => {
    const repository = new JsonFileItemRepository(join(tempDir, "missing.json"));

    await expect(repository.list()).resolves.toEqual([]);
  });

  it("treats an existing empty store file as empty", async () => {
    const storePath = join(tempDir, "items.json");
    await writeFile(storePath, "", "utf8");
    const repository = new JsonFileItemRepository(storePath);

    await expect(repository.list()).resolves.toEqual([]);
  });
});


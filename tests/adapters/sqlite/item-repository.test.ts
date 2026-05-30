import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ItemService, type SavedItem } from "../../../src/application/items.js";
import { openInventoryDatabase, type SqliteDatabase } from "../../../src/adapters/sqlite/database.js";
import { SqliteItemRepository } from "../../../src/adapters/sqlite/item-repository.js";

describe("SqliteItemRepository", () => {
  let tempDir: string;
  let sqlite: SqliteDatabase;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "inventory-sqlite-"));
    sqlite = openInventoryDatabase(join(tempDir, "inventory.sqlite"));
  });

  afterEach(async () => {
    sqlite.close();
    await rm(tempDir, { force: true, recursive: true });
  });

  it("creates a missing database and lists an empty store", async () => {
    const repository = new SqliteItemRepository(sqlite);

    await expect(repository.list()).resolves.toEqual([]);
  });

  it("round-trips saved items with optional fields", async () => {
    const repository = new SqliteItemRepository(sqlite);
    const item: SavedItem = {
      id: "itm_test_1",
      name: "MacBook Pro",
      category: "laptop",
      status: "active",
      brand: "Apple",
      model: "M4",
      serialNumber: "SER123",
      location: "Study",
      owner: "阿文",
      purchaseDate: "2026-05-30",
      purchasePriceMinor: 1888800,
      currency: "HKD",
      merchant: "Apple Store",
      warrantyStart: "2026-05-30",
      warrantyEnd: "2027-05-29",
      warrantyMonths: 12,
      notes: "Main work machine",
      createdAt: "2026-05-30T12:00:00Z",
      updatedAt: "2026-05-30T12:00:00Z"
    };

    await repository.saveAll([item]);

    await expect(repository.list()).resolves.toEqual([item]);
  });

  it("supports item service add, delete, and restore", async () => {
    const repository = new SqliteItemRepository(sqlite);
    const service = new ItemService({
      repository,
      now: () => "2026-05-30T12:00:00Z",
      idGenerator: () => "itm_sqlite_1"
    });

    const item = await service.add({ name: "Sony Headphones", category: "audio" });
    await service.delete(item.id);
    await expect(service.list({ status: "deleted" })).resolves.toMatchObject([{ id: item.id, status: "deleted" }]);

    await service.restore(item.id);

    await expect(service.list()).resolves.toMatchObject([{ id: item.id, status: "active" }]);
  });
});


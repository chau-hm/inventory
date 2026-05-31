import { describe, expect, it } from "vitest";
import { ItemService, type ItemRepository, type SavedItem } from "../../src/application/items.js";

class MemoryItemRepository implements ItemRepository {
  items: SavedItem[] = [];

  async list(): Promise<SavedItem[]> {
    return this.items;
  }

  async saveAll(items: SavedItem[]): Promise<void> {
    this.items = items;
  }
}

function createService(repository = new MemoryItemRepository()): { repository: MemoryItemRepository; service: ItemService } {
  let id = 0;
  const service = new ItemService({
    repository,
    now: () => "2026-05-30T12:00:00Z",
    idGenerator: () => `itm_test_${++id}`
  });
  return { repository, service };
}

describe("ItemService", () => {
  it("adds, lists, and details items", async () => {
    const { service } = createService();

    const item = await service.add({ name: "MacBook Pro", category: "laptop" });

    expect(item).toMatchObject({
      id: "itm_test_1",
      name: "MacBook Pro",
      category: "laptop",
      status: "active",
      createdAt: "2026-05-30T12:00:00Z",
      updatedAt: "2026-05-30T12:00:00Z"
    });
    await expect(service.list()).resolves.toEqual([item]);
    await expect(service.detail("itm_test_1")).resolves.toEqual(item);
  });

  it("edits an item while preserving id and createdAt", async () => {
    const { service } = createService();
    const item = await service.add({ name: "MacBook Pro", category: "laptop" });

    const updated = await service.edit(item.id, { location: "Study", brand: "Apple" });

    expect(updated).toMatchObject({
      id: item.id,
      createdAt: item.createdAt,
      location: "Study",
      brand: "Apple"
    });
  });

  it("soft deletes and restores an item", async () => {
    const { service } = createService();
    const item = await service.add({ name: "Old iPhone", category: "phone" });

    const deleted = await service.delete(item.id);

    expect(deleted.status).toBe("deleted");
    expect(deleted.deletedAt).toBe("2026-05-30T12:00:00Z");
    await expect(service.list()).resolves.toEqual([]);
    await expect(service.list({ status: "deleted" })).resolves.toEqual([deleted]);

    const restored = await service.restore(item.id);

    expect(restored.status).toBe("active");
    expect(restored.deletedAt).toBeUndefined();
    await expect(service.list()).resolves.toEqual([restored]);
  });

  it("returns candidates and does not mutate when target is ambiguous", async () => {
    const { repository, service } = createService();
    await service.add({ name: "Sony Headphones", category: "audio", serialNumber: "A1" });
    await service.add({ name: "Sony Speaker", category: "audio", serialNumber: "B2" });

    await expect(service.delete("Sony")).rejects.toMatchObject({
      code: "AMBIGUOUS_ITEM",
      candidates: expect.arrayContaining([expect.objectContaining({ id: "itm_test_1" }), expect.objectContaining({ id: "itm_test_2" })])
    });
    expect(repository.items.map((item) => item.status)).toEqual(["active", "active"]);
  });

  it("searches active items by item fields", async () => {
    const { service } = createService();
    const headphones = await service.add({ name: "Sony Headphones", category: "audio", serialNumber: "A1" });
    await service.add({ name: "Nintendo Switch", category: "console", serialNumber: "B2" });

    await expect(service.search("sony")).resolves.toEqual([headphones]);
    await expect(service.search("A1")).resolves.toEqual([headphones]);
  });
});

import { randomUUID } from "node:crypto";
import type { ItemDraft, ItemStatus } from "../domain/item.js";
import { validateItemDraft } from "../domain/item.js";

export interface SavedItem extends ItemDraft {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface ItemRepository {
  list(): Promise<SavedItem[]>;
  saveAll(items: SavedItem[]): Promise<void>;
}

export interface ItemServiceOptions {
  repository: ItemRepository;
  now?: () => string;
  idGenerator?: () => string;
}

export interface ItemListOptions {
  status?: ItemStatus | "all";
}

export type ItemPatch = Partial<Omit<ItemDraft, "id" | "createdAt" | "updatedAt" | "deletedAt">>;

export interface TargetResolutionError extends Error {
  code: "ITEM_NOT_FOUND" | "AMBIGUOUS_ITEM";
  candidates: SavedItem[];
}

export class ItemService {
  private readonly repository: ItemRepository;
  private readonly now: () => string;
  private readonly idGenerator: () => string;

  constructor(options: ItemServiceOptions) {
    this.repository = options.repository;
    this.now = options.now ?? (() => new Date().toISOString());
    this.idGenerator = options.idGenerator ?? (() => `itm_${randomUUID().replaceAll("-", "").slice(0, 12)}`);
  }

  async add(input: unknown): Promise<SavedItem> {
    const draft = validateItemDraft(input);
    const timestamp = this.now();
    const item: SavedItem = {
      ...draft,
      id: this.idGenerator(),
      createdAt: timestamp,
      updatedAt: timestamp
    };
    validateItemDraft(item);
    const items = await this.repository.list();
    await this.repository.saveAll([...items, item]);
    return item;
  }

  async list(options: ItemListOptions = {}): Promise<SavedItem[]> {
    const status = options.status ?? "active";
    const items = await this.repository.list();
    if (status === "all") {
      return items;
    }
    return items.filter((item) => item.status === status);
  }

  async detail(target: string): Promise<SavedItem> {
    const items = await this.repository.list();
    return resolveSingleTarget(items, target, "all");
  }

  async edit(target: string, patch: ItemPatch): Promise<SavedItem> {
    const items = await this.repository.list();
    const item = resolveSingleTarget(items, target, "not_deleted");
    const updated: SavedItem = {
      ...item,
      ...patch,
      updatedAt: this.now()
    };
    validateItemDraft(updated);
    await this.repository.saveAll(replaceItem(items, updated));
    return updated;
  }

  async delete(target: string): Promise<SavedItem> {
    const items = await this.repository.list();
    const item = resolveSingleTarget(items, target, "not_deleted");
    const timestamp = this.now();
    const deleted: SavedItem = {
      ...item,
      status: "deleted",
      deletedAt: timestamp,
      updatedAt: timestamp
    };
    validateItemDraft(deleted);
    await this.repository.saveAll(replaceItem(items, deleted));
    return deleted;
  }

  async restore(target: string): Promise<SavedItem> {
    const items = await this.repository.list();
    const item = resolveSingleTarget(items, target, "deleted");
    const restored: SavedItem = {
      ...item,
      status: "active",
      deletedAt: undefined,
      updatedAt: this.now()
    };
    validateItemDraft(restored);
    await this.repository.saveAll(replaceItem(items, restored));
    return restored;
  }
}

export function resolveSingleTarget(
  items: SavedItem[],
  target: string,
  scope: "all" | "deleted" | "not_deleted"
): SavedItem {
  const exact = items.find((item) => item.id === target);
  if (exact !== undefined) {
    if (scope === "deleted" && exact.status !== "deleted") {
      throw targetError("ITEM_NOT_FOUND", []);
    }
    if (scope === "not_deleted" && exact.status === "deleted") {
      throw targetError("ITEM_NOT_FOUND", []);
    }
    return exact;
  }

  const candidates = searchableItems(items, scope).filter((item) => itemMatchesQuery(item, target));
  if (candidates.length === 1) {
    return candidates[0] as SavedItem;
  }
  if (candidates.length > 1) {
    throw targetError("AMBIGUOUS_ITEM", candidates);
  }
  throw targetError("ITEM_NOT_FOUND", []);
}

function searchableItems(items: SavedItem[], scope: "all" | "deleted" | "not_deleted"): SavedItem[] {
  if (scope === "deleted") {
    return items.filter((item) => item.status === "deleted");
  }
  if (scope === "not_deleted") {
    return items.filter((item) => item.status !== "deleted");
  }
  return items;
}

function itemMatchesQuery(item: SavedItem, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  return [
    item.name,
    item.category,
    item.brand,
    item.model,
    item.serialNumber,
    item.location,
    item.owner,
    item.merchant,
    item.notes
  ]
    .filter((value): value is string => value !== undefined)
    .some((value) => value.toLowerCase().includes(normalizedQuery));
}

function replaceItem(items: SavedItem[], replacement: SavedItem): SavedItem[] {
  return items.map((item) => (item.id === replacement.id ? replacement : item));
}

function targetError(code: TargetResolutionError["code"], candidates: SavedItem[]): TargetResolutionError {
  const error = new Error(code === "AMBIGUOUS_ITEM" ? "Multiple matching items found." : "Item not found.") as TargetResolutionError;
  error.code = code;
  error.candidates = candidates;
  return error;
}


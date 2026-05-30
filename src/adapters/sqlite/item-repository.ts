import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { ItemRepository, SavedItem } from "../../application/items.js";
import { validateItemDraft } from "../../domain/item.js";
import type { SqliteDatabase } from "./database.js";
import { ensureInventorySchema } from "./database.js";
import { itemsTable } from "./schema.js";

type InventoryDatabase = BetterSQLite3Database<Record<string, never>>;

type ItemRow = typeof itemsTable.$inferSelect;
type ItemInsert = typeof itemsTable.$inferInsert;

export class SqliteItemRepository implements ItemRepository {
  private readonly db: InventoryDatabase;

  constructor(sqlite: SqliteDatabase) {
    ensureInventorySchema(sqlite);
    this.db = drizzle(sqlite);
  }

  async list(): Promise<SavedItem[]> {
    const rows = this.db.select().from(itemsTable).all();
    return rows.map(rowToItem);
  }

  async saveAll(items: SavedItem[]): Promise<void> {
    const normalized = items.map((item) => {
      const parsed = validateItemDraft(item);
      return itemToInsert({
        ...parsed,
        id: item.id,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
      });
    });

    this.db.transaction((tx) => {
      tx.delete(itemsTable).run();
      if (normalized.length > 0) {
        tx.insert(itemsTable).values(normalized).run();
      }
    });
  }
}

function rowToItem(row: ItemRow): SavedItem {
  return stripUndefined({
    id: row.id,
    name: row.name,
    category: row.category,
    status: row.status as SavedItem["status"],
    brand: row.brand ?? undefined,
    model: row.model ?? undefined,
    serialNumber: row.serialNumber ?? undefined,
    location: row.location ?? undefined,
    owner: row.owner ?? undefined,
    purchaseDate: row.purchaseDate ?? undefined,
    purchasePriceMinor: row.purchasePriceMinor ?? undefined,
    currency: row.currency ?? undefined,
    merchant: row.merchant ?? undefined,
    warrantyStart: row.warrantyStart ?? undefined,
    warrantyEnd: row.warrantyEnd ?? undefined,
    warrantyMonths: row.warrantyMonths ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt ?? undefined
  });
}

function itemToInsert(item: SavedItem): ItemInsert {
  return {
    id: item.id,
    name: item.name,
    category: item.category,
    status: item.status,
    brand: item.brand ?? null,
    model: item.model ?? null,
    serialNumber: item.serialNumber ?? null,
    location: item.location ?? null,
    owner: item.owner ?? null,
    purchaseDate: item.purchaseDate ?? null,
    purchasePriceMinor: item.purchasePriceMinor ?? null,
    currency: item.currency ?? null,
    merchant: item.merchant ?? null,
    warrantyStart: item.warrantyStart ?? null,
    warrantyEnd: item.warrantyEnd ?? null,
    warrantyMonths: item.warrantyMonths ?? null,
    notes: item.notes ?? null,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    deletedAt: item.deletedAt ?? null
  };
}

function stripUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}

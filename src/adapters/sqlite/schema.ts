import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const itemsTable = sqliteTable("items", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  status: text("status").notNull(),
  brand: text("brand"),
  model: text("model"),
  serialNumber: text("serial_number"),
  location: text("location"),
  owner: text("owner"),
  purchaseDate: text("purchase_date"),
  purchasePriceMinor: integer("purchase_price_minor"),
  currency: text("currency"),
  merchant: text("merchant"),
  warrantyStart: text("warranty_start"),
  warrantyEnd: text("warranty_end"),
  warrantyMonths: integer("warranty_months"),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  deletedAt: text("deleted_at")
});


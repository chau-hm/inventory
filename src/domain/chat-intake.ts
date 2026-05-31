export interface ChatItemDraft {
  name: string;
  category: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  location?: string;
  owner?: string;
  purchaseDate?: string;
  purchasePriceMinor?: number;
  currency?: string;
  merchant?: string;
  warrantyEnd?: string;
  warrantyMonths?: number;
  notes?: string;
  sourceText: string;
  commandArgs: string[];
  needsConfirmation: true;
}

export type ChatItemParseResult =
  | {
    kind: "draft";
    draft: ChatItemDraft;
  }
  | {
    kind: "needs_clarification";
    missing: Array<"name" | "category">;
    sourceText: string;
  };

export type ChatItemIntent =
  | {
    kind: "item_list";
    status: "active" | "deleted" | "all";
    commandArgs: string[];
    sourceText: string;
  }
  | {
    kind: "item_search";
    query: string;
    status: "active" | "deleted" | "all";
    commandArgs: string[];
    sourceText: string;
  };

export type ChatItemMutationIntent =
  | {
    kind: "item_mutation";
    action: "delete" | "restore";
    target: string;
    commandArgs: string[];
    sourceText: string;
  }
  | {
    kind: "item_mutation";
    action: "edit";
    target: string;
    patch: ChatItemPatch;
    commandArgs: string[];
    sourceText: string;
  }
  | {
    kind: "needs_clarification";
    missing: Array<"target" | "patch">;
    sourceText: string;
  };

export type ChatItemPatch = {
  name?: string;
  category?: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  location?: string;
  owner?: string;
  purchaseDate?: string;
  purchasePriceMinor?: number;
  currency?: string;
  merchant?: string;
  warrantyEnd?: string;
  warrantyMonths?: number;
  notes?: string;
};

const isoDatePattern = /\b\d{4}-\d{2}-\d{2}\b/;

export function parseChatItem(input: string): ChatItemParseResult {
  const sourceText = input.trim();
  const name = inferName(sourceText);
  const category = inferCategory(sourceText, name);
  const missing: Array<"name" | "category"> = [];

  if (name === undefined) {
    missing.push("name");
  }
  if (category === undefined) {
    missing.push("category");
  }
  if (missing.length > 0) {
    return { kind: "needs_clarification", missing, sourceText };
  }

  const draftWithoutArgs = {
    name,
    category,
    brand: inferBrand(sourceText, name),
    model: inferModel(sourceText),
    serialNumber: inferSerialNumber(sourceText),
    location: inferLocation(sourceText),
    owner: inferOwner(sourceText),
    purchaseDate: inferPurchaseDate(sourceText),
    ...inferPrice(sourceText),
    merchant: inferMerchant(sourceText),
    warrantyEnd: inferWarrantyEnd(sourceText),
    warrantyMonths: inferWarrantyMonths(sourceText),
    notes: inferNotes(sourceText),
    sourceText,
    needsConfirmation: true as const
  };
  const draft = stripUndefined(draftWithoutArgs) as Omit<ChatItemDraft, "commandArgs">;

  return {
    kind: "draft",
    draft: {
      ...draft,
      commandArgs: buildItemAddArgs(draft)
    }
  };
}

export function parseChatItemIntent(input: string): ChatItemIntent {
  const sourceText = input.trim();
  const match = sourceText.match(/^(?:list|show|items?|inventory|search|find|查|搵|搜尋|列出?|睇)(?:\b|\s)*(.*)$/i);
  const rawQuery = (match?.[1] ?? sourceText)
    .replace(/^(?:items?|inventory|物品|物件|記錄)\b\s*/i, "")
    .trim();
  const status = inferStatus(sourceText);
  const query = rawQuery
    .replace(/\b(?:active|deleted|all)\b/gi, "")
    .replace(/(?:已刪除|刪除咗|全部|所有|現有|有效)/g, "")
    .trim();

  if (!query || /^(?:list|show|items?|inventory|列出?|睇)$/i.test(sourceText)) {
    return {
      kind: "item_list",
      status,
      commandArgs: ["item", "list", "--status", status],
      sourceText
    };
  }

  return {
    kind: "item_search",
    query,
    status,
    commandArgs: ["chat", "items", query, "--status", status],
    sourceText
  };
}

export function parseChatItemMutationIntent(input: string): ChatItemMutationIntent {
  const sourceText = input.trim();
  const match = sourceText.match(/^(edit|update|change|修改|更改|改|delete|remove|del|刪除|删除|restore|undelete|還原|復原)\b\s*(.*)$/i);
  if (!match) {
    return { kind: "needs_clarification", missing: ["target"], sourceText };
  }

  const action = normalizeMutationAction(match[1]);
  const [target, correction] = splitMutationRemainder(action, match[2].trim());
  if (!target) {
    return { kind: "needs_clarification", missing: ["target"], sourceText };
  }

  if (action !== "edit") {
    return {
      kind: "item_mutation",
      action,
      target,
      commandArgs: ["item", action, target],
      sourceText
    };
  }

  const patch = parseChatItemPatch(correction ?? "");
  if (Object.keys(patch).length === 0) {
    return { kind: "needs_clarification", missing: ["patch"], sourceText };
  }

  return {
    kind: "item_mutation",
    action,
    target,
    patch,
    commandArgs: ["item", "edit", target, ...buildItemPatchArgs(patch)],
    sourceText
  };
}

function parseChatItemPatch(text: string): ChatItemPatch {
  return stripUndefined({
    name: text.match(/(?:name|名稱|名字)\s*[:：=]\s*([^,，;；。]+)/i)?.[1]?.trim(),
    category: inferCategory(text),
    brand: inferBrand(text),
    model: inferModel(text),
    serialNumber: inferSerialNumber(text),
    location: inferLocation(text),
    owner: inferOwner(text),
    purchaseDate: inferPurchaseDate(text),
    ...inferPrice(text),
    merchant: inferMerchant(text),
    warrantyEnd: inferWarrantyEnd(text),
    warrantyMonths: inferWarrantyMonths(text),
    notes: inferNotes(text)
  }) as ChatItemPatch;
}

function inferName(text: string): string | undefined {
  const explicit = text.match(/(?:name|名稱|名字)\s*[:：=]\s*([^,，;；。]+)/i)?.[1]?.trim();
  if (explicit) {
    return explicit;
  }

  const withoutLead = text
    .replace(/^(?:\/?inventory\s+)?(?:記低|记录|新增|加入|add|save|bought|買咗|買左|我買咗|我買左)\s*/i, "")
    .trim();
  const firstClause = withoutLead.split(/[，,。;；]/)[0]?.trim();
  const name = firstClause
    ?.replace(/\b\d{4}-\d{2}-\d{2}\b/g, "")
    .replace(/(?:買|購入|bought|purchased|放|放喺|放在|喺|在|保養|warranty|到|至|until).*/i, "")
    .trim();

  return name || undefined;
}

function inferCategory(text: string, name?: string): string | undefined {
  const explicit = text.match(/(?:category|分類|類別)\s*[:：=]?\s*([a-z][a-z0-9_-]*)/i)?.[1]?.toLowerCase();
  if (explicit) {
    return explicit;
  }

  const haystack = `${text} ${name ?? ""}`.toLowerCase();
  if (/(macbook|laptop|notebook|手提電腦|筆電)/i.test(haystack)) {
    return "laptop";
  }
  if (/(iphone|電話|手機|phone)/i.test(haystack)) {
    return "phone";
  }
  if (/(ipad|tablet|平板)/i.test(haystack)) {
    return "tablet";
  }
  if (/(airpods|headphones|earbuds|耳機|headset)/i.test(haystack)) {
    return "audio";
  }
  if (/(switch|playstation|xbox|console|遊戲機)/i.test(haystack)) {
    return "console";
  }
  if (/(camera|相機|鏡頭|lens)/i.test(haystack)) {
    return "camera";
  }
  if (/(washing machine|washer|雪櫃|冰箱|洗衣機|抽濕機|吸塵機|電視|tv|appliance)/i.test(haystack)) {
    return "appliance";
  }
  return undefined;
}

function inferBrand(text: string, name?: string): string | undefined {
  const explicit = text.match(/(?:brand|品牌)\s*[:：=]\s*([^,，;；。]+)/i)?.[1]?.trim();
  if (explicit) {
    return explicit;
  }

  if (/applecare/i.test(text)) {
    return "Apple";
  }

  const brands = ["Apple", "Sony", "Nintendo", "Samsung", "LG", "Dyson", "Panasonic", "Canon", "Nikon", "Fujifilm"];
  const haystack = `${text} ${name ?? ""}`;
  return brands.find((brand) => new RegExp(`\\b${brand}\\b`, "i").test(haystack));
}

function inferModel(text: string): string | undefined {
  return text.match(/(?:model|型號)\s*[:：=]\s*([^,，;；。]+)/i)?.[1]?.trim();
}

function inferSerialNumber(text: string): string | undefined {
  return text.match(/(?:serial|s\/n|sn|序號|機身號碼)\s*[:：=]?\s*([A-Z0-9-]+)/i)?.[1]?.trim();
}

function inferLocation(text: string): string | undefined {
  return text.match(/(?:location|位置|放喺|放在|放|喺|在)\s*[:：=]?\s*([^,，;；。]+)/i)?.[1]?.trim();
}

function inferOwner(text: string): string | undefined {
  return text.match(/(?:owner|物主|屬於|属于)\s*[:：=]?\s*([^,，;；。]+)/i)?.[1]?.trim();
}

function inferPurchaseDate(text: string): string | undefined {
  return text.match(new RegExp(`(${isoDatePattern.source})\\s*(?:買|購入|bought|purchased)`, "i"))?.[1]
    ?? text.match(/(?:purchase date|購買日期|購入日期|買咗|買左)\s*[:：=]?\s*(\d{4}-\d{2}-\d{2})/i)?.[1];
}

function inferWarrantyEnd(text: string): string | undefined {
  return text.match(/(?:warranty|保養|保固|applecare)[^,，;；。]*?(?:到|至|until|end|ends?)\s*(\d{4}-\d{2}-\d{2})/i)?.[1]
    ?? text.match(/(?:warranty end|保養到期|保固到期)\s*[:：=]?\s*(\d{4}-\d{2}-\d{2})/i)?.[1];
}

function inferWarrantyMonths(text: string): number | undefined {
  const match = text.match(/(?:warranty|保養|保固)[^,，;；。]*?(\d+)\s*(?:months?|個月|月)/i);
  return match ? Number(match[1]) : undefined;
}

function inferMerchant(text: string): string | undefined {
  return text.match(/(?:merchant|supplier|shop|商戶|店|喺)\s*[:：=]?\s*([^,，;；。]+?)\s*(?:買|購入|bought|purchased)/i)?.[1]?.trim();
}

function inferNotes(text: string): string | undefined {
  return text.match(/(?:notes?|備註)\s*[:：=]\s*(.+)$/i)?.[1]?.trim();
}

function inferStatus(text: string): "active" | "deleted" | "all" {
  if (/\b(all)\b|全部|所有/i.test(text)) {
    return "all";
  }
  if (/\b(deleted)\b|已刪除|刪除咗/i.test(text)) {
    return "deleted";
  }
  return "active";
}

function inferPrice(text: string): { purchasePriceMinor?: number; currency?: string } {
  const match = text.match(/(?:(HKD|USD|JPY|港幣|美元|日圓|日元)\s*|\$)\s*(\d+(?:\.\d{1,2})?)/i);
  if (!match) {
    return {};
  }
  const currency = normalizeCurrency(match[1], match[0].includes("$") ? "$" : undefined) ?? "HKD";
  return {
    purchasePriceMinor: decimalToMinorUnits(match[2], currency),
    currency
  };
}

function normalizeCurrency(value?: string, dollarSign?: string): string | undefined {
  if (!value && dollarSign) {
    return "HKD";
  }
  const upper = value?.toUpperCase();
  if (upper === "HKD" || value === "港幣") {
    return "HKD";
  }
  if (upper === "USD" || value === "美元") {
    return "USD";
  }
  if (upper === "JPY" || value === "日圓" || value === "日元") {
    return "JPY";
  }
  return undefined;
}

function decimalToMinorUnits(value: string, currency: string): number {
  const [major, rawMinor = ""] = value.split(".");
  if (currency === "JPY") {
    return Number(major);
  }
  return Number(major) * 100 + Number(rawMinor.padEnd(2, "0").slice(0, 2) || "0");
}

function buildItemAddArgs(draft: Omit<ChatItemDraft, "commandArgs">): string[] {
  return [
    "item",
    "add",
    "--name",
    draft.name,
    "--category",
    draft.category,
    ...optionalArg("--brand", draft.brand),
    ...optionalArg("--model", draft.model),
    ...optionalArg("--serial", draft.serialNumber),
    ...optionalArg("--location", draft.location),
    ...optionalArg("--owner", draft.owner),
    ...optionalArg("--purchase-date", draft.purchaseDate),
    ...optionalArg("--purchase-price-minor", draft.purchasePriceMinor?.toString()),
    ...optionalArg("--currency", draft.currency),
    ...optionalArg("--merchant", draft.merchant),
    ...optionalArg("--warranty-end", draft.warrantyEnd),
    ...optionalArg("--warranty-months", draft.warrantyMonths?.toString()),
    ...optionalArg("--notes", draft.notes)
  ];
}

function buildItemPatchArgs(patch: ChatItemPatch): string[] {
  return [
    ...optionalArg("--name", patch.name),
    ...optionalArg("--category", patch.category),
    ...optionalArg("--brand", patch.brand),
    ...optionalArg("--model", patch.model),
    ...optionalArg("--serial", patch.serialNumber),
    ...optionalArg("--location", patch.location),
    ...optionalArg("--owner", patch.owner),
    ...optionalArg("--purchase-date", patch.purchaseDate),
    ...optionalArg("--purchase-price-minor", patch.purchasePriceMinor?.toString()),
    ...optionalArg("--currency", patch.currency),
    ...optionalArg("--merchant", patch.merchant),
    ...optionalArg("--warranty-end", patch.warrantyEnd),
    ...optionalArg("--warranty-months", patch.warrantyMonths?.toString()),
    ...optionalArg("--notes", patch.notes)
  ];
}

function normalizeMutationAction(value: string): "edit" | "delete" | "restore" {
  if (/^(delete|remove|del|刪除|删除)$/i.test(value)) {
    return "delete";
  }
  if (/^(restore|undelete|還原|復原)$/i.test(value)) {
    return "restore";
  }
  return "edit";
}

function splitMutationRemainder(action: "edit" | "delete" | "restore", remainder: string): [string | undefined, string | undefined] {
  if (!remainder) {
    return [undefined, undefined];
  }
  if (action !== "edit") {
    return [remainder, undefined];
  }

  const marker = remainder.match(/\s(?:改做|改成|to|做|變成|change to|set|設定|改為)\s/i);
  if (marker?.index !== undefined) {
    const target = remainder.slice(0, marker.index).trim();
    const correction = remainder.slice(marker.index).replace(/^(?:\s*)(?:改做|改成|to|做|變成|change to|set|設定|改為)\s*/i, "").trim();
    return [target || undefined, correction || undefined];
  }

  const words = remainder.split(/\s+/);
  if (words[0]?.startsWith("itm_") && words.length > 1) {
    return [words[0], words.slice(1).join(" ")];
  }

  return [remainder, undefined];
}

function optionalArg(flag: string, value?: string): string[] {
  return value === undefined || value === "" ? [] : [flag, value];
}

function stripUndefined<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Partial<T>;
}

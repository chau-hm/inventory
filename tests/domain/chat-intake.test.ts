import { describe, expect, it } from "vitest";
import { parseChatItem, parseChatItemIntent, parseChatItemMutationIntent } from "../../src/domain/chat-intake.js";

describe("parseChatItem", () => {
  it("parses a Cantonese item note into a non-mutating add draft", () => {
    expect(parseChatItem("記低 MacBook Pro，2026-05-30 買，AppleCare 到 2029-05-30，放書房")).toEqual({
      kind: "draft",
      draft: expect.objectContaining({
        name: "MacBook Pro",
        category: "laptop",
        brand: "Apple",
        purchaseDate: "2026-05-30",
        warrantyEnd: "2029-05-30",
        location: "書房",
        needsConfirmation: true,
        commandArgs: [
          "item",
          "add",
          "--name",
          "MacBook Pro",
          "--category",
          "laptop",
          "--brand",
          "Apple",
          "--location",
          "書房",
          "--purchase-date",
          "2026-05-30",
          "--warranty-end",
          "2029-05-30"
        ]
      })
    });
  });

  it("parses explicit English fields and purchase price", () => {
    expect(
      parseChatItem("add name: Sony WH-1000XM5, category: audio, serial SN123, HKD 2899, location: Bedroom")
    ).toEqual({
      kind: "draft",
      draft: expect.objectContaining({
        name: "Sony WH-1000XM5",
        category: "audio",
        brand: "Sony",
        serialNumber: "SN123",
        purchasePriceMinor: 289900,
        currency: "HKD",
        location: "Bedroom"
      })
    });
  });

  it("asks for clarification when category cannot be inferred", () => {
    expect(parseChatItem("記低 mystery thing")).toEqual({
      kind: "needs_clarification",
      missing: ["category"],
      sourceText: "記低 mystery thing"
    });
  });
});

describe("parseChatItemIntent", () => {
  it("parses list and search intents", () => {
    expect(parseChatItemIntent("list")).toEqual({
      kind: "item_list",
      status: "active",
      commandArgs: ["item", "list", "--status", "active"],
      sourceText: "list"
    });

    expect(parseChatItemIntent("搵 Sony 耳機")).toEqual({
      kind: "item_search",
      query: "Sony 耳機",
      status: "active",
      commandArgs: ["chat", "items", "Sony 耳機", "--status", "active"],
      sourceText: "搵 Sony 耳機"
    });
  });
});

describe("parseChatItemMutationIntent", () => {
  it("parses delete, restore, and edit intents", () => {
    expect(parseChatItemMutationIntent("delete Sony")).toEqual({
      kind: "item_mutation",
      action: "delete",
      target: "Sony",
      commandArgs: ["item", "delete", "Sony"],
      sourceText: "delete Sony"
    });

    expect(parseChatItemMutationIntent("restore itm_123")).toEqual({
      kind: "item_mutation",
      action: "restore",
      target: "itm_123",
      commandArgs: ["item", "restore", "itm_123"],
      sourceText: "restore itm_123"
    });

    expect(parseChatItemMutationIntent("edit MacBook 改做 location: 書房")).toEqual({
      kind: "item_mutation",
      action: "edit",
      target: "MacBook",
      patch: { location: "書房" },
      commandArgs: ["item", "edit", "MacBook", "--location", "書房"],
      sourceText: "edit MacBook 改做 location: 書房"
    });
  });
});

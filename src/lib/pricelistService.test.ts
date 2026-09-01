import { describe, it, expect } from "vitest";
import { DEFAULT_PRICELIST_SETTINGS } from "./pricelistService";

describe("pricelistService", () => {
  it("should have correct default settings for Tanabrew", () => {
    expect(DEFAULT_PRICELIST_SETTINGS).toBeDefined();
    expect(DEFAULT_PRICELIST_SETTINGS.title).toContain("Tanabrew");
    expect(DEFAULT_PRICELIST_SETTINGS.whatsapp_number).toBe("62895392770243");
    expect(DEFAULT_PRICELIST_SETTINGS.instagram_username).toBe("tanabrew.id");
  });
});

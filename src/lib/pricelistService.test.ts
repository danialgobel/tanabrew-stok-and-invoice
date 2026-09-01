import { describe, it, expect } from "vitest";
import { DEFAULT_PRICELIST_SETTINGS, DEFAULT_PRICELIST_IMAGE } from "./pricelistService";

describe("pricelistService", () => {
  it("should have correct default settings for Tanabrew", () => {
    expect(DEFAULT_PRICELIST_SETTINGS).toBeDefined();
    expect(DEFAULT_PRICELIST_SETTINGS.image_url).toBe(DEFAULT_PRICELIST_IMAGE);
  });
});

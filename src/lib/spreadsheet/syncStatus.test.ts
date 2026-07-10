import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { markPending, markSynced, markFailed } from "./syncStatus";
import { updateDoc } from "firebase/firestore";

vi.mock("firebase/firestore", () => {
  return {
    doc: vi.fn().mockImplementation((_db, _collection, id) => `mock-doc-ref-${id}`),
    updateDoc: vi.fn(),
    serverTimestamp: () => "mock-server-timestamp",
  };
});

vi.mock("@/lib/firebase", () => {
  return {
    db: {},
  };
});

describe("syncStatus helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("markPending should update Firestore state to PENDING", async () => {
    vi.mocked(updateDoc).mockResolvedValue(undefined as any);

    await markPending("invoice-123");

    expect(updateDoc).toHaveBeenCalledTimes(1);
    expect(updateDoc).toHaveBeenCalledWith("mock-doc-ref-invoice-123", {
      spreadsheetSyncStatus: "PENDING",
    });
  });

  it("markSynced should update Firestore state to SYNCED with serverTimestamp", async () => {
    vi.mocked(updateDoc).mockResolvedValue(undefined as any);

    await markSynced("invoice-123");

    expect(updateDoc).toHaveBeenCalledTimes(1);
    expect(updateDoc).toHaveBeenCalledWith("mock-doc-ref-invoice-123", {
      spreadsheetSyncStatus: "SYNCED",
      spreadsheetSyncedAt: "mock-server-timestamp",
    });
  });

  it("markFailed should update Firestore state to FAILED", async () => {
    vi.mocked(updateDoc).mockResolvedValue(undefined as any);

    await markFailed("invoice-123");

    expect(updateDoc).toHaveBeenCalledTimes(1);
    expect(updateDoc).toHaveBeenCalledWith("mock-doc-ref-invoice-123", {
      spreadsheetSyncStatus: "FAILED",
    });
  });
});

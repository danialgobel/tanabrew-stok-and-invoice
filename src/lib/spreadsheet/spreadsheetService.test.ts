import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SpreadsheetService, SpreadsheetError } from "./spreadsheetService";

describe("SpreadsheetService", () => {
  let service: SpreadsheetService;
  const mockBaseUrl = "https://example.com/macros/exec";

  beforeEach(() => {
    // Setup service with small timeout and retries for faster test execution
    service = new SpreadsheetService(mockBaseUrl, { timeout: 100, retries: 2 });
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("should successfully perform GET request and parse JSON response", async () => {
    const mockResponseData = { status: "success", data: "test" };
    const mockResponse = {
      ok: true,
      headers: {
        get: (name: string) => (name.toLowerCase() === "content-type" ? "application/json" : null),
      },
      json: async () => mockResponseData,
    };
    (global.fetch as any).mockResolvedValue(mockResponse);

    const result = await service.get<{ status: string; data: string }>("?action=test");

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://example.com/macros/exec?action=test",
      expect.objectContaining({
        method: "GET",
        redirect: "follow",
      })
    );
    expect(result).toEqual(mockResponseData);
  });

  it("should perform POST request with body and correct headers", async () => {
    const mockResponseData = { success: true };
    const mockResponse = {
      ok: true,
      headers: {
        get: (name: string) => (name.toLowerCase() === "content-type" ? "application/json" : null),
      },
      json: async () => mockResponseData,
    };
    (global.fetch as any).mockResolvedValue(mockResponse);

    const body = { key: "value" };
    const result = await service.post<{ success: boolean }>("", body);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://example.com/macros/exec",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(body),
        headers: expect.objectContaining({
          "Content-Type": "text/plain",
        }),
      })
    );
    expect(result).toEqual(mockResponseData);
  });

  it("should perform PUT and DELETE requests successfully", async () => {
    const mockResponse = {
      ok: true,
      headers: {
        get: (name: string) => (name.toLowerCase() === "content-type" ? "text/plain" : null),
      },
      text: async () => "Updated",
    };
    (global.fetch as any).mockResolvedValue(mockResponse);

    const putResult = await service.put<string>("", { test: "put" });
    expect(putResult).toBe("Updated");
    expect(global.fetch).toHaveBeenCalledWith(
      "https://example.com/macros/exec",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ test: "put" }),
      })
    );

    const deleteResult = await service.delete<string>("", { id: "1" });
    expect(deleteResult).toBe("Updated");
    expect(global.fetch).toHaveBeenCalledWith(
      "https://example.com/macros/exec",
      expect.objectContaining({
        method: "DELETE",
        body: JSON.stringify({ id: "1" }),
      })
    );
  });

  it("should retry failed requests and succeed if a later attempt is successful", async () => {
    const mockSuccessResponse = {
      ok: true,
      headers: {
        get: () => "application/json",
      },
      json: async () => ({ status: "ok" }),
    };

    // First attempt fails, second fails, third succeeds
    (global.fetch as any)
      .mockRejectedValueOnce(new TypeError("Network error"))
      .mockRejectedValueOnce(new TypeError("Network error"))
      .mockResolvedValueOnce(mockSuccessResponse);

    const result = await service.get("");
    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(result).toEqual({ status: "ok" });
  });

  it("should throw SpreadsheetError after exceeding max retries", async () => {
    (global.fetch as any).mockRejectedValue(new TypeError("Network error"));

    await expect(service.get("")).rejects.toThrow(SpreadsheetError);
    expect(global.fetch).toHaveBeenCalledTimes(3); // Initial + 2 retries
  });

  it("should throw SpreadsheetError on non-ok HTTP responses", async () => {
    const mockErrorResponse = {
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      headers: {
        get: () => "text/plain",
      },
      text: async () => "Error occurred",
    };
    (global.fetch as any).mockResolvedValue(mockErrorResponse);

    await expect(service.get("")).rejects.toThrow(
      new SpreadsheetError("HTTP error! status: 500", {
        status: 500,
        statusText: "Internal Server Error",
        body: "Error occurred",
      })
    );
  });

  it("should timeout when request takes longer than specified timeout duration", async () => {
    let resolvePromise: any;
    const pendingPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });

    (global.fetch as any).mockImplementation((_url: string, options: any) => {
      // Return a promise that doesn't resolve immediately to simulate latency
      return new Promise((resolve, reject) => {
        const checkSignal = () => {
          if (options.signal?.aborted) {
            const err = new DOMException("The user aborted a request.", "AbortError");
            reject(err);
            resolvePromise();
          } else {
            setTimeout(checkSignal, 10);
          }
        };
        checkSignal();
      });
    });

    // Use a very short timeout for this test
    const timeoutService = new SpreadsheetService(mockBaseUrl, { timeout: 10, retries: 0 });
    
    await expect(timeoutService.get("")).rejects.toThrow(
      new SpreadsheetError("Request timed out after 10ms", {
        status: 408,
        statusText: "Request Timeout",
      })
    );

    // Ensure the fake fetch call promise resolves/rejects to prevent leaks
    await pendingPromise;
  });

  it("should perform healthCheck request successfully", async () => {
    const mockResponseData = { status: "success", message: "Tanabrew Spreadsheet API is Running 🚀" };
    const mockResponse = {
      ok: true,
      headers: {
        get: (name: string) => (name.toLowerCase() === "content-type" ? "application/json" : null),
      },
      json: async () => mockResponseData,
    };
    (global.fetch as any).mockResolvedValue(mockResponse);

    const result = await service.healthCheck();

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://example.com/macros/exec",
      expect.objectContaining({
        method: "GET",
        redirect: "follow",
      })
    );
    expect(result).toEqual(mockResponseData);
  });
});

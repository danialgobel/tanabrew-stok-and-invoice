import { SPREADSHEET_CONFIG } from "./config";

export interface SpreadsheetRequestOptions {
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
  params?: Record<string, string>;
}

export interface SpreadsheetResponse<T> {
  status: string;
  message?: string;
  data?: T;
}

export interface SpreadsheetSyncResponse {
  success: boolean;
  action: string;
  invoiceNumber?: string;
  sheet?: string;
  row?: number;
  timestamp?: string;
  error?: string;
  message?: string;
}

export class SpreadsheetError extends Error {
  status?: number;
  statusText?: string;
  body?: string;

  constructor(message: string, options?: { status?: number; statusText?: string; body?: string }) {
    super(message);
    this.name = "SpreadsheetError";
    this.status = options?.status;
    this.statusText = options?.statusText;
    this.body = options?.body;
  }
}

export class SpreadsheetService {
  private baseUrl: string;
  private defaultTimeout: number;
  private defaultRetries: number;

  constructor(
    baseUrl?: string,
    options?: { timeout?: number; retries?: number }
  ) {
    this.baseUrl = baseUrl || SPREADSHEET_CONFIG.apiUrl;
    this.defaultTimeout = options?.timeout ?? 10000;
    this.defaultRetries = options?.retries ?? 3;
  }

  private async request<T>(
    path: string,
    method: "GET" | "POST" | "PUT" | "DELETE",
    body?: unknown,
    options?: SpreadsheetRequestOptions
  ): Promise<T> {
    if (!this.baseUrl) {
      throw new SpreadsheetError("Spreadsheet API URL is not configured", {
        status: 400,
        statusText: "Bad Request",
      });
    }

    const urlObj = new URL(this.baseUrl);

    // Parse path parameter if provided
    if (path) {
      if (path.startsWith("?")) {
        const searchParams = new URLSearchParams(path);
        searchParams.forEach((value, key) => {
          urlObj.searchParams.append(key, value);
        });
      } else {
        urlObj.pathname = urlObj.pathname.replace(/\/$/, "") + "/" + path.replace(/^\//, "");
      }
    }

    // Append custom request options query params
    if (options?.params) {
      Object.entries(options.params).forEach(([key, val]) => {
        urlObj.searchParams.append(key, val);
      });
    }

    const timeout = options?.timeout ?? this.defaultTimeout;
    const retries = options?.retries ?? this.defaultRetries;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const headers: Record<string, string> = {
          ...(options?.headers || {}),
        };

        const fetchOptions: RequestInit = {
          method,
          headers,
          redirect: "follow",
          signal: controller.signal,
        };

        if (body !== undefined) {
          if (typeof body === "string") {
            fetchOptions.body = body;
          } else {
            fetchOptions.body = JSON.stringify(body);
            // Use text/plain to avoid CORS preflight (OPTIONS) request.
            // Google Apps Script does not respond to preflight requests,
            // so sending application/json would cause "Failed to fetch".
            // The body is still valid JSON, it just won't trigger a preflight.
            if (!headers["Content-Type"]) {
              headers["Content-Type"] = "text/plain";
            }
          }
        }

        const response = await fetch(urlObj.toString(), fetchOptions);
        clearTimeout(timeoutId);

        if (!response.ok) {
          let bodyText = "";
          try {
            bodyText = await response.text();
          } catch (_) {}
          throw new SpreadsheetError(`HTTP error! status: ${response.status}`, {
            status: response.status,
            statusText: response.statusText,
            body: bodyText,
          });
        }

        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          return (await response.json()) as T;
        } else {
          const text = await response.text();
          try {
            return JSON.parse(text) as T;
          } catch (_) {
            return text as unknown as T;
          }
        }
      } catch (error: unknown) {
        clearTimeout(timeoutId);

        const typedError = error as Error;
        let finalError = typedError;
        if (typedError.name === "AbortError") {
          finalError = new SpreadsheetError(`Request timed out after ${timeout}ms`, {
            status: 408,
            statusText: "Request Timeout",
          });
        } else if (!(typedError instanceof SpreadsheetError)) {
          finalError = new SpreadsheetError(typedError.message || "Network request failed", {
            body: typedError.stack,
          });
        }

        lastError = finalError;

        // If we still have retries remaining, wait before trying again
        if (attempt < retries) {
          const delay = Math.min(100 * Math.pow(2, attempt), 2000);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new SpreadsheetError("Request failed after retries");
  }

  public async get<T>(
    path: string = "",
    params?: Record<string, string>,
    options?: SpreadsheetRequestOptions
  ): Promise<T> {
    return this.request<T>(path, "GET", undefined, { ...options, params });
  }

  public async post<T>(
    path: string = "",
    body?: unknown,
    options?: SpreadsheetRequestOptions
  ): Promise<T> {
    return this.request<T>(path, "POST", body, options);
  }

  public async put<T>(
    path: string = "",
    body?: unknown,
    options?: SpreadsheetRequestOptions
  ): Promise<T> {
    return this.request<T>(path, "PUT", body, options);
  }

  public async delete<T>(
    path: string = "",
    body?: unknown,
    options?: SpreadsheetRequestOptions
  ): Promise<T> {
    return this.request<T>(path, "DELETE", body, options);
  }

  public async healthCheck(): Promise<SpreadsheetResponse<undefined>> {
    return this.get<SpreadsheetResponse<undefined>>();
  }
}

export const spreadsheetService = new SpreadsheetService();

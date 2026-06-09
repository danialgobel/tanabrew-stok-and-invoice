import type { User } from "firebase/auth";

export type TanabrewNotificationType = "CREATE_INVOICE" | "PRINT_INVOICE" | "UPDATE_PAYMENT_STATUS" | "TEST_NOTIFICATION";
export type TanabrewNotificationRole = "admin" | "staff";

export interface TanabrewNotificationPayload {
  type: TanabrewNotificationType;
  invoiceId?: string;
  invoiceNumber: string;
  customer: string;
  total: number;
  actorName: string;
  actorRole: TanabrewNotificationRole;
}

export const sendTanabrewNotification = async (
  payload: TanabrewNotificationPayload,
  currentUser: User | null | undefined,
) => {
  if (!currentUser) {
    throw new Error("User belum login.");
  }

  const token = await currentUser.getIdToken();
  const response = await fetch("/api/send-notification", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const responseText = await response.text();
  let result: Record<string, unknown> = {};

  if (responseText) {
    try {
      result = JSON.parse(responseText) as Record<string, unknown>;
    } catch {
      result = { message: responseText.slice(0, 220) };
    }
  }

  if (!response.ok || result.success !== true) {
    const statusInfo = `HTTP ${response.status}${result.oneSignalStatus ? `, OneSignal ${result.oneSignalStatus}` : ""}`;
    const errorMessage = result.message || result.error || "Gagal mengirim notifikasi.";
    const details = result.details ? ` Detail: ${result.details}` : "";
    console.warn("Gagal mengirim notifikasi Tanabrew", {
      status: response.status,
      oneSignalStatus: result.oneSignalStatus,
      error: result.error,
      details: result.details,
      type: payload.type,
      invoiceNumber: payload.invoiceNumber,
    });
    throw new Error(`${statusInfo}. ${errorMessage}${details}`.slice(0, 260));
  }

  return result as unknown as { success: true; messageId: string; recipientCount?: number };
};

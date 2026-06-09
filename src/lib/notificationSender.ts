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
  const result = await response.json().catch(() => ({}));

  if (!response.ok || result.success !== true) {
    console.warn("Gagal mengirim notifikasi Tanabrew", {
      status: response.status,
      error: result.error,
      details: result.details,
      type: payload.type,
      invoiceNumber: payload.invoiceNumber,
    });
    throw new Error(result.details ? `${result.error}: ${result.details}` : result.error || "Gagal mengirim notifikasi.");
  }

  return result as { success: true; messageId: string };
};

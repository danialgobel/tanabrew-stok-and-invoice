import type { User } from "firebase/auth";
import type { Invoice } from "@/types";

export interface WhatsAppGroup {
  id: string;
  name: string;
  participantCount?: number;
}

export interface WhatsAppStatusResponse {
  success: boolean;
  serviceConfigured: boolean;
  connected: boolean;
  connecting: boolean;
  user?: {
    id: string;
    name?: string;
  } | null;
  qrCode?: string | null;
  pairingCode?: string | null;
  lastError?: string | null;
  groups?: WhatsAppGroup[];
  savedConfig?: {
    target_group_id?: string;
    target_group_name?: string;
    service_url?: string;
    updated_at?: unknown;
    updated_by?: string;
  } | null;
  error?: string;
  message?: string;
}

export const fetchWhatsAppStatus = async (currentUser: User | null | undefined): Promise<WhatsAppStatusResponse> => {
  if (!currentUser) {
    throw new Error("User belum login.");
  }

  const token = await currentUser.getIdToken();
  const response = await fetch("/api/whatsapp", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  const data = await response.json();
  if (!response.ok && !data.serviceConfigured) {
    return {
      success: false,
      serviceConfigured: false,
      connected: false,
      connecting: false,
      error: data.error || "Gagal menghubungi API WhatsApp.",
    };
  }

  return data;
};

export const saveWhatsAppTargetGroup = async (
  currentUser: User | null | undefined,
  params: { target_group_id?: string; target_group_name?: string; service_url?: string },
): Promise<{ success: boolean; message: string }> => {
  if (!currentUser) {
    throw new Error("User belum login.");
  }

  const token = await currentUser.getIdToken();
  const response = await fetch("/api/whatsapp", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action: "config", ...params }),
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || "Gagal menyimpan grup tujuan WhatsApp.");
  }

  return data;
};

export const sendInvoiceToWhatsApp = async (
  currentUser: User | null | undefined,
  params: {
    invoice: Invoice;
    pdfBase64: string;
    fileName?: string;
    forceSend?: boolean;
    groupId?: string;
    groupName?: string;
  },
): Promise<{ success: boolean; message: string; alreadySent?: boolean; groupName?: string }> => {
  if (!currentUser) {
    throw new Error("User belum login.");
  }

  if (!params.invoice.id) {
    throw new Error("Data ID invoice tidak valid.");
  }

  const token = await currentUser.getIdToken();
  const response = await fetch("/api/whatsapp-send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      invoiceId: params.invoice.id,
      pdfBase64: params.pdfBase64,
      fileName: params.fileName || `Invoice-${params.invoice.no_invoice || params.invoice.id}.pdf`,
      forceSend: params.forceSend || false,
      groupId: params.groupId,
      groupName: params.groupName,
    }),
  });

  const data = await response.json();
  if (!response.ok || data.success !== true) {
    throw new Error(data.error || "Gagal mengirim invoice ke WhatsApp.");
  }

  return data;
};


export const disconnectWhatsAppSession = async (
  currentUser: User | null | undefined,
): Promise<{ success: boolean; message: string }> => {
  if (!currentUser) {
    throw new Error("User belum login.");
  }

  const token = await currentUser.getIdToken();
  const response = await fetch("/api/whatsapp", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action: "disconnect" }),
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || "Gagal memutuskan koneksi WhatsApp.");
  }

  return data;
};

export const requestWhatsAppPairingCode = async (
  currentUser: User | null | undefined,
  phoneNumber: string,
): Promise<{ success: boolean; pairingCode: string }> => {
  if (!currentUser) {
    throw new Error("User belum login.");
  }

  const token = await currentUser.getIdToken();
  const response = await fetch("/api/whatsapp", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action: "pair_code", phoneNumber }),
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || "Gagal meminta kode pairing WhatsApp.");
  }

  return data;
};

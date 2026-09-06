import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import {
  collection,
  getDocs,
  getDoc,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Skeleton } from "@/components/Skeleton";
import { sendTanabrewNotification } from "@/lib/notificationSender";
import { getNotificationPermissionState, requestNotificationPermission } from "@/lib/onesignal";
import { addActivityLog } from "@/lib/activityLog";
import { isOwnerRole } from "@/lib/roleUtils";
import {
  Terminal as TerminalIcon,
  ShieldAlert,
  Trash2,
  RefreshCw,
  Database,
  FileText,
  Package,
  History,
  Users,
  AlertTriangle,
  CheckCircle2,
  Download,
  Upload,
  Wrench,
  Send,
  Edit,
  Plus,
  X,
  Search,
  Activity,
  HardDrive,
  LogIn,
  UserCheck,
  Loader2,
  Smartphone,
} from "lucide-react";
import WhatsAppSettingsModal from "@/components/WhatsAppSettingsModal";

type CollectionName = "invoices" | "products" | "activity_logs" | "stock_movements" | "users";
type GodModeTab = "users" | "explorer" | "health" | "notifications" | "backup" | "whatsapp" | "logs";

interface LogEntry {
  timestamp: string;
  type: "info" | "success" | "warn" | "error";
  message: string;
}

interface IntegrityIssue {
  id: string;
  type: "stock_mismatch" | "negative_stock" | "invalid_invoice";
  title: string;
  description: string;
  severity: "error" | "warning";
  payload?: any;
}

const GodMode = () => {
  const { currentUser, userProfile, switchUserAccount } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<GodModeTab>("users");
  const [activeCollection, setActiveCollection] = useState<CollectionName>("invoices");
  const [explorerData, setExplorerData] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [devLogs, setDevLogs] = useState<LogEntry[]>([]);

  // Users Tab State
  const [usersList, setUsersList] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [updatingUserRole, setUpdatingUserRole] = useState<string | null>(null);
  const [switchingAccount, setSwitchingAccount] = useState<string | null>(null);

  // Edit / JSON Modal State
  const [editingRecord, setEditingRecord] = useState<any | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editJsonString, setEditJsonString] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Create Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createJsonString, setCreateJsonString] = useState("{\n  \n}");
  const [savingCreate, setSavingCreate] = useState(false);

  // Delete Confirmation State
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; display: string; collection?: CollectionName } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Health Check State
  const [healthIssues, setHealthIssues] = useState<IntegrityIssue[]>([]);
  const [scanningHealth, setScanningHealth] = useState(false);
  const [fixingHealth, setFixingHealth] = useState(false);

  // Notification Broadcast State
  const [notifTitle, setNotifTitle] = useState("Pengumuman dari Developer");
  const [notifMessage, setNotifMessage] = useState("");
  const [sendingNotif, setSendingNotif] = useState(false);

  // Backup / Restore State
  const [exportingBackup, setExportingBackup] = useState(false);
  const [restoringBackup, setRestoringBackup] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // WhatsApp Modal State
  const [showWaModal, setShowWaModal] = useState(false);

  const logsEndRef = useRef<HTMLDivElement>(null);

  // Access check
  useEffect(() => {
    if (userProfile && !isOwnerRole(userProfile.role, currentUser?.email)) {
      toast({
        title: "Akses Ditolak",
        description: "Halaman ini hanya untuk Developer dan Owner.",
        variant: "destructive",
      });
      navigate("/");
    }
  }, [userProfile, currentUser, navigate, toast]);

  const addLog = useCallback((message: string, type: LogEntry["type"] = "info") => {
    const time = new Date().toLocaleTimeString("id-ID", { hour12: false });
    setDevLogs((prev) => [...prev, { timestamp: time, type, message }]);
  }, []);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [devLogs]);

  // Initial greeting
  useEffect(() => {
    addLog("Master Developer Control Center diinisialisasi.", "info");
    addLog(`User aktif: ${userProfile?.name || "Developer"} (${userProfile?.email || "n/a"})`, "success");
    void loadUsers();
    void runHealthScan();
  }, []);

  // 1. Users Management — Bulletproof Multi-Tier User Discovery
  const loadUsers = async () => {
    setLoadingUsers(true);
    addLog("Mengambil data akun pengguna dari server...", "info");
    const roleOrder: Record<string, number> = { owner: 4, webdev: 3, admin: 2, staff: 1 };
    const userMap = new Map<string, any>();

    // Tambahkan user aktif terlebih dahulu
    if (currentUser && userProfile) {
      userMap.set(currentUser.uid, {
        id: currentUser.uid,
        uid: currentUser.uid,
        name: userProfile.name || currentUser.displayName || "Developer",
        email: userProfile.email || currentUser.email || "",
        role: userProfile.role || "webdev",
        photo_url: userProfile.photo_url || currentUser.photoURL || "",
      });
    }

    try {
      // Tier 1: Coba Admin SDK Serverless API
      let loadedViaApi = false;
      if (currentUser) {
        try {
          const token = await currentUser.getIdToken(true);
          const res = await fetch("/api/admin-users", {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            if (data.success && Array.isArray(data.users) && data.users.length > 0) {
              data.users.forEach((u: any) => {
                if (u.id || u.uid) userMap.set(u.id || u.uid, u);
              });
              loadedViaApi = true;
              addLog(`Berhasil memuat ${userMap.size} pengguna (Admin Root Access).`, "success");
            }
          }
        } catch {
          // Lanjut ke fallback berikutnya
        }
      }

      // Tier 2: Coba Firestore SDK getDocs
      if (!loadedViaApi) {
        try {
          const snap = await getDocs(collection(db, "users"));
          snap.docs.forEach((d) => {
            userMap.set(d.id, { id: d.id, uid: d.id, ...d.data() });
          });
          if (snap.docs.length > 0) {
            addLog(`Berhasil memuat ${userMap.size} pengguna via Firestore SDK.`, "success");
          }
        } catch {
          // Firestore SDK rules mungkin batasi list collection
        }
      }

      // Tier 3: Coba Firestore REST API
      if (userMap.size <= 1 && currentUser) {
        try {
          const token = await currentUser.getIdToken(true);
          const url = `https://firestore.googleapis.com/v1/projects/tanabrew/databases/(default)/documents/users?pageSize=100`;
          const restRes = await fetch(url, {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          });
          if (restRes.ok) {
            const restData = await restRes.json();
            const documents: any[] = restData.documents || [];
            documents.forEach((firestoreDoc: any) => {
              const uid = firestoreDoc.name?.split("/").pop() || "";
              const fields = firestoreDoc.fields || {};
              const getField = (f: any) => f?.stringValue ?? f?.integerValue ?? f?.booleanValue ?? null;
              if (uid) {
                userMap.set(uid, {
                  id: uid,
                  uid,
                  name: getField(fields.name) || "Tanpa Nama",
                  email: getField(fields.email) || "",
                  role: getField(fields.role) || "staff",
                  photo_url: getField(fields.photo_url) || "",
                });
              }
            });
          }
        } catch {
          // Lanjut ke agregasi
        }
      }

      // Tier 4: Agregasi pengguna dari activity_logs, invoices, stock_movements
      try {
        const [logsSnap, invSnap, stockSnap] = await Promise.allSettled([
          getDocs(collection(db, "activity_logs")),
          getDocs(collection(db, "invoices")),
          getDocs(collection(db, "stock_movements")),
        ]);

        if (logsSnap.status === "fulfilled") {
          logsSnap.value.docs.forEach((d) => {
            const data = d.data();
            const uid = data.user_id;
            if (uid && !userMap.has(uid)) {
              userMap.set(uid, {
                id: uid,
                uid,
                name: data.user_name || "Pengguna",
                email: "",
                role: data.user_role || "staff",
              });
            }
          });
        }

        if (invSnap.status === "fulfilled") {
          invSnap.value.docs.forEach((d) => {
            const data = d.data();
            const uid = data.dibuat_oleh_uid;
            if (uid && !userMap.has(uid)) {
              userMap.set(uid, {
                id: uid,
                uid,
                name: data.dibuat_oleh || "Staff Kasir",
                email: "",
                role: data.dibuat_oleh_role || "staff",
              });
            }
          });
        }

        if (stockSnap.status === "fulfilled") {
          stockSnap.value.docs.forEach((d) => {
            const data = d.data();
            const uid = data.user_id;
            if (uid && !userMap.has(uid)) {
              userMap.set(uid, {
                id: uid,
                uid,
                name: data.user_name || "Staff Gudang",
                email: "",
                role: data.user_role || "staff",
              });
            }
          });
        }

        // Coba baca dokumen spesifik untuk tiap user yang ditemukan (getDoc sering diizinkan)
        const fetchPromises = Array.from(userMap.keys()).map(async (uid) => {
          try {
            const userDocSnap = await getDoc(doc(db, "users", uid));
            if (userDocSnap.exists()) {
              const existing = userMap.get(uid) || {};
              userMap.set(uid, { ...existing, id: uid, uid, ...userDocSnap.data() });
            }
          } catch {
            // Abaikan
          }
        });
        await Promise.allSettled(fetchPromises);
      } catch {
        // Abaikan
      }

      const records = Array.from(userMap.values());
      records.sort((a: any, b: any) => (roleOrder[b.role] || 0) - (roleOrder[a.role] || 0));
      setUsersList(records);
      addLog(`Berhasil memuat ${records.length} akun tim Tanabrew.`, "success");
    } catch (err: any) {
      addLog(`Catatan pemuatan pengguna: ${err.message}`, "warn");
      const records = Array.from(userMap.values());
      if (records.length > 0) {
        records.sort((a: any, b: any) => (roleOrder[b.role] || 0) - (roleOrder[a.role] || 0));
        setUsersList(records);
      }
    } finally {
      setLoadingUsers(false);
    }
  };


  const handleChangeRole = async (userId: string, newRole: string, userName: string) => {
    setUpdatingUserRole(userId);
    addLog(`Mengubah role user '${userName}' (${userId}) menjadi '${newRole}'...`, "warn");
    try {
      if (!currentUser) throw new Error("Tidak ada user yang login.");

      const token = await currentUser.getIdToken(true);
      let updated = false;
      let lastError = "";

      // 1. Eksekusi melalui Admin SDK Serverless API (Akses Administratif Penuh)
      try {
        const res = await fetch("/api/admin-users", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ action: "update_role", userId, newRole }),
        });

        const data = await res.json().catch(() => null);
        if (res.ok && data?.success) {
          updated = true;
        } else {
          lastError = data?.error || `HTTP ${res.status}: ${res.statusText}`;
          addLog(`Admin SDK respon: ${lastError}`, "warn");
        }
      } catch (apiErr: any) {
        lastError = apiErr.message || "Gagal menghubungi Admin SDK";
        addLog(`Koneksi Admin SDK error: ${lastError}`, "warn");
      }

      // 2. Fallback: Firestore Client SDK (jika diizinkan oleh rules)
      if (!updated) {
        try {
          await updateDoc(doc(db, "users", userId), {
            role: newRole,
            updated_at: serverTimestamp(),
          });
          updated = true;
        } catch (clientErr: any) {
          addLog(`Firestore Client updateDoc gagal: ${clientErr.message}`, "warn");
        }
      }

      if (!updated) {
        throw new Error(lastError || "Gagal memperbarui role di server.");
      }

      setUsersList((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
      addLog(`Role '${userName}' berhasil diubah ke '${newRole}'.`, "success");
      toast({ title: "Berhasil", description: `Role ${userName} diubah ke ${newRole.toUpperCase()}` });
    } catch (err: any) {
      addLog(`Gagal mengubah role: ${err.message}`, "error");
      toast({ title: "Error", description: "Gagal memperbarui role: " + err.message, variant: "destructive" });
    } finally {
      setUpdatingUserRole(null);
    }
  };


  const handleSwitchAccount = async (targetUser: any) => {
    setSwitchingAccount(targetUser.id);
    addLog(`Beralih login ke akun '${targetUser.name || targetUser.email}' (${targetUser.id})...`, "warn");
    try {
      await switchUserAccount(targetUser.id);
      addLog(`Berhasil beralih ke akun '${targetUser.name || targetUser.email}'.`, "success");
      toast({
        title: "Beralih Akun Berhasil",
        description: `Sekarang Anda masuk sebagai ${targetUser.name || targetUser.email}.`,
      });
      navigate("/");
    } catch (err: any) {
      addLog(`Gagal beralih akun: ${err.message}`, "error");
      toast({
        title: "Gagal Beralih Akun",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSwitchingAccount(null);
    }
  };

  // 2. Master Data Explorer
  const loadCollectionData = async (colName: CollectionName) => {
    if (colName === "users") {
      void loadUsers();
    }
    setLoadingData(true);
    addLog(`Mengambil data dari koleksi '${colName}'...`, "info");
    try {
      const snap = await getDocs(collection(db, colName));
      const records = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      if (colName === "activity_logs" || colName === "stock_movements" || colName === "invoices") {
        records.sort((a: any, b: any) => {
          const tA = a.created_at?.seconds || 0;
          const tB = b.created_at?.seconds || 0;
          return tB - tA;
        });
      }

      setExplorerData(records);
      addLog(`Koleksi '${colName}' berhasil dimuat (${records.length} dokumen).`, "success");
    } catch (err: any) {
      addLog(`Gagal memuat koleksi '${colName}': ${err.message}`, "error");
      toast({ title: "Error", description: "Gagal memuat data Firestore", variant: "destructive" });
    } finally {
      setLoadingData(false);
    }
  };

  const handleSelectCollection = (col: CollectionName) => {
    setActiveCollection(col);
    void loadCollectionData(col);
  };

  const handleOpenEdit = (record: any) => {
    setEditingRecord(record);
    const { id, ...rest } = record;
    setEditJsonString(JSON.stringify(rest, null, 2));
    setEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingRecord?.id) return;
    setSavingEdit(true);
    addLog(`Menyimpan perubahan dokumen '${editingRecord.id}' di koleksi '${activeCollection}'...`, "info");
    try {
      const parsed = JSON.parse(editJsonString);
      await updateDoc(doc(db, activeCollection, editingRecord.id), {
        ...parsed,
        updated_at: serverTimestamp(),
      });
      setExplorerData((prev) =>
        prev.map((item) => (item.id === editingRecord.id ? { id: item.id, ...parsed } : item))
      );
      addLog(`Dokumen '${editingRecord.id}' berhasil diperbarui.`, "success");
      toast({ title: "Berhasil", description: "Dokumen berhasil diperbarui di Firestore" });
      setEditModalOpen(false);
      setEditingRecord(null);
    } catch (err: any) {
      addLog(`Gagal menyimpan edit: ${err.message}`, "error");
      toast({ title: "Error JSON / Firestore", description: err.message, variant: "destructive" });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleSaveCreate = async () => {
    setSavingCreate(true);
    addLog(`Membuat dokumen baru di koleksi '${activeCollection}'...`, "info");
    try {
      const parsed = JSON.parse(createJsonString);
      const newDocRef = doc(collection(db, activeCollection));
      await setDoc(newDocRef, {
        ...parsed,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });
      addLog(`Dokumen baru '${newDocRef.id}' berhasil ditambahkan ke '${activeCollection}'.`, "success");
      toast({ title: "Berhasil", description: `Dokumen baru dibuat: ${newDocRef.id}` });
      setCreateModalOpen(false);
      void loadCollectionData(activeCollection);
    } catch (err: any) {
      addLog(`Gagal membuat dokumen: ${err.message}`, "error");
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSavingCreate(false);
    }
  };

  const handleDeleteDocument = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const targetCol = deleteTarget.collection || activeCollection;
    addLog(`Menghapus dokumen '${deleteTarget.id}' dari '${targetCol}'...`, "warn");
    try {
      if (targetCol === "users" && currentUser) {
        const token = await currentUser.getIdToken();
        const res = await fetch("/api/admin-users", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            action: "delete_user",
            userId: deleteTarget.id,
          }),
        });
        const resData = await res.json().catch(() => ({}));
        if (!res.ok || !resData.success) {
          throw new Error(resData.error || `Gagal menghapus akun: HTTP ${res.status}`);
        }

        setUsersList((prev) => prev.filter((u) => u.id !== deleteTarget.id));
        addLog(`User '${deleteTarget.display}' (${deleteTarget.id}) berhasil dihapus permanen dari Firebase Auth & Firestore.`, "success");
        toast({ title: "Berhasil Dihapus", description: `Akun ${deleteTarget.display} telah dihapus permanen.` });
        setDeleting(false);
        setDeleteTarget(null);
        void loadUsers();
        return;
      }

      await deleteDoc(doc(db, targetCol, deleteTarget.id));
      if (targetCol === "users") {
        setUsersList((prev) => prev.filter((u) => u.id !== deleteTarget.id));
      } else {
        setExplorerData((prev) => prev.filter((d) => d.id !== deleteTarget.id));
      }
      addLog(`Dokumen '${deleteTarget.display}' (${deleteTarget.id}) berhasil dihapus.`, "success");
      toast({ title: "Berhasil", description: "Data berhasil dihapus dari Firebase" });
    } catch (err: any) {
      addLog(`Gagal menghapus: ${err.message}`, "error");
      toast({ title: "Error", description: "Gagal menghapus data", variant: "destructive" });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  // 3. Health Check & Auto-Fix
  const runHealthScan = async () => {
    setScanningHealth(true);
    addLog("Memulai pemindaian kesehatan integritas database...", "info");
    const issues: IntegrityIssue[] = [];

    try {
      const productsSnap = await getDocs(collection(db, "products"));
      const products = productsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      products.forEach((p: any) => {
        const jogja = Number(p.stok_jogja) || 0;
        const lombok = Number(p.stok_lombok) || 0;
        const total = Number(p.total_stok) || 0;

        if (jogja + lombok !== total) {
          issues.push({
            id: `mismatch-${p.id}`,
            type: "stock_mismatch",
            title: `Selisih Total Stok: ${p.nama_barang || p.id}`,
            description: `Stok Jogja (${jogja}) + Lombok (${lombok}) = ${jogja + lombok}, namun total_stok tercatat ${total}.`,
            severity: "error",
            payload: { productId: p.id, nama: p.nama_barang, jogja, lombok, correctTotal: jogja + lombok },
          });
        }

        if (jogja < 0 || lombok < 0 || total < 0) {
          issues.push({
            id: `neg-${p.id}`,
            type: "negative_stock",
            title: `Stok Negatif: ${p.nama_barang || p.id}`,
            description: `Produk memiliki stok bernilai negatif: Jogja (${jogja}), Lombok (${lombok}), Total (${total}).`,
            severity: "warning",
            payload: { productId: p.id },
          });
        }
      });

      const invoiceSnap = await getDocs(collection(db, "invoices"));
      invoiceSnap.docs.forEach((d) => {
        const inv = d.data();
        if (!inv.no_invoice || !inv.items || !Array.isArray(inv.items) || inv.items.length === 0) {
          issues.push({
            id: `inv-${d.id}`,
            type: "invalid_invoice",
            title: `Invoice Tidak Lengkap: ${inv.no_invoice || d.id}`,
            description: `Invoice memiliki data kosong atau tanpa daftar produk.`,
            severity: "warning",
            payload: { invoiceId: d.id },
          });
        }
      });

      setHealthIssues(issues);
      if (issues.length === 0) {
        addLog("Pemindaian selesai: Semua data konsisten dan sehat! (0 Masalah)", "success");
      } else {
        addLog(`Pemindaian selesai: Ditemukan ${issues.length} masalah integritas data.`, "warn");
      }
    } catch (err: any) {
      addLog(`Gagal melakukan pemindaian kesehatan: ${err.message}`, "error");
    } finally {
      setScanningHealth(false);
    }
  };

  const handleAutoFixStocks = async () => {
    setFixingHealth(true);
    addLog("Menjalankan 1-Click Auto-Fix & Rebalance Stok...", "info");
    try {
      const productsSnap = await getDocs(collection(db, "products"));
      const batch = writeBatch(db);
      let fixedCount = 0;

      productsSnap.docs.forEach((docSnap) => {
        const p = docSnap.data();
        const jogja = Number(p.stok_jogja) || 0;
        const lombok = Number(p.stok_lombok) || 0;
        const correctTotal = jogja + lombok;

        if (p.total_stok !== correctTotal) {
          batch.update(docSnap.ref, {
            total_stok: correctTotal,
            updated_at: serverTimestamp(),
          });
          fixedCount++;
        }
      });

      if (fixedCount > 0) {
        await batch.commit();
        addLog(`Auto-fix berhasil: Memperbaiki ${fixedCount} produk dengan selisih stok.`, "success");
        toast({ title: "Berhasil", description: `${fixedCount} produk berhasil diperbaiki dan diseimbangkan total stoknya.` });
      } else {
        addLog("Tidak ada produk yang memerlukan perbaikan total stok.", "info");
        toast({ title: "Informasi", description: "Semua total stok produk sudah sesuai." });
      }

      await runHealthScan();
    } catch (err: any) {
      addLog(`Gagal auto-fix stok: ${err.message}`, "error");
      toast({ title: "Error", description: "Gagal memperbaiki stok", variant: "destructive" });
    } finally {
      setFixingHealth(false);
    }
  };

  // 4. Push Notification Broadcast
  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !userProfile) {
      toast({ title: "Error", description: "User belum siap", variant: "destructive" });
      return;
    }

    if (!notifMessage.trim()) {
      toast({ title: "Error", description: "Pesan notifikasi wajib diisi", variant: "destructive" });
      return;
    }

    setSendingNotif(true);
    addLog(`Mengirim broadcast notifikasi ke seluruh perangkat: "${notifTitle}"...`, "info");

    try {
      const res = await sendTanabrewNotification(
        {
          type: "OWNER_ANNOUNCEMENT",
          actorName: userProfile.name || "Developer",
          actorRole: "webdev",
          title: notifTitle.trim(),
          message: notifMessage.trim(),
          invoiceNumber: "DEV-BROADCAST",
          customer: "ALL",
          total: 0,
        },
        currentUser
      );

      addLog(`Notifikasi broadcast berhasil dikirim! Message ID: ${res.messageId || "OK"}`, "success");
      toast({ title: "Notifikasi Terkirim", description: `Broadcast berhasil dikirim ke seluruh perangkat aktif.` });
      setNotifMessage("");

      await addActivityLog({
        user: { uid: currentUser.uid, name: userProfile.name, role: userProfile.role },
        action: "OWNER_ANNOUNCEMENT",
        targetType: "notification",
        targetId: res.messageId || "broadcast",
        targetName: notifTitle,
        description: `Developer mengirim broadcast notifikasi: ${notifTitle}`,
      });
    } catch (err: any) {
      addLog(`Gagal mengirim broadcast: ${err.message}`, "error");
      toast({ title: "Gagal Mengirim", description: err.message, variant: "destructive" });
    } finally {
      setSendingNotif(false);
    }
  };

  // 5. Backup & Restore
  const handleExportBackup = async () => {
    setExportingBackup(true);
    addLog("Memulai pembuatan full backup database Firestore...", "info");
    try {
      const collectionsToBackup: CollectionName[] = ["invoices", "products", "users", "activity_logs", "stock_movements"];
      const backupData: Record<string, any[]> = {};

      for (const col of collectionsToBackup) {
        addLog(`Mengekstrak data dari koleksi '${col}'...`, "info");
        const snap = await getDocs(collection(db, col));
        backupData[col] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `tanabrew-backup-${timestamp}.json`;
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      addLog(`Full backup berhasil diunduh: ${filename}`, "success");
      toast({ title: "Backup Berhasil", description: `File ${filename} berhasil diunduh.` });
    } catch (err: any) {
      addLog(`Gagal membuat backup: ${err.message}`, "error");
      toast({ title: "Error Backup", description: err.message, variant: "destructive" });
    } finally {
      setExportingBackup(false);
    }
  };

  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const confirmRestore = window.confirm(
      "PERINGATAN: Memulihkan database akan memperbarui atau menimpa dokumen Firestore yang ada di file backup. Lanjutkan?"
    );
    if (!confirmRestore) {
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setRestoringBackup(true);
    addLog(`Membaca file backup '${file.name}'...`, "info");

    try {
      const text = await file.text();
      const backupData = JSON.parse(text);

      let totalRestored = 0;
      for (const col of Object.keys(backupData)) {
        const records = backupData[col];
        if (Array.isArray(records)) {
          addLog(`Memulihkan ${records.length} dokumen ke koleksi '${col}'...`, "info");
          for (const item of records) {
            const { id, ...data } = item;
            if (id) {
              await setDoc(doc(db, col, id), data, { merge: true });
              totalRestored++;
            }
          }
        }
      }

      addLog(`Restore selesai! Total ${totalRestored} dokumen berhasil dipulihkan.`, "success");
      toast({ title: "Restore Berhasil", description: `${totalRestored} data berhasil dipulihkan ke Firestore.` });
      void runHealthScan();
    } catch (err: any) {
      addLog(`Gagal memuilhkan backup: ${err.message}`, "error");
      toast({ title: "Error Restore", description: err.message, variant: "destructive" });
    } finally {
      setRestoringBackup(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Maintenance Log Cleanup
  const handleClearOldLogs = async () => {
    const confirmClean = window.confirm("Hapus log aktivitas yang lebih lama dari 90 hari?");
    if (!confirmClean) return;

    addLog("Memulai pembersihan log aktivitas lama...", "info");
    try {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const snap = await getDocs(collection(db, "activity_logs"));
      let deleted = 0;
      const batch = writeBatch(db);

      snap.docs.forEach((d) => {
        const data = d.data();
        const date = data.created_at?.toDate ? data.created_at.toDate() : null;
        if (date && date < ninetyDaysAgo) {
          batch.delete(d.ref);
          deleted++;
        }
      });

      if (deleted > 0) {
        await batch.commit();
        addLog(`Berhasil menghapus ${deleted} log aktivitas lama.`, "success");
        toast({ title: "Pembersihan Selesai", description: `${deleted} log lama berhasil dibersihkan.` });
      } else {
        addLog("Tidak ada log lama yang perlu dibersihkan.", "info");
        toast({ title: "Informasi", description: "Tidak ada log lebih dari 90 hari." });
      }
    } catch (err: any) {
      addLog(`Gagal membersihkan log: ${err.message}`, "error");
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  // Filtered explorer documents
  const filteredExplorerData = useMemo(() => {
    if (!searchQuery.trim()) return explorerData;
    const q = searchQuery.toLowerCase();
    return explorerData.filter((item) => {
      const str = JSON.stringify(item).toLowerCase();
      return str.includes(q);
    });
  }, [explorerData, searchQuery]);

  if (!isOwnerRole(userProfile?.role, currentUser?.email)) {
    return (
      <div className="mx-auto w-full max-w-lg px-4 py-16 text-center space-y-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive border border-destructive/20">
          <ShieldAlert size={32} />
        </div>
        <h2 className="text-lg font-bold text-foreground">Akses Terbatas</h2>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
          Halaman Developer khusus ditujukan bagi Owner dan Developer Tanabrew.
        </p>
        <button
          type="button"
          onClick={() => navigate("/")}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary/90 transition-all cursor-pointer"
        >
          Kembali ke Beranda
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-lg lg:max-w-7xl overflow-x-hidden px-4 sm:px-6 lg:px-8 pb-32 pt-4 lg:pt-8 space-y-5">
      {/* Dev Header */}
      <div className="rounded-xl border border-primary/30 bg-card p-4 shadow-sm relative overflow-hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
              <ShieldAlert size={22} />
            </div>
            <div>
              <h1 className="text-base font-bold text-primary">
                Developer Center
              </h1>
              <p className="text-xs text-muted-foreground">
                Pusat Kendali & Pemeliharaan Tanabrew
              </p>
            </div>
          </div>
          <span className="shrink-0 flex items-center gap-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-full px-2 py-0.5 text-[10px] font-semibold">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
            ROOT
          </span>
        </div>
      </div>

      {/* Navigation Tabs (7 Submodules) */}
      <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5 text-xs font-semibold">
        {[
          { key: "users", label: "Users", icon: Users },
          { key: "explorer", label: "Master Data", icon: Database },
          { key: "health", label: "Health Check", icon: Wrench },
          { key: "notifications", label: "Broadcast", icon: Send },
          { key: "backup", label: "Backup", icon: HardDrive },
          { key: "whatsapp", label: "WhatsApp", icon: Smartphone },
          { key: "logs", label: "Console", icon: TerminalIcon },
        ].map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key as GodModeTab);
                if (tab.key === "explorer" && explorerData.length === 0) {
                  void loadCollectionData(activeCollection);
                }
              }}
              className={`flex items-center justify-center gap-1 rounded-lg border py-2.5 px-1 transition-all ${
                active
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border bg-card text-muted-foreground hover:bg-muted"
              }`}
            >
              <tab.icon size={13} />
              <span className="truncate">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* SUBMODULE 1: USERS MANAGEMENT & ROLE SWITCHER */}
      {activeTab === "users" && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-primary">Manajemen Akun & Role</h2>
              <p className="text-xs text-muted-foreground">Ubah role atau kelola akun pengguna Firestore</p>
            </div>
            <button
              onClick={loadUsers}
              disabled={loadingUsers}
              className="p-1.5 rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground"
            >
              <RefreshCw size={14} className={loadingUsers ? "animate-spin" : ""} />
            </button>
          </div>

          <div className="space-y-3">
            {loadingUsers ? (
              <>
                <Skeleton className="h-16 w-full rounded-xl" />
                <Skeleton className="h-16 w-full rounded-xl" />
              </>
            ) : usersList.length === 0 ? (
              <p className="text-center py-6 text-xs text-muted-foreground">Belum ada data user.</p>
            ) : (
              usersList.map((user) => (
                <div key={user.id} className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-foreground truncate">{user.name || "Tanpa Nama"}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
                    </div>
                    <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase bg-primary/10 text-primary">
                      {user.role || "staff"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/50">
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="text-[10px] text-muted-foreground">Ubah Role:</span>
                      {(["staff", "admin", "owner", "webdev"] as const).map((r) => (
                        <button
                          key={r}
                          onClick={() => handleChangeRole(user.id, r, user.name)}
                          disabled={updatingUserRole === user.id || user.role === r}
                          className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase border transition-colors ${
                            user.role === r
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background text-muted-foreground border-border hover:bg-muted"
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleSwitchAccount(user)}
                        disabled={switchingAccount === user.id || user.id === currentUser?.uid}
                        className="inline-flex items-center gap-1 rounded-lg bg-purple-600/10 hover:bg-purple-600/20 text-purple-600 dark:text-purple-400 border border-purple-500/20 px-2 py-1 text-[10px] font-bold transition-all disabled:opacity-40"
                        title="Beralih dan masuk sebagai akun ini"
                      >
                        {switchingAccount === user.id ? (
                          <Loader2 size={11} className="animate-spin" />
                        ) : (
                          <LogIn size={11} />
                        )}
                        <span>{user.id === currentUser?.uid ? "Akun Saat Ini" : "Masuk sebagai Akun Ini"}</span>
                      </button>

                      <button
                        onClick={() => setDeleteTarget({ id: user.id, display: user.email || user.name, collection: "users" })}
                        className="p-1 rounded text-destructive hover:bg-destructive/10 shrink-0"
                        title="Hapus User"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* SUBMODULE 2: MASTER DATA EXPLORER & DOCUMENT EDITOR */}
      {activeTab === "explorer" && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-primary">Database Explorer</h2>
            <button
              onClick={() => {
                setCreateJsonString("{\n  \n}");
                setCreateModalOpen(true);
              }}
              className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground hover:opacity-90"
            >
              <Plus size={13} /> Tambah Data
            </button>
          </div>

          {/* Collection Switcher */}
          <div className="grid grid-cols-5 gap-1">
            {(["invoices", "products", "users", "activity_logs", "stock_movements"] as CollectionName[]).map((col) => {
              const active = activeCollection === col;
              return (
                <button
                  key={col}
                  onClick={() => handleSelectCollection(col)}
                  className={`rounded-lg py-1.5 text-[10px] font-bold uppercase border truncate ${
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {col.split("_")[0]}
                </button>
              );
            })}
          </div>

          {/* Search Box */}
          <div className="flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2">
            <Search size={14} className="text-muted-foreground shrink-0" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Cari di koleksi ${activeCollection}...`}
              className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="text-muted-foreground hover:text-foreground">
                <X size={13} />
              </button>
            )}
          </div>

          {/* Document list */}
          <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
            {loadingData ? (
              <>
                <Skeleton className="h-14 w-full rounded-xl" />
                <Skeleton className="h-14 w-full rounded-xl" />
                <Skeleton className="h-14 w-full rounded-xl" />
              </>
            ) : filteredExplorerData.length === 0 ? (
              <p className="text-center py-8 text-xs text-muted-foreground">Tidak ada dokumen.</p>
            ) : (
              filteredExplorerData.map((record) => (
                <div
                  key={record.id}
                  className="rounded-xl border border-border bg-muted/20 p-3 flex items-start justify-between gap-3 hover:border-primary/30 transition-colors"
                >
                  <div className="min-w-0 flex-1 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-primary truncate">
                        {record.no_invoice || record.nama_barang || record.name || record.product_name || record.action || record.id}
                      </p>
                      <span className="text-[10px] text-muted-foreground font-mono">ID: {record.id.slice(0, 8)}...</span>
                    </div>
                    {record.customer && <p className="text-muted-foreground text-[11px]">Customer: {record.customer}</p>}
                    {record.total !== undefined && <p className="text-muted-foreground text-[11px]">Total: Rp {new Intl.NumberFormat("id-ID").format(record.total)}</p>}
                    {record.total_stok !== undefined && <p className="text-muted-foreground text-[11px]">Stok Jogja: {record.stok_jogja} | Lombok: {record.stok_lombok} | Total: {record.total_stok}</p>}
                    {record.description && <p className="text-muted-foreground text-[11px] truncate">{record.description}</p>}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleOpenEdit(record)}
                      className="p-1.5 rounded-lg border border-border bg-background hover:bg-muted text-primary"
                      title="Edit Fields"
                    >
                      <Edit size={13} />
                    </button>
                    <button
                      onClick={() => setDeleteTarget({ id: record.id, display: record.no_invoice || record.nama_barang || record.id })}
                      className="p-1.5 rounded-lg border border-destructive/20 bg-destructive/5 text-destructive hover:bg-destructive hover:text-white"
                      title="Hapus Dokumen"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* SUBMODULE 3: HEALTH CHECK & 1-CLICK AUTO-FIX */}
      {activeTab === "health" && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-primary">Integritas Data & Stok</h2>
              <p className="text-xs text-muted-foreground">Pindai dan perbaiki otomatis selisih stok database</p>
            </div>
            <button
              onClick={runHealthScan}
              disabled={scanningHealth}
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-muted"
            >
              <RefreshCw size={13} className={scanningHealth ? "animate-spin" : ""} /> Pindai Ulang
            </button>
          </div>

          <button
            onClick={handleAutoFixStocks}
            disabled={fixingHealth || scanningHealth}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-xs font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            <Wrench size={15} />
            {fixingHealth ? "Menyeimbangkan Stok..." : "⚡ 1-Click Auto-Fix & Rebalance Semua Stok"}
          </button>

          <div className="space-y-2">
            <h3 className="text-xs font-bold text-muted-foreground uppercase">Hasil Pemindaian:</h3>
            {scanningHealth ? (
              <Skeleton className="h-16 w-full rounded-xl" />
            ) : healthIssues.length === 0 ? (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-center space-y-1">
                <CheckCircle2 size={24} className="mx-auto text-emerald-500" />
                <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Database Sehat & Konsisten</p>
                <p className="text-[11px] text-muted-foreground">Tidak ditemukan ketidaksesuaian stok atau data rusak.</p>
              </div>
            ) : (
              healthIssues.map((issue) => (
                <div
                  key={issue.id}
                  className={`rounded-xl border p-3 text-xs space-y-1 ${
                    issue.severity === "error"
                      ? "border-destructive/30 bg-destructive/5"
                      : "border-amber-500/30 bg-amber-500/5"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-foreground">
                    <AlertTriangle size={14} className={issue.severity === "error" ? "text-destructive" : "text-amber-500"} />
                    {issue.title}
                  </div>
                  <p className="text-muted-foreground text-[11px]">{issue.description}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* SUBMODULE 4: PUSH NOTIFICATION BROADCAST TESTER */}
      {activeTab === "notifications" && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-4">
          <div>
            <h2 className="text-sm font-bold text-primary">Broadcast Notifikasi</h2>
            <p className="text-xs text-muted-foreground">Kirim web push notification langsung ke seluruh perangkat aktif</p>
          </div>

          <form onSubmit={handleSendBroadcast} className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Judul Notifikasi</label>
              <input
                value={notifTitle}
                onChange={(e) => setNotifTitle(e.target.value)}
                placeholder="Contoh: Pengumuman Penting"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Isi Pesan Notifikasi</label>
              <textarea
                value={notifMessage}
                onChange={(e) => setNotifMessage(e.target.value)}
                placeholder="Tulis pesan yang akan muncul di notifikasi HP/Desktop..."
                rows={3}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                required
              />
            </div>

            <button
              type="submit"
              disabled={sendingNotif}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-xs font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              <Send size={14} />
              {sendingNotif ? "Mengirim ke Seluruh Perangkat..." : "Kirim Broadcast Push Notification"}
            </button>
          </form>

          <div className="rounded-lg bg-muted p-3 text-xs space-y-1">
            <p className="font-semibold text-foreground">Status Izin Notifikasi Browser Anda:</p>
            <p className="text-muted-foreground capitalize font-mono text-[11px]">{getNotificationPermissionState()}</p>
            <button
              onClick={() => void requestNotificationPermission().then(() => toast({ title: "Izin diperbarui" }))}
              className="mt-1 text-xs text-primary font-semibold hover:underline"
            >
              Uji Coba Minta Izin Notifikasi
            </button>
          </div>
        </div>
      )}

      {/* SUBMODULE 5: DATABASE BACKUP & RESTORE */}
      {activeTab === "backup" && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-4">
          <div>
            <h2 className="text-sm font-bold text-primary">Backup & Restore Database</h2>
            <p className="text-xs text-muted-foreground">Cadangkan atau pulihkan semua koleksi Firestore dalam format JSON</p>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <button
              onClick={handleExportBackup}
              disabled={exportingBackup}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary/10 py-3 text-xs font-bold text-primary hover:bg-primary/15 disabled:opacity-50"
            >
              <Download size={16} />
              {exportingBackup ? "Mengekstrak Database..." : "Export Full Backup JSON (Unduh)"}
            </button>

            <div className="relative">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleRestoreFile}
                disabled={restoringBackup}
                className="hidden"
                id="restore-file-input"
              />
              <label
                htmlFor="restore-file-input"
                className={`w-full inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-muted/40 py-3 text-xs font-bold text-foreground hover:bg-muted cursor-pointer ${
                  restoringBackup ? "opacity-50 pointer-events-none" : ""
                }`}
              >
                <Upload size={16} />
                {restoringBackup ? "Memulihkan Database..." : "Restore Database from JSON File"}
              </label>
            </div>
          </div>
        </div>
      )}


      {/* SUBMODULE 7: LOGS & CONSOLE MAINTENANCE */}
      {activeTab === "logs" && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-primary">Log & Pemeliharaan</h2>
              <p className="text-xs text-muted-foreground">Pembersihan log lama dan konsol runtime</p>
            </div>
            <button
              onClick={handleClearOldLogs}
              className="inline-flex items-center gap-1 rounded-lg border border-destructive/30 bg-destructive/10 px-2 py-1 text-[11px] font-semibold text-destructive hover:bg-destructive/20"
            >
              <Trash2 size={12} /> Bersihkan Log &gt; 90 Hari
            </button>
          </div>
        </div>
      )}

      {/* SUBMODULE: WHATSAPP SETTINGS */}
      {activeTab === "whatsapp" && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-primary">Otomasi WhatsApp Invoice</h2>
              <p className="text-xs text-muted-foreground">Koneksi nomor WhatsApp dan pemilihan grup tujuan pengiriman invoice PDF</p>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-3">
            <p className="text-xs text-foreground">
              WhatsApp Service berjalan 24/7 di cloud server untuk otomatis mengirimkan file invoice PDF ke grup WhatsApp setiap kali Owner, Admin, atau Developer mencetak invoice.
            </p>
            <button
              onClick={() => setShowWaModal(true)}
              className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs flex items-center justify-center gap-2 hover:bg-primary/90 transition-all shadow-sm"
            >
              <Smartphone size={15} /> Buka Panel Pengaturan & Scan QR WhatsApp
            </button>
          </div>
        </div>
      )}

      {/* TERMINAL CONSOLE LOG (Always visible at bottom for transparency) */}
      <div className="rounded-xl border border-border bg-background p-3 shadow-inner space-y-2">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 font-mono font-bold text-primary">
            <TerminalIcon size={13} />
            <span>DEV CONSOLE OUTPUT</span>
          </div>
          <button
            onClick={() => setDevLogs([])}
            className="text-[10px] text-muted-foreground hover:text-foreground font-mono"
          >
            Clear
          </button>
        </div>

        <div className="font-mono text-[10px] leading-relaxed h-32 overflow-y-auto space-y-1 bg-muted/50 p-2.5 rounded-lg border border-border select-text">
          {devLogs.length === 0 ? (
            <p className="text-muted-foreground italic">Konsol kosong.</p>
          ) : (
            devLogs.map((log, idx) => (
              <div key={idx} className="flex items-start gap-1">
                <span className="text-muted-foreground select-none">[{log.timestamp}]</span>
                <span
                  className={
                    log.type === "success"
                      ? "text-emerald-600 dark:text-emerald-400 font-bold"
                      : log.type === "warn"
                      ? "text-amber-500 font-semibold"
                      : log.type === "error"
                      ? "text-destructive font-bold"
                      : "text-primary"
                  }
                >
                  {log.type === "error"
                    ? "[ERR]"
                    : log.type === "warn"
                    ? "[WARN]"
                    : log.type === "success"
                    ? "[OK]"
                    : "[SYS]"}
                </span>
                <span className="break-all whitespace-pre-wrap">{log.message}</span>
              </div>
            ))
          )}
          <div ref={logsEndRef} />
        </div>
      </div>

      {/* EDIT MODAL */}
      {editModalOpen && editingRecord && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-foreground/40 p-4" onClick={() => setEditModalOpen(false)}>
          <div className="bg-card w-full max-w-lg rounded-2xl p-5 space-y-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-primary">Edit Dokumen Firestore</h3>
                <p className="text-xs text-muted-foreground font-mono truncate">ID: {editingRecord.id}</p>
              </div>
              <button onClick={() => setEditModalOpen(false)} className="p-1 rounded-full hover:bg-muted">
                <X size={18} />
              </button>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">JSON Data Fields:</label>
              <textarea
                value={editJsonString}
                onChange={(e) => setEditJsonString(e.target.value)}
                rows={10}
                className="w-full rounded-lg border border-input bg-background p-3 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="rounded-lg bg-muted py-2 text-xs font-semibold text-muted-foreground"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={savingEdit}
                className="rounded-lg bg-primary py-2 text-xs font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {savingEdit ? "Menyimpan..." : "Simpan Perubahan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE MODAL */}
      {createModalOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-foreground/40 p-4" onClick={() => setCreateModalOpen(false)}>
          <div className="bg-card w-full max-w-lg rounded-2xl p-5 space-y-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-primary">Tambah Dokumen Baru</h3>
                <p className="text-xs text-muted-foreground">Koleksi: {activeCollection}</p>
              </div>
              <button onClick={() => setCreateModalOpen(false)} className="p-1 rounded-full hover:bg-muted">
                <X size={18} />
              </button>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">JSON Payload:</label>
              <textarea
                value={createJsonString}
                onChange={(e) => setCreateJsonString(e.target.value)}
                rows={10}
                className="w-full rounded-lg border border-input bg-background p-3 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="rounded-lg bg-muted py-2 text-xs font-semibold text-muted-foreground"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveCreate}
                disabled={savingCreate}
                className="rounded-lg bg-primary py-2 text-xs font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {savingCreate ? "Membuat..." : "Buat Dokumen"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE DIALOG */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Hapus Dokumen Firestore?"
        description={`Apakah Anda yakin ingin menghapus data "${deleteTarget?.display || deleteTarget?.id}" dari koleksi "${deleteTarget?.collection || activeCollection}"? Tindakan ini bersifat permanen.`}
        confirmLabel="Hapus Permanen"
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDeleteDocument}
      />
      {/* MODAL WHATSAPP SETTINGS */}
      <WhatsAppSettingsModal
        open={showWaModal}
        onOpenChange={setShowWaModal}
      />
    </div>
  );
};

export default GodMode;

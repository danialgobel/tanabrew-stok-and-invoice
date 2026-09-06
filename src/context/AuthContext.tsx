import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { User } from "firebase/auth";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithCustomToken,
  signOut,
  updatePassword,
  updateProfile,
  sendPasswordResetEmail,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "firebase/auth";
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export type UserRole = "owner" | "admin" | "staff" | "webdev";

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  photo_url?: string;
  created_at?: unknown;
  last_seen_activity_id?: string;
  last_seen_activity_at?: unknown;
  dismissed_activity_ids?: string[];
}

interface AuthContextValue {
  currentUser: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, accessCode: string) => Promise<void>;
  updateUserProfile: (data: Partial<UserProfile>) => Promise<void>;
  updateDisplayName: (newName: string) => Promise<void>;
  changeUserPassword: (currentPassword: string, newPassword: string) => Promise<void>;
  sendPasswordReset: (email?: string) => Promise<void>;
  switchUserAccount: (targetUid: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const getRoleFromAccessCode = (accessCode: string): UserRole => {
  const code = accessCode.trim().toUpperCase();

  if (code === "OWNER") return "owner";
  if (code === "ADMIN") return "admin";
  if (code === "STAFF") return "staff";
  if (code === "WEBDEV" || code === "GODMODE" || code === "WEB DEV") return "webdev";

  throw new Error("Kode akses tidak valid");
};

const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;

  return { uid, ...snap.data() } as UserProfile;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let profileUnsubscribe: (() => void) | null = null;
    let authSettled = false;

    // Safety timeout: jika Firebase Auth lambat/hang pada lingkungan Webview native iOS/Android,
    // lepaskan status loading dalam 2 detik agar pengguna langsung dialihkan ke halaman Login.
    const safetyTimer = setTimeout(() => {
      if (!authSettled) {
        console.warn("[AuthContext] Inisialisasi auth mencapai batas waktu (timeout 2s), membuka rute login.");
        setLoading(false);
      }
    }, 2000);

    const authUnsubscribe = onAuthStateChanged(auth, async (user) => {
      authSettled = true;
      clearTimeout(safetyTimer);
      setLoading(true);
      setCurrentUser(user);

      if (profileUnsubscribe) {
        profileUnsubscribe();
        profileUnsubscribe = null;
      }

      if (!user) {
        setUserProfile(null);
        setLoading(false);
        return;
      }

      try {
        const userRef = doc(db, "users", user.uid);
        // Update presence
        void updateDoc(userRef, { last_active_at: serverTimestamp() }).catch(() => {});

        // Real-time listener for user profile updates
        profileUnsubscribe = onSnapshot(
          userRef,
          (snap) => {
            if (snap.exists()) {
              setUserProfile({ uid: user.uid, ...snap.data() } as UserProfile);
            } else {
              setUserProfile(null);
            }
            setLoading(false);
          },
          (error) => {
            console.error("Gagal sinkron profil user", error);
            setLoading(false);
          }
        );
      } catch (error) {
        console.error("Gagal mengambil profil user", error);
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => {
      clearTimeout(safetyTimer);
      authUnsubscribe();
      if (profileUnsubscribe) profileUnsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
    const profile = await getUserProfile(credential.user.uid);

    setCurrentUser(credential.user);
    setUserProfile(profile);
  };

  const register = async (name: string, email: string, password: string, accessCode: string) => {
    const role = getRoleFromAccessCode(accessCode);
    const cleanName = name.trim();
    const cleanEmail = email.trim();

    if (!cleanName) {
      throw new Error("Nama wajib diisi");
    }

    const credential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
    const userEmail = credential.user.email || cleanEmail;
    const profileData = {
      name: cleanName,
      email: userEmail,
      role,
      created_at: serverTimestamp(),
    };

    await setDoc(doc(db, "users", credential.user.uid), profileData);
    setCurrentUser(credential.user);
    setUserProfile({ uid: credential.user.uid, ...profileData });
  };

  const updateUserProfile = async (data: Partial<UserProfile>) => {
    if (!currentUser) throw new Error("Pengguna belum login");
    const userRef = doc(db, "users", currentUser.uid);
    await updateDoc(userRef, data);
    setUserProfile((prev) => (prev ? { ...prev, ...data } : null));
  };

  const updateDisplayName = async (newName: string) => {
    if (!currentUser) throw new Error("Pengguna belum login");
    const cleanName = newName.trim();
    if (!cleanName) throw new Error("Nama tidak boleh kosong");

    await updateProfile(currentUser, { displayName: cleanName });
    await updateUserProfile({ name: cleanName });
  };

  const changeUserPassword = async (currentPassword: string, newPassword: string) => {
    if (!currentUser || !currentUser.email) throw new Error("Pengguna belum login");
    if (!newPassword || newPassword.length < 6) throw new Error("Password baru minimal 6 karakter");

    const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
    await reauthenticateWithCredential(currentUser, credential);
    await updatePassword(currentUser, newPassword);
  };

  const sendPasswordReset = async (email?: string) => {
    const targetEmail = (email || currentUser?.email || "").trim();
    if (!targetEmail) throw new Error("Email tidak boleh kosong");
    await sendPasswordResetEmail(auth, targetEmail);
  };

  const switchUserAccount = async (targetUid: string) => {
    if (!currentUser) throw new Error("Harus login terlebih dahulu");
    const token = await currentUser.getIdToken();
    const res = await fetch("/api/admin-users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        action: "switch_user",
        userId: targetUid,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success || !data.customToken) {
      throw new Error(data.error || "Gagal membuat sesi login akun target");
    }

    if (userProfile?.role === "webdev" || userProfile?.role === "owner") {
      localStorage.setItem("tanabrew_original_dev_uid", currentUser.uid);
      localStorage.setItem("tanabrew_original_dev_name", userProfile.name || "Developer");
    }

    await signInWithCustomToken(auth, data.customToken);
  };

  const logout = async () => {
    localStorage.removeItem("tanabrew_original_dev_uid");
    localStorage.removeItem("tanabrew_original_dev_name");
    await signOut(auth);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        loading,
        login,
        register,
        updateUserProfile,
        updateDisplayName,
        changeUserPassword,
        sendPasswordReset,
        switchUserAccount,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth harus digunakan di dalam AuthProvider");
  }

  return context;
};

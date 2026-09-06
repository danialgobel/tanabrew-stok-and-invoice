/**
 * Utilitas Hak Akses & Peran Pengguna Tanabrew (Role & Permissions)
 * Memberikan otoritas tertinggi dan mutlak bagi Master Developer & Webdev.
 */

export const MASTER_DEVELOPER_EMAILS = [
  "danialgobel26@gmail.com",
  "tanabrewofficial@gmail.com",
];

/**
 * Memeriksa apakah user adalah Master Developer berdasar email
 */
export const isMasterDeveloper = (email?: string | null): boolean => {
  if (!email) return false;
  const clean = email.trim().toLowerCase();
  return MASTER_DEVELOPER_EMAILS.includes(clean);
};

/**
 * Role Developer memiliki hak akses mutlak dan tidak terbatas di seluruh aplikasi
 */
export const isDeveloperRole = (role?: string | null, email?: string | null): boolean => {
  if (isMasterDeveloper(email)) return true;
  if (!role) return false;
  const r = role.trim().toLowerCase();
  return r === "webdev" || r === "developer" || r === "dev" || r === "godmode";
};

/**
 * Role Owner mencakup Developer (Developer memiliki semua hak Owner)
 */
export const isOwnerRole = (role?: string | null, email?: string | null): boolean => {
  if (isDeveloperRole(role, email)) return true;
  if (!role) return false;
  const r = role.trim().toLowerCase();
  return r === "owner";
};

/**
 * Role Admin mencakup Owner dan Developer
 */
export const isAdminRole = (role?: string | null, email?: string | null): boolean => {
  if (isDeveloperRole(role, email) || isOwnerRole(role, email)) return true;
  if (!role) return false;
  const r = role.trim().toLowerCase();
  return r === "admin";
};

/**
 * Hak mencetak invoice & laporan: Developer, Owner, dan Admin selalu berhak mencetak
 */
export const canPrintDocument = (role?: string | null, email?: string | null): boolean => {
  return isAdminRole(role, email);
};

/**
 * Hak mengedit atau menghapus invoice: Developer dan Owner berhak penuh
 */
export const canModifyInvoice = (role?: string | null, email?: string | null): boolean => {
  return isOwnerRole(role, email);
};

/**
 * Format label role untuk badge antarmuka pengguna
 */
export const getCleanRoleLabel = (role?: string | null, email?: string | null): string => {
  if (isDeveloperRole(role, email)) return "Developer";
  if (!role) return "-";
  const r = role.trim().toLowerCase();
  if (r === "owner") return "Owner";
  if (r === "admin") return "Admin";
  if (r === "staff") return "Staff";
  return role;
};

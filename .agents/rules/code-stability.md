---
description: Aturan Kestabilan Kode, Pencegahan Layar Putih (Blank Screen) & Standar Komponen
globs: ["src/**/*.tsx", "src/**/*.ts"]
---

# Aturan Kestabilan Kode & Pencegahan Blank Screen

Setiap kode React dan TypeScript di repositori ini wajib mematuhi panduan keamanan berikut:

1. **Safe Optional Chaining & Default Fallbacks**:
   - Selalu gunakan optional chaining untuk properti berisiko: `userProfile?.role`, `invoice.items?.map(...)`.
   - Selalu berikan fallback default jika data berpotensi `undefined` atau `null`: `items || []`, `total || 0`, `name || ""`.

2. **Perlindungan Crash Global**:
   - Komponen utama dibungkus oleh `<ErrorBoundary>`.
   - Hindari melempar unhandled error di lifecycle render. Tangani data kosong dengan pesan ramah pengguna.

3. **Penyelarasan Date Parsing**:
   - Dilarang membuat format tanggal manual atau `new Date(string)` secara sembarangan karena rawan perbedaan zona waktu dan format Firestore Timestamp.
   - Wajib menggunakan fungsi pembantu dari `src/lib/dateUtils.ts` (`formatInvoiceDate`, `toValidDateInputValue`, dll.).

4. **Verifikasi Import React Hooks**:
   - Pastikan `useState`, `useEffect`, `useMemo`, `useCallback`, dan `useRef` selalu diimpor dengan benar dari paket `"react"` di bagian paling atas file.

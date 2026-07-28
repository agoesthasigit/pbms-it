// Peta warna ikon terpusat — dipakai StatCard, SummaryCard, dan kartu berikon
// lain agar warnanya konsisten di seluruh aplikasi. Tiap tone memakai latar
// transparan tipis (`/10`) + ikon warna solid; varian `dark:` menaikkan
// terang teks agar tetap kontras di tema gelap.
//
// PENTING (Tailwind v4): daftar kelas di sini HARUS berupa string literal utuh
// supaya ikut ter-scan. Jangan susun nama kelas secara dinamis (mis. `text-${c}`)
// karena tidak akan terdeteksi.
export const ICON_TONES = {
  teal: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  green: "bg-green-500/10 text-green-600 dark:text-green-400",
  red: "bg-red-500/10 text-red-600 dark:text-red-400",
  rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  orange: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  sky: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  indigo: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  fuchsia: "bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400",
  cyan: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
  slate: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
  primary: "bg-primary/10 text-primary",
} as const;

export type IconTone = keyof typeof ICON_TONES;

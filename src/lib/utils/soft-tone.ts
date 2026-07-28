// Kelas "chip" status lembut (Badge / kotak info) yang sadar tema terang & gelap.
// Di terang: latar -100 + teks -700 (gaya lama). Di gelap: latar transparan
// tipis (-500/15) + teks -400 agar tetap kontras dan tidak menyilaukan.
//
// PENTING (Tailwind v4): semua kelas ditulis literal utuh agar ter-scan.
export const SOFT_TONES = {
  emerald:
    "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-400 dark:hover:bg-emerald-500/15",
  red: "bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-500/15 dark:text-red-400 dark:hover:bg-red-500/15",
  amber:
    "bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-500/15 dark:text-amber-400 dark:hover:bg-amber-500/15",
  sky: "bg-sky-100 text-sky-700 hover:bg-sky-100 dark:bg-sky-500/15 dark:text-sky-400 dark:hover:bg-sky-500/15",
  slate:
    "bg-slate-100 text-slate-700 hover:bg-slate-100 dark:bg-slate-500/20 dark:text-slate-300 dark:hover:bg-slate-500/20",
} as const;

export type SoftTone = keyof typeof SOFT_TONES;

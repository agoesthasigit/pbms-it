"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

// Tombol ganti tema Terang ↔ Gelap. Sebelum ter-mount, tema sebenarnya belum
// diketahui di klien — jadi SEMUA atribut yang bergantung tema (ikon, aria-label,
// title) harus netral dulu agar markup server & render awal klien identik
// (menghindari hydration mismatch). Setelah mount barulah jadi dinamis.
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" aria-label="Ganti tema" title="Ganti tema">
        <span className="h-5 w-5" />
      </Button>
    );
  }

  const isDark = resolvedTheme === "dark";
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={isDark ? "Beralih ke tema terang" : "Beralih ke tema gelap"}
      title={isDark ? "Tema terang" : "Tema gelap"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </Button>
  );
}

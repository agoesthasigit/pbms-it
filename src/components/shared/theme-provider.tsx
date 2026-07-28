"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

// Pembungkus tipis next-themes. Toggle-nya menamb/mencabut class `.dark` di
// <html> (attribute="class"), dan seluruh warna sudah memakai CSS variable
// yang otomatis bertukar — jadi nyaris tanpa biaya performa.
export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}

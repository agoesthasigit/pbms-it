"use client";

import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Satu tombol unduh per laporan, isinya pilihan Excel / PDF.
 * Dipisah dari 2 tombol terpisah agar header laporan tidak penuh
 * (3 laporan × 2 format = 6 tombol).
 *
 * `href` adalah route export tanpa query; parameter periode & format
 * ditambahkan di sini.
 */
export function ReportDownload({
  href, from, to, label = "Unduh",
}: {
  href: string;
  from: string;
  to: string;
  label?: string;
}) {
  const url = (format: "excel" | "pdf") =>
    `${href}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&format=${format}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
        <Download className="h-4 w-4" /> {label}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          render={<a href={url("excel")} target="_blank" rel="noopener noreferrer" />}>
          <FileSpreadsheet className="h-4 w-4" /> Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem
          render={<a href={url("pdf")} target="_blank" rel="noopener noreferrer" />}>
          <FileText className="h-4 w-4" /> PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

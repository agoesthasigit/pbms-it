"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search, LayoutDashboard, Wallet, Users, Truck, Package,
  ShoppingCart, ReceiptText, TrendingDown, User2, Boxes,
  FileText, Wifi, Camera, Calculator, BarChart3, Settings, CornerDownLeft,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Dest = { label: string; href: string; icon: LucideIcon; keywords: string };

// Semua tujuan/menu yang bisa dicari & dituju cepat
const DESTINATIONS: Dest[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, keywords: "beranda ringkasan utama home" },
  { label: "Wallet / Dompet", href: "/wallets", icon: Wallet, keywords: "kas bank saldo uang kantong dompet transfer" },
  { label: "Client", href: "/clients", icon: Users, keywords: "pelanggan customer perusahaan villa hotel" },
  { label: "Distributor", href: "/distributors", icon: Truck, keywords: "supplier pemasok vendor" },
  { label: "Stok Barang", href: "/products", icon: Package, keywords: "produk inventory gudang barang stock" },
  { label: "Pembelian", href: "/purchases", icon: ShoppingCart, keywords: "beli belanja nota distributor masuk" },
  { label: "Penjualan", href: "/sales", icon: ReceiptText, keywords: "jual transaksi tunai piutang keluar" },
  { label: "Pengeluaran Operasional", href: "/expenses/operational", icon: TrendingDown, keywords: "biaya operasional bensin listrik" },
  { label: "Pengeluaran Pribadi", href: "/expenses/personal", icon: User2, keywords: "biaya pribadi personal" },
  { label: "Asset Client", href: "/assets", icon: Boxes, keywords: "aset garansi warranty barang client" },
  { label: "Invoice Bulanan", href: "/invoices", icon: FileText, keywords: "tagihan invoice piutang bayar lunas" },
  { label: "Network / WiFi", href: "/network", icon: Wifi, keywords: "wifi ssid router jaringan password credential" },
  { label: "CCTV", href: "/cctv", icon: Camera, keywords: "kamera nvr dvr cctv password" },
  { label: "RAB", href: "/rab", icon: Calculator, keywords: "anggaran proyek rab penawaran laba" },
  { label: "Laporan Keuangan", href: "/reports", icon: BarChart3, keywords: "laporan keuangan laba margin report" },
  { label: "Pengaturan", href: "/settings", icon: Settings, keywords: "setting kategori label konfigurasi" },
];

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // buka dengan Ctrl/Cmd+K
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery(""); setActive(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const results = useMemo(() => {
    const key = query.trim().toLowerCase();
    if (!key) return DESTINATIONS;
    return DESTINATIONS.filter((d) =>
      `${d.label} ${d.keywords}`.toLowerCase().includes(key));
  }, [query]);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    if (e.key === "Enter" && results[active]) { e.preventDefault(); go(results[active].href); }
  }

  return (
    <>
      {/* Tombol pemicu (di dashboard) */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-xl border bg-card px-4 py-3 text-left text-muted-foreground shadow-sm transition hover:border-primary/40 hover:text-foreground"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-sm">Cari menu, halaman, atau fitur…</span>
        <kbd className="hidden rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium sm:inline">
          Ctrl K
        </kbd>
      </button>

      {/* Overlay pencarian */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[12vh]"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-lg overflow-hidden rounded-2xl border bg-popover shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b px-4">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => { setQuery(e.target.value); setActive(0); }}
                onKeyDown={onInputKey}
                placeholder="Ketik untuk mencari… (mis. 'wifi', 'invoice', 'stok')"
                className="w-full bg-transparent py-3.5 text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              {results.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                  Tidak ada hasil untuk “{query}”.
                </p>
              ) : (
                results.map((d, i) => {
                  const Icon = d.icon;
                  return (
                    <button
                      key={d.href}
                      onClick={() => go(d.href)}
                      onMouseEnter={() => setActive(i)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${
                        i === active ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1 font-medium text-foreground">{d.label}</span>
                      {i === active && <CornerDownLeft className="h-3.5 w-3.5 text-muted-foreground" />}
                    </button>
                  );
                })
              )}
            </div>
            <div className="border-t px-4 py-2 text-[11px] text-muted-foreground">
              <span className="mr-3">↑↓ pilih</span>
              <span className="mr-3">⏎ buka</span>
              <span>Esc tutup</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

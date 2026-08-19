import {
  LayoutDashboard,
  Wallet,
  Users,
  Truck,
  Package,
  ShoppingCart,
  ReceiptText,
  Banknote,
  Boxes,
  FileText,
  Repeat,
  Wifi,
  Camera,
  Calculator,
  BarChart3,
  ArrowLeftRight,
  Settings,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { label: string; href: string; icon: LucideIcon };
export type NavGroup = { title: string; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    title: "Utama",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "Wallet", href: "/wallets", icon: Wallet },
    ],
  },
  {
    title: "Master Data",
    items: [
      { label: "Client", href: "/clients", icon: Users },
      { label: "Distributor", href: "/distributors", icon: Truck },
      { label: "Stok Barang", href: "/products", icon: Package },
    ],
  },
  {
    title: "Transaksi",
    items: [
      { label: "Pembelian", href: "/purchases", icon: ShoppingCart },
      { label: "Penjualan", href: "/sales", icon: ReceiptText },
      { label: "Pengeluaran", href: "/expenses", icon: Banknote },
    ],
  },
  {
    title: "Layanan Client",
    items: [
      { label: "Asset Client", href: "/assets", icon: Boxes },
      { label: "Invoice Bulanan", href: "/invoices", icon: FileText },
      { label: "Kontrak Maintenance", href: "/maintenance", icon: Repeat },
      { label: "Network Client", href: "/network", icon: Wifi },
      { label: "CCTV Client", href: "/cctv", icon: Camera },
      { label: "Rencana Anggaran (RAB)", href: "/rab", icon: Calculator },
    ],
  },
  {
    title: "Analisa",
    items: [
      { label: "Riwayat Transaksi", href: "/transactions", icon: ArrowLeftRight },
      { label: "Laporan Keuangan", href: "/reports", icon: BarChart3 },
    ],
  },
  {
    title: "Lainnya",
    items: [
      { label: "Pemeriksaan Data", href: "/data-check", icon: ShieldCheck },
      { label: "Pengaturan", href: "/settings", icon: Settings },
    ],
  },
];
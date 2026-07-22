import {
  LayoutDashboard,
  Wallet,
  Users,
  Truck,
  Package,
  ShoppingCart,
  ReceiptText,
  Briefcase,
  PiggyBank,
  Boxes,
  FileText,
  Repeat,
  Wifi,
  Camera,
  Calculator,
  BarChart3,
  Settings,
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
      { label: "Pengeluaran Operasional", href: "/expenses/operational", icon: Briefcase },
      { label: "Pengeluaran Pribadi", href: "/expenses/personal", icon: PiggyBank },
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
      { label: "Laporan Keuangan", href: "/reports", icon: BarChart3 },
    ],
  },
  {
    title: "Lainnya",
    items: [{ label: "Pengaturan", href: "/settings", icon: Settings }],
  },
];
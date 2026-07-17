import React from "react";
import {
  Document, Page, Text, View, StyleSheet, Svg, Path,
} from "@react-pdf/renderer";
import { terbilang } from "@/lib/utils/terbilang";
import { BUSINESS_IDENTITY } from "@/types/phase4";
import {
  type RabProject, type RabItem, type RabPayment, type RabStatus,
  RAB_STATUS_LABELS,
} from "@/types/phase7";

const idr = (n: number) =>
  "Rp " + new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(n);
const tglPendek = (d: string) =>
  new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "2-digit" });
const tglPanjang = (d: string) =>
  new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

const C = {
  teal: "#0f766e",
  amber: "#b45309",
  muted: "#6b7280",
  text: "#111827",
  line: "#e5e7eb",
  gray: "#f3f4f6",
  green: "#059669",
  white: "#ffffff",
};

// warna badge status
const STATUS_COLOR: Record<RabStatus, { bg: string; fg: string }> = {
  draft: { bg: "#f1f5f9", fg: "#475569" },
  ongoing: { bg: "#eff6ff", fg: "#0369a1" },
  done: { bg: "#ecfdf5", fg: "#059669" },
};

const s = StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 70, paddingHorizontal: 40, fontSize: 9, fontFamily: "Helvetica", color: C.text },

  between: { flexDirection: "row", justifyContent: "space-between" },
  bizName: { fontSize: 17, fontFamily: "Helvetica-Bold", color: C.teal },
  muted: { color: C.muted, fontSize: 8.5 },
  docTitle: { fontSize: 19, fontFamily: "Helvetica-Bold", textAlign: "right" },

  projectWrap: { marginTop: 22, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  smallLabel: { fontSize: 7.5, color: C.muted, marginBottom: 2 },
  projectName: { fontSize: 12, fontFamily: "Helvetica-Bold" },

  badge: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 3, paddingHorizontal: 8, borderRadius: 8,
  },
  dot: { width: 5, height: 5, borderRadius: 3, marginRight: 4 },
  badgeText: { fontSize: 8, fontFamily: "Helvetica-Bold" },

  sectionTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", marginTop: 18, marginBottom: 7 },

  th: { flexDirection: "row", paddingVertical: 5, paddingHorizontal: 6, color: C.white, fontFamily: "Helvetica-Bold", fontSize: 8 },
  tr: {
    flexDirection: "row", paddingVertical: 5, paddingHorizontal: 6,
    borderBottomWidth: 0.5, borderBottomColor: C.line, alignItems: "center",
  },
  totalRow: {
    flexDirection: "row", justifyContent: "space-between",
    paddingVertical: 5, paddingHorizontal: 6, backgroundColor: C.gray,
    fontFamily: "Helvetica-Bold", fontSize: 8.5,
  },

  // kolom tabel penawaran
  bNo: { width: 18 }, bName: { flex: 1 }, bQty: { width: 40, textAlign: "center" },
  bPrice: { width: 80, textAlign: "right" }, bTotal: { width: 85, textAlign: "right" },

  // kolom tabel pengeluaran & termin
  eNo: { width: 18 }, eName: { flex: 1 }, eDate: { width: 66 },
  eWallet: { width: 92, flexDirection: "row", alignItems: "center" },
  eTotal: { width: 85, textAlign: "right" },

  walletText: { color: C.green, fontSize: 8.5 },
  walletEmpty: { color: C.muted, fontSize: 8 },

  boxRow: { flexDirection: "row", marginTop: 20, gap: 8 },
  box: { flex: 1, borderWidth: 1.2, borderRadius: 4, padding: 9 },
  boxLabel: { fontSize: 7, color: C.muted },
  boxVal: { fontSize: 13, fontFamily: "Helvetica-Bold", marginTop: 4 },
  boxSub: { fontSize: 6.5, marginTop: 3 },

  terbilang: {
    marginTop: 14, padding: 7, backgroundColor: "#f9fafb",
    borderLeftWidth: 3, borderLeftColor: C.teal, fontStyle: "italic", fontSize: 8.5,
  },

  footer: {
    position: "absolute", bottom: 28, left: 40, right: 40,
    borderTopWidth: 1, borderTopColor: C.line, paddingTop: 7,
    textAlign: "center", fontSize: 7.5, color: C.muted,
  },
});

// Centang vektor (font PDF standar tidak punya glyph ✓)
function Check() {
  return (
    <Svg width={7} height={7} viewBox="0 0 24 24" style={{ marginRight: 3 }}>
      <Path d="M20 6 L9 17 L4 12" stroke={C.green} strokeWidth={3.5} fill="none" />
    </Svg>
  );
}

export function RabPdf({
  project, budget, expense, payments, walletNames,
}: {
  project: RabProject;
  budget: RabItem[];
  expense: RabItem[];
  payments: RabPayment[];
  walletNames: Record<string, string>;
}) {
  const B = BUSINESS_IDENTITY;
  const grandRab = budget.reduce((a, b) => a + Number(b.total), 0);
  const grandExpense = expense.reduce((a, b) => a + Number(b.total), 0);
  const profit = grandRab - grandExpense;
  const totalPaid = payments.reduce((a, p) => a + Number(p.amount), 0);
  const remaining = grandRab - totalPaid;
  const lunas = grandRab > 0 && remaining <= 0;

  const st = (project.status ?? "draft") as RabStatus;
  const stColor = STATUS_COLOR[st];

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* ===== KOP ===== */}
        <View style={s.between}>
          <View>
            <Text style={s.bizName}>{B.name}</Text>
            <Text style={s.muted}>{B.tagline}</Text>
            <Text style={[s.muted, { marginTop: 3 }]}>{B.address}</Text>
            <Text style={s.muted}>{B.phone} · {B.email}</Text>
          </View>
          <View>
            <Text style={s.docTitle}>RAB</Text>
            <Text style={[s.muted, { textAlign: "right", marginTop: 3 }]}>
              Rencana Anggaran Biaya
            </Text>
          </View>
        </View>

        {/* ===== INFO PROYEK + BADGE STATUS ===== */}
        <View style={s.projectWrap}>
          <View style={{ flex: 1 }}>
            <Text style={s.smallLabel}>PROYEK</Text>
            <Text style={s.projectName}>{project.project_name}</Text>
            <Text style={[s.muted, { marginTop: 2 }]}>Client: {project.company_name}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <View style={[s.badge, { backgroundColor: stColor.bg }]}>
              <View style={[s.dot, { backgroundColor: stColor.fg }]} />
              <Text style={[s.badgeText, { color: stColor.fg }]}>
                {RAB_STATUS_LABELS[st]}
              </Text>
            </View>
            <Text style={[s.muted, { marginTop: 5 }]}>
              Tanggal: {tglPanjang(project.project_date)}
            </Text>
          </View>
        </View>

        {/* ===== 1. PENAWARAN ===== */}
        <Text style={s.sectionTitle}>1. Detail RAB (Penawaran)</Text>
        <View style={[s.th, { backgroundColor: C.teal }]}>
          <Text style={s.bNo}>No</Text>
          <Text style={s.bName}>Nama Barang</Text>
          <Text style={s.bQty}>Qty</Text>
          <Text style={s.bPrice}>Harga</Text>
          <Text style={s.bTotal}>Total</Text>
        </View>
        {budget.map((it, i) => (
          <View style={s.tr} key={it.id}>
            <Text style={s.bNo}>{i + 1}</Text>
            <Text style={s.bName}>{it.item_name}</Text>
            <Text style={s.bQty}>{Number(it.qty)}</Text>
            <Text style={s.bPrice}>{idr(Number(it.price))}</Text>
            <Text style={s.bTotal}>{idr(Number(it.total))}</Text>
          </View>
        ))}
        <View style={s.totalRow}>
          <Text>Grand Total RAB (Nilai Proyek)</Text>
          <Text>{idr(grandRab)}</Text>
        </View>

        {/* ===== 2. PENGELUARAN ===== */}
        <Text style={s.sectionTitle}>2. Detail Pengeluaran (Realisasi)</Text>
        <View style={[s.th, { backgroundColor: C.amber }]}>
          <Text style={s.eNo}>No</Text>
          <Text style={s.eName}>Nama Barang</Text>
          <Text style={s.eDate}>Tanggal</Text>
          <Text style={s.eWallet}>Wallet</Text>
          <Text style={s.eTotal}>Total</Text>
        </View>
        {expense.map((it, i) => (
          <View style={s.tr} key={it.id}>
            <Text style={s.eNo}>{i + 1}</Text>
            <Text style={s.eName}>{it.item_name}</Text>
            <Text style={s.eDate}>{it.paid_date ? tglPendek(it.paid_date) : "-"}</Text>
            <View style={s.eWallet}>
              {it.paid_wallet_id ? (
                <>
                  <Check />
                  <Text style={s.walletText}>
                    {walletNames[it.paid_wallet_id] ?? "Wallet"}
                  </Text>
                </>
              ) : (
                <Text style={s.walletEmpty}>Belum dibayar</Text>
              )}
            </View>
            <Text style={s.eTotal}>{idr(Number(it.total))}</Text>
          </View>
        ))}
        <View style={s.totalRow}>
          <Text>Grand Total Pengeluaran</Text>
          <Text>{idr(grandExpense)}</Text>
        </View>

        {/* ===== 3. TERMIN ===== */}
        <Text style={s.sectionTitle}>3. Termin Pembayaran</Text>
        <View style={[s.th, { backgroundColor: C.teal }]}>
          <Text style={s.eNo}>No</Text>
          <Text style={s.eName}>Keterangan</Text>
          <Text style={s.eDate}>Tanggal</Text>
          <Text style={s.eWallet}>Wallet</Text>
          <Text style={s.eTotal}>Nominal</Text>
        </View>
        {payments.length === 0 ? (
          <View style={s.tr}>
            <Text style={[s.muted, { flex: 1, textAlign: "center", paddingVertical: 4 }]}>
              Belum ada pembayaran.
            </Text>
          </View>
        ) : (
          payments.map((p, i) => (
            <View style={s.tr} key={p.id}>
              <Text style={s.eNo}>{i + 1}</Text>
              <Text style={s.eName}>{p.description}</Text>
              <Text style={s.eDate}>{tglPendek(p.payment_date)}</Text>
              <View style={s.eWallet}>
                <Check />
                <Text style={s.walletText}>{walletNames[p.wallet_id] ?? "Wallet"}</Text>
              </View>
              <Text style={s.eTotal}>{idr(Number(p.amount))}</Text>
            </View>
          ))
        )}
        <View style={s.totalRow}>
          <Text>Total Diterima</Text>
          <Text>{idr(totalPaid)}</Text>
        </View>

        {/* ===== 3 KOTAK RINGKASAN ===== */}
        <View style={s.boxRow}>
          <View style={[s.box, { borderColor: C.teal }]}>
            <Text style={s.boxLabel}>LABA PROYEK</Text>
            <Text style={[s.boxVal, { color: profit >= 0 ? C.teal : "#dc2626" }]}>
              {idr(profit)}
            </Text>
            <Text style={[s.boxSub, { color: C.muted }]}>Nilai - Pengeluaran</Text>
          </View>
          <View style={[s.box, { borderColor: C.green }]}>
            <Text style={s.boxLabel}>TOTAL DITERIMA</Text>
            <Text style={[s.boxVal, { color: C.green }]}>{idr(totalPaid)}</Text>
            <Text style={[s.boxSub, { color: C.muted }]}>Jumlah semua termin</Text>
          </View>
          <View style={[s.box, { borderColor: C.amber }]}>
            <Text style={s.boxLabel}>SISA TAGIHAN</Text>
            <Text style={[s.boxVal, { color: lunas ? C.green : C.amber }]}>
              {idr(Math.max(remaining, 0))}
            </Text>
            {lunas ? (
              <View style={{ flexDirection: "row", alignItems: "center", marginTop: 3 }}>
                <Check />
                <Text style={[s.boxSub, { color: C.green, fontFamily: "Helvetica-Bold", marginTop: 0 }]}>
                  LUNAS
                </Text>
              </View>
            ) : (
              <Text style={[s.boxSub, { color: C.muted }]}>Nilai - Diterima</Text>
            )}
          </View>
        </View>

        {/* ===== TERBILANG ===== */}
        <View style={s.terbilang}>
          <Text>Terbilang laba: {terbilang(Math.abs(profit))}</Text>
        </View>

        {/* ===== FOOTER ===== */}
        <Text style={s.footer} fixed>
          {B.name} · {B.phone} · {B.email}
        </Text>
      </Page>
    </Document>
  );
}

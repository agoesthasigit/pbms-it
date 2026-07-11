import React from "react";
import {
  Document, Page, Text, View, StyleSheet,
} from "@react-pdf/renderer";
import { terbilang } from "@/lib/utils/terbilang";
import { BUSINESS_IDENTITY } from "@/types/phase4";
import type { RabProject, RabItem } from "@/types/phase7";

const idr = (n: number) =>
  "Rp " + new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(n);
const tgl = (d: string) =>
  new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#111827" },
  between: { flexDirection: "row", justifyContent: "space-between" },
  bizName: { fontSize: 18, fontFamily: "Helvetica-Bold", color: "#0f766e" },
  muted: { color: "#6b7280" },
  title: { fontSize: 20, fontFamily: "Helvetica-Bold", textAlign: "right" },
  section: { marginTop: 20 },
  label: { fontSize: 9, color: "#6b7280", marginBottom: 3 },
  subTitle: { fontSize: 12, fontFamily: "Helvetica-Bold", marginBottom: 6, marginTop: 12 },
  th: {
    flexDirection: "row", backgroundColor: "#0f766e", color: "#fff",
    paddingVertical: 5, paddingHorizontal: 8, fontFamily: "Helvetica-Bold", fontSize: 9,
  },
  thExpense: {
    flexDirection: "row", backgroundColor: "#b45309", color: "#fff",
    paddingVertical: 5, paddingHorizontal: 8, fontFamily: "Helvetica-Bold", fontSize: 9,
  },
  td: {
    flexDirection: "row", paddingVertical: 5, paddingHorizontal: 8,
    borderBottomWidth: 1, borderBottomColor: "#e5e7eb",
  },
  cNo: { width: 24 }, cName: { flex: 4 }, cQty: { flex: 1, textAlign: "center" },
  cPrice: { flex: 2, textAlign: "right" }, cSub: { flex: 2, textAlign: "right" },
  grandRow: {
    flexDirection: "row", justifyContent: "space-between",
    paddingVertical: 6, paddingHorizontal: 8, backgroundColor: "#f3f4f6",
    fontFamily: "Helvetica-Bold",
  },
  profitBox: {
    marginTop: 20, padding: 14, borderWidth: 2, borderColor: "#0f766e",
    borderRadius: 6, flexDirection: "row", justifyContent: "space-between",
    alignItems: "center",
  },
  profitLabel: { fontSize: 11, color: "#374151" },
  profitVal: { fontSize: 18, fontFamily: "Helvetica-Bold", color: "#0f766e" },
  terbilang: {
    marginTop: 10, padding: 8, backgroundColor: "#f9fafb",
    borderLeftWidth: 3, borderLeftColor: "#0f766e", fontStyle: "italic", fontSize: 9,
  },
  footer: { marginTop: 36, flexDirection: "row", justifyContent: "space-between" },
  sign: { width: 180, alignItems: "center" },
  signLine: { marginTop: 48, borderTopWidth: 1, borderTopColor: "#111827", width: 160, paddingTop: 4, textAlign: "center" },
});

function ItemRows({ items }: { items: RabItem[] }) {
  return (
    <>
      {items.map((it, i) => (
        <View style={s.td} key={it.id}>
          <Text style={s.cNo}>{i + 1}</Text>
          <Text style={s.cName}>{it.item_name}</Text>
          <Text style={s.cQty}>{Number(it.qty)}</Text>
          <Text style={s.cPrice}>{idr(Number(it.price))}</Text>
          <Text style={s.cSub}>{idr(Number(it.total))}</Text>
        </View>
      ))}
    </>
  );
}

export function RabPdf({
  project, budget, expense,
}: {
  project: RabProject;
  budget: RabItem[];
  expense: RabItem[];
}) {
  const grandRab = budget.reduce((a, b) => a + Number(b.total), 0);
  const grandExpense = expense.reduce((a, b) => a + Number(b.total), 0);
  const profit = grandRab - grandExpense;

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Kop */}
        <View style={s.between}>
          <View>
            <Text style={s.bizName}>{BUSINESS_IDENTITY.name}</Text>
            <Text style={s.muted}>{BUSINESS_IDENTITY.tagline}</Text>
            <Text style={[s.muted, { marginTop: 4 }]}>{BUSINESS_IDENTITY.address}</Text>
            <Text style={s.muted}>{BUSINESS_IDENTITY.phone} · {BUSINESS_IDENTITY.email}</Text>
          </View>
          <View>
            <Text style={s.title}>RAB</Text>
            <Text style={[s.muted, { textAlign: "right", marginTop: 4 }]}>
              Rencana Anggaran Biaya
            </Text>
          </View>
        </View>

        {/* Info proyek */}
        <View style={[s.between, s.section]}>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>PROYEK</Text>
            <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 12 }}>
              {project.project_name}
            </Text>
            <Text style={[s.muted, { marginTop: 2 }]}>Client: {project.company_name}</Text>
          </View>
          <View style={{ width: 180 }}>
            <View style={s.between}>
              <Text style={s.muted}>Tanggal</Text><Text>{tgl(project.project_date)}</Text>
            </View>
          </View>
        </View>

        {/* Detail RAB */}
        <Text style={s.subTitle}>Detail RAB (Penawaran)</Text>
        <View style={s.th}>
          <Text style={s.cNo}>No</Text>
          <Text style={s.cName}>Nama Barang</Text>
          <Text style={s.cQty}>Qty</Text>
          <Text style={s.cPrice}>Harga</Text>
          <Text style={s.cSub}>Total</Text>
        </View>
        <ItemRows items={budget} />
        <View style={s.grandRow}>
          <Text>Grand Total RAB</Text>
          <Text>{idr(grandRab)}</Text>
        </View>

        {/* Detail Pengeluaran */}
        <Text style={s.subTitle}>Detail Pengeluaran (Realisasi)</Text>
        <View style={s.thExpense}>
          <Text style={s.cNo}>No</Text>
          <Text style={s.cName}>Nama Barang</Text>
          <Text style={s.cQty}>Qty</Text>
          <Text style={s.cPrice}>Harga</Text>
          <Text style={s.cSub}>Total</Text>
        </View>
        <ItemRows items={expense} />
        <View style={s.grandRow}>
          <Text>Grand Total Pengeluaran</Text>
          <Text>{idr(grandExpense)}</Text>
        </View>

        {/* Laba */}
        <View style={s.profitBox}>
          <View>
            <Text style={s.profitLabel}>LABA BERSIH</Text>
            <Text style={[s.muted, { fontSize: 8 }]}>
              Grand Total RAB − Grand Total Pengeluaran
            </Text>
          </View>
          <Text style={s.profitVal}>{idr(profit)}</Text>
        </View>
        <View style={s.terbilang}>
          <Text>Terbilang laba: {terbilang(Math.abs(profit))}</Text>
        </View>

        {/* Tanda tangan */}
        <View style={s.footer}>
          <View style={s.sign}>
            <Text style={s.muted}>Dibuat oleh,</Text>
            <Text style={s.signLine}>{BUSINESS_IDENTITY.name}</Text>
          </View>
          <View style={s.sign}>
            <Text style={s.muted}>Menyetujui,</Text>
            <Text style={s.signLine}>{project.company_name}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

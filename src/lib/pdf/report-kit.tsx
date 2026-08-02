import React from "react";
import { Text, View, StyleSheet } from "@react-pdf/renderer";
import { BUSINESS_IDENTITY } from "@/types/phase4";

/**
 * Gaya & potongan yang dipakai bersama oleh PDF laporan keuangan
 * (Laba Rugi, Analisa Margin, Riwayat Transaksi) agar tampilannya seragam
 * dengan PDF lain di aplikasi (NOTA, Invoice, RAB).
 */

export const C = {
  teal: "#0f766e",
  amber: "#b45309",
  muted: "#6b7280",
  text: "#111827",
  line: "#e5e7eb",
  gray: "#f3f4f6",
  green: "#059669",
  red: "#dc2626",
  white: "#ffffff",
};

export const idr = (n: number) =>
  "Rp " + new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(n);

export const tglPendek = (d: string) =>
  new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "2-digit" });

export const tglPanjang = (d: string) =>
  new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

export const rs = StyleSheet.create({
  page: {
    paddingTop: 36, paddingBottom: 60, paddingHorizontal: 40,
    fontSize: 9, fontFamily: "Helvetica", color: C.text,
  },
  between: { flexDirection: "row", justifyContent: "space-between" },
  bizName: { fontSize: 17, fontFamily: "Helvetica-Bold", color: C.teal },
  muted: { color: C.muted, fontSize: 8.5 },
  docTitle: { fontSize: 19, fontFamily: "Helvetica-Bold", textAlign: "right" },

  sectionTitle: {
    fontSize: 10, fontFamily: "Helvetica-Bold", marginTop: 16, marginBottom: 6,
    borderBottomWidth: 1, borderBottomColor: C.line, paddingBottom: 3,
    textTransform: "uppercase",
  },

  row: {
    flexDirection: "row", justifyContent: "space-between",
    paddingVertical: 2.5, paddingHorizontal: 2,
  },
  rowIndent: { paddingLeft: 14 },
  amount: { textAlign: "right" },

  totalRow: {
    flexDirection: "row", justifyContent: "space-between",
    paddingVertical: 4, paddingHorizontal: 2,
    borderTopWidth: 0.8, borderTopColor: C.line,
    fontFamily: "Helvetica-Bold",
  },

  th: {
    flexDirection: "row", paddingVertical: 5, paddingHorizontal: 6,
    color: C.white, fontFamily: "Helvetica-Bold", fontSize: 8,
    backgroundColor: C.teal,
  },
  tr: {
    flexDirection: "row", paddingVertical: 4, paddingHorizontal: 6,
    borderBottomWidth: 0.5, borderBottomColor: C.line, alignItems: "center",
  },
  trAlt: { backgroundColor: "#fafafa" },

  highlight: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginTop: 12, paddingVertical: 9, paddingHorizontal: 12,
    backgroundColor: C.gray, borderRadius: 4,
  },
  highlightLabel: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  highlightValue: { fontSize: 15, fontFamily: "Helvetica-Bold" },

  note: { marginTop: 6, fontSize: 7.5, color: C.muted, fontStyle: "italic" },

  footer: {
    position: "absolute", bottom: 24, left: 40, right: 40,
    borderTopWidth: 1, borderTopColor: C.line, paddingTop: 6,
    textAlign: "center", fontSize: 7.5, color: C.muted,
  },
});

/** Kop surat + judul laporan + rentang periode. */
export function ReportHeader({
  title, subtitle, from, to,
}: {
  title: string;
  subtitle?: string;
  from: string;
  to: string;
}) {
  const B = BUSINESS_IDENTITY;
  return (
    <>
      <View style={rs.between}>
        <View>
          <Text style={rs.bizName}>{B.name}</Text>
          <Text style={rs.muted}>{B.tagline}</Text>
          <Text style={[rs.muted, { marginTop: 3 }]}>{B.address}</Text>
          <Text style={rs.muted}>{B.phone} · {B.email}</Text>
        </View>
        <View>
          <Text style={rs.docTitle}>{title}</Text>
          {subtitle ? (
            <Text style={[rs.muted, { textAlign: "right", marginTop: 3 }]}>{subtitle}</Text>
          ) : null}
          <Text style={[rs.muted, { textAlign: "right", marginTop: 3 }]}>
            Periode {tglPanjang(from)} — {tglPanjang(to)}
          </Text>
        </View>
      </View>
    </>
  );
}

export function ReportFooter() {
  const B = BUSINESS_IDENTITY;
  return (
    <Text style={rs.footer} fixed
      render={({ pageNumber, totalPages }) =>
        `${B.name} · ${B.phone} · ${B.email}    —    Halaman ${pageNumber} dari ${totalPages}`
      } />
  );
}

/** Baris "label ..... nominal". */
export function LineRow({
  label, value, indent = false, bold = false, muted = false,
}: {
  label: string; value: number; indent?: boolean; bold?: boolean; muted?: boolean;
}) {
  const font = bold ? { fontFamily: "Helvetica-Bold" } : {};
  return (
    <View style={[rs.row, indent ? rs.rowIndent : {}]}>
      <Text style={[muted ? rs.muted : {}, font]}>{label}</Text>
      <Text style={[rs.amount, font]}>{idr(value)}</Text>
    </View>
  );
}

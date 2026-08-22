import React from "react";
import {
  Document, Page, Text, View, StyleSheet,
} from "@react-pdf/renderer";
import { terbilang } from "@/lib/utils/terbilang";
import { BUSINESS_IDENTITY } from "@/types/phase4";

const idr = (n: number) =>
  "Rp " + new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(n);
const tgl = (d: string) =>
  new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#111827" },
  between: { flexDirection: "row", justifyContent: "space-between" },
  bizName: { fontSize: 18, fontFamily: "Helvetica-Bold", color: "#0f766e" },
  muted: { color: "#6b7280" },
  title: { fontSize: 18, fontFamily: "Helvetica-Bold", textAlign: "right" },
  section: { marginTop: 24 },
  label: { fontSize: 9, color: "#6b7280", marginBottom: 3 },
  th: {
    flexDirection: "row", backgroundColor: "#0f766e", color: "#fff",
    paddingVertical: 6, paddingHorizontal: 8, fontFamily: "Helvetica-Bold", fontSize: 9,
  },
  td: {
    flexDirection: "row", paddingVertical: 6, paddingHorizontal: 8,
    borderBottomWidth: 1, borderBottomColor: "#e5e7eb",
  },
  cNo: { flex: 4 }, cDate: { flex: 2, textAlign: "center" }, cSub: { flex: 2, textAlign: "right" },
  destLine: { fontSize: 8, color: "#6b7280", marginTop: 1 },
  totalBox: { marginTop: 12, alignItems: "flex-end" },
  grand: {
    flexDirection: "row", width: 260, justifyContent: "space-between",
    paddingVertical: 8, borderTopWidth: 2, borderTopColor: "#0f766e", marginTop: 4,
  },
  grandText: { fontFamily: "Helvetica-Bold", fontSize: 13, color: "#0f766e" },
  terbilang: {
    marginTop: 16, padding: 10, backgroundColor: "#f9fafb",
    borderLeftWidth: 3, borderLeftColor: "#0f766e", fontStyle: "italic",
  },
  lunas: {
    marginTop: 20, alignSelf: "flex-start", paddingVertical: 6, paddingHorizontal: 16,
    borderWidth: 2, borderColor: "#0f766e", borderRadius: 6,
    color: "#0f766e", fontFamily: "Helvetica-Bold", fontSize: 14,
  },
  note: { marginTop: 28, fontSize: 8.5, color: "#6b7280", lineHeight: 1.5 },
});

export type HutangPaymentRow = {
  invoiceNo: string;
  purchaseDate: string;
  total: number;
  /** Tujuan pengiriman (untuk nota dari portal distributor); opsional. */
  destination?: string;
};

export function HutangPaymentPdf({
  distributorName, paidDate, rows, total,
}: {
  distributorName: string;
  paidDate: string;
  rows: HutangPaymentRow[];
  total: number;
}) {
  const B = BUSINESS_IDENTITY;
  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Kop */}
        <View style={s.between}>
          <View>
            <Text style={s.bizName}>{B.name}</Text>
            <Text style={s.muted}>{B.tagline}</Text>
            <Text style={[s.muted, { marginTop: 4 }]}>{B.address}</Text>
            <Text style={s.muted}>{B.phone} · {B.email}</Text>
            <Text style={s.muted}>{B.website}</Text>
          </View>
          <View>
            <Text style={s.title}>BUKTI PEMBAYARAN{"\n"}HUTANG</Text>
            <Text style={[s.muted, { textAlign: "right", marginTop: 4 }]}>{tgl(paidDate)}</Text>
          </View>
        </View>

        {/* Info */}
        <View style={[s.between, s.section]}>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>DIBAYARKAN KEPADA</Text>
            <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 11 }}>{distributorName}</Text>
          </View>
          <View style={{ width: 200 }}>
            <View style={s.between}>
              <Text style={s.muted}>Tanggal Bayar</Text><Text>{tgl(paidDate)}</Text>
            </View>
            <View style={[s.between, { marginTop: 3 }]}>
              <Text style={s.muted}>Jumlah Nota</Text><Text>{rows.length}</Text>
            </View>
          </View>
        </View>

        {/* Tabel nota */}
        <View style={s.section}>
          <View style={s.th}>
            <Text style={s.cNo}>No. Nota</Text>
            <Text style={s.cDate}>Tgl Beli</Text>
            <Text style={s.cSub}>Jumlah</Text>
          </View>
          {rows.map((r, i) => (
            <View style={s.td} key={i}>
              <View style={s.cNo}>
                <Text>{r.invoiceNo || "Tanpa nota"}</Text>
                {r.destination ? (
                  <Text style={s.destLine}>Tujuan: {r.destination}</Text>
                ) : null}
              </View>
              <Text style={s.cDate}>{tgl(r.purchaseDate)}</Text>
              <Text style={s.cSub}>{idr(r.total)}</Text>
            </View>
          ))}
        </View>

        {/* Total */}
        <View style={s.totalBox}>
          <View style={s.grand}>
            <Text style={s.grandText}>TOTAL DIBAYARKAN</Text>
            <Text style={s.grandText}>{idr(total)}</Text>
          </View>
        </View>

        <View style={s.terbilang}>
          <Text>Terbilang: {terbilang(total)}</Text>
        </View>

        <Text style={s.lunas}>LUNAS</Text>

        <Text style={s.note}>
          Dokumen ini adalah bukti bahwa pembayaran atas nota-nota di atas telah kami
          lakukan secara penuh. Mohon dikonfirmasi apabila pembayaran telah diterima.
        </Text>
      </Page>
    </Document>
  );
}

import React from "react";
import {
  Document, Page, Text, View, StyleSheet,
} from "@react-pdf/renderer";
import { terbilang } from "@/lib/utils/terbilang";
import { businessIdentity, type Brand } from "@/types/phase4";

const idr = (n: number) =>
  "Rp " + new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(n);
const tgl = (d: string) =>
  new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });

// Tema warna mengikuti brand (Athaya = teal, Cetak Ide = oranye).
const makeStyles = (theme: string) => StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#111827" },
  row: { flexDirection: "row" },
  between: { flexDirection: "row", justifyContent: "space-between" },
  bizName: { fontSize: 18, fontFamily: "Helvetica-Bold", color: theme },
  muted: { color: "#6b7280" },
  title: { fontSize: 22, fontFamily: "Helvetica-Bold", textAlign: "right" },
  section: { marginTop: 24 },
  label: { fontSize: 9, color: "#6b7280", marginBottom: 3 },
  th: {
    flexDirection: "row", backgroundColor: theme, color: "#fff",
    paddingVertical: 6, paddingHorizontal: 8, fontFamily: "Helvetica-Bold", fontSize: 9,
  },
  td: {
    flexDirection: "row", paddingVertical: 6, paddingHorizontal: 8,
    borderBottomWidth: 1, borderBottomColor: "#e5e7eb",
  },
  cName: { flex: 4 }, cQty: { flex: 1, textAlign: "center" },
  cPrice: { flex: 2, textAlign: "right" }, cSub: { flex: 2, textAlign: "right" },
  totalBox: { marginTop: 12, alignItems: "flex-end" },
  grand: {
    flexDirection: "row", width: 240, justifyContent: "space-between",
    paddingVertical: 8, borderTopWidth: 2, borderTopColor: theme, marginTop: 4,
  },
  grandText: { fontFamily: "Helvetica-Bold", fontSize: 13, color: theme },
  paidTag: {
    marginTop: 6, alignSelf: "flex-end", paddingVertical: 3, paddingHorizontal: 10,
    borderWidth: 1, borderColor: theme, borderRadius: 4,
    color: theme, fontFamily: "Helvetica-Bold", fontSize: 10,
  },
  terbilang: {
    marginTop: 16, padding: 10, backgroundColor: "#f9fafb",
    borderLeftWidth: 3, borderLeftColor: theme, fontStyle: "italic",
  },
  payFooter: {
    marginTop: 28, flexDirection: "row", justifyContent: "space-between",
    borderTopWidth: 1, borderTopColor: "#e5e7eb", paddingTop: 14,
  },
  footBlockLeft: { flex: 1, paddingRight: 24 },
  footBlockRight: { width: 210 },
  footHeading: {
    fontSize: 9, fontFamily: "Helvetica-Bold", color: theme,
    marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5,
  },
  termsText: { fontSize: 8.5, color: "#4b5563", lineHeight: 1.5 },
  payName: { fontSize: 11, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  payBank: { fontSize: 10, color: "#111827" },
  payAcc: { fontSize: 13, fontFamily: "Helvetica-Bold", color: theme, marginTop: 2 },
});

const TERMS_TEXT =
  "Barang yang sudah dibeli tidak dapat dikembalikan kecuali ada perjanjian tertulis. Simpan nota ini sebagai bukti pembayaran dan klaim garansi.";

export type SaleNota = {
  nota_no: string;
  sale_date: string;
  paid_date: string | null;
  payment_label: string; // "Tunai" | "Transfer" | "Terhutang (Lunas)"
  total: number;
  company_name: string;
  contact_name?: string | null;
  client_address?: string | null;
  client_phone?: string | null;
  notes?: string | null;
  brand?: Brand; // penerbit nota (tema warna & kop)
};

export function SalePdf({
  nota, rows,
}: {
  nota: SaleNota;
  rows: { name: string; qty: number; price: number; subtotal: number }[];
}) {
  const B = businessIdentity(nota.brand);
  const s = makeStyles(B.theme);
  // Tanggal nota: pakai tanggal lunas bila ada (terhutang), selain itu tanggal jual.
  const notaDate = nota.paid_date ?? nota.sale_date;

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
            <Text style={s.title}>NOTA</Text>
            <Text style={[s.muted, { textAlign: "right", marginTop: 4 }]}>
              {nota.nota_no}
            </Text>
          </View>
        </View>

        {/* Info nota */}
        <View style={[s.between, s.section]}>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>DITERIMA DARI / KEPADA</Text>
            <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 11 }}>
              {nota.company_name}
            </Text>
            {nota.contact_name ? <Text>{nota.contact_name}</Text> : null}
            {nota.client_address ? <Text style={s.muted}>{nota.client_address}</Text> : null}
            {nota.client_phone ? <Text style={s.muted}>{nota.client_phone}</Text> : null}
          </View>
          <View style={{ width: 200 }}>
            <View style={s.between}>
              <Text style={s.muted}>Tanggal</Text><Text>{tgl(notaDate)}</Text>
            </View>
            <View style={[s.between, { marginTop: 3 }]}>
              <Text style={s.muted}>Pembayaran</Text>
              <Text>{nota.payment_label}</Text>
            </View>
            <View style={[s.between, { marginTop: 3 }]}>
              <Text style={s.muted}>Status</Text>
              <Text>LUNAS</Text>
            </View>
          </View>
        </View>

        {/* Tabel item */}
        <View style={s.section}>
          <View style={s.th}>
            <Text style={s.cName}>Barang</Text>
            <Text style={s.cQty}>Qty</Text>
            <Text style={s.cPrice}>Harga</Text>
            <Text style={s.cSub}>Subtotal</Text>
          </View>
          {rows.map((r, i) => (
            <View style={s.td} key={i}>
              <Text style={s.cName}>{r.name}</Text>
              <Text style={s.cQty}>{r.qty}</Text>
              <Text style={s.cPrice}>{idr(r.price)}</Text>
              <Text style={s.cSub}>{idr(r.subtotal)}</Text>
            </View>
          ))}
        </View>

        {/* Total */}
        <View style={s.totalBox}>
          <View style={s.grand}>
            <Text style={s.grandText}>TOTAL</Text>
            <Text style={s.grandText}>{idr(Number(nota.total))}</Text>
          </View>
          <Text style={s.paidTag}>LUNAS</Text>
        </View>

        {/* Terbilang */}
        <View style={s.terbilang}>
          <Text>Terbilang: {terbilang(Number(nota.total))}</Text>
        </View>

        {/* Footer: Terms (kiri) + Bank (kanan) */}
        <View style={s.payFooter}>
          <View style={s.footBlockLeft}>
            <Text style={s.footHeading}>Syarat &amp; ketentuan</Text>
            <Text style={s.termsText}>{TERMS_TEXT}</Text>
          </View>
          <View style={s.footBlockRight}>
            <Text style={s.footHeading}>Pembayaran ke</Text>
            <Text style={s.payName}>{B.bankHolder}</Text>
            <Text style={s.payBank}>Bank {B.bankName}</Text>
            <Text style={s.payAcc}>{B.bankAccount}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

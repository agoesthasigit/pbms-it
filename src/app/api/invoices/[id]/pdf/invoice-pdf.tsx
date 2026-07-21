import React from "react";
import {
  Document, Page, Text, View, StyleSheet,
} from "@react-pdf/renderer";
import { terbilang } from "@/lib/utils/terbilang";
import { BUSINESS_IDENTITY, type MonthlyInvoice } from "@/types/phase4";

const idr = (n: number) =>
  "Rp " + new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(n);
const tgl = (d: string) =>
  new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#111827" },
  row: { flexDirection: "row" },
  between: { flexDirection: "row", justifyContent: "space-between" },
  bizName: { fontSize: 18, fontFamily: "Helvetica-Bold", color: "#0f766e" },
  muted: { color: "#6b7280" },
  title: { fontSize: 22, fontFamily: "Helvetica-Bold", textAlign: "right" },
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
  cName: { flex: 4 }, cQty: { flex: 1, textAlign: "center" },
  cPrice: { flex: 2, textAlign: "right" }, cSub: { flex: 2, textAlign: "right" },
  totalBox: { marginTop: 12, alignItems: "flex-end" },
  totalRow: { flexDirection: "row", width: 240, justifyContent: "space-between", paddingVertical: 3 },
  grand: {
    flexDirection: "row", width: 240, justifyContent: "space-between",
    paddingVertical: 8, borderTopWidth: 2, borderTopColor: "#0f766e", marginTop: 4,
  },
  grandText: { fontFamily: "Helvetica-Bold", fontSize: 13, color: "#0f766e" },
  terbilang: {
    marginTop: 16, padding: 10, backgroundColor: "#f9fafb",
    borderLeftWidth: 3, borderLeftColor: "#0f766e", fontStyle: "italic",
  },

  // ===== Footer: Terms (kiri) + Pembayaran/bank (kanan) =====
  payFooter: {
    marginTop: 28, flexDirection: "row", justifyContent: "space-between",
    borderTopWidth: 1, borderTopColor: "#e5e7eb", paddingTop: 14,
  },
  footBlockLeft: { flex: 1, paddingRight: 24 },
  footBlockRight: { width: 210 },
  footHeading: {
    fontSize: 9, fontFamily: "Helvetica-Bold", color: "#0f766e",
    marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5,
  },
  termsText: { fontSize: 8.5, color: "#4b5563", lineHeight: 1.5 },
  payName: { fontSize: 11, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  payBank: { fontSize: 10, color: "#111827" },
  payAcc: { fontSize: 13, fontFamily: "Helvetica-Bold", color: "#0f766e", marginTop: 2 },
});

const TERMS_TEXT =
  "Thank you for your business. Please send payment within 30 days of receiving this invoice. There will be a 1.5% interest charge per month on late invoices.";

export function InvoicePdf({
  invoice, rows,
}: {
  invoice: MonthlyInvoice;
  rows: { name: string; qty: number; price: number; subtotal: number; date: string }[];
}) {
  const B = BUSINESS_IDENTITY;
  const periode = new Date(invoice.period_month).toLocaleDateString("id-ID", {
    month: "long", year: "numeric",
  });

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
            <Text style={s.title}>INVOICE</Text>
            <Text style={[s.muted, { textAlign: "right", marginTop: 4 }]}>
              {invoice.invoice_no}
            </Text>
          </View>
        </View>

        {/* Info tagihan */}
        <View style={[s.between, s.section]}>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>DITAGIHKAN KEPADA</Text>
            <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 11 }}>
              {invoice.company_name}
            </Text>
            {invoice.contact_name ? <Text>{invoice.contact_name}</Text> : null}
            {invoice.client_address ? <Text style={s.muted}>{invoice.client_address}</Text> : null}
            {invoice.client_phone ? <Text style={s.muted}>{invoice.client_phone}</Text> : null}
          </View>
          <View style={{ width: 200 }}>
            <View style={s.between}>
              <Text style={s.muted}>Periode</Text><Text>{periode}</Text>
            </View>
            <View style={[s.between, { marginTop: 3 }]}>
              <Text style={s.muted}>Jatuh Tempo</Text>
              <Text>{invoice.due_date ? tgl(invoice.due_date) : "-"}</Text>
            </View>
            <View style={[s.between, { marginTop: 3 }]}>
              <Text style={s.muted}>Status</Text>
              <Text>{invoice.status === "paid" ? "LUNAS" : "BELUM LUNAS"}</Text>
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
            <Text style={s.grandText}>{idr(Number(invoice.total))}</Text>
          </View>
        </View>

        {/* Terbilang */}
        <View style={s.terbilang}>
          <Text>Terbilang: {terbilang(Number(invoice.total))}</Text>
        </View>

        {/* Footer: Terms (kiri) + Bank (kanan) — menggantikan tanda tangan */}
        <View style={s.payFooter}>
          <View style={s.footBlockLeft}>
            <Text style={s.footHeading}>Terms and conditions</Text>
            <Text style={s.termsText}>{TERMS_TEXT}</Text>
          </View>
          <View style={s.footBlockRight}>
            <Text style={s.footHeading}>Please make a payment to</Text>
            <Text style={s.payName}>{B.bankHolder}</Text>
            <Text style={s.payBank}>Bank {B.bankName}</Text>
            <Text style={s.payAcc}>{B.bankAccount}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

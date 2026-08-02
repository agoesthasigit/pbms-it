import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import {
  C, rs, idr, ReportHeader, ReportFooter,
} from "@/lib/pdf/report-kit";
import type { MarginReport } from "@/types/reports";

const m = StyleSheet.create({
  cItem: { flex: 1, paddingRight: 4 },
  cQty: { width: 32, textAlign: "center" },
  cNum: { width: 74, textAlign: "right" },
  cPct: { width: 46, textAlign: "right" },
  groupRow: {
    flexDirection: "row", paddingVertical: 4, paddingHorizontal: 6,
    backgroundColor: C.gray,
  },
  groupText: { fontSize: 8, fontFamily: "Helvetica-Bold", textTransform: "uppercase" },
  box: { flex: 1, borderWidth: 1.2, borderRadius: 4, padding: 9 },
  boxLabel: { fontSize: 7, color: C.muted },
  boxVal: { fontSize: 13, fontFamily: "Helvetica-Bold", marginTop: 4 },

  // kolom tabel rekonsiliasi
  rInv: { width: 88, paddingRight: 4 },
  rClient: { flex: 1, paddingRight: 4 },
  rNum: { width: 74, textAlign: "right" },
  rCek: { width: 34, textAlign: "center" },
});

export function MarginPdf({ data }: { data: MarginReport }) {
  const groups = [...new Set(data.rows.map((r) => r.group))];

  return (
    <Document>
      <Page size="A4" style={rs.page}>
        <ReportHeader title="ANALISA MARGIN" subtitle="Margin per Item"
          from={data.period.from} to={data.period.to} />

        {/* ===== RINGKASAN ===== */}
        <View style={{ flexDirection: "row", marginTop: 18, gap: 8 }}>
          <View style={[m.box, { borderColor: C.green }]}>
            <Text style={m.boxLabel}>TOTAL HARGA JUAL</Text>
            <Text style={[m.boxVal, { color: C.green }]}>{idr(data.total_revenue)}</Text>
          </View>
          <View style={[m.box, { borderColor: C.teal }]}>
            <Text style={m.boxLabel}>TOTAL MODAL</Text>
            <Text style={[m.boxVal, { color: C.teal }]}>{idr(data.total_cost)}</Text>
          </View>
          <View style={[m.box, { borderColor: C.amber }]}>
            <Text style={m.boxLabel}>TOTAL MARGIN</Text>
            <Text style={[m.boxVal, {
              color: data.total_margin >= 0 ? C.green : C.red,
            }]}>
              {idr(data.total_margin)}
            </Text>
            <Text style={[rs.muted, { marginTop: 2 }]}>
              {(data.total_margin_pct * 100).toFixed(1)}% dari harga jual
            </Text>
          </View>
        </View>

        {/* ===== TABEL ===== */}
        <Text style={rs.sectionTitle}>Rincian per Item</Text>

        {data.rows.length === 0 ? (
          <Text style={rs.muted}>
            Tidak ada penjualan atau proyek selesai pada periode ini.
          </Text>
        ) : (
          <>
            <View style={rs.th} fixed>
              <Text style={m.cItem}>Item</Text>
              <Text style={m.cQty}>Qty</Text>
              <Text style={m.cNum}>Harga Beli</Text>
              <Text style={m.cNum}>Harga Jual</Text>
              <Text style={m.cNum}>Margin</Text>
              <Text style={m.cPct}>%</Text>
            </View>

            {groups.map((g) => (
              <View key={g}>
                <View style={m.groupRow} wrap={false}>
                  <Text style={m.groupText}>{g}</Text>
                </View>
                {data.rows.filter((r) => r.group === g).map((r, i) => (
                  <View style={rs.tr} key={`${g}-${i}`} wrap={false}>
                    <Text style={m.cItem}>
                      {r.item}{r.kind === "project" ? "  (proyek selesai)" : ""}
                    </Text>
                    <Text style={m.cQty}>{r.qty}</Text>
                    <Text style={m.cNum}>{idr(r.cost)}</Text>
                    <Text style={m.cNum}>{idr(r.revenue)}</Text>
                    <Text style={[m.cNum, {
                      color: r.margin >= 0 ? C.green : C.red,
                      fontFamily: "Helvetica-Bold",
                    }]}>
                      {idr(r.margin)}
                    </Text>
                    <Text style={m.cPct}>{(r.margin_pct * 100).toFixed(1)}%</Text>
                  </View>
                ))}
              </View>
            ))}

            <View style={[rs.tr, {
              borderTopWidth: 1.5, borderTopColor: C.text, borderBottomWidth: 0,
            }]}>
              <Text style={[m.cItem, { fontFamily: "Helvetica-Bold" }]}>TOTAL</Text>
              <Text style={m.cQty} />
              <Text style={[m.cNum, { fontFamily: "Helvetica-Bold" }]}>{idr(data.total_cost)}</Text>
              <Text style={[m.cNum, { fontFamily: "Helvetica-Bold" }]}>{idr(data.total_revenue)}</Text>
              <Text style={[m.cNum, { fontFamily: "Helvetica-Bold" }]}>{idr(data.total_margin)}</Text>
              <Text style={[m.cPct, { fontFamily: "Helvetica-Bold" }]}>
                {(data.total_margin_pct * 100).toFixed(1)}%
              </Text>
            </View>
          </>
        )}

        <Text style={rs.note}>
          Baris jasa modalnya nol sehingga marginnya 100%. Proyek hanya muncul
          bila statusnya sudah Selesai.
        </Text>

        {/* ===== REKONSILIASI INVOICE vs PEMBAYARAN ===== */}
        <Text style={rs.sectionTitle}>Rekonsiliasi Invoice vs Pembayaran Diterima</Text>
        {data.recon.length === 0 ? (
          <Text style={rs.muted}>
            Belum ada invoice bulanan yang lunas pada periode ini.
          </Text>
        ) : (
          <>
            <View style={rs.th}>
              <Text style={m.rInv}>Invoice</Text>
              <Text style={m.rClient}>Client</Text>
              <Text style={m.rNum}>Bruto</Text>
              <Text style={m.rNum}>Dasar Pajak</Text>
              <Text style={m.rNum}>PPh 2,5%</Text>
              <Text style={m.rNum}>Netto</Text>
              <Text style={m.rCek}>Cek</Text>
            </View>
            {data.recon.map((r) => (
              <View style={rs.tr} key={r.invoice_no} wrap={false}>
                <Text style={m.rInv}>{r.invoice_no}</Text>
                <Text style={m.rClient}>{r.client}</Text>
                <Text style={m.rNum}>{idr(r.bruto)}</Text>
                <Text style={m.rNum}>{idr(r.dpp)}</Text>
                <Text style={[m.rNum, { color: C.red }]}>
                  {r.pph > 0 ? `- ${idr(r.pph)}` : idr(0)}
                </Text>
                <Text style={[m.rNum, { color: C.green, fontFamily: "Helvetica-Bold" }]}>
                  {idr(r.netto)}
                </Text>
                <Text style={[m.rCek, { color: r.ok ? C.green : C.red }]}>
                  {r.ok ? "OK" : "CEK"}
                </Text>
              </View>
            ))}
            <View style={[rs.tr, {
              borderTopWidth: 1.5, borderTopColor: C.text, borderBottomWidth: 0,
            }]}>
              <Text style={[m.rInv, { fontFamily: "Helvetica-Bold" }]}>TOTAL</Text>
              <Text style={m.rClient} />
              <Text style={[m.rNum, { fontFamily: "Helvetica-Bold" }]}>{idr(data.recon_bruto)}</Text>
              <Text style={[m.rNum, { fontFamily: "Helvetica-Bold" }]}>{idr(data.recon_dpp)}</Text>
              <Text style={[m.rNum, { fontFamily: "Helvetica-Bold", color: C.red }]}>
                {data.recon_pph > 0 ? `- ${idr(data.recon_pph)}` : idr(0)}
              </Text>
              <Text style={[m.rNum, { fontFamily: "Helvetica-Bold", color: C.green }]}>
                {idr(data.recon_netto)}
              </Text>
              <Text style={m.rCek} />
            </View>
            <Text style={rs.note}>
              PPh 23 (2,5%) hanya atas nilai jasa; penjualan barang tidak kena.
              Netto = uang yang benar-benar masuk ke wallet.
            </Text>
          </>
        )}

        <ReportFooter />
      </Page>
    </Document>
  );
}

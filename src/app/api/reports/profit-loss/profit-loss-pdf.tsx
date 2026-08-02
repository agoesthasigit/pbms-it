import React from "react";
import { Document, Page, Text, View } from "@react-pdf/renderer";
import {
  C, rs, idr, ReportHeader, ReportFooter, LineRow,
} from "@/lib/pdf/report-kit";
import type { ProfitLoss } from "@/types/reports";

export function ProfitLossPdf({ data }: { data: ProfitLoss }) {
  const positif = data.net_profit >= 0;

  return (
    <Document>
      <Page size="A4" style={rs.page}>
        <ReportHeader title="LABA RUGI" subtitle="Laporan Laba Rugi"
          from={data.period.from} to={data.period.to} />

        {/* ===== A. PENDAPATAN USAHA ===== */}
        <Text style={rs.sectionTitle}>A. Pendapatan Usaha</Text>
        {data.revenue.length === 0 ? (
          <Text style={rs.muted}>Tidak ada pendapatan pada periode ini.</Text>
        ) : (
          data.revenue.map((r) => (
            <LineRow key={r.name} label={r.name} value={r.amount} indent />
          ))
        )}
        <View style={rs.totalRow}>
          <Text>Total Pendapatan Usaha</Text>
          <Text>{idr(data.revenue_total)}</Text>
        </View>

        {/* ===== B. HPP ===== */}
        <Text style={rs.sectionTitle}>B. Harga Pokok Penjualan (HPP)</Text>
        {data.cogs.length === 0 ? (
          <Text style={rs.muted}>Tidak ada modal terpakai pada periode ini.</Text>
        ) : (
          data.cogs.map((r) => (
            <LineRow key={r.name} label={r.name} value={r.amount} indent />
          ))
        )}
        <View style={rs.totalRow}>
          <Text>Total HPP</Text>
          <Text>{idr(data.cogs_total)}</Text>
        </View>

        <View style={[rs.highlight, { marginTop: 10, paddingVertical: 7 }]}>
          <Text style={[rs.highlightLabel, { fontSize: 10 }]}>LABA KOTOR</Text>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={[rs.highlightValue, { fontSize: 12, color: C.teal }]}>
              {idr(data.gross_profit)}
            </Text>
            <Text style={rs.muted}>
              Margin Kotor {(data.gross_margin * 100).toFixed(1)}%
            </Text>
          </View>
        </View>

        {/* ===== C. BIAYA OPERASIONAL ===== */}
        <Text style={rs.sectionTitle}>C. Biaya Operasional</Text>
        {data.opex.map((r) => (
          <LineRow key={r.name} label={r.name} value={r.amount} indent />
        ))}
        {data.personal_total > 0 && (
          <LineRow label="Pengeluaran Pribadi" value={data.personal_total} indent />
        )}
        {data.pph_total > 0 && (
          <LineRow label="Pajak PPh 23 (dipotong client atas jasa)"
            value={data.pph_total} indent />
        )}
        {data.opex_total === 0 && (
          <Text style={rs.muted}>Tidak ada biaya pada periode ini.</Text>
        )}
        <View style={rs.totalRow}>
          <Text>Total Biaya Operasional</Text>
          <Text>{idr(data.opex_total)}</Text>
        </View>

        {/* ===== LABA BERSIH ===== */}
        <View style={[rs.highlight, {
          backgroundColor: positif ? "#ecfdf5" : "#fef2f2",
        }]}>
          <Text style={rs.highlightLabel}>LABA BERSIH</Text>
          <Text style={[rs.highlightValue, { color: positif ? C.green : C.red }]}>
            {idr(data.net_profit)}
          </Text>
        </View>

        {/* ===== D. PROYEK BERJALAN ===== */}
        <Text style={rs.sectionTitle}>D. Proyek Berjalan — belum diakui sebagai laba</Text>
        {data.ongoing.length === 0 ? (
          <Text style={rs.muted}>Tidak ada proyek yang masih berjalan.</Text>
        ) : (
          <>
            {data.ongoing.map((p) => (
              <View key={p.id} wrap={false} style={{ marginBottom: 6 }}>
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 2 }}>
                  <Text style={{ fontFamily: "Helvetica-Bold" }}>{p.project_name}</Text>
                  <View style={{
                    marginLeft: 6, paddingVertical: 1.5, paddingHorizontal: 5,
                    backgroundColor: "#fffbeb", borderRadius: 6,
                  }}>
                    <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold", color: C.amber }}>
                      BERJALAN
                    </Text>
                  </View>
                  <Text style={[rs.muted, { marginLeft: 6 }]}>· {p.company_name}</Text>
                </View>
                <LineRow label="Uang muka diterima" value={p.received} indent muted />
                <LineRow label="Biaya proyek dikeluarkan" value={-p.spent} indent muted />
                <LineRow label="Sisa uang muka (kewajiban ke client)"
                  value={p.remaining} indent bold />
              </View>
            ))}
            <Text style={rs.note}>
              Sisa uang muka masih uang client, bukan laba. Angka di atas tidak
              dihitung dalam Laba Bersih.
            </Text>
          </>
        )}

        {/* ===== E. PERSEDIAAN ===== */}
        <Text style={rs.sectionTitle}>E. Persediaan — aset, belum jadi biaya</Text>
        {data.inventory.length === 0 ? (
          <Text style={rs.muted}>Tidak ada stok barang tersisa.</Text>
        ) : (
          <>
            {data.inventory.map((r) => (
              <View key={r.name} style={[rs.row, rs.rowIndent]}>
                <Text>{r.name} ({r.qty} {r.unit})</Text>
                <Text style={rs.amount}>{idr(r.value)}</Text>
              </View>
            ))}
            <View style={rs.totalRow}>
              <Text>Total Nilai Persediaan</Text>
              <Text>{idr(data.inventory_total)}</Text>
            </View>
            <Text style={rs.note}>
              Nilai stok saat ini. Baru menjadi HPP ketika barang terjual.
            </Text>
          </>
        )}

        <ReportFooter />
      </Page>
    </Document>
  );
}

import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import {
  C, rs, idr, tglPendek, ReportHeader, ReportFooter,
} from "@/lib/pdf/report-kit";
import { type TxRow, TX_SOURCE_LABEL } from "@/types/reports";

const t = StyleSheet.create({
  cDate: { width: 46 },
  cParty: { width: 96, paddingRight: 4 },
  cDesc: { flex: 1, paddingRight: 4 },
  cWallet: { width: 62, paddingRight: 4 },
  cIn: { width: 68, textAlign: "right" },
  cOut: { width: 68, textAlign: "right" },
  box: { flex: 1, borderWidth: 1.2, borderRadius: 4, padding: 9 },
  boxLabel: { fontSize: 7, color: C.muted },
  boxVal: { fontSize: 12, fontFamily: "Helvetica-Bold", marginTop: 4 },
  small: { fontSize: 7, color: C.muted },
});

export function TransactionsPdf({
  rows, from, to, totalIn, totalOut,
}: {
  rows: TxRow[];
  from: string;
  to: string;
  totalIn: number;
  totalOut: number;
}) {
  const net = totalIn - totalOut;

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={rs.page}>
        <ReportHeader title="RIWAYAT TRANSAKSI" subtitle="Daftar Transaksi Uang"
          from={from} to={to} />

        {/* ===== RINGKASAN ===== */}
        <View style={{ flexDirection: "row", marginTop: 16, gap: 8 }}>
          <View style={[t.box, { borderColor: C.green }]}>
            <Text style={t.boxLabel}>TOTAL PEMASUKAN</Text>
            <Text style={[t.boxVal, { color: C.green }]}>{idr(totalIn)}</Text>
          </View>
          <View style={[t.box, { borderColor: C.red }]}>
            <Text style={t.boxLabel}>TOTAL PENGELUARAN</Text>
            <Text style={[t.boxVal, { color: C.red }]}>{idr(totalOut)}</Text>
          </View>
          <View style={[t.box, { borderColor: C.teal }]}>
            <Text style={t.boxLabel}>SELISIH (NET)</Text>
            <Text style={[t.boxVal, { color: net >= 0 ? C.green : C.red }]}>
              {idr(net)}
            </Text>
          </View>
        </View>

        {/* ===== TABEL ===== */}
        <Text style={rs.sectionTitle}>Rincian Transaksi</Text>

        {rows.length === 0 ? (
          <Text style={rs.muted}>Tidak ada transaksi pada periode ini.</Text>
        ) : (
          <>
            <View style={rs.th} fixed>
              <Text style={t.cDate}>Tanggal</Text>
              <Text style={t.cParty}>Pihak</Text>
              <Text style={t.cDesc}>Keterangan</Text>
              <Text style={t.cWallet}>Wallet</Text>
              <Text style={t.cIn}>Pemasukan</Text>
              <Text style={t.cOut}>Pengeluaran</Text>
            </View>

            {rows.map((r, i) => {
              const skipped = r.countInTotal === false;
              return (
                <View style={[rs.tr, i % 2 === 1 ? rs.trAlt : {}]} key={r.key} wrap={false}>
                  <Text style={t.cDate}>{r.date ? tglPendek(r.date) : "-"}</Text>
                  <Text style={t.cParty}>{r.party}</Text>
                  <View style={t.cDesc}>
                    <Text>{r.description || TX_SOURCE_LABEL[r.source]}</Text>
                    <Text style={t.small}>
                      {TX_SOURCE_LABEL[r.source]}
                      {r.isPiutang ? " · piutang" : ""}
                      {skipped ? " · ditagih via invoice" : ""}
                    </Text>
                  </View>
                  <Text style={t.cWallet}>{r.walletName}</Text>
                  <Text style={[t.cIn, { color: skipped ? C.muted : C.green }]}>
                    {r.direction === "in" ? idr(r.amount) : ""}
                  </Text>
                  <Text style={[t.cOut, { color: skipped ? C.muted : C.red }]}>
                    {r.direction === "out" ? idr(r.amount) : ""}
                  </Text>
                </View>
              );
            })}

            <View style={[rs.tr, {
              borderTopWidth: 1.5, borderTopColor: C.text, borderBottomWidth: 0,
            }]}>
              <Text style={[t.cDate, { fontFamily: "Helvetica-Bold" }]}>TOTAL</Text>
              <Text style={t.cParty} />
              <Text style={t.cDesc} />
              <Text style={t.cWallet} />
              <Text style={[t.cIn, { fontFamily: "Helvetica-Bold", color: C.green }]}>
                {idr(totalIn)}
              </Text>
              <Text style={[t.cOut, { fontFamily: "Helvetica-Bold", color: C.red }]}>
                {idr(totalOut)}
              </Text>
            </View>
          </>
        )}

        <Text style={rs.note}>
          Baris bertanda &quot;ditagih via invoice&quot; tidak ikut dijumlahkan —
          uangnya sudah dihitung pada baris pelunasan invoice agar tidak dobel.
        </Text>

        <ReportFooter />
      </Page>
    </Document>
  );
}

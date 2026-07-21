import React from "react";
import {
  Document, Page, Text, View, StyleSheet, Image,
} from "@react-pdf/renderer";
import { BUSINESS_IDENTITY } from "@/types/phase4";
import type { WarrantyStatus } from "@/types/phase5";

const tglPanjang = (d: string) =>
  new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
const tglPendek = (d: string) =>
  new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });

const C = {
  teal: "#0f766e",
  muted: "#6b7280",
  text: "#111827",
  line: "#e5e7eb",
  gray: "#f3f4f6",
};

// warna badge status garansi (sesuai mockup)
const STATUS: Record<WarrantyStatus, { label: string; bg: string; fg: string }> = {
  active: { label: "AKTIF", bg: "#ecfdf5", fg: "#059669" },
  expiring: { label: "AKAN HABIS", bg: "#fff7ed", fg: "#b45309" },
  expired: { label: "HABIS", bg: "#fef2f2", fg: "#dc2626" },
};

export type AssetPdfItem = {
  id: string;
  product_name: string;
  serial_number: string | null;
  purchase_date: string;
  warranty_end: string;
  warranty_status: WarrantyStatus;
  photos: string[]; // data URI base64 (maks 2)
};

export type AssetPdfClient = {
  company_name: string;
  address: string | null;
  phone: string | null;
};

const s = StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 64, paddingHorizontal: 40, fontSize: 9, fontFamily: "Helvetica", color: C.text },

  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  bizName: { fontSize: 17, fontFamily: "Helvetica-Bold", color: C.teal },
  muted: { color: C.muted, fontSize: 8.5 },
  docTitle: { fontSize: 19, fontFamily: "Helvetica-Bold", textAlign: "right" },

  clientWrap: { marginTop: 22, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  smallLabel: { fontSize: 7.5, color: C.muted, marginBottom: 2 },
  clientName: { fontSize: 12, fontFamily: "Helvetica-Bold" },

  divider: { borderBottomWidth: 1, borderBottomColor: C.line, marginTop: 16, marginBottom: 4 },

  // kartu aset
  card: {
    flexDirection: "row", borderWidth: 0.8, borderColor: C.line, borderRadius: 5,
    padding: 7, marginTop: 10,
  },
  photo: { width: 105, height: 78, borderRadius: 3, objectFit: "cover", marginRight: 6 },
  noPhoto: {
    width: 105, height: 78, borderRadius: 3, backgroundColor: C.gray,
    alignItems: "center", justifyContent: "center", marginRight: 6,
  },
  noPhotoText: { fontSize: 8, color: C.muted, fontStyle: "italic" },

  detail: { flex: 1, paddingLeft: 6, justifyContent: "center" },
  assetName: { fontSize: 11, fontFamily: "Helvetica-Bold", marginBottom: 5 },
  detailRow: { flexDirection: "row", marginBottom: 2 },
  detailKey: { width: 78, color: C.muted },
  detailVal: { flex: 1 },

  badge: { marginTop: 6, alignSelf: "flex-start", paddingVertical: 3, paddingHorizontal: 9, borderRadius: 8 },
  badgeText: { fontSize: 7.5, fontFamily: "Helvetica-Bold" },

  footer: {
    position: "absolute", bottom: 28, left: 40, right: 40,
    borderTopWidth: 1, borderTopColor: C.line, paddingTop: 7,
    textAlign: "center", fontSize: 7.5, color: C.muted,
  },
  emptyBox: {
    marginTop: 24, padding: 20, borderWidth: 1, borderColor: C.line,
    borderRadius: 6, textAlign: "center",
  },
});

export function AssetPdf({
  client, assets, printedAt,
}: {
  client: AssetPdfClient;
  assets: AssetPdfItem[];
  printedAt: string;
}) {
  const B = BUSINESS_IDENTITY;

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* ===== KOP ATHAYA ===== */}
        <View style={s.between}>
          <View>
            <Text style={s.bizName}>{B.name}</Text>
            <Text style={s.muted}>{B.tagline}</Text>
            <Text style={[s.muted, { marginTop: 3 }]}>{B.address}</Text>
            <Text style={s.muted}>{B.phone} · {B.email}</Text>
          </View>
          <View>
            <Text style={s.docTitle}>ASSET KLIEN</Text>
            <Text style={[s.muted, { textAlign: "right", marginTop: 3 }]}>
              Daftar Aset Terpasang
            </Text>
          </View>
        </View>

        {/* ===== INFO CLIENT ===== */}
        <View style={s.clientWrap}>
          <View style={{ flex: 1 }}>
            <Text style={s.smallLabel}>CLIENT</Text>
            <Text style={s.clientName}>{client.company_name}</Text>
            {(client.address || client.phone) ? (
              <Text style={[s.muted, { marginTop: 2 }]}>
                {[client.address, client.phone].filter(Boolean).join(" · ")}
              </Text>
            ) : null}
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={s.muted}>Tanggal cetak: {tglPanjang(printedAt)}</Text>
            <Text style={s.muted}>Total aset: {assets.length} unit</Text>
          </View>
        </View>

        <View style={s.divider} />

        {/* ===== DAFTAR KARTU ASET ===== */}
        {assets.length === 0 ? (
          <View style={s.emptyBox}>
            <Text style={s.muted}>Belum ada aset untuk client ini.</Text>
          </View>
        ) : (
          assets.map((a) => {
            const st = STATUS[a.warranty_status] ?? STATUS.active;
            return (
              <View key={a.id} style={s.card} wrap={false}>
                {/* foto (maks 2) atau kotak "Tanpa foto" */}
                {a.photos.length > 0 ? (
                  a.photos.slice(0, 2).map((src, i) => (
                    // eslint-disable-next-line jsx-a11y/alt-text
                    <Image key={i} src={src} style={s.photo} />
                  ))
                ) : (
                  <View style={s.noPhoto}>
                    <Text style={s.noPhotoText}>Tanpa foto</Text>
                  </View>
                )}

                {/* detail */}
                <View style={s.detail}>
                  <Text style={s.assetName}>{a.product_name}</Text>
                  <View style={s.detailRow}>
                    <Text style={s.detailKey}>Serial Number</Text>
                    <Text style={s.detailVal}>: {a.serial_number || "-"}</Text>
                  </View>
                  <View style={s.detailRow}>
                    <Text style={s.detailKey}>Tanggal Beli</Text>
                    <Text style={s.detailVal}>: {tglPendek(a.purchase_date)}</Text>
                  </View>
                  <View style={s.detailRow}>
                    <Text style={s.detailKey}>Garansi s/d</Text>
                    <Text style={s.detailVal}>: {tglPendek(a.warranty_end)}</Text>
                  </View>
                  <View style={[s.badge, { backgroundColor: st.bg }]}>
                    <Text style={[s.badgeText, { color: st.fg }]}>{st.label}</Text>
                  </View>
                </View>
              </View>
            );
          })
        )}

        {/* ===== FOOTER ===== */}
        <Text style={s.footer} fixed>
          {B.name} · {B.phone} · {B.email} · {B.website}
        </Text>
      </Page>
    </Document>
  );
}

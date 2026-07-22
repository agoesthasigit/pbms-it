import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { AssetPdf, type AssetPdfItem, type AssetPdfClient } from "./asset-pdf";
import type { WarrantyStatus } from "@/types/phase5";

const BUCKET = "asset-photos";
const MAX_PHOTOS = 2;

// @react-pdf/renderer HANYA bisa merender JPG & PNG (WebP tidak didukung).
// Format lain sengaja dilewati agar PDF tetap terbentuk (aset tampil "Tanpa foto")
// alih-alih gagal total.
const PDF_SAFE_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
};

// ubah file storage privat → data URI base64 (andal untuk @react-pdf di Vercel)
async function toDataUri(
  supabase: Awaited<ReturnType<typeof createClient>>,
  path: string
): Promise<string | null> {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const mime = PDF_SAFE_MIME[ext];
  if (!mime) return null; // mis. .webp lama → lewati

  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !data) return null;
  const buf = Buffer.from(await data.arrayBuffer());
  return `data:${mime};base64,${buf.toString("base64")}`;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("client_id");
  if (!clientId) return new NextResponse("client_id wajib diisi", { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  // data client
  const { data: client } = await supabase
    .from("clients")
    .select("company_name, address, phone")
    .eq("id", clientId)
    .single();
  if (!client) return new NextResponse("Client tidak ditemukan", { status: 404 });

  // aset client (dengan status garansi computed dari view)
  const { data: assets } = await supabase
    .from("v_client_assets")
    .select("id, product_name, serial_number, purchase_date, warranty_end, warranty_status")
    .eq("client_id", clientId)
    .order("warranty_end");

  const assetList = (assets ?? []) as {
    id: string; product_name: string; serial_number: string | null;
    purchase_date: string; warranty_end: string; warranty_status: WarrantyStatus;
  }[];

  // foto semua aset client ini
  const assetIds = assetList.map((a) => a.id);
  const photosByAsset: Record<string, string[]> = {};
  if (assetIds.length > 0) {
    const { data: photos } = await supabase
      .from("asset_photos")
      .select("asset_id, storage_path, sort_order")
      .in("asset_id", assetIds)
      .order("sort_order");

    // kelompokkan path per aset (maks 2), lalu ubah ke data URI
    const grouped: Record<string, string[]> = {};
    for (const p of (photos ?? []) as { asset_id: string; storage_path: string }[]) {
      (grouped[p.asset_id] ??= []).push(p.storage_path);
    }
    await Promise.all(
      Object.entries(grouped).map(async ([assetId, paths]) => {
        const uris = await Promise.all(
          paths.slice(0, MAX_PHOTOS).map((path) => toDataUri(supabase, path))
        );
        photosByAsset[assetId] = uris.filter((u): u is string => !!u);
      })
    );
  }

  const items: AssetPdfItem[] = assetList.map((a) => ({
    id: a.id,
    product_name: a.product_name,
    serial_number: a.serial_number,
    purchase_date: a.purchase_date,
    warranty_end: a.warranty_end,
    warranty_status: a.warranty_status,
    photos: photosByAsset[a.id] ?? [],
  }));

  const pdfClient: AssetPdfClient = {
    company_name: client.company_name,
    address: client.address ?? null,
    phone: client.phone ?? null,
  };

  const printedAt = new Date().toISOString().slice(0, 10);

  const buffer = await renderToBuffer(
    AssetPdf({ client: pdfClient, assets: items, printedAt }) as React.ReactElement
  );

  const safeName = client.company_name.replace(/[^a-z0-9]/gi, "-");
  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Asset-${safeName}.pdf"`,
    },
  });
}

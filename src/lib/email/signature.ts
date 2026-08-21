import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { type Brand, toBrand } from "@/types/phase4";
import type { MailAttachment } from "./mailer";

// ============================================================
//  Tanda tangan email HTML (logo + blok kontak) untuk fitur
//  "Kirim via Gmail". Logo ditanam inline via CID agar tampil
//  di email client tanpa bergantung link eksternal.
//
//  Kini PER-BRAND: Athaya (teal) & Cetak Ide (oranye). Kontak sama
//  (satu entitas) — beda hanya nama, tagline, warna aksen, dan logo.
//  File logo per brand:
//    - Athaya   : public/email-logo.png            (CID athaya-logo)
//    - Cetak Ide: public/email-logo-cetak-ide.png  (CID cetak-ide-logo)
//  Bila file logo tak ada, tanda tangan tetap dikirim tanpa <img>.
// ============================================================

type BrandSignature = {
  identity: {
    name: string; tagline: string; address: string;
    phone: string; mobile: string; email1: string; email2: string; web: string;
  };
  teal: string;      // warna aksen (garis, label A/P/M/E/W)
  nameColor: string; // warna nama usaha
  logoFile: string;  // path file logo
  logoCid: string;   // Content-ID logo inline
};

const CONTACT = {
  address: "Jl Mahendradata Gg Puputan Baru II No 19 Denpasar - Bali",
  phone: "+62 83119956442",
  mobile: "+62 81339151010",
  email1: "agustasigit@gmail.com",
  email2: "athaya.it@gmail.com",
  web: "www.athayacomputer.com",
} as const;

const SIGNATURES: Record<Brand, BrandSignature> = {
  athaya: {
    identity: {
      name: "Athaya Computer",
      tagline: "IT Support | Web Development | Graphic Design",
      ...CONTACT,
    },
    teal: "#1CA9C9",
    nameColor: "#0E7C9B",
    logoFile: path.join(process.cwd(), "public", "email-logo.png"),
    logoCid: "athaya-logo",
  },
  cetak_ide: {
    identity: {
      name: "Cetak Ide",
      tagline: "Creative Advertising - Design - Printing",
      ...CONTACT,
    },
    teal: "#F8AB01",
    nameColor: "#F8AB01",
    logoFile: path.join(process.cwd(), "public", "email-logo-cetak-ide.png"),
    logoCid: "cetak-ide-logo",
  },
};

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Ubah teks polos (dengan newline) menjadi HTML aman + <br>. */
function textToHtml(text: string) {
  return esc(text).replace(/\r?\n/g, "<br>");
}

/** Baca logo brand dari disk sebagai lampiran inline (CID). null bila file tak ada. */
async function loadLogo(sig: BrandSignature): Promise<MailAttachment & { cid: string } | null> {
  try {
    const content = await readFile(sig.logoFile);
    return { filename: "logo.png", content, contentType: "image/png", cid: sig.logoCid };
  } catch {
    return null; // file belum disimpan → tanda tangan tetap dikirim tanpa logo
  }
}

/** HTML blok tanda tangan brand. `withLogo` false = tanpa <img> (file tidak ada). */
function signatureHtml(sig: BrandSignature, withLogo: boolean) {
  const id = sig.identity;
  const label = (t: string) =>
    `<b style="color:${sig.teal};display:inline-block;width:14px;">${t}</b>`;
  const logoCell = withLogo
    ? `<td style="vertical-align:top;padding-right:16px;">
         <img src="cid:${sig.logoCid}" alt="${esc(id.name)}" width="66"
              style="display:block;border:0;outline:none;" />
       </td>`
    : "";
  return `
  <table cellpadding="0" cellspacing="0" border="0"
    style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;line-height:1.5;">
    <tr>
      ${logoCell}
      <td style="vertical-align:top;">
        <div style="font-size:17px;font-weight:bold;color:${sig.nameColor};">${esc(id.name)}</div>
        <div style="color:#666666;margin:2px 0 7px;">${esc(id.tagline)}</div>
        <div style="border-top:2px solid ${sig.teal};max-width:300px;margin-bottom:7px;"></div>
        <div>${label("A")} ${esc(id.address)}</div>
        <div>${label("P")} ${esc(id.phone)}&nbsp;&nbsp;&nbsp;${label("M")} ${esc(id.mobile)}</div>
        <div>${label("E")} ${esc(id.email1)} | ${esc(id.email2)}</div>
        <div>${label("W")} ${esc(id.web)}</div>
      </td>
    </tr>
  </table>`;
}

/** Versi teks polos tanda tangan brand (fallback email client non-HTML). */
function signatureText(sig: BrandSignature) {
  const id = sig.identity;
  return [
    id.name,
    id.tagline,
    "----------------------------------------",
    `A  ${id.address}`,
    `P  ${id.phone}    M  ${id.mobile}`,
    `E  ${id.email1} | ${id.email2}`,
    `W  ${id.web}`,
  ].join("\n");
}

/**
 * Rangkai email lengkap dari isi (body) yang diketik user:
 * kembalikan versi HTML (isi + tanda tangan berlogo), versi teks polos,
 * dan lampiran logo (bila file tersedia). Tanda tangan mengikuti `brand`
 * (default Athaya) — Cetak Ide memakai identitas & warna oranye sendiri.
 */
export async function composeEmail(body: string, brand?: string | null): Promise<{
  html: string;
  text: string;
  attachments: MailAttachment[];
}> {
  const sig = SIGNATURES[toBrand(brand)];
  const logo = await loadLogo(sig);
  const html =
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222222;line-height:1.6;">` +
    `${textToHtml(body)}` +
    `</div><br>` +
    signatureHtml(sig, Boolean(logo));
  const text = `${body}\n\n${signatureText(sig)}`;
  const attachments: MailAttachment[] = logo ? [logo] : [];
  return { html, text, attachments };
}

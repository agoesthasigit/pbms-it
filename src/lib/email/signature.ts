import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { MailAttachment } from "./mailer";

// ============================================================
//  Tanda tangan email HTML (logo + blok kontak) untuk fitur
//  "Kirim via Gmail". Logo ditanam inline via CID agar tampil
//  di email client tanpa bergantung link eksternal.
//
//  Ganti isi teks di IDENTITY bila data usaha berubah.
//  File logo: public/email-logo.png (PNG, sebaiknya transparan).
// ============================================================

const LOGO_CID = "athaya-logo";
const LOGO_FILE = path.join(process.cwd(), "public", "email-logo.png");

const IDENTITY = {
  name: "Athaya Computer",
  tagline: "IT Support | Web Development | Graphic Design",
  address: "Jl Mahendradata Gg Puputan Baru II No 19 Denpasar - Bali",
  phone: "+62 83119956442",
  mobile: "+62 81339151010",
  email1: "agustasigit@gmail.com",
  email2: "athaya.it@gmail.com",
  web: "www.athayacomputer.com",
} as const;

// Warna mengikuti contoh tanda tangan
const TEAL = "#1CA9C9";
const NAME_COLOR = "#0E7C9B";

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Ubah teks polos (dengan newline) menjadi HTML aman + <br>. */
function textToHtml(text: string) {
  return esc(text).replace(/\r?\n/g, "<br>");
}

/** Baca logo dari disk sebagai lampiran inline (CID). null bila file tak ada. */
async function loadLogo(): Promise<MailAttachment & { cid: string } | null> {
  try {
    const content = await readFile(LOGO_FILE);
    return { filename: "logo.png", content, contentType: "image/png", cid: LOGO_CID };
  } catch {
    return null; // file belum disimpan → tanda tangan tetap dikirim tanpa logo
  }
}

/** HTML blok tanda tangan. `withLogo` false = tanpa <img> (file tidak ada). */
function signatureHtml(withLogo: boolean) {
  const label = (t: string) =>
    `<b style="color:${TEAL};display:inline-block;width:14px;">${t}</b>`;
  const logoCell = withLogo
    ? `<td style="vertical-align:top;padding-right:16px;">
         <img src="cid:${LOGO_CID}" alt="${esc(IDENTITY.name)}" width="66"
              style="display:block;border:0;outline:none;" />
       </td>`
    : "";
  return `
  <table cellpadding="0" cellspacing="0" border="0"
    style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;line-height:1.5;">
    <tr>
      ${logoCell}
      <td style="vertical-align:top;">
        <div style="font-size:17px;font-weight:bold;color:${NAME_COLOR};">${esc(IDENTITY.name)}</div>
        <div style="color:#666666;margin:2px 0 7px;">${esc(IDENTITY.tagline)}</div>
        <div style="border-top:2px solid ${TEAL};max-width:300px;margin-bottom:7px;"></div>
        <div>${label("A")} ${esc(IDENTITY.address)}</div>
        <div>${label("P")} ${esc(IDENTITY.phone)}&nbsp;&nbsp;&nbsp;${label("M")} ${esc(IDENTITY.mobile)}</div>
        <div>${label("E")} ${esc(IDENTITY.email1)} | ${esc(IDENTITY.email2)}</div>
        <div>${label("W")} ${esc(IDENTITY.web)}</div>
      </td>
    </tr>
  </table>`;
}

/** Versi teks polos tanda tangan (fallback email client non-HTML). */
function signatureText() {
  return [
    IDENTITY.name,
    IDENTITY.tagline,
    "----------------------------------------",
    `A  ${IDENTITY.address}`,
    `P  ${IDENTITY.phone}    M  ${IDENTITY.mobile}`,
    `E  ${IDENTITY.email1} | ${IDENTITY.email2}`,
    `W  ${IDENTITY.web}`,
  ].join("\n");
}

/**
 * Rangkai email lengkap dari isi (body) yang diketik user:
 * kembalikan versi HTML (isi + tanda tangan berlogo), versi teks polos,
 * dan lampiran logo (bila file tersedia).
 */
export async function composeEmail(body: string): Promise<{
  html: string;
  text: string;
  attachments: MailAttachment[];
}> {
  const logo = await loadLogo();
  const html =
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222222;line-height:1.6;">` +
    `${textToHtml(body)}` +
    `</div><br>` +
    signatureHtml(Boolean(logo));
  const text = `${body}\n\n${signatureText()}`;
  const attachments: MailAttachment[] = logo ? [logo] : [];
  return { html, text, attachments };
}

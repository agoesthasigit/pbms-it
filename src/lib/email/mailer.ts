import "server-only";
import nodemailer from "nodemailer";
import { createClient } from "@/lib/supabase/server";

// ============================================================
//  Pengirim email via Gmail SMTP (App Password).
//
//  Konfigurasi lewat .env.local:
//    GMAIL_USER          = akun Gmail pengirim (mis. athaya.it@gmail.com)
//    GMAIL_APP_PASSWORD  = App Password 16 karakter (tanpa spasi)
//    GMAIL_FROM_NAME     = nama tampil di inbox (mis. "Agusta Sigit IT")
//
//  Catatan: Gmail otomatis menyimpan email yang dikirim lewat SMTP ini
//  ke folder "Terkirim" akun GMAIL_USER, jadi tetap ada arsipnya.
// ============================================================

export type MailAttachment = {
  filename: string;
  content: Buffer;
  contentType?: string;
};

export type SendMailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: MailAttachment[];
};

type GmailConfig = { user: string; pass: string; fromName: string };

/**
 * Ambil konfigurasi Gmail. Prioritas:
 *   1) DATABASE (tabel email_settings) — dikelola lewat menu Pengaturan → Email,
 *      password tersimpan terenkripsi (pgcrypto, kunci CREDENTIALS_SECRET_KEY).
 *   2) env GMAIL_* — fallback mundur-kompatibel (deployment lama tetap jalan).
 * Melempar error bila belum lengkap di kedua sumber.
 */
async function getConfig(): Promise<GmailConfig> {
  // --- Sumber 1: database (butuh sesi login + kunci dekripsi) ---
  const key = process.env.CREDENTIALS_SECRET_KEY;
  if (key) {
    try {
      const supabase = await createClient();
      const [{ data: rows }, { data: revealed }] = await Promise.all([
        supabase.rpc("get_email_settings"),
        supabase.rpc("reveal_email_password", { p_key: key }),
      ]);
      const row = (Array.isArray(rows) ? rows[0] : rows) as
        | { gmail_user: string | null; gmail_from_name: string | null }
        | undefined;
      const user = row?.gmail_user?.trim();
      const pass = typeof revealed === "string" ? revealed.replace(/\s+/g, "") : "";
      if (user && pass) {
        const fromName = row?.gmail_from_name?.trim() || "Agusta Sigit IT";
        return { user, pass, fromName };
      }
    } catch {
      // gagal baca DB (mis. tanpa sesi) → lanjut ke env
    }
  }

  // --- Sumber 2: env ---
  const user = process.env.GMAIL_USER?.trim();
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, ""); // izinkan spasi App Password
  const fromName = process.env.GMAIL_FROM_NAME?.trim() || "Agusta Sigit IT";
  if (!user || !pass) {
    throw new Error(
      "Email pengirim belum dikonfigurasi. Isi di menu Pengaturan → Email (atau set GMAIL_USER & GMAIL_APP_PASSWORD di environment)."
    );
  }
  return { user, pass, fromName };
}

/** True bila kredensial Gmail sudah terisi (DB atau env). */
export async function isMailerConfigured(): Promise<boolean> {
  try { await getConfig(); return true; } catch { return false; }
}

// Pakai SMTP 587 + STARTTLS (bukan preset service "gmail" yang default ke port
// 465/TLS-implisit) — di sebagian jaringan port 465 diblokir/time-out, sedangkan
// 587 STARTTLS lolos. Host & auth tetap akun Gmail (App Password). Transporter
// dibangun per-kirim karena kredensial bisa berubah lewat UI Pengaturan.
function buildTransporter(user: string, pass: string) {
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,       // STARTTLS di-upgrade setelah koneksi
    requireTLS: true,
    auth: { user, pass },
  });
}

/** Kirim satu email. Mengembalikan alamat pengirim yang dipakai. */
export async function sendMail(input: SendMailInput): Promise<{ from: string }> {
  const { user, pass, fromName } = await getConfig();
  const transporter = buildTransporter(user, pass);
  const from = `"${fromName}" <${user}>`;
  await transporter.sendMail({
    from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
    attachments: input.attachments,
  });
  return { from: user };
}

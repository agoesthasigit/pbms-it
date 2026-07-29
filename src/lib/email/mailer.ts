import "server-only";
import nodemailer from "nodemailer";

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

/** Ambil konfigurasi Gmail dari env; melempar error jika belum lengkap. */
function getConfig() {
  const user = process.env.GMAIL_USER?.trim();
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, ""); // izinkan spasi App Password
  const fromName = process.env.GMAIL_FROM_NAME?.trim() || "Agusta Sigit IT";
  if (!user || !pass) {
    throw new Error(
      "Email pengirim belum dikonfigurasi. Isi GMAIL_USER & GMAIL_APP_PASSWORD di .env.local lalu restart server."
    );
  }
  return { user, pass, fromName };
}

/** True bila kredensial Gmail sudah terisi (untuk cek di server sebelum kirim). */
export function isMailerConfigured() {
  return Boolean(process.env.GMAIL_USER?.trim() && process.env.GMAIL_APP_PASSWORD?.trim());
}

let cached: nodemailer.Transporter | null = null;

function getTransporter() {
  const { user, pass } = getConfig();
  if (cached) return cached;
  // Pakai SMTP 587 + STARTTLS (bukan preset service "gmail" yang default ke port
  // 465/TLS-implisit) — di sebagian jaringan port 465 diblokir/time-out, sedangkan
  // 587 STARTTLS lolos. Host & auth tetap akun Gmail (App Password).
  cached = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,       // STARTTLS di-upgrade setelah koneksi
    requireTLS: true,
    auth: { user, pass },
  });
  return cached;
}

/** Kirim satu email. Mengembalikan alamat pengirim yang dipakai. */
export async function sendMail(input: SendMailInput): Promise<{ from: string }> {
  const { user, fromName } = getConfig();
  const transporter = getTransporter();
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

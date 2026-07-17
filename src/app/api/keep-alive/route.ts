import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Route ini dipanggil oleh Vercel Cron secara berkala untuk menjaga
// database Supabase tetap aktif (mencegah pause 7 hari di free tier).
// Memakai SERVICE ROLE key (server-only) agar bypass RLS & tidak perlu login.

export const dynamic = "force-dynamic"; // jangan di-cache

export async function GET(req: Request) {
  // Proteksi opsional: hanya izinkan pemanggilan dengan secret yang benar.
  // Vercel Cron otomatis mengirim header Authorization: Bearer <CRON_SECRET>.
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json(
      { error: "Env NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diset." },
      { status: 500 }
    );
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });

  try {
    // 1) tulis 1 baris ping (ini yang mereset timer inaktivitas)
    const { error: insErr } = await supabase
      .from("keep_alive")
      .insert({ pinged_at: new Date().toISOString() });
    if (insErr) throw insErr;

    // 2) bersihkan baris lama (>7 hari) agar tabel tetap mungil
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    await supabase.from("keep_alive").delete().lt("pinged_at", weekAgo);

    return NextResponse.json({
      ok: true,
      pinged_at: new Date().toISOString(),
      message: "Supabase keep-alive ping berhasil.",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

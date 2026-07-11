import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST { kind: 'network'|'cctv'|'wifi', id } → { password }
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const key = process.env.CREDENTIALS_SECRET_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "CREDENTIALS_SECRET_KEY belum diset di environment." },
      { status: 500 }
    );
  }

  let body: { kind?: string; id?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }

  const { kind, id } = body;
  if (!id || !["network", "cctv", "wifi"].includes(kind ?? "")) {
    return NextResponse.json({ error: "Parameter tidak valid" }, { status: 400 });
  }

  const fn =
    kind === "network" ? "reveal_network_password"
    : kind === "wifi" ? "reveal_wifi_password"
    : "reveal_cctv_password";

  const { data, error } = await supabase.rpc(fn, { p_id: id, p_key: key });
  if (error) return NextResponse.json({ error: "Gagal mendekripsi." }, { status: 500 });
  return NextResponse.json({ password: (data as string) ?? "" });
}

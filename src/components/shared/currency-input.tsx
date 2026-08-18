"use client";

// Input mata-uang Rupiah dengan pemisah ribuan otomatis saat mengetik.
// Menyimpan nilai sebagai string angka MENTAH ("6050000"), tapi menampilkan
// "6.050.000" agar tak salah baca nol untuk nominal jutaan.
//
// Pemakaian (drop-in pengganti <Input type="number"> untuk uang):
//   <CurrencyInput value={line.price} onValueChange={(v) => setLine(i, { price: v })} />
// `value` & hasil `onValueChange` = string digit mentah (cocok dgn toNumber()).

import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";

const nf = new Intl.NumberFormat("id-ID");

/** Tampilkan digit mentah sebagai "1.234.567" (kosong bila tak ada digit).
 *  Nilai programatik ber-desimal (mis. "6050000.00" dari default harga produk)
 *  diambil bagian bulatnya agar tidak korup jadi "605000000". */
function formatGrouped(raw: string): string {
  if (raw == null || raw === "") return "";
  let digits: string;
  if (/[.,]/.test(raw)) {
    const n = Math.trunc(Number(raw.replace(",", ".")));
    digits = Number.isFinite(n) ? String(Math.abs(n)) : raw.replace(/\D/g, "");
  } else {
    digits = raw.replace(/\D/g, "");
  }
  return digits ? nf.format(Number(digits)) : "";
}

type Props = Omit<
  ComponentProps<typeof Input>,
  "value" | "onChange" | "type" | "inputMode"
> & {
  /** Nilai mentah (hanya digit, "" diperbolehkan). */
  value: string;
  /** Dipanggil dengan string digit mentah setelah pemisah dibuang. */
  onValueChange: (raw: string) => void;
};

export function CurrencyInput({ value, onValueChange, ...props }: Props) {
  return (
    <Input
      {...props}
      type="text"
      inputMode="numeric"
      value={formatGrouped(value)}
      onChange={(e) => onValueChange(e.target.value.replace(/\D/g, ""))}
    />
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";

/**
 * Paginasi sisi-klien untuk daftar yang sudah difilter.
 *
 * @param items    array hasil filter/pencarian yang mau dipotong per halaman
 * @param pageSize jumlah baris per halaman (default 10)
 * @param resetKey nilai yang, saat berubah, memulangkan tampilan ke halaman 1
 *                 — biasanya gabungan state filter/pencarian, mis.
 *                 `` `${q}|${status}|${clientId}` ``. Tanpa ini, memfilter saat
 *                 berada di halaman 5 bisa menampilkan halaman kosong.
 */
export function usePagination<T>(
  items: T[],
  pageSize = 10,
  resetKey?: unknown
) {
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(page, totalPages);

  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  const paged = useMemo(
    () => items.slice((current - 1) * pageSize, current * pageSize),
    [items, current, pageSize]
  );

  return {
    page: current,
    setPage,
    paged,
    totalPages,
    total: items.length,
    from: items.length === 0 ? 0 : (current - 1) * pageSize + 1,
    to: Math.min(current * pageSize, items.length),
  };
}

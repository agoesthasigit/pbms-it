<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# UI: pakai Base UI (`@base-ui/react`), BUKAN Radix/shadcn

Komponen di `src/components/ui/*` dibangun di atas **Base UI**. Konvensi komposisinya
berbeda dari Radix/shadcn yang ada di training data. **Jangan pakai `asChild`** — Base UI
tidak mengenalnya, propnya diabaikan diam-diam sehingga elemen jadi tersarang
(mis. `<button>` di dalam `<button>`) → **hydration error**.

Gunakan prop **`render`** untuk komposisi:

```tsx
// ❌ SALAH (pola Radix) — menghasilkan <button> di dalam <button>
<SheetTrigger asChild>
  <Button variant="ghost">...</Button>
</SheetTrigger>

// ✅ BENAR (pola Base UI) — child jadi isi elemen yang di-render
<SheetTrigger render={<Button variant="ghost" />}>
  <Menu className="h-5 w-5" />
</SheetTrigger>

// ✅ Button yang di-render sebagai elemen NON-button (mis. <a>/<Link>):
//    wajib set nativeButton={false} agar `type="button"` tidak ikut menempel
<Button variant="outline" nativeButton={false} render={<Link href="/products" />}>
  <ArrowLeft className="h-4 w-4" /> Kembali
</Button>
```

Berlaku untuk semua trigger Base UI: `SheetTrigger`, `DialogTrigger`,
`DropdownMenuTrigger`, `SelectTrigger`, `PopoverTrigger`, dst.

## `<Select>` WAJIB diberi prop `items` (value→label)

Base UI `Select.Value` secara default menampilkan **value mentah**, bukan label.
Kalau `value`-nya berupa id (UUID) atau kode (`cash`, `in`, `all`), trigger akan
menampilkan teks acak seperti `37a3bfa3-5edc-...` alih-alih nama item. Solusinya:
oper array `{ value, label }` ke prop **`items`** pada `<Select>` (root).

```tsx
// ❌ SALAH — trigger menampilkan UUID/kode mentah
<Select value={walletId} onValueChange={setWalletId}>
  <SelectTrigger><SelectValue placeholder="Wallet" /></SelectTrigger>
  <SelectContent>
    {wallets.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
  </SelectContent>
</Select>

// ✅ BENAR — `items` memetakan value→label, jadikan sumber SelectItem juga
const items = wallets.map((w) => ({ value: w.id, label: w.name }));
<Select items={items} value={walletId} onValueChange={(v) => setWalletId(v ?? "")}>
  <SelectTrigger><SelectValue placeholder="Wallet" /></SelectTrigger>
  <SelectContent>
    {items.map((it) => <SelectItem key={it.value} value={it.value}>{it.label}</SelectItem>)}
  </SelectContent>
</Select>
```

Catatan: `onValueChange` memberi `string | null` (bukan `string`). Kalau state-nya
`string`, tampung dengan `v ?? ""` (atau default lain) supaya tidak error TypeScript.

### Nilai kosong: pakai `|| null`, JANGAN `|| undefined`

Base UI menentukan controlled/uncontrolled dari render pertama: value `undefined`
= *uncontrolled*, selain itu (termasuk `null`) = *controlled*. Kalau state awal `""`
lalu ditulis `value={walletId || undefined}`, render pertama jadi `undefined`
(uncontrolled), begitu dipilih berubah jadi string (controlled) → **console error
"changing uncontrolled to controlled"** + value mentah (UUID) bocor ke trigger.

```tsx
// ❌ SALAH — render pertama `undefined` (uncontrolled), lalu controlled
<Select value={walletId || undefined} ...>

// ✅ BENAR — `null` tetap controlled sejak awal, placeholder tetap muncul
<Select items={items} value={walletId || null}
  onValueChange={(v) => setWalletId(v ?? "")} ...>
```

`null` adalah sentinel "belum dipilih" di Base UI dan tetap menampilkan
`placeholder` pada `<SelectValue>`. Untuk value enum yang selalu terisi
(mis. `method`, `type`, `status`) cukup `value={method}` tanpa `|| null`.

## Riwayat perbaikan

- **2026-07-11 — Fix nested `<button>` hydration error.** Beberapa komponen ditulis
  dengan `asChild` (pola Radix) sehingga trigger merender `<button>`-nya sendiri
  membungkus `<Button>` anak → button tersarang. Diubah ke prop `render`:
  `src/components/shared/app-header.tsx` (SheetTrigger + DropdownMenuTrigger),
  `src/app/(app)/products/product-manager.tsx` (Button→Link riwayat stok),
  `src/app/(app)/products/[id]/page.tsx` (Button→Link kembali). Untuk Button yang
  dirender sebagai `<Link>` ditambahkan `nativeButton={false}`.
- **2026-07-11 — Fix Select menampilkan value mentah (UUID/kode).** Semua `<Select>`
  belum mengoper prop `items`, sehingga trigger menampilkan UUID/`cash`/`all`
  alih-alih label (mis. field "Dari" di Transfer Antar Wallet menampilkan UUID).
  Ditambahkan `items` + normalisasi `onValueChange` (`v ?? ...`) di:
  `wallets/wallet-manager.tsx`, `products/product-manager.tsx`,
  `clients/client-manager.tsx`, `(app)/settings/category-manager.tsx`.
- **2026-07-11 — Fix Select "uncontrolled→controlled" + saldo wallet jadi UUID.**
  Form Phase 3 memakai `value={x || undefined}` sehingga render pertama uncontrolled
  lalu controlled (console error di `purchases/page.tsx`), dan trigger menampilkan
  UUID. Diganti ke `value={x || null}` + ditambah prop `items` di:
  `purchases/purchase-form.tsx`, `sales/sale-form.tsx`,
  `components/shared/expense-manager.tsx`, plus category select di
  `products/product-manager.tsx` & `clients/client-manager.tsx`.

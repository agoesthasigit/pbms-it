// Gauge setengah lingkaran (SVG murni, tanpa dependency).
// Zona merah→oranye→hijau dari kiri ke kanan, dengan jarum penunjuk nilai.
// Skala (min/max) ditentukan pemanggil; nilai di luar rentang otomatis di-clamp.

function polar(cx: number, cy: number, r: number, f: number) {
  const a = Math.PI * (1 - f); // f=0 → 180° (kiri), f=1 → 0° (kanan)
  return { x: cx + r * Math.cos(a), y: cy - r * Math.sin(a) };
}

function arcPath(cx: number, cy: number, r: number, f0: number, f1: number) {
  const p0 = polar(cx, cy, r, f0);
  const p1 = polar(cx, cy, r, f1);
  return `M ${p0.x} ${p0.y} A ${r} ${r} 0 0 1 ${p1.x} ${p1.y}`;
}

export function Gauge({
  value, min, max, reverse = false,
}: {
  value: number;
  min: number;
  max: number;
  // reverse: hijau di kiri, merah di kanan (mis. untuk "spending" — makin besar makin buruk)
  reverse?: boolean;
}) {
  const span = max - min;
  const raw = span > 0 ? (value - min) / span : 0;
  const f = Math.max(0, Math.min(1, raw)); // clamp 0..1
  const cx = 100, cy = 100, r = 78, tickR = 90;

  const needle = polar(cx, cy, r * 0.82, f);
  const hub = 5;

  const leftColor = reverse ? "#10b981" : "#ef4444";
  const rightColor = reverse ? "#ef4444" : "#10b981";

  return (
    <svg viewBox="0 0 200 116" className="w-full" role="img" aria-label="gauge">
      {/* Track dasar */}
      <path d={arcPath(cx, cy, r, 0, 1)} fill="none" stroke="currentColor"
        className="text-muted/30" strokeWidth={14} strokeLinecap="round" />
      {/* Zona warna */}
      <path d={arcPath(cx, cy, r, 0, 0.34)} fill="none" stroke={leftColor}
        strokeWidth={14} strokeLinecap="round" />
      <path d={arcPath(cx, cy, r, 0.36, 0.64)} fill="none" stroke="#f59e0b"
        strokeWidth={14} />
      <path d={arcPath(cx, cy, r, 0.66, 1)} fill="none" stroke={rightColor}
        strokeWidth={14} strokeLinecap="round" />
      {/* Jarum */}
      <line x1={cx} y1={cy} x2={needle.x} y2={needle.y}
        stroke="currentColor" className="text-foreground"
        strokeWidth={3} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={hub} className="fill-foreground" />
      {/* Label ujung skala */}
      <text x={polar(cx, cy, tickR, 0).x - 2} y={cy + 12} fontSize={9}
        textAnchor="middle" className="fill-muted-foreground">min</text>
      <text x={polar(cx, cy, tickR, 1).x + 2} y={cy + 12} fontSize={9}
        textAnchor="middle" className="fill-muted-foreground">max</text>
    </svg>
  );
}

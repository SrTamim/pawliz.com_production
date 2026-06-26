import { useState } from "react";

export function MiniBarChart({ data, height = 120 }: any) {
  const max = Math.max(...data.map((d: any) => d.value), 1);
  const barW = 100 / data.length;
  return (
    <svg width="100%" height={height} style={{ display: "block", overflow: "visible" }}>
      {data.map((d: any, i: any) => {
        const barH = Math.max((d.value / max) * (height - 28), 2);
        const x = i * barW + barW * 0.15;
        const w = barW * 0.7;
        const y = height - 20 - barH;
        return (
          <g key={i}>
            <rect
              x={`${x}%`}
              y={y}
              width={`${w}%`}
              height={barH}
              rx={3}
              fill={d.color || "var(--accent)"}
              opacity={0.85}
            />
            <text
              x={`${x + w / 2}%`}
              y={y - 4}
              textAnchor="middle"
              fontSize={10}
              fill="var(--text-secondary)"
              fontFamily="DM Sans, sans-serif"
            >
              {d.value}
            </text>
            <text
              x={`${x + w / 2}%`}
              y={height - 4}
              textAnchor="middle"
              fontSize={9}
              fill="var(--text-muted)"
              fontFamily="DM Sans, sans-serif"
            >
              {d.shortLabel}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
export function DonutChart({ segments, size = 110 }: any) {
  const r = 40;
  const cx = size / 2;
  const cy = size / 2;
  const total = segments.reduce((s: any, d: any) => s + d.value, 0) || 1;
  let cumAngle = -Math.PI / 2;
  const paths = segments.map((seg: any) => {
    const angle = (seg.value / total) * 2 * Math.PI;
    const x1 = cx + r * Math.cos(cumAngle);
    const y1 = cy + r * Math.sin(cumAngle);
    cumAngle += angle;
    const x2 = cx + r * Math.cos(cumAngle);
    const y2 = cy + r * Math.sin(cumAngle);
    const largeArc = angle > Math.PI ? 1 : 0;
    const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    return { d, color: seg.color, value: seg.value };
  });
  return (
    <svg width={size} height={size}>
      <circle cx={cx} cy={cy} r={r} fill="var(--bg-primary)" />
      {paths.map((p: any, i: any) => (
        <path key={i} d={p.d} fill={p.color} opacity={0.85} />
      ))}
      <circle cx={cx} cy={cy} r={r * 0.6} fill="var(--bg-card)" />
      <text x={cx} y={cy + 4} textAnchor="middle" fontSize={13} fontWeight={700} fill="var(--text-primary)" fontFamily="Roboto, sans-serif">
        {total}
      </text>
    </svg>
  );
}
// `delta` is the net new count for this week; `prevDelta` the prior week, used
// only to pick the trend arrow direction. Both optional → card stays backward compatible.
export function StatCard({ icon, value, label, color, delta, prevDelta }: any) {
  const hasDelta = typeof delta === "number";
  const up = hasDelta && delta >= (prevDelta ?? 0);
  const deltaColor = !hasDelta ? "" : delta === 0 ? "var(--text-muted)" : up ? "#00c875" : "#ff6b6b";
  return (
    <div style={{
      padding: "18px 20px",
      background: "var(--bg-card)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius)",
      display: "flex",
      alignItems: "center",
      gap: 14,
    }}>
      <div style={{ fontSize: 28, flexShrink: 0 }}>{icon}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <div style={{ fontFamily: "Roboto, sans-serif", fontSize: 28, fontWeight: 800, color: color || "var(--accent)", lineHeight: 1 }}>{value}</div>
          {hasDelta && (
            <span style={{ fontSize: 12, fontWeight: 700, color: deltaColor, whiteSpace: "nowrap" }}>
              {delta === 0 ? "→" : up ? "▲" : "▼"} {delta > 0 ? "+" : ""}{delta}
            </span>
          )}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 500, marginTop: 3 }}>
          {label}{hasDelta ? " · 7d" : ""}
        </div>
      </div>
    </div>
  );
}

// Attention card for the Action Center. Neutral/green at 0, danger-tinted when
// there's a backlog. Clickable → routes into the relevant admin section.
export function ActionCard({ icon, count, label, onClick }: any) {
  const active = count > 0;
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: "left",
        padding: "16px 18px",
        background: active ? "color-mix(in srgb, var(--danger) 10%, var(--bg-card))" : "var(--bg-card)",
        border: `1px solid ${active ? "var(--danger)" : "var(--border)"}`,
        borderRadius: "var(--radius)",
        display: "flex",
        alignItems: "center",
        gap: 14,
        cursor: "pointer",
        width: "100%",
        fontFamily: "DM Sans, sans-serif",
        transition: "all 0.15s",
      }}
    >
      <div style={{ fontSize: 24, flexShrink: 0 }}>{icon}</div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontFamily: "Roboto, sans-serif", fontSize: 24, fontWeight: 800, color: active ? "var(--danger)" : "var(--text-primary)", lineHeight: 1 }}>{count}</div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 500, marginTop: 3 }}>{label}</div>
      </div>
      <span style={{ fontSize: 16, color: active ? "var(--danger)" : "var(--text-muted)", flexShrink: 0 }}>›</span>
    </button>
  );
}

// Multi-series area+line chart, same custom-SVG approach as MiniBarChart/DonutChart.
// `series` = [{ key, color, label }]; `data` = [{ date, [key]: number }].
export function MiniLineChart({ data, series, height = 180 }: any) {
  const W = 600, padL = 8, padR = 8, padT = 12, padB = 22;
  if (!data || data.length === 0) return null;
  const max = Math.max(1, ...data.flatMap((d: any) => series.map((s: any) => d[s.key] ?? 0)));
  const innerW = W - padL - padR;
  const innerH = height - padT - padB;
  const xAt = (i: number) => padL + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const yAt = (v: number) => padT + innerH - (v / max) * innerH;
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" style={{ display: "block" }}>
      {[0, 0.5, 1].map((g) => (
        <line key={g} x1={padL} x2={W - padR} y1={padT + innerH * g} y2={padT + innerH * g} stroke="var(--border)" strokeWidth={1} opacity={0.5} />
      ))}
      {series.map((s: any) => {
        const pts = data.map((d: any, i: number) => `${xAt(i)},${yAt(d[s.key] ?? 0)}`);
        const area = `M ${padL},${padT + innerH} L ${pts.join(" L ")} L ${W - padR},${padT + innerH} Z`;
        return (
          <g key={s.key}>
            <path d={area} fill={s.color} opacity={0.1} />
            <polyline points={pts.join(" ")} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          </g>
        );
      })}
    </svg>
  );
}
export const SERVER_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api").replace("/api", "");
export function getAdminImageUrl(path: any) {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${SERVER_BASE}${path}`;
}
export function TableWrapper({ title, children }: any) {
  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "14px 20px",
          borderBottom: "1px solid var(--border)",
          fontFamily: "Roboto, sans-serif",
          fontWeight: 700,
          fontSize: 15,
          color: "var(--text-primary)",
        }}
      >
        {title}
      </div>
      <div style={{ overflowX: "auto" }}>{children}</div>
    </div>
  );
}
export function SectionTitle({ children }: any) {
  return (
    <div
      style={{
        fontFamily: "Roboto, sans-serif",
        fontWeight: 800,
        fontSize: 22,
        color: "var(--text-primary)",
        marginBottom: 24,
      }}
    >
      {children}
    </div>
  );
}
export function Tr({ children, header }: any) {
  return (
    <tr
      style={{
        background: header ? "var(--bg-elevated)" : "transparent",
        transition: "background 0.15s",
      }}
      onMouseEnter={(e: any) => {
        if (!header) e.currentTarget.style.background = "var(--bg-elevated)";
      }}
      onMouseLeave={(e: any) => {
        if (!header) e.currentTarget.style.background = "transparent";
      }}
    >
      {children}
    </tr>
  );
}
export function Th({ children }: any) {
  return (
    <th
      style={{
        padding: "10px 16px",
        textAlign: "left",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "1px",
        textTransform: "uppercase",
        color: "var(--text-muted)",
        borderBottom: "1px solid var(--border)",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}
export function Td({ children, bold, style }: any) {
  return (
    <td
      style={{
        padding: "13px 16px",
        fontSize: 13,
        color: bold ? "var(--text-primary)" : "var(--text-secondary)",
        fontWeight: bold ? 600 : 400,
        borderBottom: "1px solid var(--border)",
        verticalAlign: "middle",
        ...style,
      }}
    >
      {children}
    </td>
  );
}

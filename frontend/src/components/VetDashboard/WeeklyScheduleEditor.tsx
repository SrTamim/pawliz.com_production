import type { WeeklySchedule, DaySchedule } from "../../types";

// Ordered days matching the rest of the app (Saturday-first, BD week).
const DAY_DEFS: { key: string; label: string }[] = [
  { key: "saturday", label: "Saturday" },
  { key: "sunday", label: "Sunday" },
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" },
];

const TIME_OPTIONS = (() => {
  const opts: { value: string; label: string }[] = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      const hh = String(h).padStart(2, "0");
      const mm = String(m).padStart(2, "0");
      const period = h < 12 ? "AM" : "PM";
      const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      opts.push({ value: `${hh}:${mm}`, label: `${h12}:${mm} ${period}` });
    }
  }
  return opts;
})();

// Default hours used when a closed day is toggled open.
const DEFAULT_OPEN = "09:00";
const DEFAULT_CLOSE = "17:00";

/**
 * Build a per-day schedule from the various legacy / partial shapes so old profiles
 * render populated. Priority: explicit weekly_schedule → legacy checkup_start/end + holidays.
 */
export function buildScheduleFromLegacy(
  weekly_schedule: WeeklySchedule | null | undefined,
  checkup_start?: string | null,
  checkup_end?: string | null,
  weekly_holidays?: string[] | null,
): WeeklySchedule {
  const out: WeeklySchedule = {};
  if (weekly_schedule && typeof weekly_schedule === "object") {
    for (const { key } of DAY_DEFS) {
      const d = weekly_schedule[key];
      out[key] = d && d.open ? { open: d.open.slice(0, 5), close: (d.close || "").slice(0, 5) } : null;
    }
    return out;
  }
  // Legacy fallback: same hours every non-holiday day.
  const start = checkup_start ? checkup_start.slice(0, 5) : "";
  const end = checkup_end ? checkup_end.slice(0, 5) : "";
  const holidays = (weekly_holidays || []).map((h) => h.toLowerCase());
  for (const { key } of DAY_DEFS) {
    out[key] = !holidays.includes(key) && start ? { open: start, close: end } : null;
  }
  return out;
}

interface Props {
  value: WeeklySchedule;
  onChange: (next: WeeklySchedule) => void;
  // Optional translations; falls back to English labels.
  labels?: { open?: string; closed?: string };
  inputStyle?: any;
  compact?: boolean;
}

export default function WeeklyScheduleEditor({ value, onChange, labels, inputStyle, compact }: Props) {
  const openLabel = labels?.open || "Open";
  const closedLabel = labels?.closed || "Closed";

  const setDay = (key: string, day: DaySchedule | null) => {
    onChange({ ...value, [key]: day });
  };

  const selStyle: any = inputStyle || {
    padding: "8px 10px", borderRadius: 8, fontSize: 13,
    background: "var(--bg-elevated)", border: "1px solid var(--border)",
    color: "var(--text-primary)", outline: "none",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: compact ? 6 : 8 }}>
      {DAY_DEFS.map(({ key, label }) => {
        const day = value[key];
        const isOpen = !!(day && day.open);
        return (
          <div
            key={key}
            style={{
              display: "grid",
              gridTemplateColumns: compact ? "90px auto 1fr" : "110px 90px 1fr",
              alignItems: "center", gap: 8,
            }}
          >
            <span style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 500 }}>{label}</span>
            <button
              type="button"
              onClick={() =>
                setDay(key, isOpen ? null : { open: DEFAULT_OPEN, close: DEFAULT_CLOSE })
              }
              style={{
                padding: "5px 12px", borderRadius: 20, fontSize: 12, cursor: "pointer",
                fontFamily: "DM Sans, sans-serif", border: "1px solid var(--border)",
                background: isOpen ? "rgba(0,229,160,0.12)" : "#ff4f6a22",
                color: isOpen ? "var(--accent)" : "#ff4f6a",
                fontWeight: 600, whiteSpace: "nowrap",
              }}
            >
              {isOpen ? openLabel : closedLabel}
            </button>
            {isOpen ? (
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                <select
                  style={selStyle}
                  value={day!.open}
                  onChange={(e) => setDay(key, { open: e.target.value, close: day!.close })}
                >
                  {TIME_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <span style={{ color: "var(--text-muted)" }}>–</span>
                <select
                  style={selStyle}
                  value={day!.close}
                  onChange={(e) => setDay(key, { open: day!.open, close: e.target.value })}
                >
                  {TIME_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            ) : (
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{closedLabel}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

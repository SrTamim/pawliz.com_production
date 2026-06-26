import { useState, useEffect } from 'react';

// ─── SPINNER ─────────────────────────────────────────────────────────────
export function Spinner({ size = 18 }: any) {
  return (
    <div style={{
      width: size, height: size,
      border: '2px solid var(--border)',
      borderTopColor: 'var(--accent)',
      borderRadius: '50%',
      animation: 'spin 0.7s linear infinite',
      flexShrink: 0,
    }} />
  );
}

// ─── LOADING STATE ───────────────────────────────────────────────────────
export function Loading({ text = 'Loading...' }: any) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48, gap: 10, color: 'var(--text-muted)', fontSize: 13 }}>
      <Spinner /> {text}
    </div>
  );
}

// ─── EMPTY STATE ──────────────────────────────────────────────────────────
export function EmptyState({ icon = '🔍', title = 'Nothing found', subtitle }: any) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 20px' }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>{icon}</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>{title}</div>
      {subtitle && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{subtitle}</div>}
    </div>
  );
}

// ─── BUTTON ───────────────────────────────────────────────────────────────
export function Button({ children, variant = 'accent', size = 'md', loading, disabled, style, ...props }: any) {
  const sizes = { sm: '6px 12px', md: '9px 18px', lg: '12px 24px' };
  const fontSizes = { sm: 12, md: 14, lg: 15 };
  const minHeights = { sm: 32, md: 44, lg: 48 };
  const variants = {
    accent: { background: 'var(--grad-cool)', color: 'var(--on-accent)', fontWeight: 700, boxShadow: '0 8px 22px -8px rgba(0,229,160,0.55)' },
    ghost: { background: 'var(--glass)', color: 'var(--text-primary)', border: '1px solid var(--border-2)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' },
    danger: { background: 'var(--danger)', color: 'white', fontWeight: 700 },
    outline: { background: 'transparent', border: '1.5px solid var(--mint-ring)', color: 'var(--accent)', fontWeight: 700 },
    donate: { background: 'var(--grad-warm)', color: '#2a1700', fontWeight: 700, boxShadow: '0 8px 20px -8px rgba(255,140,0,0.55)' },
    dark: { background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border)' },
  };
  return (
    <button
      disabled={disabled || loading}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        padding: (sizes as any)[size],
        borderRadius: 10,
        fontSize: (fontSizes as any)[size],
        fontFamily: 'DM Sans, sans-serif',
        fontWeight: 700,
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        border: 'none',
        transition: 'transform 0.2s var(--ease), filter 0.2s var(--ease), background 0.2s, border-color 0.2s',
        opacity: disabled ? 0.6 : 1,
        whiteSpace: 'nowrap',
        minHeight: (minHeights as any)[size],
        ...(variants as any)[variant],
        ...style,
      }}
      onMouseEnter={(e: any) => {
        if (!(disabled || loading)) {
          e.currentTarget.style.transform = 'translateY(-1px)';
          e.currentTarget.style.filter = 'brightness(1.05)';
        }
        props.onMouseEnter?.(e);
      }}
      onMouseLeave={(e: any) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.filter = 'none';
        props.onMouseLeave?.(e);
      }}
      {...props}
    >
      {loading && <Spinner size={14} />}
      {children}
    </button>
  );
}

// ─── INPUT ────────────────────────────────────────────────────────────────
export function Input({ label, error, id, name, ...props }: any) {
  const fieldId = id ?? name;
  return (
    <div style={{ marginBottom: error ? 4 : 0 }}>
      {label && <label className="label" htmlFor={fieldId}>{label}</label>}
      <input className="input-field" id={fieldId} name={name} style={{ minHeight: 44 }} {...props} />
      {error && <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>{error}</div>}
    </div>
  );
}

// ─── TEXTAREA ─────────────────────────────────────────────────────────────
export function Textarea({ label, error, rows = 3, ...props }: any) {
  return (
    <div>
      {label && <label className="label">{label}</label>}
      <textarea className="input-field" rows={rows} style={{ resize: 'vertical' }} {...props} />
      {error && <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>{error}</div>}
    </div>
  );
}

// ─── BADGE ────────────────────────────────────────────────────────────────
export function Badge({ children, color = 'accent' }: any) {
  const colors = {
    accent: { bg: 'var(--accent-dim)', border: 'var(--border-accent)', color: 'var(--accent)' },
    gold: { bg: 'rgba(240,165,0,0.15)', border: 'rgba(240,165,0,0.3)', color: 'var(--gold)' },
    danger: { bg: 'rgba(255,79,106,0.1)', border: 'rgba(255,79,106,0.2)', color: 'var(--danger)' },
    gray: { bg: 'var(--bg-elevated)', border: 'var(--border)', color: 'var(--text-muted)' },
    info: { bg: 'rgba(99,179,237,0.12)', border: 'rgba(99,179,237,0.3)', color: '#63b3ed' },
  };
  const c = (colors as any)[color] || colors.accent;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '3px 10px',
      borderRadius: 999,
      fontSize: 11, fontWeight: 600, letterSpacing: '0.3px',
      background: c.bg, border: `1px solid ${c.border}`, color: c.color,
    }}>
      {children}
    </span>
  );
}

// ─── STAR DISPLAY ─────────────────────────────────────────────────────────
export function Stars({ rating, count, size = 13 }: any) {
  const filled = Math.round(rating || 0);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ color: 'var(--gold)', fontSize: size, letterSpacing: 1 }}>
        {'★'.repeat(filled)}{'☆'.repeat(5 - filled)}
      </span>
      <span style={{ fontSize: size, fontWeight: 600, color: 'var(--text-primary)' }}>
        {parseFloat(rating || 0).toFixed(1)}
      </span>
      {count !== undefined && (
        <span style={{ fontSize: size - 1, color: 'var(--text-muted)' }}>({count})</span>
      )}
    </div>
  );
}

// ─── STAR INPUT ───────────────────────────────────────────────────────────
export function StarInput({ value, onChange }: any) {
  const [hover, setHover] = useState(0);
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {[1, 2, 3, 4, 5].map((i: any) => (
        <button
          key={i}
          onClick={() => onChange(i)}
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(0)}
          style={{
            fontSize: 26, cursor: 'pointer', background: 'none', border: 'none',
            color: i <= (hover || value) ? 'var(--gold)' : 'var(--text-muted)',
            transition: 'all 0.15s',
            transform: i <= (hover || value) ? 'scale(1.2)' : 'scale(1)',
          }}
        >
          ★
        </button>
      ))}
    </div>
  );
}

// ─── MODAL ───────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, maxWidth = 440 }: any) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={typeof title === 'string' ? title : undefined}
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: isMobile ? 'calc(var(--header-height) + 16px) 12px 16px' : 'calc(var(--header-height) + 20px) 20px 20px',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        animation: 'fadeIn 0.2s ease',
      }}
    >
      <div style={{
        background: 'var(--glass-2)',
        WebkitBackdropFilter: 'blur(18px)',
        backdropFilter: 'blur(18px)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        width: '100%',
        maxWidth,
        maxHeight: 'none',
        overflowY: 'visible',
        animation: 'slideUp 0.32s cubic-bezier(0.22,1,0.36,1)',
        boxShadow: 'var(--shadow-lg)',
      }}>
        <div style={{ padding: isMobile ? '16px 16px 0' : '24px 24px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontFamily: 'Roboto, sans-serif', fontWeight: 800, fontSize: 20, color: 'var(--text-primary)' }}>{title}</div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--bg-elevated)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 16, color: 'var(--text-secondary)',
              transition: 'color 0.2s, border-color 0.2s', flexShrink: 0,
            }}
            onMouseEnter={(e: any) => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.borderColor = 'var(--mint-ring)'; }}
            onMouseLeave={(e: any) => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
          >✕</button>
        </div>
        <div style={{ padding: isMobile ? '0 16px 16px' : '0 24px 24px' }}>{children}</div>
      </div>
    </div>
  );
}

// ─── DIVIDER ─────────────────────────────────────────────────────────────
export function Divider() {
  return <div style={{ borderTop: '1px solid var(--border)', margin: '16px 0' }} />;
}

// ─── ALERT ───────────────────────────────────────────────────────────────
export function Alert({ type = 'error', children }: any) {
  const styles = {
    error: { bg: 'rgba(255,79,106,0.12)', border: 'rgba(255,79,106,0.3)', color: '#ff8fa3' },
    success: { bg: 'rgba(0,229,160,0.12)', border: 'rgba(0,229,160,0.3)', color: 'var(--accent)' },
    info: { bg: 'rgba(99,179,237,0.12)', border: 'rgba(99,179,237,0.3)', color: '#63b3ed' },
    warning: { bg: 'rgba(240,165,0,0.12)', border: 'rgba(240,165,0,0.3)', color: '#f0a500' },
  };
  const s = (styles as any)[type];
  return (
    <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13, background: s.bg, border: `1px solid ${s.border}`, color: s.color, marginBottom: 14 }}>
      {children}
    </div>
  );
}

// ─── PAGINATION ───────────────────────────────────────────────────────────
export function Pagination({ page, total, limit, onChange }: any) {
  const totalPages = Math.ceil(total / limit);
  if (totalPages <= 1) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20 }}>
      <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>← Prev</Button>
      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Page {page} of {totalPages}</span>
      <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>Next →</Button>
    </div>
  );
}

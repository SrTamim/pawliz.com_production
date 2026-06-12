export default function EmptyState({ icon = "📭", title, description, action = null }: any) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '300px',
        padding: '40px 20px',
        textAlign: 'center',
        color: 'var(--text-secondary)',
      }}
    >
      <div style={{ fontSize: '60px', marginBottom: '16px' }}>{icon}</div>
      <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-primary)' }}>
        {title}
      </h3>
      {description && (
        <p style={{ fontSize: '14px', marginBottom: action ? '20px' : 0, maxWidth: '400px' }}>
          {description}
        </p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            background: 'var(--accent)',
            color: '#000',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '14px',
            transition: 'opacity 0.2s',
          }}
          onMouseEnter={(e: any) => ((e.target as any).style.opacity = '0.8')}
          onMouseLeave={(e: any) => ((e.target as any).style.opacity = '1')}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

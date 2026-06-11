import { createContext, useContext, useState, useCallback } from 'react';

/**
 * Toast notification context
 * Shows success/error messages at bottom-right, auto-dismiss after 3.5s
 */

const ToastContext = createContext(null);

let _toastId = 0;

/**
 * Toast provider: manage notification queue + render toasts
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const toast = useCallback((msg, type = 'success') => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div style={{ position: 'fixed', bottom: 104, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            padding: '13px 18px',
            background: 'var(--bg-card)',
            border: `1px solid var(--border)`,
            borderLeft: `3px solid ${t.type === 'success' ? 'var(--accent)' : 'var(--danger)'}`,
            borderRadius: 'var(--radius)',
            color: 'var(--text-primary)',
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            maxWidth: 320,
            boxShadow: 'var(--shadow-lg)',
            animation: 'slideInRight 0.3s ease',
          }}>
            {t.type === 'success' ? '✅' : '❌'} {t.msg}
          </div>
        ))}
      </div>
      <style>{`@keyframes slideInRight { from { transform: translateX(80px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>
    </ToastContext.Provider>
  );
}

/**
 * Use toast context
 * @returns {{toast: (msg: string, type?: 'success'|'error') => void}}
 */
export const useToast = () => useContext(ToastContext);

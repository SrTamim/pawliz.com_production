import { useEffect, useState } from 'react';

export default function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 'var(--header-height)',
        left: 0,
        right: 0,
        background: '#ff9800',
        color: 'white',
        padding: '12px',
        textAlign: 'center',
        fontSize: 13,
        fontWeight: 600,
        zIndex: 100,
        animation: 'slideDown 0.3s ease-out',
      }}
    >
      📶 You're offline — Some features may be limited
    </div>
  );
}

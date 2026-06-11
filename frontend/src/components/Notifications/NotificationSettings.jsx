import { useState, useEffect } from 'react';
import { notificationsAPI } from '../../lib/api';
import { useToast } from '../../context/ToastContext';

export default function NotificationSettings({ onClose }) {
  const { toast } = useToast();
  const [prefs, setPrefs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await notificationsAPI.getPreferences();
        setPrefs(data);
      } catch {
        toast('Failed to load settings', 'error');
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await notificationsAPI.updatePreferences(prefs);
      toast('Notification settings updated', 'success');
      onClose?.();
    } catch (err) {
      toast(err.message || 'Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div style={{ padding: 16, color: 'var(--text-muted)' }}>Loading...</div>;
  }

  if (!prefs) {
    return <div style={{ padding: 16, color: 'var(--text-muted)' }}>No settings available</div>;
  }

  return (
    <div style={{ padding: 16 }}>
      <h3 style={{ marginTop: 0, marginBottom: 16, fontSize: 16, fontWeight: 600 }}>
        Notification Settings
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Enable notifications */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={prefs.notifications_enabled}
            onChange={(e) => setPrefs({ ...prefs, notifications_enabled: e.target.checked })}
            style={{ cursor: 'pointer' }}
          />
          <span style={{ fontSize: 13 }}>Enable notifications</span>
        </label>

        {/* Email notifications */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={prefs.notifications_email}
            onChange={(e) => setPrefs({ ...prefs, notifications_email: e.target.checked })}
            style={{ cursor: 'pointer' }}
          />
          <span style={{ fontSize: 13 }}>Send email notifications</span>
        </label>

        {/* Notification types filter */}
        <div style={{ marginTop: 4 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
            Notification types
          </label>
          <select
            value={prefs.notification_types}
            onChange={(e) => setPrefs({ ...prefs, notification_types: e.target.value })}
            style={{
              width: '100%',
              padding: '8px',
              borderRadius: 6,
              border: '1px solid var(--border)',
              background: 'var(--bg-elevated)',
              color: 'var(--text-primary)',
              fontSize: 13,
            }}
          >
            <option value="all">All notifications</option>
            <option value="comments">Comments only</option>
            <option value="system">System only</option>
          </select>
        </div>

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            marginTop: 12,
            padding: '9px 18px',
            borderRadius: 6,
            background: 'var(--accent)',
            color: '#0a0d12',
            border: 'none',
            fontWeight: 600,
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? 'Saving...' : 'Save settings'}
        </button>
      </div>
    </div>
  );
}

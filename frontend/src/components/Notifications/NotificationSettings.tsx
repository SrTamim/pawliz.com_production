import { useState, useEffect } from 'react';
import { notificationsAPI } from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import { requestAndSubscribe, getPermission } from '../../lib/webPush';

export default function NotificationSettings({ onClose }: any) {
  const { toast } = useToast();
  const [prefs, setPrefs] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pushPermission, setPushPermission] = useState<string>('default');
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    setPushPermission(getPermission());
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

  const handleEnableDevicePush = async () => {
    setPushBusy(true);
    try {
      const result = await requestAndSubscribe();
      setPushPermission(result);
      if (result === 'granted') toast('Device notifications enabled', 'success');
      else if (result === 'denied') toast('Notifications are blocked in your browser settings', 'error');
      else if (result === 'unsupported') toast('Your browser does not support push notifications', 'error');
    } catch {
      toast('Could not enable device notifications', 'error');
    } finally {
      setPushBusy(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await notificationsAPI.updatePreferences(prefs);
      toast('Notification settings updated', 'success');
      onClose?.();
    } catch (err: any) {
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
            onChange={(e: any) => setPrefs({ ...prefs, notifications_enabled: e.target.checked })}
            style={{ cursor: 'pointer' }}
          />
          <span style={{ fontSize: 13 }}>Enable notifications</span>
        </label>

        {/* Email notifications */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={prefs.notifications_email}
            onChange={(e: any) => setPrefs({ ...prefs, notifications_email: e.target.checked })}
            style={{ cursor: 'pointer' }}
          />
          <span style={{ fontSize: 13 }}>Send email notifications</span>
        </label>

        {/* SMS vaccine reminders */}
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={prefs.sms_vaccine_reminders}
            onChange={(e: any) => setPrefs({ ...prefs, sms_vaccine_reminders: e.target.checked })}
            style={{ cursor: 'pointer', marginTop: 2 }}
          />
          <span style={{ fontSize: 13 }}>
            SMS me before my pet&apos;s vaccine is due
            <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              Requires a verified phone number on your account.
            </span>
          </span>
        </label>

        {/* Notification types filter */}
        <div style={{ marginTop: 4 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
            Notification types
          </label>
          <select
            value={prefs.notification_types}
            onChange={(e: any) => setPrefs({ ...prefs, notification_types: e.target.value })}
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

        {/* Device push notifications */}
        <div style={{ marginTop: 4, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
            Device notifications
          </label>
          {pushPermission === 'granted' ? (
            <div style={{ fontSize: 13, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>✓</span> Enabled on this device
            </div>
          ) : pushPermission === 'denied' ? (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Blocked in your browser. Enable notifications for this site in your browser settings.
            </div>
          ) : pushPermission === 'unsupported' ? (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Your browser does not support push notifications.
            </div>
          ) : (
            <button
              onClick={handleEnableDevicePush}
              disabled={pushBusy}
              style={{
                padding: '8px 14px',
                borderRadius: 6,
                background: 'var(--bg-elevated)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
                fontSize: 13,
                fontWeight: 600,
                cursor: pushBusy ? 'not-allowed' : 'pointer',
                opacity: pushBusy ? 0.6 : 1,
              }}
            >
              {pushBusy ? 'Enabling…' : 'Enable device notifications'}
            </button>
          )}
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '6px 0 0' }}>
            Get a pop-up with sound on this device — even when Pawliz is closed.
          </p>
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

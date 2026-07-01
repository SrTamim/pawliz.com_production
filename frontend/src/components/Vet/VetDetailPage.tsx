import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Stars, StarInput, Button, Loading, EmptyState, Alert, Pagination, Badge } from '../UI';
import { vetsAPI, reviewsAPI, getImageUrl } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import ShareButton from '../ShareButton';
import { ContactIcon } from './contactIcons';

const DAYS = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

function fmt12(t: any) {
  if (!t) return null;
  const [h, m] = t.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  return `${hour % 12 || 12}:${m} ${ampm}`;
}

const DAY_KEYS = ['saturday', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

// True when at least one day has hours set.
function hasSchedule(ws: any) {
  return !!ws && typeof ws === 'object' && DAY_KEYS.some((k) => ws[k] && ws[k].open);
}

// Per-day schedule list. `closedLabel` localizes the closed text.
function WeeklyScheduleView({ schedule, closedLabel = 'Closed' }: any) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {DAYS.map((d: string) => {
        const day = schedule?.[d.toLowerCase()];
        const isOpen = !!(day && day.open);
        return (
          <div key={d} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13 }}>
            <span style={{ color: 'var(--text-secondary)' }}>{d}</span>
            <span style={{ color: isOpen ? 'var(--text-primary)' : '#ff4f6a', fontWeight: isOpen ? 500 : 600 }}>
              {isOpen ? `${fmt12(day.open)} – ${fmt12(day.close)}` : closedLabel}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function VetDetailPage({ vetId, open, onClose, onAuthRequired, fullPage = false, initialVet = null, onReviewChange }: any) {
  const [vet, setVet] = useState<any>(initialVet);
  const [reviews, setReviews] = useState<any[]>([]);
  const [qualifications, setQualifications] = useState<any[]>([]);
  const [clinicContacts, setClinicContacts] = useState<any[]>([]);
  const [clinicVets, setClinicVets] = useState<any[]>([]);
  const [loading, setLoading] = useState(!initialVet);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reviewPage, setReviewPage] = useState(1);
  const [reviewFilter, setReviewFilter] = useState(0);
  const [logoFailed, setLogoFailed] = useState(false);
  const REVIEWS_PER_PAGE = 5;

  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation("vet");

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!open || !vetId) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    vetsAPI.getById(vetId)
      .then(res => {
        if (cancelled) return;
        setVet(res.vet);
        setLogoFailed(false);
        setReviews(res.reviews || []);
        setQualifications(res.qualifications || []);
        setClinicContacts(res.clinic_contacts || []);
        setClinicVets(res.clinic_vets || []);
      })
      .catch((e: any) => {
        if (cancelled) return;
        // Distinguish a load failure (network/server) from a genuinely missing
        // vet so the user sees a retry affordance instead of an endless spinner.
        setVet(null);
        setLoadError((e as Error)?.message || 'Failed to load profile');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [vetId, open, reloadKey]);

  const submitReview = async () => {
    if (!rating) { toast('Please select a star rating', 'error'); return; }
    if (comment.length > 500) { toast('Review must be 500 characters or less', 'error'); return; }
    setSubmitting(true);
    try {
      await reviewsAPI.add(vetId, rating, comment);
      toast('Review submitted! ⭐');
      setRating(0); setComment('');
      const res = await vetsAPI.getById(vetId);
      setVet(res.vet); setReviews(res.reviews || []);
      // Tell the parent (Home) the rating changed so it can refresh map pins +
      // sidebar, which read the denormalized avg_rating column. Optional: the
      // standalone /vets/[id] page doesn't pass this and has nothing to refresh.
      onReviewChange?.(vetId);
    } catch (e: any) { toast(e.message, 'error'); }
    finally { setSubmitting(false); }
  };

  if (!open && !fullPage) return null;

  // Canonical shareable URL for this vet (dedicated page). Used by the Share button.
  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/vets/${vetId}` : '';

  const filteredReviews = reviewFilter > 0
    ? reviews.filter(r => r.rating === reviewFilter)
    : reviews;
  const pagedReviews = filteredReviews.slice((reviewPage - 1) * REVIEWS_PER_PAGE, reviewPage * REVIEWS_PER_PAGE);

  const coverUrl = getImageUrl(vet?.cover_image);
  const avatarUrl = getImageUrl(vet?.image);
  const hasCover = !!coverUrl;

  // Outer wrapper differs by mode: fixed overlay (modal) vs in-document page.
  // Inline (not a nested component) so children don't remount on each render.
  const wrapperProps = fullPage
    ? {
        style: {
          minHeight: '100vh',
          background: 'var(--bg-primary)',
          paddingTop: 'calc(var(--header-height) + 16px)',
          paddingBottom: 'calc(80px + env(safe-area-inset-bottom) + 16px)',
          paddingLeft: 16,
          paddingRight: 16,
        } as any,
      }
    : {
        onClick: (e: any) => e.target === e.currentTarget && onClose(),
        style: {
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.82)',
          backdropFilter: 'blur(12px)',
          zIndex: 1500,
          overflowY: 'auto',
          animation: 'fadeIn 0.3s ease',
        } as any,
      };

  return (
    <div {...wrapperProps}>
      <div style={{
        maxWidth: 900,
        margin: fullPage ? '0 auto' : '80px auto 60px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 20,
        overflow: 'hidden',
        animation: fullPage ? undefined : 'slideUp 0.4s cubic-bezier(0.34,1.56,0.64,1)',
        boxShadow: 'var(--shadow-lg)',
      }}>
        {loading ? (
          <Loading text={t("detail.loadingProfile")} />
        ) : loadError ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: 32, textAlign: 'center' }}>
            <EmptyState icon="⚠️" title={t("detail.noProfile")} />
            <Button variant="accent" onClick={() => setReloadKey(k => k + 1)}>{t("detail.retry")}</Button>
          </div>
        ) : !vet ? (
          <EmptyState icon="⚠️" title={t("detail.noProfile")} />
        ) : (
          <>
            {/* Hero — cover image or fallback */}
            <div style={{ position: 'relative', background: '#0a0d12' }}>
              {hasCover
                ? <img src={coverUrl} alt={`${vet.name} cover`} style={{ width: '100%', display: 'block', objectFit: 'cover', maxHeight: 280 }} onError={e => (e.target as any).style.display = 'none'} />
                : <div style={{ width: '100%', height: 180, background: 'linear-gradient(135deg, var(--bg-elevated), var(--bg-secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 80 }}>🏥</div>
              }
              {!fullPage && (
                <button
                  onClick={onClose}
                  style={{
                    position: 'absolute', top: 16, left: 16,
                    background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255,255,255,0.1)', color: 'white',
                    width: 38, height: 38, borderRadius: 10,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', fontSize: 16,
                  }}
                >←</button>
              )}
            </div>

            {/* Profile header — below hero */}
            <div style={{ padding: '16px 24px 12px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                {avatarUrl && !logoFailed ? (
                  <img
                    src={avatarUrl}
                    alt={vet.name}
                    style={{
                      width: 80, height: 80, borderRadius: 14,
                      objectFit: 'cover', flexShrink: 0,
                      border: '3px solid var(--border)',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                      background: 'var(--bg-card)',
                    }}
                    onError={() => setLogoFailed(true)}
                  />
                ) : (
                  <div style={{
                    width: 80, height: 80, borderRadius: 14, flexShrink: 0,
                    border: '3px solid var(--border)',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                    background: 'var(--accent-dim)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'Roboto, sans-serif', fontWeight: 800, fontSize: 34,
                    color: 'var(--accent)', textTransform: 'uppercase',
                  }}>{(vet.name || '?').trim().charAt(0)}</div>
                )}
                <div style={{ flex: 1, minWidth: 0, paddingTop: 4 }}>
                  <div style={{ fontFamily: 'Roboto, sans-serif', fontWeight: 800, fontSize: 22, color: 'var(--text-primary)', marginBottom: 3, lineHeight: 1.2 }}>{vet.name}</div>
                  {vet.clinic_reg_number && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 3 }}>Clinic Reg: {vet.clinic_reg_number}</div>
                  )}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 6, marginBottom: 12 }}>
                    <Badge color="gold">★ {parseFloat(vet.avg_rating || 0).toFixed(1)} · {t("detail.reviewsCount", { count: vet.review_count })}</Badge>
                    {((vet.status === 'claimed' || vet.user_id) && vet.approval_status === 'approved')
                      ? <Badge color="accent">✓ Verified</Badge>
                      : vet.approval_status === 'approved'
                        ? <Badge color="info">Verification Pending</Badge>
                        : <Badge color="gray">Unverified</Badge>
                    }
                    <ShareButton
                      url={shareUrl}
                      text={`🏥 ${vet.name} in ${vet.address || 'Bangladesh'}. ★ ${parseFloat(vet.avg_rating || 0).toFixed(1)} rating. Find vets & clinics on Pawliz! #Pawliz #VetBD`}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Body */}
            <div style={{ padding: 28 }}>
              {/* Contact & Location */}
              <Section title={t("detail.contactLocation")}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                  <InfoItem icon="🏠" label={t("detail.addressLabel")} value={vet.address} />
                  {vet.contact && <InfoItem icon="📞" label={t("detail.phoneLabel")} value={vet.contact} />}
                  {vet.email && <InfoItem icon="✉️" label={t("detail.emailLabel")} value={vet.email} />}
                  {vet.website && (
                    <div style={{ display: 'flex', gap: 10, padding: 12, background: 'var(--bg-elevated)', borderRadius: 10 }}>
                      <span style={{ fontSize: 18, flexShrink: 0 }}>🌐</span>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 2 }}>{t("detail.website")}</div>
                        <a href={vet.website} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: 'var(--accent)', wordBreak: 'break-word' }}>{vet.website}</a>
                      </div>
                    </div>
                  )}
                </div>

                {/* Clinic Contacts */}
                {clinicContacts.length > 0 && (
                  <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {clinicContacts.map((c: any) => {
                      // For 'other', only treat the value as a link if it's an
                      // http(s) URL — blocks javascript:/data: hrefs (DOM XSS) from
                      // untrusted contact data.
                      let href = '';
                      let isLink = false;
                      if (c.contact_type === 'whatsapp') {
                        href = `https://wa.me/${c.contact_value.replace(/\D/g, '')}`;
                        isLink = true;
                      } else if (c.contact_type === 'email') {
                        href = `mailto:${c.contact_value}`;
                        isLink = true;
                      } else if (c.contact_type === 'other') {
                        try {
                          const u = new URL(c.contact_value);
                          if (u.protocol === 'http:' || u.protocol === 'https:') {
                            href = c.contact_value;
                            isLink = true;
                          }
                        } catch { /* not a valid absolute URL → render as plain text */ }
                      }
                      return (
                        <div key={c.id} style={{ padding: '6px 14px', background: 'var(--bg-elevated)', borderRadius: 8, fontSize: 13, display: 'flex', gap: 6, alignItems: 'center' }}>
                          <span style={{ display: 'flex', alignItems: 'center' }}><ContactIcon type={c.contact_type} size={16} /></span>
                          {isLink
                            ? <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-primary)', textDecoration: 'none' }}>{c.contact_value}</a>
                            : <span style={{ color: 'var(--text-primary)' }}>{c.contact_value}</span>
                          }
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Social media icon row */}
                {(vet.social_facebook || vet.social_instagram || vet.social_linkedin || vet.social_whatsapp) && (
                  <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                    {vet.social_facebook && (
                      <a href={vet.social_facebook} target="_blank" rel="noopener noreferrer" title="Facebook"
                        style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                      </a>
                    )}
                    {vet.social_instagram && (
                      <a href={vet.social_instagram} target="_blank" rel="noopener noreferrer" title="Instagram"
                        style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="#E4405F"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                      </a>
                    )}
                    {vet.social_linkedin && (
                      <a href={vet.social_linkedin} target="_blank" rel="noopener noreferrer" title="LinkedIn"
                        style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="#0A66C2"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                      </a>
                    )}
                    {vet.social_whatsapp && (
                      <a href={`https://wa.me/${vet.social_whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noopener noreferrer" title="WhatsApp"
                        style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                      </a>
                    )}
                  </div>
                )}
              </Section>

              {/* Clinic Vets */}
              {clinicVets.length > 0 && (
                <Section title={t("detail.ourVets", { count: clinicVets.length })}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
                    {clinicVets.map((cv: any) => {
                      const cvAvatar = getImageUrl(cv.vet_image);
                      return (
                        <div key={cv.id} style={{ padding: 16, background: 'var(--bg-elevated)', borderRadius: 12, border: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                          {cvAvatar
                            ? <img src={cvAvatar} alt={cv.name} style={{ width: 48, height: 48, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} onError={e => (e.target as any).style.display = 'none'} />
                            : <div style={{ width: 48, height: 48, borderRadius: 10, background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>👨‍⚕️</div>
                          }
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>{cv.name}</div>
                            {cv.designation && <div style={{ fontSize: 12, color: 'var(--accent)', marginBottom: 2 }}>{cv.designation}</div>}
                            {cv.bvc_reg_number && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>BVC: {cv.bvc_reg_number}</div>}
                            {cv.bmdc_reg_number && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>BMDC: {cv.bmdc_reg_number}</div>}
                            {Array.isArray(cv.qualifications) && cv.qualifications.length > 0 && (
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                                {cv.qualifications.map((q: any) => q.qualification).join(' · ')}
                              </div>
                            )}
                            {hasSchedule(cv.weekly_schedule) ? (
                              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                                {DAYS.map((d: string) => {
                                  const day = cv.weekly_schedule[d.toLowerCase()];
                                  const isOpen = !!(day && day.open);
                                  return (
                                    <div key={d} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                                      <span>{d.slice(0, 3)}</span>
                                      <span style={{ color: isOpen ? 'var(--text-secondary)' : '#ff4f6a' }}>
                                        {isOpen ? `${fmt12(day.open)} – ${fmt12(day.close)}` : t("detail.closed")}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <>
                                {(cv.checkup_start || cv.checkup_end) && (
                                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                                    🕐 {fmt12(cv.checkup_start)} – {fmt12(cv.checkup_end)}
                                  </div>
                                )}
                                {Array.isArray(cv.weekly_holidays) && cv.weekly_holidays.length > 0 && (
                                  <div style={{ fontSize: 11, color: '#ff4f6a', marginTop: 2 }}>
                                    Off: {cv.weekly_holidays.join(', ')}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Section>
              )}

              {/* Services */}
              {Array.isArray(vet.services) && vet.services.length > 0 && (
                <Section title={t("detail.servicesOffered")}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {vet.services.map((s: any, i: any) => (
                      <span key={i} style={{
                        padding: '6px 14px',
                        background: 'var(--accent-dim)',
                        border: '1px solid var(--border-accent)',
                        borderRadius: 999,
                        fontSize: 12, fontWeight: 500,
                        color: 'var(--accent)',
                      }}>✓ {s}</span>
                    ))}
                  </div>
                </Section>
              )}

              {/* Schedule — prefer per-day weekly_schedule, fall back to legacy single-range + holidays */}
              {hasSchedule(vet.weekly_schedule) ? (
                <Section title={t("detail.schedule")}>
                  <div style={{ padding: 14, background: 'var(--bg-elevated)', borderRadius: 10, maxWidth: 360 }}>
                    <WeeklyScheduleView schedule={vet.weekly_schedule} closedLabel={t("detail.closed")} />
                  </div>
                </Section>
              ) : (vet.checkup_start || vet.checkup_end || (Array.isArray(vet.weekly_holidays) && vet.weekly_holidays.length > 0)) && (
                <Section title={t("detail.schedule")}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                    {(vet.checkup_start || vet.checkup_end) && (
                      <InfoItem
                        icon="🕐"
                        label={t("detail.checkupHours")}
                        value={`${fmt12(vet.checkup_start) || '?'} – ${fmt12(vet.checkup_end) || '?'}`}
                      />
                    )}
                    {Array.isArray(vet.weekly_holidays) && vet.weekly_holidays.length > 0 && (
                      <div style={{ display: 'flex', gap: 10, padding: 12, background: 'var(--bg-elevated)', borderRadius: 10 }}>
                        <span style={{ fontSize: 18, flexShrink: 0 }}>📅</span>
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 6 }}>{t("detail.holidays")}</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {DAYS.map((d: any) => {
                              const isHoliday = vet.weekly_holidays.includes(d);
                              return (
                                <span key={d} style={{
                                  fontSize: 11, padding: '2px 8px', borderRadius: 999,
                                  background: isHoliday ? 'rgba(255,79,106,0.15)' : 'var(--bg-page)',
                                  color: isHoliday ? '#ff4f6a' : 'var(--text-muted)',
                                  fontWeight: isHoliday ? 600 : 400,
                                  border: `1px solid ${isHoliday ? 'rgba(255,79,106,0.3)' : 'var(--border)'}`,
                                }}>
                                  {d.slice(0, 3)}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </Section>
              )}

              {/* About */}
              {vet.description && (
                <Section title={t("detail.about")}>
                  <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, fontSize: 14 }}>{vet.description}</p>
                </Section>
              )}

              {/* Reviews */}
              <Section title={t("detail.reviewsSection", { count: reviews.length })}>
                {reviews.length > 0 && (
                  <div style={{ padding: 20, background: 'var(--bg-elevated)', borderRadius: 12, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontFamily: 'Roboto, sans-serif', fontWeight: 800, fontSize: 48, color: 'var(--gold)', lineHeight: 1 }}>
                        {parseFloat(vet.avg_rating || 0).toFixed(1)}
                      </div>
                      <Stars rating={vet.avg_rating} size={16} />
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{t("detail.reviewsCount", { count: vet.review_count })}</div>
                    </div>
                    <div style={{ flex: 1, minWidth: 160 }}>
                      {[5,4,3,2,1].map((r: any) => {
                        const count = reviews.filter(rv => rv.rating === r).length;
                        const pct = reviews.length ? (count / reviews.length) * 100 : 0;
                        return (
                          <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                            <span style={{ fontSize: 11, color: 'var(--gold)', width: 16 }}>{r}★</span>
                            <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 999, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${pct}%`, background: 'var(--gold)', borderRadius: 999, transition: 'width 0.4s' }} />
                            </div>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 16 }}>{count}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {[0,5,4,3,2,1].map((r: any) => (
                        <button key={r} onClick={() => { setReviewFilter(r); setReviewPage(1); }} style={{
                          padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                          cursor: 'pointer', border: '1px solid',
                          background: reviewFilter === r ? 'rgba(240,165,0,0.15)' : 'transparent',
                          borderColor: reviewFilter === r ? 'rgba(240,165,0,0.4)' : 'var(--border)',
                          color: reviewFilter === r ? 'var(--gold)' : 'var(--text-muted)',
                        }}>{r === 0 ? t("detail.allFilter") : `${r}★`}</button>
                      ))}
                    </div>
                  </div>
                )}

                {user ? (
                  <div style={{ padding: 20, background: 'var(--bg-elevated)', borderRadius: 12, border: '1px dashed var(--border-accent)', marginBottom: 20 }}>
                    <div style={{ fontFamily: 'Roboto, sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 12 }}>{t("detail.writeReview")}</div>
                    <div style={{ marginBottom: 12 }}><StarInput value={rating} onChange={setRating} /></div>
                    <textarea
                      value={comment}
                      onChange={e => setComment(e.target.value.slice(0, 500))}
                      className="input-field"
                      placeholder={t("detail.reviewPlaceholder")}
                      rows={3}
                      maxLength={500}
                      style={{ marginBottom: 4, resize: 'vertical' }}
                    />
                    <div style={{ fontSize: 11, color: comment.length >= 500 ? 'var(--danger)' : 'var(--text-muted)', textAlign: 'right', marginBottom: 10 }}>{comment.length}/500</div>
                    <Button variant="accent" loading={submitting} onClick={submitReview}>{t("detail.submitReview")}</Button>
                  </div>
                ) : (
                  <div
                    onClick={onAuthRequired}
                    style={{ padding: 16, background: 'var(--bg-elevated)', borderRadius: 10, textAlign: 'center', marginBottom: 20, fontSize: 13, color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }}
                  >
                    {t("detail.loginToReview")}
                  </div>
                )}

                {filteredReviews.length === 0 ? (
                  <EmptyState icon="💬" title={t("detail.noReviewsTitle")} subtitle={t("detail.noReviewsHint")} />
                ) : (
                  <>
                    {pagedReviews.map((r: any) => <ReviewCard key={r.id} review={r} />)}
                    <Pagination page={reviewPage} total={filteredReviews.length} limit={REVIEWS_PER_PAGE} onChange={setReviewPage} />
                  </>
                )}
              </Section>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: any) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ fontFamily: 'Roboto, sans-serif', fontWeight: 700, fontSize: 12, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 14, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function InfoItem({ icon, label, value }: any) {
  return (
    <div style={{ display: 'flex', gap: 10, padding: 12, background: 'var(--bg-elevated)', borderRadius: 10 }}>
      <span style={{ fontSize: 18, flexShrink: 0 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500, wordBreak: 'break-word' }}>{value}</div>
      </div>
    </div>
  );
}

function ReviewCard({ review }: any) {
  const { t } = useTranslation("common");
  return (
    <div style={{ padding: 16, background: 'var(--bg-elevated)', borderRadius: 12, border: '1px solid var(--border)', marginBottom: 10, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--accent), #00b87a)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 700, color: '#0a0d12', flexShrink: 0,
          }}>{(review.user_name || 'U').charAt(0).toUpperCase()}</div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{review.user_name || t("words.anonymous")}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {new Date(review.created_at).toLocaleDateString('en-BD', { year: 'numeric', month: 'short', day: 'numeric' })}
            </div>
          </div>
        </div>
        <span style={{ color: 'var(--gold)', fontSize: 14 }}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span>
      </div>
      {review.comment && <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, wordBreak: 'break-word', overflowWrap: 'break-word', whiteSpace: 'pre-wrap', margin: 0 }}>{review.comment}</p>}
    </div>
  );
}

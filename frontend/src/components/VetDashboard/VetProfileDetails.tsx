import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { vetDashboardAPI } from "../../lib/api";
import { useToast } from "../../context/ToastContext";
import PasswordStrengthChecker from "../Auth/PasswordStrengthChecker";
import WeeklyScheduleEditor, { buildScheduleFromLegacy } from "./WeeklyScheduleEditor";

const DAYS = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const DOC_TYPES_CLINIC = [
  { value: "clinic_certificate", label: "Clinic Registration Certificate" },
  { value: "trade_licence", label: "Trade License" },
  { value: "tin_certificate", label: "TIN Certificate" },
];
const CONTACT_TYPES = ["phone", "email", "whatsapp", "other"];

const TIME_OPTIONS = (() => {
  const opts = [{ value: "", label: "— Select time —" }];
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

function Section({ title, children }: any) {
  return (
    <div style={{ background: "var(--bg-card)", borderRadius: 12, padding: "20px 22px", border: "1px solid var(--border)", marginBottom: 20 }}>
      <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 16, fontFamily: "Syne, sans-serif" }}>{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, children }: any) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, type = "text", style = {} }: any) {
  return (
    <input
      type={type}
      value={value || ""}
      onChange={onChange}
      placeholder={placeholder}
      style={{
        width: "100%", padding: "9px 12px", borderRadius: 8, fontSize: 14,
        background: "var(--bg-elevated)", border: "1px solid var(--border)",
        color: "var(--text-primary)", outline: "none", boxSizing: "border-box", ...style,
      }}
    />
  );
}

function ImageUploadBox({ src, label, uploadLabel, onUpload, loading }: any) {
  const ref = useRef<any>();
  return (
    <div
      onClick={() => !loading && ref.current.click()}
      style={{
        position: "relative", borderRadius: 10, overflow: "hidden", cursor: loading ? "wait" : "pointer",
        border: "2px dashed var(--border)", background: "var(--bg-elevated)",
        display: "flex", alignItems: "center", justifyContent: "center",
        width: "100%", height: "100%",
      }}
    >
      {src ? (
        <img src={src} alt={label} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", display: "block" }} />
      ) : (
        <div style={{ textAlign: "center", padding: 20, color: "var(--text-secondary)", fontSize: 13 }}>
          <div style={{ fontSize: 28, marginBottom: 6 }}>📷</div>
          <div>{label}</div>
          <div style={{ fontSize: 11, marginTop: 4, color: "var(--text-secondary)" }}>{uploadLabel}</div>
        </div>
      )}
      {loading && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13 }}>
          {uploadLabel}
        </div>
      )}
      <input ref={ref} type="file" accept="image/*" style={{ display: "none" }} onChange={(e: any) => e.target.files[0] && onUpload(e.target.files[0])} />
    </div>
  );
}

const normalizeTime = (t: any) => (t ? t.slice(0, 5) : "");

const buildProfile = (v: any) => ({
  name: v?.name || "",
  latitude: v?.latitude || "",
  longitude: v?.longitude || "",
  address: v?.address || "",
  email: v?.email || "",
  website: v?.website || "",
  description: v?.description || "",
  clinic_reg_number: v?.clinic_reg_number || "",
  checkup_start: normalizeTime(v?.checkup_start),
  checkup_end: normalizeTime(v?.checkup_end),
  weekly_holidays: v?.weekly_holidays || [],
  weekly_schedule: buildScheduleFromLegacy(v?.weekly_schedule, v?.checkup_start, v?.checkup_end, v?.weekly_holidays),
  account_owner_name: v?.account_owner_name || "",
  contact: v?.contact || "",
  services: (v?.services || []).join(", "),
  social_facebook: v?.social_facebook || "",
  social_instagram: v?.social_instagram || "",
  social_linkedin: v?.social_linkedin || "",
  social_whatsapp: v?.social_whatsapp || "",
});

export default function VetProfileDetails({ vet, qualifications, documents, clinicVets, clinicContacts, owner, onRefresh }: any) {
  const { toast } = useToast();
  const { t } = useTranslation("vet");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  if (!vet) return null;

  const certDeleteLocked = vet.approval_status === 'approved';

  const [profile, setProfile] = useState(() => buildProfile(vet));

  const setP = (key: any, val: any) => setProfile((p: any) => ({ ...p, [key]: val }));

  useEffect(() => {
    setProfile(buildProfile(vet));
  }, [vet]);

  const [saving, setSaving] = useState(false);
  const [imgLoading, setImgLoading] = useState({ cover: false, vet: false });
  const [newContact, setNewContact] = useState({ contact_type: "phone", contact_value: "" });
  const [docType, setDocType] = useState("clinic_certificate");
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [pwForm, setPwForm] = useState({ current_password: "", new_password: "", confirm_password: "" });
  const [savingPw, setSavingPw] = useState(false);
  const [showPasswords, setShowPasswords] = useState({ current: false, new: false, confirm: false });
  const docRef = useRef<any>();
  const mapContainerRef = useRef<any>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const pinIconRef = useRef<any>(null);

  useEffect(() => {
    if (mapInstanceRef.current || !mapContainerRef.current) return;

    import("leaflet").then((L: any) => {
      leafletRef.current = L.default || L;
      const Leaf = leafletRef.current;
      if (!mapContainerRef.current || mapInstanceRef.current) return;

      pinIconRef.current = Leaf.divIcon({
        html: `<svg xmlns="http://www.w3.org/2000/svg" width="25" height="41" viewBox="0 0 25 41"><path d="M12.5 0C5.596 0 0 5.596 0 12.5c0 8.75 12.5 28.5 12.5 28.5S25 21.25 25 12.5C25 5.596 19.404 0 12.5 0z" fill="#2563eb" stroke="white" stroke-width="1.5"/><circle cx="12.5" cy="12.5" r="5" fill="white"/></svg>`,
        className: "",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
      });

      const initLat = parseFloat(profile.latitude) || 23.685;
      const initLng = parseFloat(profile.longitude) || 90.3563;
      const hasCoords = profile.latitude && profile.longitude;

      const map = Leaf.map(mapContainerRef.current, {
        center: [initLat, initLng],
        zoom: hasCoords ? 15 : 7,
        zoomControl: true,
        attributionControl: false,
      });

      Leaf.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", { maxZoom: 19 }).addTo(map);

      if (hasCoords) {
        markerRef.current = Leaf.marker([initLat, initLng], { draggable: true, icon: pinIconRef.current }).addTo(map);
        markerRef.current.on("dragend", () => {
          const pos = markerRef.current.getLatLng();
          setP("latitude", pos.lat.toFixed(6));
          setP("longitude", pos.lng.toFixed(6));
        });
      }

      map.on("click", (e: any) => {
        const { lat, lng } = e.latlng;
        setP("latitude", lat.toFixed(6));
        setP("longitude", lng.toFixed(6));
        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
        } else {
          markerRef.current = Leaf.marker([lat, lng], { draggable: true, icon: pinIconRef.current }).addTo(map);
          markerRef.current.on("dragend", () => {
            const pos = markerRef.current.getLatLng();
            setP("latitude", pos.lat.toFixed(6));
            setP("longitude", pos.lng.toFixed(6));
          });
        }
      });

      mapInstanceRef.current = map;
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
    };
  }, [profile, setP]);

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast("Geolocation not supported", "error");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos: any) => {
        const { latitude, longitude } = pos.coords;
        setP("latitude", latitude.toFixed(6));
        setP("longitude", longitude.toFixed(6));
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([latitude, longitude], 15);
          if (markerRef.current) {
            markerRef.current.setLatLng([latitude, longitude]);
          } else {
            const Leaf = leafletRef.current;
            markerRef.current = Leaf.marker([latitude, longitude], { draggable: true, icon: pinIconRef.current }).addTo(mapInstanceRef.current);
            markerRef.current.on("dragend", () => {
              const p = markerRef.current.getLatLng();
              setP("latitude", p.lat.toFixed(6));
              setP("longitude", p.lng.toFixed(6));
            });
          }
        }
        toast("Location captured");
      },
      () => toast("Could not get location", "error"),
      { enableHighAccuracy: true },
    );
  };

  const [showAddClinicVet, setShowAddClinicVet] = useState(false);
  const [newClinicVet, setNewClinicVet] = useState({ name: "", designation: "", bvc_reg_number: "", bmdc_reg_number: "", checkup_start: "", checkup_end: "", weekly_holidays: [] as any[], weekly_schedule: buildScheduleFromLegacy(null) });
  const [newClinicVetImage, setNewClinicVetImage] = useState<any>(null);
  const [newClinicVetQuals, setNewClinicVetQuals] = useState([{ qualification: "", institute: "" }]);
  const [cvSaving, setCvSaving] = useState(false);

  const toggleHoliday = (day: any) => {
    setProfile((p: any) => ({
      ...p,
      weekly_holidays: p.weekly_holidays.includes(day)
        ? p.weekly_holidays.filter((d: any) => d !== day)
        : [...p.weekly_holidays, day],
    }));
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      const servicesArr = profile.services.split(",").map((s: any) => s.trim()).filter(Boolean);
      const res = await vetDashboardAPI.updateProfile({ ...profile, services: servicesArr });
      setProfile(buildProfile(res.vet));
      toast("Profile updated successfully");
      onRefresh();
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleSavePassword = async (e: any) => {
    e.preventDefault();
    if (!pwForm.current_password || !pwForm.new_password) {
      toast("All password fields are required", "error");
      return;
    }
    if (pwForm.new_password !== pwForm.confirm_password) {
      toast("New passwords do not match", "error");
      return;
    }
    const hasUpper = /[A-Z]/.test(pwForm.new_password);
    const hasLower = /[a-z]/.test(pwForm.new_password);
    const hasNum = /\d/.test(pwForm.new_password);
    const hasSpecial = /[@$!%*?&]/.test(pwForm.new_password);
    if (!hasUpper || !hasLower || !hasNum || !hasSpecial || pwForm.new_password.length < 8) {
      toast("Password must be at least 8 characters with uppercase, lowercase, number, and special character (@$!%*?&)", "error");
      return;
    }
    setSavingPw(true);
    try {
      await vetDashboardAPI.updatePassword({
        current_password: pwForm.current_password,
        new_password: pwForm.new_password,
      });
      toast("Password updated successfully!", "success");
      setShowPasswordForm(false);
      setPwForm({ current_password: "", new_password: "", confirm_password: "" });
    } catch (err: any) {
      toast(err.message || "Failed to update password", "error");
    } finally {
      setSavingPw(false);
    }
  };

  const uploadCover = async (file: any) => {
    setImgLoading((l: any) => ({ ...l, cover: true }));
    try {
      await vetDashboardAPI.uploadCoverImage(file);
      toast("Cover image updated");
      onRefresh();
    } catch (e: any) { toast(e.message, "error"); }
    finally { setImgLoading((l: any) => ({ ...l, cover: false })); }
  };

  const uploadVetImg = async (file: any) => {
    setImgLoading((l: any) => ({ ...l, vet: true }));
    try {
      await vetDashboardAPI.uploadVetImage(file);
      toast("Image updated");
      onRefresh();
    } catch (e: any) { toast(e.message, "error"); }
    finally { setImgLoading((l: any) => ({ ...l, vet: false })); }
  };

  const uploadDoc = async (file: any) => {
    try {
      await vetDashboardAPI.uploadDocument(file, docType);
      toast("Document uploaded");
      onRefresh();
    } catch (e: any) { toast(e.message, "error"); }
  };

  const removeDoc = async (id: any) => {
    try { await vetDashboardAPI.deleteDocument(id); onRefresh(); }
    catch (e: any) { toast(e.message, "error"); }
  };

  const addContact = async () => {
    if (!newContact.contact_value) return;
    try {
      await vetDashboardAPI.addClinicContact(newContact.contact_type, newContact.contact_value);
      setNewContact({ contact_type: "phone", contact_value: "" });
      onRefresh();
    } catch (e: any) { toast(e.message, "error"); }
  };

  const removeContact = async (id: any) => {
    try { await vetDashboardAPI.deleteClinicContact(id); onRefresh(); }
    catch (e: any) { toast(e.message, "error"); }
  };

  const saveClinicVet = async () => {
    if (!newClinicVet.name) return toast("Name is required", "error");
    setCvSaving(true);
    try {
      const res = await vetDashboardAPI.addClinicVet(newClinicVet, newClinicVetImage);
      const cvId = res.clinic_vet.id;
      for (const q of newClinicVetQuals) {
        if (q.qualification) {
          await vetDashboardAPI.addClinicVetQualification(cvId, q.qualification, q.institute);
        }
      }
      toast("Vet added to clinic");
      setShowAddClinicVet(false);
      setNewClinicVet({ name: "", designation: "", bvc_reg_number: "", bmdc_reg_number: "", checkup_start: "", checkup_end: "", weekly_holidays: [] as any[], weekly_schedule: buildScheduleFromLegacy(null) });
      setNewClinicVetImage(null);
      setNewClinicVetQuals([{ qualification: "", institute: "" }]);
      const servicesArr = profile.services.split(",").map((s: any) => s.trim()).filter(Boolean);
      await vetDashboardAPI.updateProfile({ ...profile, services: servicesArr }).catch(() => {});
      onRefresh();
    } catch (e: any) { toast(e.message, "error"); }
    finally { setCvSaving(false); }
  };

  const removeClinicVet = async (id: any) => {
    try { await vetDashboardAPI.deleteClinicVet(id); onRefresh(); }
    catch (e: any) { toast(e.message, "error"); }
  };

  const inputStyle: any = {
    width: "100%", padding: "9px 12px", borderRadius: 8, fontSize: 14,
    background: "var(--bg-elevated)", border: "1px solid var(--border)",
    color: "var(--text-primary)", outline: "none", boxSizing: "border-box",
  };
  const btnPrimary: any = {
    padding: "9px 20px", borderRadius: 8, cursor: "pointer",
    background: "var(--accent)", border: "none", color: "#000",
    fontWeight: 600, fontSize: 14, fontFamily: "DM Sans, sans-serif",
  };
  const btnSecondary: any = {
    padding: "8px 16px", borderRadius: 8, cursor: "pointer",
    background: "var(--bg-elevated)", border: "1px solid var(--border)",
    color: "var(--text-secondary)", fontSize: 13, fontFamily: "DM Sans, sans-serif",
  };
  const btnDanger = {
    padding: "5px 12px", borderRadius: 6, cursor: "pointer",
    background: "transparent", border: "1px solid #ff4f6a",
    color: "#ff4f6a", fontSize: 12, fontFamily: "DM Sans, sans-serif",
  };

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", fontFamily: "Syne, sans-serif", marginBottom: 24 }}>
        {t("profileForm.title")}
      </h2>

      {/* Images — inline, not a numbered section */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 180px", gap: 16, marginBottom: 20, alignItems: "start" }}>
        <div>
          <label style={{ display: "block", fontSize: 13, color: "var(--text-secondary)", marginBottom: 6 }}>{t("profileForm.coverImageLabel")}</label>
          <div style={{ height: 160 }}>
            <ImageUploadBox
              src={vet?.cover_image ? `${process.env.NEXT_PUBLIC_API_URL?.replace("/api", "")}${vet.cover_image}` : null}
              label={t("profileForm.uploadCover")}
              uploadLabel={imgLoading.cover ? t("profileForm.uploading") : t("profileForm.clickToUpload")}
              onUpload={uploadCover}
              loading={imgLoading.cover}
            />
          </div>
        </div>
        <div style={isMobile ? { display: "flex", flexDirection: "column", alignItems: "center" } : {}}>
          <label style={{ display: "block", fontSize: 13, color: "var(--text-secondary)", marginBottom: 6 }}>
            {t("profileForm.clinicLogo")}
          </label>
          <div style={{ height: 160, width: isMobile ? 160 : "100%" }}>
            <ImageUploadBox
              src={vet?.image ? `${process.env.NEXT_PUBLIC_API_URL?.replace("/api", "")}${vet.image}` : null}
              label={t("profileForm.uploadPhoto")}
              uploadLabel={imgLoading.vet ? t("profileForm.uploading") : t("profileForm.clickToUpload")}
              onUpload={uploadVetImg}
              loading={imgLoading.vet}
            />
          </div>
        </div>
      </div>

      {/* 1. Basic Information — Account Owner */}
      <Section title={t("profileForm.accountOwnerSection") || "Basic Information of Account Owner"}>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>
          {t("profileForm.accountOwnerNote") || "This information is from your user account and cannot be edited here."}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14 }}>
          <Field label={t("profileForm.accountOwner")}>
            <input style={{ ...inputStyle, background: "var(--bg-elevated)", color: "var(--text-secondary)" }} value={owner?.name || "—"} readOnly />
          </Field>
          <Field label={t("profileForm.email")}>
            <input style={{ ...inputStyle, background: "var(--bg-elevated)", color: "var(--text-secondary)" }} type="email" value={owner?.email || "—"} readOnly />
          </Field>
          <Field label={t("profileForm.phone") || "Phone No"}>
            <input style={{ ...inputStyle, background: "var(--bg-elevated)", color: "var(--text-secondary)" }} value={owner?.phone || "—"} readOnly />
          </Field>
        </div>
      </Section>

      {/* 2. Basic Information — Clinic */}
      <Section title={t("profileForm.clinicInfoSection") || "Basic Information of Clinic"}>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14 }}>
          <Field label={t("profileForm.clinicName")}>
            <input style={inputStyle} value={profile.name} onChange={(e: any) => setP("name", e.target.value)} placeholder="Clinic name" />
          </Field>
          <Field label={t("profileForm.clinicRegNum")}>
            <input style={inputStyle} value={profile.clinic_reg_number} onChange={(e: any) => setP("clinic_reg_number", e.target.value)} placeholder="Hospital / Clinic registration number" />
          </Field>
        </div>
        <Field label={t("profileForm.description")}>
          <textarea
            style={{ ...inputStyle, minHeight: 80, resize: "vertical" }}
            value={profile.description}
            onChange={(e: any) => setP("description", e.target.value)}
            placeholder="About your clinic..."
          />
        </Field>
        <Field label={t("profileForm.services")}>
          <input style={inputStyle} value={profile.services} onChange={(e: any) => setP("services", e.target.value)} placeholder="e.g. Surgery, Vaccination, Dental" />
        </Field>
        <Field label={t("profileForm.address")}>
          <input style={inputStyle} value={profile.address} onChange={(e: any) => setP("address", e.target.value)} placeholder="Clinic address" />
        </Field>
        <Field label={t("profileForm.pinLocation")}>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 8px 0" }}>
            {t("profileForm.mapHint")}
          </p>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
            <button type="button" style={btnSecondary} onClick={handleUseCurrentLocation}>
              {t("profileForm.useCurrentLocation")}
            </button>
            {profile.latitude && profile.longitude && (
              <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                {profile.latitude}, {profile.longitude}
              </span>
            )}
          </div>
          <div
            ref={mapContainerRef}
            style={{ width: "100%", height: 280, borderRadius: 8, border: "1px solid var(--border)", overflow: "hidden" }}
          />
        </Field>
      </Section>

      {/* 3. Clinic Opening Hours — per-day schedule */}
      <Section title={t("profileForm.weeklySchedule") || t("profileForm.clinicHours")}>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
          {t("profileForm.scheduleHint")}
        </div>
        <WeeklyScheduleEditor
          value={profile.weekly_schedule}
          onChange={(next: any) => setP("weekly_schedule", next)}
          labels={{ open: t("profileForm.open"), closed: t("profileForm.closed") }}
        />
      </Section>

      {/* 4. Clinic Contact Details */}
      <Section title={t("profileForm.clinicContactsSection")}>
        {clinicContacts?.map((c: any) => (
          <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "var(--bg-elevated)", borderRadius: 8, marginBottom: 8 }}>
            <div>
              <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--accent)", marginRight: 8 }}>{c.contact_type}</span>
              <span style={{ fontSize: 14, color: "var(--text-primary)" }}>{c.contact_value}</span>
            </div>
            <button style={btnDanger} onClick={() => removeContact(c.id)}>{t("profileForm.remove")}</button>
          </div>
        ))}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "160px 1fr auto", gap: 10, marginTop: 12 }}>
          <select value={newContact.contact_type} onChange={(e: any) => setNewContact((n: any) => ({ ...n, contact_type: e.target.value }))} style={inputStyle}>
            {CONTACT_TYPES.map((ct: any) => <option key={ct} value={ct}>{ct.charAt(0).toUpperCase() + ct.slice(1)}</option>)}
          </select>
          <input style={inputStyle} value={newContact.contact_value} onChange={(e: any) => setNewContact((n: any) => ({ ...n, contact_value: e.target.value }))} placeholder="Phone / Email / URL" />
          <button style={btnPrimary} onClick={addContact}>{t("profileForm.add")}</button>
        </div>
      </Section>

      {/* 5. Vets at this Clinic */}
      <Section title={t("profileForm.clinicVetsSection")}>
        {clinicVets?.map((cv: any) => (
          <div key={cv.id} style={{ padding: "14px 16px", background: "var(--bg-elevated)", borderRadius: 10, marginBottom: 12, border: "1px solid var(--border)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                {cv.vet_image && (
                  <img src={`${process.env.NEXT_PUBLIC_API_URL?.replace("/api", "")}${cv.vet_image}`} alt={cv.name} style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover" }} />
                )}
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15, color: "var(--text-primary)" }}>{cv.name}</div>
                  {cv.designation && <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{cv.designation}</div>}
                  {cv.bvc_reg_number && <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>BVC: {cv.bvc_reg_number}</div>}
                  {cv.bmdc_reg_number && <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>BMDC: {cv.bmdc_reg_number}</div>}
                  {cv.checkup_start && <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Hours: {cv.checkup_start} – {cv.checkup_end}</div>}
                  {cv.qualifications?.length > 0 && (
                    <div style={{ marginTop: 4 }}>
                      {cv.qualifications.map((q: any) => (
                        <span key={q.id} style={{ fontSize: 11, background: "var(--bg-card)", padding: "2px 8px", borderRadius: 10, marginRight: 4, color: "var(--text-secondary)" }}>
                          {q.qualification}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <button style={btnDanger} onClick={() => removeClinicVet(cv.id)}>{t("profileForm.remove")}</button>
            </div>
          </div>
        ))}

        {!showAddClinicVet ? (
          <button style={{ ...btnSecondary, marginTop: 8 }} onClick={() => setShowAddClinicVet(true)}>
            {t("profileForm.addVetBtn")}
          </button>
        ) : (
          <div style={{ padding: "18px", background: "var(--bg-page)", borderRadius: 10, border: "1px solid var(--border)", marginTop: 12 }}>
            <h4 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 14 }}>{t("profileForm.addVetTitle")}</h4>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: "var(--text-secondary)", display: "block", marginBottom: 5 }}>{t("profileForm.vetNameField")} *</label>
                <input style={inputStyle} value={newClinicVet.name} onChange={(e: any) => setNewClinicVet((n: any) => ({ ...n, name: e.target.value }))} placeholder="Dr. Name" />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "var(--text-secondary)", display: "block", marginBottom: 5 }}>{t("profileForm.vetDesignationField")} *</label>
                <input style={inputStyle} value={newClinicVet.designation} onChange={(e: any) => setNewClinicVet((n: any) => ({ ...n, designation: e.target.value }))} placeholder="Veterinary Surgeon" />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "var(--text-secondary)", display: "block", marginBottom: 5 }}>BVC Registration Number</label>
                <input style={inputStyle} value={newClinicVet.bvc_reg_number} onChange={(e: any) => setNewClinicVet((n: any) => ({ ...n, bvc_reg_number: e.target.value }))} placeholder="BVC reg. number" />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "var(--text-secondary)", display: "block", marginBottom: 5 }}>BMDC Registration Number</label>
                <input style={inputStyle} value={newClinicVet.bmdc_reg_number} onChange={(e: any) => setNewClinicVet((n: any) => ({ ...n, bmdc_reg_number: e.target.value }))} placeholder="BMDC reg. number" />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "var(--text-secondary)", display: "block", marginBottom: 5 }}>{t("profileForm.vetPhotoField")}</label>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {newClinicVetImage && (
                    <img
                      src={URL.createObjectURL(newClinicVetImage)}
                      alt="preview"
                      style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover", border: "2px solid var(--border)", flexShrink: 0 }}
                    />
                  )}
                  <label style={{ cursor: "pointer", fontSize: 13, color: "var(--accent)", padding: "6px 12px", borderRadius: 6, border: "1px solid var(--accent)", background: "transparent" }}>
                    {newClinicVetImage ? t("profileForm.changePhoto") : t("profileForm.choosePhoto")}
                    <input type="file" accept="image/*" onChange={(e: any) => setNewClinicVetImage(e.target.files[0])} style={{ display: "none" }} />
                  </label>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>{t("profileForm.weeklySchedule")}</label>
              <WeeklyScheduleEditor
                value={newClinicVet.weekly_schedule}
                onChange={(next: any) => setNewClinicVet((n: any) => ({ ...n, weekly_schedule: next }))}
                labels={{ open: t("profileForm.open"), closed: t("profileForm.closed") }}
                compact
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>{t("profileForm.qualificationsSection")}</label>
              {newClinicVetQuals.map((q: any, i: any) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr auto", gap: 8, marginBottom: 6 }}>
                  <input style={inputStyle} value={q.qualification} onChange={(e: any) => setNewClinicVetQuals((arr: any) => arr.map((x: any, j: any) => j === i ? { ...x, qualification: e.target.value } : x))} placeholder={t("profileForm.degreeCert")} />
                  <input style={inputStyle} value={q.institute} onChange={(e: any) => setNewClinicVetQuals((arr: any) => arr.map((x: any, j: any) => j === i ? { ...x, institute: e.target.value } : x))} placeholder={t("profileForm.institute")} />
                  <button style={btnDanger} onClick={() => setNewClinicVetQuals((arr: any) => arr.filter((_: any, j: any) => j !== i))}>✕</button>
                </div>
              ))}
              <button style={btnSecondary} onClick={() => setNewClinicVetQuals((arr: any) => [...arr, { qualification: "", institute: "" }])}>
                {t("profileForm.addQualification")}
              </button>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button style={btnPrimary} onClick={saveClinicVet} disabled={cvSaving}>
                {cvSaving ? t("profileForm.saving") : t("profileForm.saveVet")}
              </button>
              <button style={btnSecondary} onClick={() => setShowAddClinicVet(false)}>{t("profileForm.cancel")}</button>
            </div>
          </div>
        )}
      </Section>

      {/* 6. Social Media Links */}
      <Section title={t("profileForm.socialMediaSection")}>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14 }}>
          <Field label={t("profileForm.facebookUrl")}>
            <input style={inputStyle} value={profile.social_facebook} onChange={(e: any) => setP("social_facebook", e.target.value)} placeholder="https://facebook.com/yourpage" />
          </Field>
          <Field label={t("profileForm.instagramUrl")}>
            <input style={inputStyle} value={profile.social_instagram} onChange={(e: any) => setP("social_instagram", e.target.value)} placeholder="https://instagram.com/yourhandle" />
          </Field>
          <Field label={t("profileForm.linkedinUrl")}>
            <input style={inputStyle} value={profile.social_linkedin} onChange={(e: any) => setP("social_linkedin", e.target.value)} placeholder="https://linkedin.com/in/yourprofile" />
          </Field>
          <Field label={t("profileForm.whatsappNum")}>
            <input style={inputStyle} value={profile.social_whatsapp} onChange={(e: any) => setP("social_whatsapp", e.target.value)} placeholder="+880 1XXXXXXXXX" />
          </Field>
          <Field label={t("profileForm.website") || "Website"}>
            <input style={inputStyle} value={profile.website} onChange={(e: any) => setP("website", e.target.value)} placeholder="https://yourclinic.com" />
          </Field>
        </div>
      </Section>

      {/* 7. Clinic Certificates & Licences */}
      <Section title={t("profileForm.certificatesSection")}>
        {documents?.map((d: any) => (
          <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "var(--bg-elevated)", borderRadius: 8, marginBottom: 8 }}>
            <div>
              <div style={{ fontWeight: 500, fontSize: 13, color: "var(--text-primary)" }}>
                {DOC_TYPES_CLINIC.find((t: any) => t.value === d.doc_type)?.label || d.doc_type}
              </div>
              <a
                href={`${process.env.NEXT_PUBLIC_API_URL?.replace("/api", "")}${d.file_path}`}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: 12, color: "var(--accent)", textDecoration: "none" }}
              >
                {d.original_name || "View file"}
              </a>
            </div>
            {!certDeleteLocked && (
              <button style={btnDanger} onClick={() => removeDoc(d.id)}>{t("profileForm.remove")}</button>
            )}
          </div>
        ))}
        <div style={{ display: "flex", gap: 10, marginTop: 12, alignItems: "center" }}>
          <select
            value={docType}
            onChange={(e: any) => setDocType(e.target.value)}
            style={{ ...inputStyle, flex: 1 }}
          >
            {DOC_TYPES_CLINIC.map((t: any) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <button style={btnPrimary} onClick={() => docRef.current.click()}>{t("profileForm.upload")}</button>
          <input ref={docRef} type="file" style={{ display: "none" }} onChange={(e: any) => e.target.files[0] && uploadDoc(e.target.files[0])} />
        </div>
      </Section>

      {/* 8. Account Security */}
      <Section title={t("profileForm.passwordSection") || "Account Security"}>
        {!showPasswordForm ? (
          <button style={btnSecondary} onClick={() => setShowPasswordForm(true)}>
            {t("profileForm.changePassword") || "Change Password"}
          </button>
        ) : (
          <form onSubmit={handleSavePassword}>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14, marginBottom: 12 }}>
              <Field label={t("profile:password.current") || "Current Password"}>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPasswords.current ? "text" : "password"}
                    style={inputStyle}
                    value={pwForm.current_password}
                    onChange={(e: any) => setPwForm((f: any) => ({ ...f, current_password: e.target.value }))}
                    placeholder="••••••••"
                    required
                  />
                  {pwForm.current_password && (
                    <button
                      type="button"
                      onClick={() => setShowPasswords((s: any) => ({ ...s, current: !s.current }))}
                      style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 16, padding: 0, color: "var(--text-secondary)" }}
                    >
                      {showPasswords.current ? "👁️" : "👁️‍🗨️"}
                    </button>
                  )}
                </div>
              </Field>
              <div></div>
              <Field label={t("profile:password.new") || "New Password"}>
                <div style={{ position: "relative", marginBottom: 8 }}>
                  <input
                    type={showPasswords.new ? "text" : "password"}
                    style={inputStyle}
                    value={pwForm.new_password}
                    onChange={(e: any) => setPwForm((f: any) => ({ ...f, new_password: e.target.value }))}
                    required
                  />
                  {pwForm.new_password && (
                    <button
                      type="button"
                      onClick={() => setShowPasswords((s: any) => ({ ...s, new: !s.new }))}
                      style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 16, padding: 0, color: "var(--text-secondary)" }}
                    >
                      {showPasswords.new ? "👁️" : "👁️‍🗨️"}
                    </button>
                  )}
                </div>
                <PasswordStrengthChecker password={pwForm.new_password} t={t} namespace="profile" />
              </Field>
              <Field label={t("profile:password.confirm") || "Confirm Password"}>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPasswords.confirm ? "text" : "password"}
                    style={inputStyle}
                    value={pwForm.confirm_password}
                    onChange={(e: any) => setPwForm((f: any) => ({ ...f, confirm_password: e.target.value }))}
                    placeholder="••••••••"
                    required
                  />
                  {pwForm.confirm_password && (
                    <button
                      type="button"
                      onClick={() => setShowPasswords((s: any) => ({ ...s, confirm: !s.confirm }))}
                      style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 16, padding: 0, color: "var(--text-secondary)" }}
                    >
                      {showPasswords.confirm ? "👁️" : "👁️‍🗨️"}
                    </button>
                  )}
                </div>
                {pwForm.confirm_password && (
                  <span style={{ fontSize: 12, marginTop: 4, display: "block", color: pwForm.new_password === pwForm.confirm_password ? "#00e5a0" : "#ff4f6a" }}>
                    {pwForm.new_password === pwForm.confirm_password ? "✓ Passwords match" : "✗ Passwords do not match"}
                  </span>
                )}
              </Field>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="submit" style={btnPrimary} disabled={savingPw}>
                {savingPw ? "Updating..." : "Update Password"}
              </button>
              <button type="button" style={btnSecondary} onClick={() => setShowPasswordForm(false)}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </Section>

      {/* Save button */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
        <button style={{ ...btnPrimary, padding: "11px 32px", fontSize: 15, opacity: saving ? 0.7 : 1 }} onClick={saveProfile} disabled={saving}>
          {saving ? t("profileForm.saving") : t("profileForm.saveProfile")}
        </button>
      </div>
    </div>
  );
}

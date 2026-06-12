import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { petsAPI } from "../../lib/api";
import { useToast } from "../../context/ToastContext";

export default function LostPetModal({ pet, open, onClose, onMarkedLost }: any) {
  const { t } = useTranslation("pets");
  const { toast } = useToast();
  const [form, setForm] = useState({
    lost_date: new Date().toISOString().split("T")[0],
    lost_location_name: "",
    lost_latitude: "",
    lost_longitude: "",
    additional_details: "",
  });
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const mapRef = useRef<any>(null);
  const leafletMap = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const pinIconRef = useRef<any>(null);

  useEffect(() => {
    if (open) {
      setForm({
        lost_date: new Date().toISOString().split("T")[0],
        lost_location_name: "",
        lost_latitude: "",
        lost_longitude: "",
        additional_details: "",
      });
      // Initialize map with dynamic import for Leaflet
      setTimeout(() => initMap(), 100);
    } else {
      if (leafletMap.current) {
        leafletMap.current.remove();
        leafletMap.current = null;
      }
    }
    return () => {
      if (leafletMap.current) {
        leafletMap.current.remove();
        leafletMap.current = null;
      }
    };
  }, [open]);

  const initMap = async () => {
    if (leafletMap.current || !mapRef.current) return;

    // Dynamically import Leaflet only on client side
    if (!leafletRef.current) {
      leafletRef.current = await import("leaflet");
    }
    const L = leafletRef.current;

    pinIconRef.current = L.divIcon({
      html: `<svg xmlns="http://www.w3.org/2000/svg" width="25" height="41" viewBox="0 0 25 41"><path d="M12.5 0C5.596 0 0 5.596 0 12.5c0 8.75 12.5 28.5 12.5 28.5S25 21.25 25 12.5C25 5.596 19.404 0 12.5 0z" fill="#2563eb" stroke="white" stroke-width="1.5"/><circle cx="12.5" cy="12.5" r="5" fill="white"/></svg>`,
      className: "",
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
    });

    const map = L.map(mapRef.current, {
      center: [23.685, 90.3563],
      zoom: 12,
      zoomControl: true,
      attributionControl: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);

    map.on("click", (e) => {
      const { lat, lng } = e.latlng;
      setForm((f) => ({
        ...f,
        lost_latitude: lat.toFixed(6),
        lost_longitude: lng.toFixed(6),
      }));

      if (markerRef.current) markerRef.current.remove();
      markerRef.current = L.marker([lat, lng], { icon: pinIconRef.current }).addTo(map);
    });

    leafletMap.current = map;
  };

  if (!open || !pet) return null;

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      toast(t("lostModal.gettingLocation"), "error");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const L = leafletRef.current;

        setForm((f) => ({
          ...f,
          lost_latitude: latitude.toFixed(6),
          lost_longitude: longitude.toFixed(6),
        }));

        if (leafletMap.current) {
          leafletMap.current.setView([latitude, longitude], 14);
        }

        if (markerRef.current) markerRef.current.remove();
        if (leafletMap.current && L) {
          markerRef.current = L.marker([latitude, longitude], { icon: pinIconRef.current }).addTo(
            leafletMap.current,
          );
        }

        setLocating(false);
        toast(t("lostModal.locatedAt"));
      },
      () => {
        toast(t("foundModal.locationFailed") || "Could not get location", "error");
        setLocating(false);
      },
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.lost_date) {
      toast(t("lostModal.lostDate"), "error");
      return;
    }
    setSaving(true);
    try {
      await petsAPI.markLost(pet.id, {
        lost_date: form.lost_date,
        lost_location_name: form.lost_location_name || undefined,
        lost_latitude: form.lost_latitude || undefined,
        lost_longitude: form.lost_longitude || undefined,
        additional_details: form.additional_details || undefined,
      });
      toast(t("lostModal.markedSuccess", { name: pet.name }), "success");
      onMarkedLost(pet.id);
      onClose();
    } catch (err) {
      toast(err.message || "Failed to mark as lost", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        zIndex: 2000,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        overflowY: "auto",
        paddingTop: 80,
        paddingBottom: 96,
        paddingLeft: 16,
        paddingRight: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: 28,
          width: "100%",
          maxWidth: 480,
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: "rgba(255,79,106,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
            }}
          >
            🔴
          </div>
          <div>
            <div
              style={{
                fontWeight: 700,
                fontSize: 16,
                color: "var(--text-primary)",
              }}
            >
              {t("lostModal.title", { name: pet.name })}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {t("lostModal.subtitle")}
            </div>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: 14 }}
        >
          <div>
            <label style={labelStyle}>{t("lostModal.lostDate")}</label>
            <input
              type="date"
              className="input-field"
              required
              max={new Date().toISOString().split("T")[0]}
              value={form.lost_date}
              onChange={(e) =>
                setForm((f) => ({ ...f, lost_date: e.target.value }))
              }
            />
          </div>

          <div>
            <label style={labelStyle}>{t("lostModal.lostLocation")}</label>
            <input
              className="input-field"
              placeholder={t("lostModal.locationPlaceholder")}
              value={form.lost_location_name}
              onChange={(e) =>
                setForm((f) => ({ ...f, lost_location_name: e.target.value }))
              }
            />
          </div>

          <div>
            <div style={{ marginBottom: 10 }}>
              <label style={labelStyle}>
                {t("lostModal.mapLabel")}
              </label>
              <p
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  margin: "4px 0 0",
                }}
              >
                {t("lostModal.mapHint")}
              </p>
            </div>
            <div
              ref={mapRef}
              style={{
                width: "100%",
                height: 280,
                borderRadius: 8,
                border: "1px solid var(--border)",
                marginBottom: 10,
              }}
            />
            <button
              type="button"
              onClick={handleGetLocation}
              disabled={locating}
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid var(--border-accent)",
                background: "var(--bg-elevated)",
                color: "var(--accent)",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {locating ? t("lostModal.gettingLocation") : t("lostModal.useGPS")}
            </button>
            {form.lost_latitude && form.lost_longitude && (
              <div
                style={{
                  marginTop: 8,
                  padding: "8px 12px",
                  background: "var(--bg-elevated)",
                  borderRadius: 6,
                  fontSize: 11,
                  color: "var(--text-muted)",
                }}
              >
                {t("lostModal.locatedAt")} {form.lost_latitude}, {form.lost_longitude}
              </div>
            )}
          </div>

          <div>
            <label style={labelStyle}>{t("lostModal.additionalDetails")}</label>
            <textarea
              className="input-field"
              rows={3}
              placeholder={t("lostModal.detailsPlaceholder")}
              value={form.additional_details}
              maxLength={1000}
              onChange={(e) =>
                setForm((f) => ({ ...f, additional_details: e.target.value }))
              }
              style={{ resize: "vertical", minHeight: 80 }}
            />
            <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "right", marginTop: 4 }}>
              {(form.additional_details || "").length}/1000
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: "10px 0",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "transparent",
                color: "var(--text-secondary)",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              {t("lostModal.cancel")}
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                flex: 2,
                padding: "10px 0",
                borderRadius: 8,
                border: "none",
                background: "var(--danger)",
                color: "#fff",
                cursor: saving ? "not-allowed" : "pointer",
                fontWeight: 700,
                fontSize: 14,
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? t("lostModal.saving") : t("lostModal.markLostBtn")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const labelStyle = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "var(--text-muted)",
  marginBottom: 6,
  textTransform: "uppercase",
  letterSpacing: "0.4px",
};

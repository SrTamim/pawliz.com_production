import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { rescueAdoptionAPI } from "../../lib/api";

const PET_TYPES = ["dog", "cat", "other"];
const GENDERS = ["male", "female"];
const URGENCY_LEVELS = ["low", "medium", "high", "critical"];

export default function RescueModal({ open, onClose, onCreated, editPost }) {
  const { t } = useTranslation("lostfound");
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef(null);
  const mapRef = useRef(null);
  const leafletMap = useRef(null);
  const markerRef = useRef(null);
  const leafletRef = useRef(null);
  const pinIconRef = useRef(null);
  const isEdit = !!editPost;

  const parseExistingImages = (raw) => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    try { return JSON.parse(raw) || []; } catch { return []; }
  };

  const buildInitialForm = () => {
    if (editPost) {
      return {
        pet_type: editPost.pet_type || "dog",
        color: editPost.color || "",
        gender: editPost.gender || "",
        breed: editPost.breed || "",
        rescue_location_name: editPost.rescue_location_name || "",
        rescue_latitude: editPost.rescue_latitude || "",
        rescue_longitude: editPost.rescue_longitude || "",
        rescue_date: editPost.rescue_date
          ? String(editPost.rescue_date).split("T")[0]
          : new Date().toISOString().split("T")[0],
        description: editPost.description || "",
        urgency: editPost.urgency || "medium",
        status: editPost.status || "active",
        images: [],
      };
    }
    return {
      pet_type: "dog",
      color: "",
      gender: "",
      breed: "",
      rescue_location_name: "",
      rescue_latitude: "",
      rescue_longitude: "",
      rescue_date: new Date().toISOString().split("T")[0],
      description: "",
      urgency: "medium",
      images: [],
    };
  };

  const [form, setForm] = useState(buildInitialForm);
  const [existingImages, setExistingImages] = useState(() =>
    parseExistingImages(editPost?.images),
  );
  const [imagePreviews, setImagePreviews] = useState([]);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(buildInitialForm());
      setExistingImages(parseExistingImages(editPost?.images));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editPost?.id]);

  useEffect(() => {
    if (open && mapRef.current && !leafletMap.current) {
      setTimeout(() => initMap(), 100);
    }
    return () => {
      if (leafletMap.current && !open) {
        leafletMap.current.remove();
        leafletMap.current = null;
      }
    };
  }, [open]);

  const initMap = async () => {
    if (leafletMap.current || !mapRef.current) return;
    if (!leafletRef.current) leafletRef.current = await import("leaflet");
    const L = leafletRef.current;

    pinIconRef.current = L.divIcon({
      html: `<svg xmlns="http://www.w3.org/2000/svg" width="25" height="41" viewBox="0 0 25 41"><path d="M12.5 0C5.596 0 0 5.596 0 12.5c0 8.75 12.5 28.5 12.5 28.5S25 21.25 25 12.5C25 5.596 19.404 0 12.5 0z" fill="#2563eb" stroke="white" stroke-width="1.5"/><circle cx="12.5" cy="12.5" r="5" fill="white"/></svg>`,
      className: "",
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
    });

    const initLat = form.rescue_latitude ? parseFloat(form.rescue_latitude) : 23.685;
    const initLng = form.rescue_longitude ? parseFloat(form.rescue_longitude) : 90.3563;
    const initZoom = form.rescue_latitude && form.rescue_longitude ? 14 : 12;

    const map = L.map(mapRef.current, {
      center: [initLat, initLng],
      zoom: initZoom,
      zoomControl: true,
      attributionControl: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);

    if (form.rescue_latitude && form.rescue_longitude) {
      markerRef.current = L.marker([initLat, initLng], { icon: pinIconRef.current }).addTo(map);
    }

    map.on("click", (e) => {
      const { lat, lng } = e.latlng;
      setForm((f) => ({ ...f, rescue_latitude: lat.toFixed(6), rescue_longitude: lng.toFixed(6) }));
      if (markerRef.current) markerRef.current.remove();
      markerRef.current = L.marker([lat, lng], { icon: pinIconRef.current }).addTo(map);
    });

    leafletMap.current = map;
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) { toast(t("form.geolocationNotSupported"), "error"); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const L = leafletRef.current;
        setForm((f) => ({
          ...f,
          rescue_latitude: latitude.toFixed(6),
          rescue_longitude: longitude.toFixed(6),
        }));
        if (leafletMap.current) leafletMap.current.setView([latitude, longitude], 14);
        if (markerRef.current) markerRef.current.remove();
        if (leafletMap.current && L) {
          markerRef.current = L.marker([latitude, longitude], { icon: pinIconRef.current }).addTo(leafletMap.current);
        }
        setLocating(false);
        toast(t("form.locationCaptured"), "success");
      },
      () => { toast(t("form.locationFailed"), "error"); setLocating(false); },
    );
  };

  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files);
    if (form.images.length + files.length > 3) { toast(t("form.maxImagesError"), "error"); return; }
    const newImages = [...form.images, ...files].slice(0, 3);
    setForm((f) => ({ ...f, images: newImages }));
    setImagePreviews(newImages.map((file) => URL.createObjectURL(file)));
  };

  const handleRemoveImage = (index) => {
    const newImages = form.images.filter((_, i) => i !== index);
    setForm((f) => ({ ...f, images: newImages }));
    setImagePreviews((prev) => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.pet_type || !form.rescue_date) {
      toast(t("form.petTypeDateRequired"), "error");
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        await rescueAdoptionAPI.updateRescuePost(editPost.id, form);
        toast(t("form.updateSuccess"), "success");
      } else {
        await rescueAdoptionAPI.createRescuePost(form);
        toast(t("form.createSuccess"), "success");
      }
      onCreated();
      handleClose();
    } catch (err) {
      toast(err.message || (isEdit ? t("form.updateFailed") : t("form.createFailed")), "error");
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    imagePreviews.forEach((p) => URL.revokeObjectURL(p));
    setForm(buildInitialForm());
    setImagePreviews([]);
    onClose();
  };

  if (!open) return null;

  return (
    <div
      onClick={handleClose}
      className="fixed inset-0 bg-black/50 z-50 flex items-start md:items-center justify-center overflow-y-auto pb-24 md:pb-24"
      style={{ paddingTop: "calc(var(--header-height) + 16px)", paddingBottom: "calc(var(--bottom-nav-height, 64px) + 16px)" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg w-full max-w-2xl max-h-[85vh] md:max-h-[80vh] overflow-y-auto shadow-xl mx-3 md:mx-0"
      >
        {/* Header */}
        <div className="sticky top-0 bg-[var(--bg-card)] border-b border-[var(--border)] p-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-[var(--text-primary)]">
            {isEdit ? t("rescueModal.titleEdit") : t("rescueModal.titleCreate")}
          </h2>
          <button onClick={handleClose} className="text-2xl text-[var(--text-secondary)] hover:text-[var(--text-primary)]">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Pet Type & Gender */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-2 text-[var(--text-primary)]">{t("rescueModal.petType")}</label>
              <select
                value={form.pet_type}
                onChange={(e) => setForm((f) => ({ ...f, pet_type: e.target.value }))}
                className="input-field w-full"
                style={{ background: "var(--bg-primary)", border: "1px solid var(--border)" }}
              >
                {PET_TYPES.map((type) => (
                  <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2 text-[var(--text-primary)]">{t("rescueModal.gender")}</label>
              <select
                value={form.gender}
                onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}
                className="input-field w-full"
                style={{ background: "var(--bg-primary)", border: "1px solid var(--border)" }}
              >
                <option value="">{t("rescueModal.notSpecified")}</option>
                {GENDERS.map((g) => (
                  <option key={g} value={g}>{g.charAt(0).toUpperCase() + g.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Color & Breed */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-2 text-[var(--text-primary)]">{t("rescueModal.color")}</label>
              <input
                type="text"
                placeholder={t("rescueModal.colorPlaceholder")}
                value={form.color}
                maxLength={100}
                onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                className="input-field w-full"
                style={{ background: "var(--bg-primary)", border: "1px solid var(--border)" }}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2 text-[var(--text-primary)]">{t("rescueModal.breed")}</label>
              <input
                type="text"
                placeholder={t("rescueModal.breedPlaceholder")}
                value={form.breed}
                maxLength={100}
                onChange={(e) => setForm((f) => ({ ...f, breed: e.target.value }))}
                className="input-field w-full"
                style={{ background: "var(--bg-primary)", border: "1px solid var(--border)" }}
              />
            </div>
          </div>

          {/* Urgency */}
          <div>
            <label className="block text-sm font-semibold mb-2 text-[var(--text-primary)]">{t("rescueModal.urgency")}</label>
            <select
              value={form.urgency}
              onChange={(e) => setForm((f) => ({ ...f, urgency: e.target.value }))}
              className="input-field w-full"
              style={{ background: "var(--bg-primary)", border: "1px solid var(--border)" }}
            >
              {URGENCY_LEVELS.map((u) => (
                <option key={u} value={u}>{t(`rescueModal.urgency${u.charAt(0).toUpperCase() + u.slice(1)}`)}</option>
              ))}
            </select>
          </div>

          {/* Rescue Date */}
          <div>
            <label className="block text-sm font-semibold mb-2 text-[var(--text-primary)]">{t("rescueModal.dateSpotted")}</label>
            <input
              type="date"
              value={form.rescue_date}
              onChange={(e) => setForm((f) => ({ ...f, rescue_date: e.target.value }))}
              max={new Date().toISOString().split("T")[0]}
              className="input-field w-full"
              style={{ background: "var(--bg-primary)", border: "1px solid var(--border)" }}
              required
            />
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-semibold mb-2 text-[var(--text-primary)]">{t("rescueModal.locationName")}</label>
            <input
              type="text"
              placeholder={t("rescueModal.locationPlaceholder")}
              value={form.rescue_location_name}
              maxLength={200}
              onChange={(e) => setForm((f) => ({ ...f, rescue_location_name: e.target.value }))}
              className="input-field w-full"
              style={{ background: "var(--bg-primary)", border: "1px solid var(--border)" }}
            />
          </div>

          {/* Map */}
          <div>
            <label className="block text-sm font-semibold mb-2 text-[var(--text-primary)]">
              {t("rescueModal.mapLabel")}
            </label>
            <div
              ref={mapRef}
              style={{ width: "100%", height: "300px", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}
            />
            <button
              type="button"
              onClick={handleGetLocation}
              disabled={locating}
              className="mt-2 px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-sm font-semibold hover:bg-[var(--bg-primary)] disabled:opacity-50 transition-all"
            >
              {locating ? t("rescueModal.gettingLocation") : t("rescueModal.useMyLocation")}
            </button>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold mb-2 text-[var(--text-primary)]">{t("rescueModal.description")}</label>
            <textarea
              placeholder={t("rescueModal.descPlaceholder")}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              maxLength={1000}
              className="input-field w-full resize-none"
              rows={4}
              style={{ background: "var(--bg-primary)", border: "1px solid var(--border)" }}
            />
            <p className="text-xs text-[var(--text-secondary)] mt-1">{form.description.length}/1000</p>
          </div>

          {/* Status (edit only) */}
          {isEdit && (
            <div>
              <label className="block text-sm font-semibold mb-2 text-[var(--text-primary)]">{t("rescueModal.status")}</label>
              <select
                value={form.status || "active"}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                className="input-field w-full"
                style={{ background: "var(--bg-primary)", border: "1px solid var(--border)" }}
              >
                <option value="active">{t("rescueModal.statusActive")}</option>
                <option value="rescued">{t("rescueModal.statusRescued")}</option>
                <option value="resolved">{t("rescueModal.statusResolved")}</option>
              </select>
            </div>
          )}

          {/* Existing Images (edit only) */}
          {isEdit && existingImages.length > 0 && (
            <div>
              <label className="block text-sm font-semibold mb-2 text-[var(--text-primary)]">{t("rescueModal.existingImages")}</label>
              <div className="grid grid-cols-3 gap-2">
                {existingImages.map((img, idx) => (
                  <img
                    key={idx}
                    src={img.startsWith("http") ? img : `${process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") || "http://localhost:5000"}${img}`}
                    alt={`Existing ${idx + 1}`}
                    className="w-full h-20 object-cover rounded-lg border border-[var(--border)]"
                    onError={(e) => { e.target.style.opacity = 0.3; }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Image Upload */}
          <div>
            <label className="block text-sm font-semibold mb-2 text-[var(--text-primary)]">
              {isEdit ? t("rescueModal.addMoreImages") : t("rescueModal.uploadImages")}
            </label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 dashed border-[var(--border)] rounded-lg p-6 text-center cursor-pointer hover:bg-[var(--bg-secondary)] transition-all"
            >
              <input type="file" ref={fileInputRef} multiple accept="image/*" onChange={handleImageSelect} style={{ display: "none" }} />
              <div className="text-3xl mb-2">📸</div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">{t("rescueModal.clickToUpload")}</p>
              <p className="text-xs text-[var(--text-secondary)]">{t("rescueModal.imagesSelected", { count: form.images.length })}</p>
            </div>

            {imagePreviews.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-4">
                {imagePreviews.map((preview, index) => (
                  <div key={index} className="relative">
                    <img src={preview} alt={`Preview ${index}`} className="w-full h-20 object-cover rounded-lg border border-[var(--border)]" />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(index)}
                      className="absolute top-1 right-1 w-6 h-6 bg-[var(--danger)] text-white rounded-full flex items-center justify-center text-xs hover:opacity-90"
                    >✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg font-semibold hover:bg-[var(--bg-primary)] transition-all"
            >
              {t("rescueModal.cancel")}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-[var(--accent)] text-white rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 transition-all"
            >
              {saving
                ? isEdit ? t("rescueModal.saving") : t("rescueModal.submitting")
                : isEdit ? t("rescueModal.saveChanges") : t("rescueModal.submitRescueBtn")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

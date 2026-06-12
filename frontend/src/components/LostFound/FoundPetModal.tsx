import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { lostFoundAPI } from "../../lib/api";

const PET_TYPES = ["dog", "cat", "other"];
const GENDERS = ["male", "female"];

export default function FoundPetModal({ open, onClose, onCreated, editPost }: any) {
  const { t } = useTranslation("lostfound");
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<any>(null);
  const mapRef = useRef<any>(null);
  const leafletMap = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const pinIconRef = useRef<any>(null);
  const isEdit = !!editPost;

  const parseExistingImages = (raw: any) => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    try {
      return JSON.parse(raw) || [];
    } catch {
      return [];
    }
  };

  const buildInitialForm = () => {
    if (editPost) {
      return {
        pet_type: editPost.pet_type || "dog",
        color: editPost.color || "",
        gender: editPost.gender || "",
        breed: editPost.breed || "",
        found_location_name: editPost.found_location_name || "",
        found_latitude: editPost.found_latitude || "",
        found_longitude: editPost.found_longitude || "",
        found_date: editPost.found_date
          ? String(editPost.found_date).split("T")[0]
          : new Date().toISOString().split("T")[0],
        description: editPost.description || "",
        status: editPost.status || "found",
        images: [],
      };
    }
    return {
      pet_type: "dog",
      color: "",
      gender: "",
      breed: "",
      found_location_name: "",
      found_latitude: "",
      found_longitude: "",
      found_date: new Date().toISOString().split("T")[0],
      description: "",
      images: [],
    };
  };

  const [form, setForm] = useState(buildInitialForm);
  const [existingImages, setExistingImages] = useState(() =>
    parseExistingImages(editPost?.images),
  );

  useEffect(() => {
    if (open) {
      setForm(buildInitialForm());
      setExistingImages(parseExistingImages(editPost?.images));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editPost?.id]);

  const [imagePreviews, setImagePreviews] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);

  // Initialize map
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

    const initLat = form.found_latitude ? parseFloat(form.found_latitude) : 23.685;
    const initLng = form.found_longitude ? parseFloat(form.found_longitude) : 90.3563;
    const initZoom = form.found_latitude && form.found_longitude ? 14 : 12;

    const map = L.map(mapRef.current, {
      center: [initLat, initLng],
      zoom: initZoom,
      zoomControl: true,
      attributionControl: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);

    if (form.found_latitude && form.found_longitude) {
      markerRef.current = L.marker([initLat, initLng], { icon: pinIconRef.current }).addTo(map);
    }

    map.on("click", (e: any) => {
      const { lat, lng } = e.latlng;
      setForm((f: any) => ({
        ...f,
        found_latitude: lat.toFixed(6),
        found_longitude: lng.toFixed(6),
      }));

      if (markerRef.current) markerRef.current.remove();
      markerRef.current = L.marker([lat, lng], { icon: pinIconRef.current }).addTo(map);
    });

    leafletMap.current = map;
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      toast(t("form.geolocationNotSupported") || "Geolocation not supported", "error");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos: any) => {
        const { latitude, longitude } = pos.coords;
        const L = leafletRef.current;

        setForm((f: any) => ({
          ...f,
          found_latitude: latitude.toFixed(6),
          found_longitude: longitude.toFixed(6),
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
        toast(t("form.locationCaptured"), "success");
      },
      () => {
        toast(t("form.locationFailed"), "error");
        setLocating(false);
      },
    );
  };

  const handleImageSelect = (e: any) => {
    const files = Array.from(e.target.files);
    if (form.images.length + files.length > 3) {
      toast(t("form.maxImagesError"), "error");
      return;
    }

    const newImages = [...form.images, ...files].slice(0, 3);
    setForm((f: any) => ({ ...f, images: newImages }));

    // Create previews
    const previews = newImages.map((file: any) => URL.createObjectURL(file));
    setImagePreviews(previews);
  };

  const handleRemoveImage = (index: any) => {
    const newImages = form.images.filter((_: any, i: any) => i !== index);
    setForm((f: any) => ({ ...f, images: newImages }));

    setImagePreviews((prev: any) => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_: any, i: any) => i !== index);
    });
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();

    if (!form.pet_type || !form.found_date) {
      toast(t("form.petTypeDateRequired"), "error");
      return;
    }

    setSaving(true);
    try {
      const submitForm = { ...form };
      if (isEdit) {
        await lostFoundAPI.updateFoundPet(editPost.id, submitForm);
        toast(t("form.updateSuccess"), "success");
      } else {
        await lostFoundAPI.createFoundPet(submitForm);
        toast(t("form.createSuccess"), "success");
      }
      onCreated();
      handleClose();
    } catch (err: any) {
      toast(
        err.message || (isEdit ? t("form.updateFailed") : t("form.createFailed")),
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    // Cleanup previews
    imagePreviews.forEach((preview: any) => URL.revokeObjectURL(preview));

    setForm({
      pet_type: "dog",
      color: "",
      gender: "",
      breed: "",
      found_location_name: "",
      found_latitude: "",
      found_longitude: "",
      found_date: new Date().toISOString().split("T")[0],
      description: "",
      images: [],
    });
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
        onClick={(e: any) => e.stopPropagation()}
        className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg w-full max-w-2xl max-h-[85vh] md:max-h-[80vh] overflow-y-auto shadow-xl mx-3 md:mx-0"
      >
        {/* Header */}
        <div className="sticky top-0 bg-[var(--bg-card)] border-b border-[var(--border)] p-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-[var(--text-primary)]">
            {isEdit ? t("foundModal.titleEdit") : t("foundModal.titleCreate")}
          </h2>
          <button
            onClick={handleClose}
            className="text-2xl text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Pet Type & Gender */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-2 text-[var(--text-primary)]">
                {t("foundModal.petType")}
              </label>
              <select
                value={form.pet_type}
                onChange={(e: any) =>
                  setForm((f: any) => ({ ...f, pet_type: e.target.value }))
                }
                className="input-field w-full"
                style={{
                  background: "var(--bg-primary)",
                  border: "1px solid var(--border)",
                }}
              >
                {PET_TYPES.map((type: any) => (
                  <option key={type} value={type}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2 text-[var(--text-primary)]">
                {t("foundModal.gender")}
              </label>
              <select
                value={form.gender}
                onChange={(e: any) =>
                  setForm((f: any) => ({ ...f, gender: e.target.value }))
                }
                className="input-field w-full"
                style={{
                  background: "var(--bg-primary)",
                  border: "1px solid var(--border)",
                }}
              >
                <option value="">{t("foundModal.notSpecified")}</option>
                {GENDERS.map((gender: any) => (
                  <option key={gender} value={gender}>
                    {gender.charAt(0).toUpperCase() + gender.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Color & Breed */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-2 text-[var(--text-primary)]">
                {t("foundModal.color")}
              </label>
              <input
                type="text"
                placeholder={t("foundModal.colorPlaceholder")}
                value={form.color}
                maxLength={100}
                onChange={(e: any) =>
                  setForm((f: any) => ({ ...f, color: e.target.value }))
                }
                className="input-field w-full"
                style={{
                  background: "var(--bg-primary)",
                  border: "1px solid var(--border)",
                }}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2 text-[var(--text-primary)]">
                {t("foundModal.breed")}
              </label>
              <input
                type="text"
                placeholder={t("foundModal.breedPlaceholder")}
                value={form.breed}
                maxLength={100}
                onChange={(e: any) =>
                  setForm((f: any) => ({ ...f, breed: e.target.value }))
                }
                className="input-field w-full"
                style={{
                  background: "var(--bg-primary)",
                  border: "1px solid var(--border)",
                }}
              />
            </div>
          </div>

          {/* Found Date */}
          <div>
            <label className="block text-sm font-semibold mb-2 text-[var(--text-primary)]">
              {t("foundModal.foundDate")}
            </label>
            <input
              type="date"
              value={form.found_date}
              onChange={(e: any) =>
                setForm((f: any) => ({ ...f, found_date: e.target.value }))
              }
              max={new Date().toISOString().split("T")[0]}
              className="input-field w-full"
              style={{
                background: "var(--bg-primary)",
                border: "1px solid var(--border)",
              }}
              required
            />
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-semibold mb-2 text-[var(--text-primary)]">
              {t("foundModal.locationName")}
            </label>
            <input
              type="text"
              placeholder={t("foundModal.locationPlaceholder")}
              value={form.found_location_name}
              maxLength={200}
              onChange={(e: any) =>
                setForm((f: any) => ({ ...f, found_location_name: e.target.value }))
              }
              className="input-field w-full"
              style={{
                background: "var(--bg-primary)",
                border: "1px solid var(--border)",
              }}
            />
          </div>

          {/* Map */}
          <div>
            <label className="block text-sm font-semibold mb-2 text-[var(--text-primary)]">
              {t("foundModal.mapLabel")}
            </label>
            <div
              ref={mapRef}
              style={{
                width: "100%",
                height: "300px",
                borderRadius: "var(--radius)",
                border: "1px solid var(--border)",
              }}
            />
            <button
              type="button"
              onClick={handleGetLocation}
              disabled={locating}
              className="mt-2 px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-sm font-semibold hover:bg-[var(--bg-primary)] disabled:opacity-50 transition-all"
            >
              {locating ? t("foundModal.gettingLocation") : t("foundModal.useMyLocation")}
            </button>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold mb-2 text-[var(--text-primary)]">
              {t("foundModal.description")}
            </label>
            <textarea
              placeholder={t("foundModal.descPlaceholder")}
              value={form.description}
              onChange={(e: any) =>
                setForm((f: any) => ({ ...f, description: e.target.value }))
              }
              maxLength={1000}
              className="input-field w-full resize-none"
              rows={4}
              style={{
                background: "var(--bg-primary)",
                border: "1px solid var(--border)",
              }}
            />
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              {form.description.length}/1000
            </p>
          </div>

          {/* Status (edit only) */}
          {isEdit && (
            <div>
              <label className="block text-sm font-semibold mb-2 text-[var(--text-primary)]">
                {t("foundModal.status")}
              </label>
              <select
                value={form.status || "found"}
                onChange={(e: any) =>
                  setForm((f: any) => ({ ...f, status: e.target.value }))
                }
                className="input-field w-full"
                style={{
                  background: "var(--bg-primary)",
                  border: "1px solid var(--border)",
                }}
              >
                <option value="found">{t("foundModal.statusFound")}</option>
                <option value="resolved">{t("foundModal.statusResolved")}</option>
              </select>
            </div>
          )}

          {/* Existing Images (edit only) */}
          {isEdit && existingImages.length > 0 && (
            <div>
              <label className="block text-sm font-semibold mb-2 text-[var(--text-primary)]">
                {t("foundModal.existingImages")}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {existingImages.map((img: any, idx: any) => (
                  <div key={idx} className="relative">
                    <img
                      src={
                        img.startsWith("http")
                          ? img
                          : `${process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") || "http://localhost:5000"}${img}`
                      }
                      alt={`Existing ${idx + 1}`}
                      className="w-full h-20 object-cover rounded-lg border border-[var(--border)]"
                      onError={(e: any) => {
                        (e.target as any).style.opacity = 0.3;
                      }}
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                {t("foundModal.existingImagesNote")}
              </p>
            </div>
          )}

          {/* Image Upload */}
          <div>
            <label className="block text-sm font-semibold mb-2 text-[var(--text-primary)]">
              {isEdit ? t("foundModal.addMoreImages") : t("foundModal.uploadImages")}
            </label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 dashed border-[var(--border)] rounded-lg p-6 text-center cursor-pointer hover:bg-[var(--bg-secondary)] transition-all"
            >
              <input
                type="file"
                ref={fileInputRef}
                multiple
                accept="image/*"
                onChange={handleImageSelect}
                style={{ display: "none" }}
              />
              <div className="text-3xl mb-2">📸</div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                {t("foundModal.clickToUpload")}
              </p>
              <p className="text-xs text-[var(--text-secondary)]">
                {t("foundModal.imagesSelected", { count: form.images.length })}
              </p>
            </div>

            {/* Image Previews */}
            {imagePreviews.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-4">
                {imagePreviews.map((preview: any, index: any) => (
                  <div key={index} className="relative">
                    <img
                      src={preview}
                      alt={`Preview ${index}`}
                      className="w-full h-20 object-cover rounded-lg border border-[var(--border)]"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(index)}
                      className="absolute top-1 right-1 w-6 h-6 bg-[var(--danger)] text-white rounded-full flex items-center justify-center text-xs hover:opacity-90"
                    >
                      ✕
                    </button>
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
              {t("foundModal.cancel")}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-[var(--accent)] text-white rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 transition-all"
            >
              {saving
                ? isEdit ? t("foundModal.saving") : t("foundModal.submitting")
                : isEdit ? t("foundModal.saveChanges") : t("foundModal.reportFoundBtn")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

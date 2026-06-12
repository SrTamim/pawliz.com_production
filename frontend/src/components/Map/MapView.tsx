import { useEffect, useRef } from "react";

// Escape user-controlled values before interpolating into popup HTML strings (XSS guard)
const esc = (s: any) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c: any): string =>
      (({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }) as any)[
        c
      ],
  );
import L from "leaflet";
// markercluster patches global L — must come AFTER `import L from "leaflet"`
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

// OpenStreetMap tiles for all modes
const DARK_TILE = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const LIGHT_TILE = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const BANGLADESH_CENTER: [number, number] = [23.685, 90.3563];

export default function MapView({
  vets,
  theme,
  selectedVetId,
  onVetClick,
  onMapReady,
  userLocation,
  isMobile,
}: any) {
  const mapRef = useRef<any>(null);
  const leafletMap = useRef<any>(null);
  const tileLayer = useRef<any>(null);
  const clusterGroup = useRef<any>(null);
  const markers = useRef<any>({});
  const userMarker = useRef<any>(null);
  const onVetClickRef = useRef(onVetClick);
  const vetsRef = useRef(vets);

  useEffect(() => {
    onVetClickRef.current = onVetClick;
  }, [onVetClick]);
  useEffect(() => {
    vetsRef.current = vets;
  }, [vets]);

  // Init map
  useEffect(() => {
    if (leafletMap.current) return;

    let cancelled = false;
    function tryInitMap() {
      if (cancelled) return;
      if (
        !mapRef.current ||
        mapRef.current.offsetWidth === 0 ||
        mapRef.current.offsetHeight === 0
      ) {
        requestAnimationFrame(tryInitMap);
        return;
      }

      if (!mapRef.current) return;
      if (mapRef.current._leaflet_id) {
        try {
          delete mapRef.current._leaflet_id;
        } catch (e: any) {}
      }
      const map = L.map(mapRef.current, {
        center: BANGLADESH_CENTER,
        zoom: 11,
        zoomControl: false,
        attributionControl: false,
      });

      tileLayer.current = L.tileLayer(
        theme === "dark" ? DARK_TILE : LIGHT_TILE,
        { maxZoom: 19 },
      ).addTo(map);

      leafletMap.current = map;

      clusterGroup.current = L.markerClusterGroup({
        chunkedLoading: true, // async marker add — no freeze on big sets
        removeOutsideVisibleBounds: true, // cull off-screen markers — core perf win
        animate: false, // no spread/zoom animation — pins SNAP in on zoom (fast feel)
        maxClusterRadius: 60,
        disableClusteringAtZoom: 13, // real pins appear early on zoom-in, not held as clusters
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        // Custom branded cluster icon — explicit size + count so it can't look broken.
        iconCreateFunction: (cluster) => {
          const count = cluster.getChildCount();
          const size = count < 10 ? 36 : count < 100 ? 44 : 52; // scale with density
          return L.divIcon({
            html: `<div class="pawliz-cluster"><span>${count}</span></div>`,
            className: "pawliz-cluster-wrap", // empty wrapper — no default leaflet styling
            iconSize: L.point(size, size),
            // Teardrop tip is the bottom-left corner after rotate(-45deg) — anchor
            // there so the point sits on the location (matches .custom-marker-pin).
            iconAnchor: [size / 2, size],
          });
        },
      });
      leafletMap.current.addLayer(clusterGroup.current);

      if (onMapReady) onMapReady(map);
    }
    tryInitMap();

    return () => {
      cancelled = true;
      if (leafletMap.current) {
        try {
          leafletMap.current.stop();
        } catch (e: any) {}
        try {
          leafletMap.current.remove();
        } catch (e: any) {}
        leafletMap.current = null;
      }
      clusterGroup.current = null; // map.remove() already detaches its layers
    };
  }, []);

  // Update tile on theme change
  useEffect(() => {
    if (!tileLayer.current) return;
    tileLayer.current.setUrl(theme === "dark" ? DARK_TILE : LIGHT_TILE);
  }, [theme]);

  // Render markers + fit bounds — only when vet list changes
  useEffect(() => {
    if (!leafletMap.current || !clusterGroup.current) return;

    clusterGroup.current.clearLayers();
    markers.current = {};

    vets.forEach((vet: any) => {
      if (vet.latitude == null || vet.longitude == null) return;
      const icon = L.divIcon({
        html: `<div class="custom-marker-pin"><div class="custom-marker-inner">🐾</div></div>`,
        className: "",
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -36],
      });

      const marker = L.marker([vet.latitude, vet.longitude], { icon });
      const popup = L.popup({ maxWidth: 280 }).setContent(buildPopup(vet));
      marker.bindPopup(popup);
      // pin click — select vet, do NOT open detail panel
      marker.on(
        "click",
        () => onVetClickRef.current && onVetClickRef.current(vet, false),
      );
      clusterGroup.current.addLayer(marker);
      markers.current[vet.id] = marker;
    });

    const validVets = vets.filter(
      (v: any) => v.latitude != null && v.longitude != null,
    );
    if (validVets.length > 1) {
      const bounds = L.latLngBounds(
        validVets.map((v: any) => [v.latitude, v.longitude]),
      );
      leafletMap.current.fitBounds(bounds, {
        paddingTopLeft: [20, 80],
        paddingBottomRight: [20, 20],
        maxZoom: 16,
        duration: 1,
      });
    } else if (validVets.length === 1) {
      leafletMap.current.flyTo(
        [validVets[0].latitude, validVets[0].longitude],
        14,
        { duration: 1 },
      );
    }
  }, [vets]);

  // Swap selected marker icon — no map movement
  useEffect(() => {
    Object.entries(markers.current).forEach(([id, marker]: [string, any]) => {
      const isSelected = String(id) === String(selectedVetId);
      marker.setIcon(
        L.divIcon({
          html: `<div class="custom-marker-pin ${isSelected ? "selected" : ""}"><div class="custom-marker-inner">🐾</div></div>`,
          className: "",
          iconSize: [32, 32],
          iconAnchor: [16, 32],
          popupAnchor: [0, -36],
        }),
      );
    });
  }, [selectedVetId]);

  // Pan/fly to selected vet
  useEffect(() => {
    if (!leafletMap.current || !selectedVetId) return;
    const vet = vets.find((v: any) => v.id === selectedVetId);
    if (!vet || vet.latitude == null || vet.longitude == null) return;

    const map = leafletMap.current;

    // On mobile, shift the centered pin downward so its popup (anchored above
    // the marker) opens clear of the top search/nearby bar instead of overlapping it.
    const isMobile =
      typeof window !== "undefined" && window.innerWidth < 768;
    const offsetCenter = (lat: any, lng: any, zoom: any) => {
      if (!isMobile) return [lat, lng];
      try {
        const pt = map.project([lat, lng], zoom);
        pt.y -= map.getSize().y * 0.22;
        const ll = map.unproject(pt, zoom);
        return [ll.lat, ll.lng];
      } catch (e: any) {
        return [lat, lng];
      }
    };

    const m = markers.current[selectedVetId];
    if (!m || !clusterGroup.current) return;

    // Re-center (with mobile offset) then open the popup. Runs once the marker
    // is guaranteed on-map (un-clustered/spiderfied) by zoomToShowLayer below.
    const openAfterMove = () => {
      if (!leafletMap.current) return;
      try {
        const z = map.getZoom();
        map.panTo(offsetCenter(vet.latitude, vet.longitude, z), {
          animate: true,
          duration: 0.4,
          easeLinearity: 0.5,
        });
      } catch (e: any) {}
      try {
        m.openPopup();
      } catch (e: any) {}
    };

    // zoomToShowLayer un-clusters/spiderfies the marker, THEN runs the callback —
    // openPopup() on a marker hidden inside a cluster would otherwise no-op.
    try {
      clusterGroup.current.zoomToShowLayer(m, openAfterMove);
    } catch (e: any) {
      try {
        m.openPopup();
      } catch (e2: any) {}
    }
  }, [selectedVetId]);

  // User location marker
  useEffect(() => {
    if (!leafletMap.current) return;

    if (userMarker.current) {
      userMarker.current.remove();
      userMarker.current = null;
    }

    if (!userLocation) return;

    const icon = L.divIcon({
      html: `<div style="width:16px;height:16px;background:#4a90e2;border-radius:50%;border:3px solid white;box-shadow:0 0 0 4px rgba(74,144,226,0.3)"></div>`,
      className: "",
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });
    userMarker.current = L.marker([userLocation.lat, userLocation.lng], {
      icon,
    })
      .addTo(leafletMap.current)
      .bindPopup(
        '<div style="color:#0a0d12;font-weight:700;font-size:13px;padding:6px">📍 You are here</div>',
      );
    leafletMap.current.flyTo([userLocation.lat, userLocation.lng], 12, {
      duration: 1.5,
    });
  }, [userLocation]);

  // Event delegation — "View Full Profile" button click inside any popup
  function handleMapClick(e: any) {
    const vetId = e.target.dataset.popupVetId;
    if (!vetId) return;
    const vet = vetsRef.current.find((v: any) => String(v.id) === vetId);
    if (vet && onVetClickRef.current) onVetClickRef.current(vet, true);
  }

  return (
    <div
      style={{ flex: 1, position: "relative", overflow: "hidden" }}
      onClick={handleMapClick}
    >
      <div ref={mapRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}

function buildPopup(vet: any) {
  const stars =
    "★".repeat(Math.round(vet.avg_rating || 0)) +
    "☆".repeat(5 - Math.round(vet.avg_rating || 0));
  const rating = parseFloat(vet.avg_rating || 0).toFixed(1);

  // Slim popup: renders from /vets/map columns only (no image/contact/address —
  // those load lazily in VetDetailPage via "View Full Profile").
  return `
    <div style="width:276px;font-family:'DM Sans',sans-serif;">
      <div style="padding:14px 16px 16px">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">
          <div style="font-family:'Roboto',sans-serif;font-weight:700;font-size:15px;color:var(--text-primary);line-height:1.3">${esc(vet.name)}</div>
          ${
            (vet.status === "claimed" || vet.user_id) &&
            vet.approval_status === "approved"
              ? `<span style="font-size:10px;font-weight:600;padding:2px 6px;border-radius:4px;background:rgba(0,229,160,0.15);color:#00e5a0">✓ Verified</span>`
              : vet.approval_status === "approved"
                ? `<span style="font-size:10px;font-weight:600;padding:2px 6px;border-radius:4px;background:rgba(99,179,237,0.15);color:#63b3ed">Verification Pending</span>`
                : `<span style="font-size:10px;font-weight:500;padding:2px 6px;border-radius:4px;background:rgba(255,255,255,0.08);color:var(--text-muted)">Unverified</span>`
          }
        </div>
        ${vet.location_name ? `<div style="font-size:12px;color:var(--accent);font-weight:500;margin-bottom:10px">📍 ${esc(vet.location_name)}</div>` : '<div style="margin-bottom:10px"></div>'}
        <div style="display:flex;align-items:center;gap:5px;margin-bottom:12px">
          <span style="color:var(--gold);font-size:13px">${stars}</span>
          <span style="font-size:13px;font-weight:600;color:var(--text-primary)">${rating}</span>
          <span style="font-size:11px;color:var(--text-muted)">(${vet.review_count || 0} reviews)</span>
        </div>
        <button
          data-popup-vet-id="${vet.id}"
          style="width:100%;padding:10px;background:var(--accent);color:#0a0d12;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:700;border:none;border-radius:8px;cursor:pointer;transition:all 0.2s"
        >
          View Full Profile →
        </button>
      </div>
    </div>`;
}

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import Head from "next/head";
import Sidebar from "../components/Sidebar";
import AuthModal from "../components/Auth/AuthModal";
import DonateModal from "../components/DonateModal";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useNavbar } from "../context/NavbarContext";
import { vetsAPI, fetchNearbyVets } from "../lib/api";
import { useVets } from "../hooks/useVets";
import { useTranslation } from "react-i18next";

// Static map preview path (file in /public). Used as the facade LCP <img>:
// it's real, in the SSR HTML, preload-scanner-discoverable, and LCP-eligible.
// The interactive Leaflet map is deferred (idle/interaction) and swaps into the
// same slot — see the map facade in the Home render below.
const MAP_PREVIEW_SRC = "/map-preview.svg";

// next/dynamic with ssr:false does NOT render this on the server, so it must
// stay DOM-identical between the client's first paint and hydration — keep it
// spinner-only (no SSR-divergent elements).
function MapLoadingFallback() {
  const { t } = useTranslation("home");
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "transparent",
        color: "var(--text-muted)",
        fontSize: 14,
        gap: 10,
      }}
    >
      <div
        style={{
          width: 20,
          height: 20,
          border: "2px solid var(--border)",
          borderTopColor: "var(--accent)",
          borderRadius: "50%",
          animation: "spin 0.7s linear infinite",
        }}
      />
      {t("map.loadingMap")}
    </div>
  );
}

// Leaflet must load client-side only
const MapView = dynamic(() => import("../components/Map/MapView"), {
  ssr: false,
  loading: () => <MapLoadingFallback />,
});

const VetDetailPage = dynamic(() => import("../components/Vet/VetDetailPage"), {
  ssr: false,
});

const VETS_LS_KEY = "pawliz_vets_v1";
const VETS_LS_TTL_MS = 5 * 60 * 1000;

function readVetsFromLocalStorage() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(VETS_LS_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (!cached || !Array.isArray(cached.v)) return null;
    if (Date.now() - cached.t > VETS_LS_TTL_MS) return null;
    return cached.v;
  } catch {
    return null;
  }
}

function writeVetsToLocalStorage(vets: any) {
  if (typeof window === "undefined" || !vets?.length) return;
  try {
    localStorage.setItem(VETS_LS_KEY, JSON.stringify({ v: vets, t: Date.now() }));
  } catch {}
}

export async function getStaticProps() {
  const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
  try {
    const r = await fetch(`${base}/v1/vets/map`);
    if (!r.ok) throw new Error(`Upstream ${r.status}`);
    const data = await r.json();
    return {
      props: { initialVets: Array.isArray(data.vets) ? data.vets : [] },
      revalidate: 60,
    };
  } catch {
    return { props: { initialVets: [] }, revalidate: 30 };
  }
}

export default function Home({ initialVets = [] }: any) {
  const { theme } = useNavbar();
  const { t } = useTranslation("home");
  // Map pins: ALL approved vets, slim payload (from /vets/map). Always shown
  // unless nearbyMode is active, which temporarily filters the map to nearby.
  const [mapVets, setMapVets] = useState(initialVets || []);
  const [nearbyVets, setNearbyVets] = useState<any[]>([]);
  // Sidebar list: paginated/cursor via useVets hook (server-side search + infinite scroll).
  const {
    vets,
    locations,
    loading,
    hasMore,
    loadVets,
    loadMore,
    loadLocations,
  } = useVets();
  const [selectedVetId, setSelectedVetId] = useState<any>(null);
  const [detailVetId, setDetailVetId] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authTab, setAuthTab] = useState("login");
  const [donateOpen, setDonateOpen] = useState(false);
  const [nearbyMode, setNearbyMode] = useState(false);
  const [userLocation, setUserLocation] = useState<any>(null);
  const [isMobile, setIsMobile] = useState(false);
  // Map facade: show the static preview <img> as the LCP element first, then
  // mount the interactive Leaflet map once idle or on interaction (whichever
  // first). Keeps the heavy map JS + tile fetches off the LCP critical path.
  const [mapActivated, setMapActivated] = useState(false);

  const { isAdmin, user } = useAuth();
  const { toast } = useToast();

  // Detect mobile
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Activate the interactive map after the page is idle (so passive visitors
  // still get the live map ~1.5s after paint, without it gating LCP).
  useEffect(() => {
    if (mapActivated) return;
    let idleId: any;
    let timeoutId;
    const activate = () => setMapActivated(true);
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(activate, { timeout: 2000 });
    }
    // Fallback for browsers without requestIdleCallback (e.g. Safari).
    timeoutId = setTimeout(activate, 1500);
    return () => {
      if (idleId && "cancelIdleCallback" in window) window.cancelIdleCallback(idleId);
      clearTimeout(timeoutId);
    };
  }, [mapActivated]);

  // NO-BREAK: any action that drives the map (selecting a vet from the sidebar/
  // search, or entering nearby mode) must mount the live map before it's needed.
  useEffect(() => {
    if (!mapActivated && (selectedVetId || nearbyMode || userLocation)) {
      setMapActivated(true);
    }
  }, [mapActivated, selectedVetId, nearbyMode, userLocation]);

  // Load ALL map pins (slim). Falls back to localStorage cache, then DEMO.
  const loadMapVets = useCallback(async ({ background = false } = {}) => {
    try {
      const res = await vetsAPI.getMap();
      const fresh = res.vets || [];
      setMapVets(fresh);
      writeVetsToLocalStorage(fresh);
    } catch {
      if (!background) {
        setMapVets((prev: any) => (prev?.length ? prev : DEMO_VETS));
        toast(t("map.backendOffline"), "error");
      }
    }
  }, [toast, t]);

  // Initial load: paint pins fast (SSR initial -> localStorage -> network),
  // load the sidebar's first page, and fetch the location filter list.
  useEffect(() => {
    if (initialVets?.length) {
      writeVetsToLocalStorage(initialVets);
      loadMapVets({ background: true });
    } else {
      const ls = readVetsFromLocalStorage();
      if (ls?.length) {
        setMapVets(ls);
        loadMapVets({ background: true });
      } else {
        loadMapVets();
      }
    }
    loadVets();
    loadLocations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // IP-geo prefetch (no permission prompt). On Vercel, /api/geo returns
  // city-level coords -> warm the server cache for the ~15 nearest vets so a
  // click on a nearby pin is instant. On localhost the headers are absent and
  // /api/geo returns {lat:null} -> we silently skip. Never blocks the UI.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/geo");
        if (!res.ok || cancelled) return;
        const { lat, lng } = await res.json();
        if (lat == null || lng == null) return;
        // Fire-and-forget: warms /vets/:id server cache for nearby vets.
        fetchNearbyVets(lat, lng, 25, 15).catch(() => {});
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  // Handlers
  const handleSelectVet = (vet: any) => {
    setSelectedVetId(vet.id);
  };

  const handleVetClick = (vet: any, openDetail = false) => {
    setSelectedVetId(vet.id);
    if (openDetail) {
      setDetailVetId(vet.id);
      setDetailOpen(true);
    }
  };

  const handleNearbyVets = () => {
    if (!navigator.geolocation) {
      toast("Geolocation not supported by your browser", "error");
      return;
    }
    toast("Getting your location...");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setUserLocation({ lat: latitude, lng: longitude });

        // Start at 5km, double until results found (max 320km)
        let radius = 5;
        let nearby = [];
        while (radius <= 320) {
          const data = await fetchNearbyVets(latitude, longitude, radius);
          nearby = data.vets || [];
          if (nearby.length > 0) break;
          radius *= 2;
        }

        setNearbyVets(nearby);
        setNearbyMode(true);
        if (nearby.length === 0) {
          toast("No vets found nearby", "error");
        } else {
          toast(
            `Found ${nearby.length} vet${nearby.length !== 1 ? "s" : ""} within ${radius}km!`,
          );
        }
      },
      () => toast("Location access denied. Please enable location.", "error"),
      { timeout: 8000 },
    );
  };

  const handleClearNearby = () => {
    setNearbyMode(false);
    setUserLocation(null);
    setNearbyVets([]);
  };

  const openAuth = (tab = "login") => {
    setAuthTab(tab);
    setAuthOpen(true);
  };

  return (
    <>
      <Head>
        <title>Pawliz — Veterinary Platform Bangladesh</title>
        {/* Preload the static map preview so it's the fast-path LCP element. */}
        <link rel="preload" as="image" href="/map-preview.svg" type="image/svg+xml" fetchPriority="high" />
        <meta
          name="description"
          content="Find the best veterinary clinics across Bangladesh on Pawliz. Browse the map, read reviews, and get expert care for your pets."
          key="description"
        />
        <meta property="og:title" content="Pawliz — Veterinary Platform Bangladesh" key="og:title" />
        <meta
          property="og:description"
          content="Find trusted veterinary clinics near you across Bangladesh."
          key="og:description"
        />
      </Head>

      <div
        style={{
          display: "flex",
          position: "fixed",
          top: "var(--header-height)",
          bottom: "80px",
          left: 0,
          right: 0,
        }}
      >
        {/* Mobile top search bar */}
        {isMobile && (
          <div
            style={{
              position: "absolute",
              top: "12px",
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 900,
              width: "90%",
              maxWidth: 400,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div style={{ position: "relative" }}>
              <span
                style={{
                  position: "absolute",
                  left: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  display: "flex",
                  color: "var(--text-muted)",
                  pointerEvents: "none",
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></svg>
              </span>
              <input
                id="mobile-vet-search"
                name="search"
                className="input-field"
                placeholder={t("map.searchPlaceholder")}
                autoComplete="off"
                style={{
                  paddingLeft: 36,
                  boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
                  background:
                    theme === "dark"
                      ? "rgba(19,24,31,0.95)"
                      : "rgba(255,255,255,0.95)",
                  backdropFilter: "blur(10px)",
                }}
                onChange={(e: any) => {
                  const val = e.target.value;
                  clearTimeout((window as any).__mobileSearchTimer);
                  (window as any).__mobileSearchTimer = setTimeout(
                    () => loadVets(val),
                    400,
                  );
                }}
              />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {nearbyMode ? (
                <button
                  onClick={handleClearNearby}
                  style={{
                    flex: 1,
                    padding: "10px 0",
                    borderRadius: 8,
                    border: "1px solid var(--border-accent)",
                    background:
                      theme === "dark"
                        ? "rgba(19,24,31,0.95)"
                        : "rgba(255,255,255,0.95)",
                    backdropFilter: "blur(10px)",
                    color: "var(--accent)",
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: "pointer",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
                  }}
                >
                  {t("map.clearNearby")}
                </button>
              ) : (
                <button
                  onClick={handleNearbyVets}
                  style={{
                    flex: 1,
                    padding: "10px 0",
                    borderRadius: 8,
                    border: "1px solid var(--border-accent)",
                    background:
                      theme === "dark"
                        ? "rgba(19,24,31,0.95)"
                        : "rgba(255,255,255,0.95)",
                    backdropFilter: "blur(10px)",
                    color: "var(--accent)",
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: "pointer",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
                  }}
                >
                  {t("map.findNearby")}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Sidebar - hidden on mobile */}
        {!isMobile && (
          <Sidebar
            vets={nearbyMode ? nearbyVets : vets}
            loading={loading}
            locations={locations}
            onSelectVet={handleSelectVet}
            onSearch={(q: any, loc: any) => loadVets(q, loc)}
            onFilterLocation={(loc: any, q: any) => loadVets(q, loc)}
            selectedVetId={selectedVetId}
            onNearbyVets={handleNearbyVets}
            nearbyMode={nearbyMode}
            onClearNearby={handleClearNearby}
            hasMore={!nearbyMode && hasMore}
            onLoadMore={loadMore}
          />
        )}
        {/* Map facade: a real static <img> is the LCP element (in SSR HTML,
            preloaded, not lazy). The interactive Leaflet map mounts into the
            same slot once activated (idle/interaction) — see mapActivated. They
            never render together, so there's no ssr:false dynamic-sibling
            hydration conflict. Activate on first pointer/touch as a safety net
            for users who interact before the idle timer fires. */}
        <div
          onPointerOver={!mapActivated ? () => setMapActivated(true) : undefined}
          onPointerDown={!mapActivated ? () => setMapActivated(true) : undefined}
          onTouchStart={!mapActivated ? () => setMapActivated(true) : undefined}
          style={{
            position: "relative",
            flex: 1,
            display: "flex",
            minWidth: 0,
            background: "var(--bg-primary)",
          }}
        >
          {mapActivated ? (
            <MapView
              vets={nearbyMode ? nearbyVets : mapVets}
              theme={theme}
              selectedVetId={selectedVetId}
              onVetClick={handleVetClick}
              userLocation={userLocation}
              isMobile={isMobile}
            />
          ) : (
            <img
              src={MAP_PREVIEW_SRC}
              alt=""
              aria-hidden="true"
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          )}
        </div>
      </div>

      {/* Modals */}
      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        defaultTab={authTab}
      />
      <DonateModal open={donateOpen} onClose={() => setDonateOpen(false)} />

      {/* Vet Detail */}
      <VetDetailPage
        vetId={detailVetId}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onAuthRequired={() => {
          setDetailOpen(false);
          openAuth("login");
        }}
      />
    </>
  );
}

// Demo data when backend is offline
const DEMO_VETS = [
  {
    id: 1,
    name: "Central Veterinary Hospital Dhaka",
    location_name: "Mirpur",
    latitude: 23.8103,
    longitude: 90.3654,
    address: "Mirpur DOHS, Dhaka 1216",
    contact: "+880 1711-234567",
    avg_rating: 4.5,
    review_count: 12,
    image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600",
  },
  {
    id: 2,
    name: "Gulshan Pet Care Center",
    location_name: "Gulshan",
    latitude: 23.7806,
    longitude: 90.4193,
    address: "Gulshan-1, Dhaka 1212",
    contact: "+880 1812-345678",
    avg_rating: 4.8,
    review_count: 24,
    image: "https://images.unsplash.com/photo-1576201836106-db1758fd1c97?w=600",
  },
  {
    id: 3,
    name: "Dhanmondi Animal Clinic",
    location_name: "Dhanmondi",
    latitude: 23.7461,
    longitude: 90.3742,
    address: "Dhanmondi R/A, Dhaka 1209",
    contact: "+880 1911-456789",
    avg_rating: 4.2,
    review_count: 8,
  },
  {
    id: 4,
    name: "Chittagong Animal Hospital",
    location_name: "Chittagong",
    latitude: 22.3569,
    longitude: 91.7832,
    address: "GEC Circle, Chittagong 4000",
    contact: "+880 1711-789012",
    avg_rating: 4.0,
    review_count: 15,
  },
  {
    id: 5,
    name: "Sylhet Pet Wellness Center",
    location_name: "Sylhet",
    latitude: 24.8949,
    longitude: 91.8687,
    address: "Zindabazar, Sylhet 3100",
    contact: "+880 1811-890123",
    avg_rating: 4.3,
    review_count: 6,
  },
  {
    id: 6,
    name: "Rajshahi Animal Care",
    location_name: "Rajshahi",
    latitude: 24.3636,
    longitude: 88.6241,
    address: "Shaheb Bazar, Rajshahi 6000",
    contact: "+880 1911-901234",
    avg_rating: 3.8,
    review_count: 5,
  },
  {
    id: 7,
    name: "Khulna Pet Medical Center",
    location_name: "Khulna",
    latitude: 22.8456,
    longitude: 89.5403,
    address: "KDA Avenue, Khulna 9000",
    contact: "+880 1811-345679",
    avg_rating: 4.1,
    review_count: 9,
  },
];

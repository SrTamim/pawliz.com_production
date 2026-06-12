import { useState, useEffect, useRef } from "react";
import { Stars, Button, EmptyState, Loading } from "./UI";
import { useTranslation } from "react-i18next";

export default function Sidebar({
  vets,
  loading,
  locations,
  onSelectVet,
  onSearch,
  onFilterLocation,
  selectedVetId,
  onNearbyVets,
  nearbyMode,
  onClearNearby,
  hasMore,
  onLoadMore,
}: any) {
  const [searchVal, setSearchVal] = useState("");
  const [activeLocation, setActiveLocation] = useState("");
  const [activeRating, setActiveRating] = useState(0);
  const debounceRef = useRef<any>(null);
  const { t } = useTranslation("vet");

  const handleSearch = (val) => {
    setSearchVal(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onSearch(val, activeLocation), 400);
  };

  const handleLocation = (loc) => {
    setActiveLocation(loc);
    onFilterLocation(loc, searchVal);
  };

  const handleRating = (r) => {
    setActiveRating((prev) => (prev === r ? 0 : r));
  };

  const displayed =
    activeRating > 0
      ? vets.filter((v) => parseFloat(v.avg_rating || 0) >= activeRating)
      : vets;

  return (
    <aside
      style={{
        width: "var(--sidebar-width)",
        minWidth: "var(--sidebar-width)",
        height: "100%",
        background: "var(--bg-secondary)",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        transition: "background 0.3s",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "18px 18px 14px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div
          style={{
            fontFamily: "Roboto, sans-serif",
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: "1.5px",
            textTransform: "uppercase",
            color: "var(--accent)",
            marginBottom: 12,
          }}
        >
          {t("findVets")}
        </div>

        {/* Search */}
        <div style={{ position: "relative", marginBottom: 10 }}>
          <span
            style={{
              position: "absolute",
              left: 11,
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: 20,
              color: "var(--text-muted)",
            }}
          >
            🔍
          </span>
          <input
            id="sidebar-vet-search"
            name="search"
            className="input-field"
            value={searchVal}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder={t("search")}
            style={{ paddingLeft: 34 }}
            autoComplete="off"
          />
        </div>

        {/* Nearby Button */}
        {nearbyMode ? (
          <Button
            variant="outline"
            size="sm"
            style={{ width: "100%" }}
            onClick={onClearNearby}
          >
            {t("clearNearby")}
          </Button>
        ) : (
          <Button
            variant="dark"
            size="sm"
            style={{ width: "100%" }}
            onClick={onNearbyVets}
          >
            {t("nearby")}
          </Button>
        )}
      </div>

      {/* Rating Filter */}
      <div
        style={{
          padding: "10px 18px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: "1px",
            textTransform: "uppercase",
            color: "var(--text-muted)",
            marginBottom: 8,
          }}
        >
          {t("minRating")}
        </div>
        <div style={{ display: "flex", gap: 5 }}>
          {[0, 3, 4, 5].map((r) => (
            <button
              key={r}
              onClick={() => handleRating(r)}
              style={{
                padding: "3px 10px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                border: "1px solid",
                transition: "all 0.2s",
                background:
                  activeRating === r && r > 0
                    ? "rgba(240,165,0,0.15)"
                    : "transparent",
                borderColor:
                  activeRating === r && r > 0
                    ? "rgba(240,165,0,0.4)"
                    : "var(--border)",
                color:
                  activeRating === r && r > 0
                    ? "var(--gold)"
                    : "var(--text-secondary)",
              }}
            >
              {r === 0 ? t("allRatings") : `★ ${r}+`}
            </button>
          ))}
        </div>
      </div>

      {/* Count */}
      <div
        style={{
          padding: "8px 18px 4px",
          fontSize: 15,
          color: "var(--text-muted)",
        }}
      >
        {loading
          ? ""
          : t("clinicsFound", { count: displayed.length })}
        {nearbyMode && (
          <span style={{ color: "var(--accent)", fontWeight: 600 }}>
            {" "}
            · {t("nearbyLabel")}
          </span>
        )}
      </div>

      {/* Vet List */}
      <div
        style={{ flex: 1, overflowY: "auto", padding: "8px 12px" }}
        onScroll={(e) => {
          if (!hasMore || loading || !onLoadMore) return;
          const el = e.currentTarget;
          if (el.scrollHeight - el.scrollTop - el.clientHeight < 200) {
            onLoadMore();
          }
        }}
      >
        {loading && displayed.length === 0 ? (
          <Loading text={t("searching")} />
        ) : displayed.length === 0 ? (
          <EmptyState
            icon="🔍"
            title={t("noVets")}
            subtitle={t("noVetsHint")}
          />
        ) : (
          <>
            {displayed.map((vet) => (
              <VetListCard
                key={vet.id}
                vet={vet}
                selected={selectedVetId === vet.id}
                onClick={() => onSelectVet(vet)}
              />
            ))}
            {hasMore && (
              <div
                style={{
                  padding: "10px 0 16px",
                  textAlign: "center",
                  fontSize: 13,
                  color: "var(--text-muted)",
                }}
              >
                {loading ? t("searching") : "↓"}
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
}

function VetListCard({ vet, selected, onClick }: any) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: "16px 16px",
        background: selected ? "var(--accent-dim)" : "var(--bg-card)",
        border: `1px solid ${selected ? "var(--border-accent)" : "var(--border)"}`,
        borderRadius: "var(--radius)",
        marginBottom: 10,
        cursor: "pointer",
        transition: "all 0.2s",
        borderLeft: `3px solid ${selected ? "var(--accent)" : "transparent"}`,
        transform: selected ? "translateX(3px)" : "none",
      }}
      onMouseEnter={(e) => {
        if (!selected) {
          e.currentTarget.style.borderColor = "var(--border-accent)";
          e.currentTarget.style.transform = "translateX(3px)";
        }
      }}
      onMouseLeave={(e) => {
        if (!selected) {
          e.currentTarget.style.borderColor = "var(--border)";
          e.currentTarget.style.transform = "none";
        }
      }}
    >
      <div
        style={{
          fontFamily: "Roboto, sans-serif",
          fontWeight: 700,
          fontSize: 25,
          color: "var(--text-primary)",
          marginBottom: 5,
          lineHeight: 1.3,
        }}
      >
        {vet.name}
      </div>
      <div
        style={{
          fontSize: 13,
          color: "var(--accent)",
          fontWeight: 500,
          marginBottom: 6,
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        📍 {vet.location_name}
        {vet.distance !== undefined && (
          <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>
            {" "}
            · {vet.distance.toFixed(1)} km
          </span>
        )}
      </div>
      <div
        style={{
          fontSize: 15,
          color: "var(--text-muted)",
          lineHeight: 1.5,
          marginBottom: 10,
          overflow: "hidden",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
        }}
      >
        {vet.address}
      </div>
      <Stars rating={vet.avg_rating} count={vet.review_count} size={14} />
    </div>
  );
}

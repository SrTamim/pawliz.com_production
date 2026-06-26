import { useState, useEffect, useRef } from "react";
import { Button, EmptyState, Loading } from "./UI";
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

  const handleSearch = (val: any) => {
    setSearchVal(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onSearch(val, activeLocation), 400);
  };

  const handleLocation = (loc: any) => {
    setActiveLocation(loc);
    onFilterLocation(loc, searchVal);
  };

  const handleRating = (r: any) => {
    setActiveRating((prev: any) => (prev === r ? 0 : r));
  };

  const displayed =
    activeRating > 0
      ? vets.filter((v: any) => parseFloat(v.avg_rating || 0) >= activeRating)
      : vets;

  return (
    <aside
      style={{
        width: "var(--sidebar-width)",
        minWidth: "var(--sidebar-width)",
        height: "100%",
        background: "var(--glass-2)",
        backdropFilter: "blur(18px) saturate(1.3)",
        WebkitBackdropFilter: "blur(18px) saturate(1.3)",
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
          className="eyebrow"
          style={{
            marginBottom: 12,
            display: "block",
          }}
        >
          {t("findVets")}
        </div>

        {/* Search */}
        <div className="search" style={{ marginBottom: 10 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4-4" />
          </svg>
          <input
            id="sidebar-vet-search"
            name="search"
            value={searchVal}
            onChange={(e: any) => handleSearch(e.target.value)}
            placeholder={t("search")}
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
            variant="donate"
            size="sm"
            style={{ width: "100%" }}
            onClick={onNearbyVets}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s-7-6.5-7-11a7 7 0 0114 0c0 4.5-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>
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
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[0, 3, 4, 5].map((r: any) => (
            <button
              key={r}
              type="button"
              className={`chip${activeRating === r ? " on" : ""}`}
              onClick={() => handleRating(r)}
              style={{
                minHeight: 30,
                padding: "0 12px",
                fontSize: 12.5,
                cursor: "pointer",
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
        onScroll={(e: any) => {
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
            {displayed.map((vet: any) => (
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
  const rating = parseFloat(vet.avg_rating || 0);
  return (
    <div
      onClick={onClick}
      className={`vet-row${selected ? " selected" : ""}`}
      style={{ marginBottom: 12 }}
    >
      <div className="meta">
        <div className="vr-top">
          <h4>{vet.name}</h4>
          <span className="rate">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" /></svg>
            {rating > 0 ? rating.toFixed(1) : "—"}
            {rating > 0 && vet.review_count !== undefined && (
              <span className="rc">({vet.review_count})</span>
            )}
          </span>
        </div>
        <p>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s-7-6.5-7-11a7 7 0 0114 0c0 4.5-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>
          {vet.location_name}
          {vet.distance !== undefined && (
            <span> · {vet.distance.toFixed(1)} km</span>
          )}
        </p>
        {vet.address && <p className="addr">{vet.address}</p>}
      </div>
    </div>
  );
}

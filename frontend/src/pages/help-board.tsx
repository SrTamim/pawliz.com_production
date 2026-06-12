import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { useAuth } from "../context/AuthContext";
import { useNavbar } from "../context/NavbarContext";
import { useToast } from "../context/ToastContext";
import { useTranslation } from "react-i18next";
import { lostFoundAPI, rescueAdoptionAPI } from "../lib/api";
import LostPetPostCard from "../components/LostFound/LostPetPostCard";
import FoundPetPostCard from "../components/LostFound/FoundPetPostCard";
import RescuePostCard from "../components/RescueAdoption/RescuePostCard";
import AdoptionPostCard from "../components/RescueAdoption/AdoptionPostCard";
import FoundPetModal from "../components/LostFound/FoundPetModal";
import RescueModal from "../components/RescueAdoption/RescueModal";
import PostDetailsModal from "../components/LostFound/PostDetailsModal";
import RescueAdoptionPostDetailsModal from "../components/RescueAdoption/RescueAdoptionPostDetailsModal";

const PET_TYPES = ["dog", "cat", "other"];
const LOCATIONS = ["Dhaka", "Chittagong", "Sylhet", "Khulna", "Rajshahi", "Barisal"];
const VALID_TABS = ["lost", "found", "rescue", "adoption"];

const TABS = [
  { id: "lost",     label: "Lost",   icon: "😿", color: "#ff4f6a" },
  { id: "found",    label: "Found",  icon: "🎉", color: "#00e5a0" },
  { id: "rescue",   label: "Rescue", icon: "🚨", color: "#f0a500" },
  { id: "adoption", label: "Adopt",  icon: "🏠", color: "#4f9eff" },
];

export default function HelpBoard() {
  const { user } = useAuth();
  const { theme, openAuth } = useNavbar();
  const { toast } = useToast();
  const router = useRouter();
  const { t } = useTranslation("lostfound");

  const [activeTab, setActiveTab] = useState("lost");
  const [tabInitialized, setTabInitialized] = useState(false);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [foundPetModalOpen, setFoundPetModalOpen] = useState(false);
  const [rescueModalOpen, setRescueModalOpen] = useState(false);
  const [deepLinkPost, setDeepLinkPost] = useState<any>(null);
  const [deepLinkType, setDeepLinkType] = useState<any>(null);
  const [filters, setFilters] = useState({ pet_type: "", location: "" });
  const [showFilters, setShowFilters] = useState(false);
  const [searchText, setSearchText] = useState("");

  // Read ?tab= on mount
  useEffect(() => {
    if (!router.isReady) return;
    const tabParam = router.query.tab as string;
    if (tabParam && VALID_TABS.includes(tabParam)) {
      setActiveTab(tabParam);
    }
    setTabInitialized(true);
  }, [router.isReady]);

  // Deep-link: open specific post from notification (?post=ID&type=...)
  useEffect(() => {
    if (!router.isReady || !tabInitialized) return;
    const { post: postId, type: postType } = router.query as { post?: string; type?: string };
    if (!postId || !postType || !VALID_TABS.includes(postType)) return;

    const fetchAndOpen = async () => {
      try {
        let data;
        if (postType === "lost") {
          data = await lostFoundAPI.getLostPetDetails(postId);
        } else if (postType === "found") {
          data = await lostFoundAPI.getFoundPetDetails(postId);
        } else if (postType === "rescue") {
          data = await rescueAdoptionAPI.getRescuePostDetails(postId);
        } else {
          data = await rescueAdoptionAPI.getAdoptionPostDetails(postId);
        }
        if (data?.post) {
          setDeepLinkPost(data.post);
          setDeepLinkType(postType);
          setActiveTab(postType);
        }
      } catch {}
    };

    fetchAndOpen();
    router.replace("/help-board", undefined, { shallow: true });
  }, [router.query.post, router.query.type, router.isReady, tabInitialized]);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (filters.pet_type) params.pet_type = filters.pet_type;
      if (filters.location) params.location = filters.location;

      let data;
      if (activeTab === "lost") {
        data = await lostFoundAPI.getLostPets(params);
      } else if (activeTab === "found") {
        data = await lostFoundAPI.getFoundPets(params);
      } else if (activeTab === "rescue") {
        data = await rescueAdoptionAPI.getRescuePosts(params);
      } else {
        data = await rescueAdoptionAPI.getAdoptionPosts(params);
      }
      setPosts(data.posts || []);
    } catch (err: any) {
      toast(err.message || "Failed to load posts", "error");
    } finally {
      setLoading(false);
    }
  }, [activeTab, filters, toast]);

  useEffect(() => {
    if (!tabInitialized) return;
    loadPosts();
  }, [loadPosts, tabInitialized]);

  const handleTabChange = (tabId: any) => {
    setActiveTab(tabId);
    setSearchText("");
    setFilters({ pet_type: "", location: "" });
    setShowFilters(false);
  };

  const handleReportLostPet = () => {
    if (!user) { openAuth("login"); return; }
    router.push({ pathname: "/profile", query: { showLostInstruction: true } });
  };

  const handleOpenFoundPetForm = () => {
    if (!user) { openAuth("login"); return; }
    setFoundPetModalOpen(true);
  };

  const handleFoundPetCreated = () => {
    setFoundPetModalOpen(false);
    loadPosts();
    toast("Found pet report created! 🐾", "success");
  };

  const handleReportRescue = () => {
    if (!user) { openAuth("login"); return; }
    setRescueModalOpen(true);
  };

  const handleRescueCreated = () => {
    setRescueModalOpen(false);
    loadPosts();
    toast("Rescue request submitted! 🐾", "success");
  };

  const handleMarkForAdoption = () => {
    if (!user) { openAuth("login"); return; }
    router.push({ pathname: "/profile", query: { showAdoptionInstruction: true } });
  };

  const filteredPosts = posts.filter((post: any) => {
    const k = searchText.toLowerCase();
    if (!k) return true;
    if (activeTab === "lost") {
      return (
        (post.name && post.name.toLowerCase().includes(k)) ||
        (post.breed && post.breed.toLowerCase().includes(k)) ||
        (post.lost_location_name && post.lost_location_name.toLowerCase().includes(k))
      );
    } else if (activeTab === "found") {
      return (
        (post.color && post.color.toLowerCase().includes(k)) ||
        (post.breed && post.breed.toLowerCase().includes(k)) ||
        (post.found_location_name && post.found_location_name.toLowerCase().includes(k))
      );
    } else if (activeTab === "rescue") {
      return (
        (post.color && post.color.toLowerCase().includes(k)) ||
        (post.breed && post.breed.toLowerCase().includes(k)) ||
        (post.rescue_location_name && post.rescue_location_name.toLowerCase().includes(k)) ||
        (post.description && post.description.toLowerCase().includes(k))
      );
    } else {
      return (
        (post.name && post.name.toLowerCase().includes(k)) ||
        (post.breed && post.breed.toLowerCase().includes(k)) ||
        (post.reason && post.reason.toLowerCase().includes(k))
      );
    }
  });

  const activeTabConfig = TABS.find((t: any) => t.id === activeTab);
  const REPORT_ACTION = {
    lost: handleReportLostPet,
    found: handleOpenFoundPetForm,
    rescue: handleReportRescue,
    adoption: handleMarkForAdoption,
  };

  const EMPTY_ICON = { lost: "🔍", found: "🎉", rescue: "🚨", adoption: "🏠" };

  return (
    <>
      <Head>
        <title>Help Board - Pawliz</title>
        <meta
          name="description"
          content="Pawliz Help Board — lost & found pets, rescue and adoption posts across Bangladesh."
          key="description"
        />
        <meta property="og:title" content="Help Board — Pawliz" key="og:title" />
        <meta
          property="og:description"
          content="Pawliz Help Board — lost & found pets, rescue and adoption posts across Bangladesh."
          key="og:description"
        />
      </Head>

      <div className={theme}>
        <div className="bg-[var(--bg-primary)] text-[var(--text-primary)] min-h-screen pt-16 md:pt-20 pb-32 md:pb-24">
          <div className="w-full">
            <div className="w-full px-4 sm:px-6 lg:px-8 pt-5 pb-8">
              {/* Header */}
              <div className="mb-4">
                <h1 className="text-4xl font-bold mb-1">{t(`tabTitle.${activeTab}`)}</h1>
                <p className="text-[var(--text-secondary)]">
                  {t(`tabSubtitle.${activeTab}`)}
                </p>
              </div>

              {/* Tab Bar — horizontal scrollable pills */}
              <div className="overflow-x-auto mb-6">
                <div className="flex gap-2 min-w-max pb-1">
                  {TABS.map((tab: any) => {
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => handleTabChange(tab.id)}
                        style={{
                          backgroundColor: isActive ? tab.color : "var(--bg-card)",
                          color: isActive ? "#fff" : "var(--text-secondary)",
                          border: `2px solid ${isActive ? tab.color : "var(--border)"}`,
                          borderRadius: 9999,
                          padding: "8px 20px",
                          fontWeight: 600,
                          fontSize: 14,
                          cursor: "pointer",
                          transition: "all 0.2s",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          whiteSpace: "nowrap",
                        }}
                      >
                        <span style={{ fontSize: 18, lineHeight: 1 }}>{tab.icon}</span>
                        <span className="tab-label">{t(`tabs.${tab.id}`)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Search & Filters Bar */}
              <div className="flex flex-col md:flex-row gap-4 mb-8">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder={t(`searchPlaceholder.${activeTab}`)}
                    value={searchText}
                    onChange={(e: any) => setSearchText(e.target.value)}
                    className="input-field w-full"
                    style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
                  />
                </div>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="px-4 py-2 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-all"
                >
                  🔍 {t("filters.label")} {showFilters ? "▲" : "▼"}
                </button>
                <button
                  onClick={(REPORT_ACTION as any)[activeTab]}
                  style={{ backgroundColor: activeTabConfig?.color }}
                  className="px-6 py-2 text-white rounded-lg font-semibold hover:opacity-90 transition-all whitespace-nowrap"
                >
                  {t(`reportAction.${activeTab}`)}
                </button>
              </div>

              {/* Filters Panel */}
              {showFilters && (
                <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-6 mb-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold mb-2 text-[var(--text-primary)]">
                        {t("filters.petType")}
                      </label>
                      <select
                        value={filters.pet_type}
                        onChange={(e: any) => setFilters((f: any) => ({ ...f, pet_type: e.target.value }))}
                        className="input-field w-full"
                        style={{ background: "var(--bg-primary)", border: "1px solid var(--border)" }}
                      >
                        <option value="">{t("filters.allTypes")}</option>
                        {PET_TYPES.map((type: any) => (
                          <option key={type} value={type}>
                            {type.charAt(0).toUpperCase() + type.slice(1)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-2 text-[var(--text-primary)]">
                        {t("filters.location")}
                      </label>
                      <select
                        value={filters.location}
                        onChange={(e: any) => setFilters((f: any) => ({ ...f, location: e.target.value }))}
                        className="input-field w-full"
                        style={{ background: "var(--bg-primary)", border: "1px solid var(--border)" }}
                      >
                        <option value="">{t("filters.allLocations")}</option>
                        {LOCATIONS.map((loc: any) => (
                          <option key={loc} value={loc}>{loc}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <button
                    onClick={() => setFilters({ pet_type: "", location: "" })}
                    className="mt-4 px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-sm font-semibold hover:bg-[var(--bg-primary)] transition-all"
                  >
                    {t("filters.clear")}
                  </button>
                </div>
              )}

              {/* Count */}
              <div className="mb-4 text-sm text-[var(--text-secondary)]">
                {t("showing")} {filteredPosts.length} {t(`countLabel.${activeTab}`, { count: filteredPosts.length })}
              </div>

              {/* Posts Grid */}
              {loading ? (
                <div className="flex justify-center items-center py-20">
                  <div className="text-center">
                    <div className="animate-spin mb-4" style={{ fontSize: 32 }}>🐾</div>
                    <p className="text-[var(--text-secondary)]">{t("common:status.loading")}</p>
                  </div>
                </div>
              ) : filteredPosts.length === 0 ? (
                <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-12 text-center">
                  <div style={{ fontSize: 48, marginBottom: 16 }}>{(EMPTY_ICON as any)[activeTab]}</div>
                  <h3 className="text-xl font-bold mb-2">{t(`emptyTitle.${activeTab}`)}</h3>
                  <p className="text-[var(--text-secondary)] mb-6">{t(`emptyDesc.${activeTab}`)}</p>
                  {activeTab === "found" && (
                    <button
                      onClick={handleOpenFoundPetForm}
                      className="px-6 py-2 bg-[var(--accent)] text-white rounded-lg font-semibold hover:opacity-90 transition-all"
                    >
                      {t("emptyBtn.found")}
                    </button>
                  )}
                  {activeTab === "rescue" && (
                    <button
                      onClick={handleReportRescue}
                      className="px-6 py-2 bg-[var(--accent)] text-white rounded-lg font-semibold hover:opacity-90 transition-all"
                    >
                      {t("emptyBtn.rescue")}
                    </button>
                  )}
                  {activeTab === "adoption" && (
                    <button
                      onClick={handleMarkForAdoption}
                      className="px-6 py-2 bg-[var(--accent)] text-white rounded-lg font-semibold hover:opacity-90 transition-all"
                    >
                      {t("emptyBtn.adoption")}
                    </button>
                  )}
                </div>
              ) : (
                <div className="help-grid grid grid-cols-2 gap-4">
                  {filteredPosts.map((post: any) => {
                    if (activeTab === "lost")
                      return <LostPetPostCard key={post.id} post={post} onPostDeleted={loadPosts} />;
                    if (activeTab === "found")
                      return <FoundPetPostCard key={post.id} post={post} onPostDeleted={loadPosts} />;
                    if (activeTab === "rescue")
                      return <RescuePostCard key={post.id} post={post} onPostDeleted={loadPosts} />;
                    return <AdoptionPostCard key={post.id} post={post} onPostDeleted={loadPosts} />;
                  })}
                </div>
              )}
            </div>
          </div>
        </div>



        {/* Modals */}
        <FoundPetModal
          open={foundPetModalOpen}
          onClose={() => setFoundPetModalOpen(false)}
          onCreated={handleFoundPetCreated}
        />
        <RescueModal
          open={rescueModalOpen}
          onClose={() => setRescueModalOpen(false)}
          onCreated={handleRescueCreated}
        />

        {/* Deep-link modals */}
        <PostDetailsModal
          open={!!deepLinkPost && (deepLinkType === "lost" || deepLinkType === "found")}
          onClose={() => { setDeepLinkPost(null); setDeepLinkType(null); }}
          postType={deepLinkType}
          post={deepLinkPost}
          onPostDeleted={loadPosts}
        />
        <RescueAdoptionPostDetailsModal
          open={!!deepLinkPost && (deepLinkType === "rescue" || deepLinkType === "adoption")}
          onClose={() => { setDeepLinkPost(null); setDeepLinkType(null); }}
          postType={deepLinkType}
          post={deepLinkPost}
          onPostDeleted={loadPosts}
        />
      </div>

      {/* Hide tab label text on very small screens */}
      <style jsx>{`
        @media (max-width: 359px) {
          .tab-label {
            display: none;
          }
        }
        @media (min-width: 640px) {
          .help-grid {
            grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          }
        }
      `}</style>
    </>
  );
}

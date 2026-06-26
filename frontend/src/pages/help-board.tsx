import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { useAuth } from "../context/AuthContext";
import { useNavbar } from "../context/NavbarContext";
import { useToast } from "../context/ToastContext";
import { useTranslation } from "react-i18next";
import { lostFoundAPI, rescueAdoptionAPI, getImageUrl } from "../lib/api";
import { parseImages } from "../lib/postUtils";
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

export default function HelpBoard({ ogPost = null }: any) {
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
  const [searchText, setSearchText] = useState("");
  const [counts, setCounts] = useState<any>({ lost: 0, found: 0, rescue: 0, adoption: 0 });

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

  // Tab counts — fetched once (unfiltered) so all four pills show totals.
  const loadCounts = useCallback(async () => {
    try {
      const [lost, found, rescue, adoption] = await Promise.all([
        lostFoundAPI.getLostPets({}),
        lostFoundAPI.getFoundPets({}),
        rescueAdoptionAPI.getRescuePosts({}),
        rescueAdoptionAPI.getAdoptionPosts({}),
      ]);
      setCounts({
        lost: lost.posts?.length || 0,
        found: found.posts?.length || 0,
        rescue: rescue.posts?.length || 0,
        adoption: adoption.posts?.length || 0,
      });
    } catch {}
  }, []);

  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  const handleTabChange = (tabId: any) => {
    setActiveTab(tabId);
    setSearchText("");
    setFilters({ pet_type: "", location: "" });
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
    loadCounts();
    toast("Found pet report created! 🐾", "success");
  };

  const handleReportRescue = () => {
    if (!user) { openAuth("login"); return; }
    setRescueModalOpen(true);
  };

  const handleRescueCreated = () => {
    setRescueModalOpen(false);
    loadPosts();
    loadCounts();
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

  // Per-post OG meta (from SSR) so a shared link previews the specific pet on
  // social apps. Falls back to the generic help-board tags when absent.
  const cap = (s: any) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");
  const og = (() => {
    if (!ogPost) return null;
    const type = ogPost.type;
    const petType = cap(ogPost.pet_type || ogPost.type) || "Pet";
    const img = parseImages(ogPost.images)[0];
    const image = img ? getImageUrl(img) : null;
    let title = "";
    let description = "";
    if (type === "lost") {
      const name = ogPost.name || "this pet";
      title = `🚨 Help find ${name} — Pawliz`;
      description = `${petType} lost in ${ogPost.lost_location_name || "Bangladesh"}. Please share to help reunite them.`;
    } else if (type === "found") {
      title = `📢 Found a ${petType} — Pawliz`;
      description = `A ${petType} was found in ${ogPost.found_location_name || "Bangladesh"}. Help find the owner.`;
    } else if (type === "rescue") {
      title = `🚨 ${petType} needs rescue — Pawliz`;
      description = `A ${petType} needs rescue in ${ogPost.rescue_location_name || "Bangladesh"}. Please help share.`;
    } else {
      const name = ogPost.name || "A pet";
      title = `🏠 ${name} needs a home — Pawliz`;
      description = `${petType} available for adoption on Pawliz. #AdoptDontShop`;
    }
    return { title, description, image };
  })();

  return (
    <>
      <Head>
        <title>{og ? og.title : "Help Board - Pawliz"}</title>
        <meta
          name="description"
          content={og ? og.description : "Pawliz Help Board — lost & found pets, rescue and adoption posts across Bangladesh."}
          key="description"
        />
        <meta property="og:title" content={og ? og.title : "Help Board — Pawliz"} key="og:title" />
        <meta
          property="og:description"
          content={og ? og.description : "Pawliz Help Board — lost & found pets, rescue and adoption posts across Bangladesh."}
          key="og:description"
        />
        {og?.image && <meta property="og:image" content={og.image} key="og:image" />}
        {og?.image && <meta name="twitter:image" content={og.image} key="twitter:image" />}
      </Head>

      <div className={theme}>
        <main className="shell">
          {/* Page heading — gives the board a visible title on every viewport */}
          <header className="page-head">
            <h1>{t(`tabTitle.${activeTab}`)}</h1>
            <p>{t(`tabSubtitle.${activeTab}`)}</p>
          </header>

          {/* Tabs — segmented, wraps to 2x2 on mobile (no horizontal scroll), with live counts */}
          <div className="tabs tabs-wrap" role="tablist" style={{ marginBottom: 16, maxWidth: "100%" }}>
            {TABS.map((tab: any) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => handleTabChange(tab.id)}
              >
                <span style={{ lineHeight: 1 }}>{tab.icon}</span>
                <span className="tab-label">{t(`tabs.${tab.id}`)}</span>
                <span className="ct">{counts[tab.id]}</span>
              </button>
            ))}
          </div>

          {/* Search + inline pet/location filters + report CTA — all on one row, wraps on mobile */}
          <div className="row wrapx between help-controls" style={{ gap: 10, marginBottom: 18 }}>
            <div className="search grow" style={{ minWidth: 200 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></svg>
              <input
                type="text"
                placeholder={t(`searchPlaceholder.${activeTab}`)}
                value={searchText}
                onChange={(e: any) => setSearchText(e.target.value)}
              />
            </div>
            <div className="row wrapx help-filters" style={{ gap: 8 }}>
              <select
                className="select"
                value={filters.pet_type}
                onChange={(e: any) => setFilters((f: any) => ({ ...f, pet_type: e.target.value }))}
                aria-label={t("filters.petType")}
              >
                <option value="">{t("filters.allTypes")}</option>
                {PET_TYPES.map((type: any) => (
                  <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>
                ))}
              </select>
              <select
                className="select"
                value={filters.location}
                onChange={(e: any) => setFilters((f: any) => ({ ...f, location: e.target.value }))}
                aria-label={t("filters.location")}
              >
                <option value="">{t("filters.allLocations")}</option>
                {LOCATIONS.map((loc: any) => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
              <button className="btn btn-warm grow" onClick={(REPORT_ACTION as any)[activeTab]}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
                {t(`reportAction.${activeTab}`)}
              </button>
            </div>
          </div>

          {/* Count */}
          <div className="dim text-sm" style={{ marginBottom: 16 }}>
            {t("showing")} {filteredPosts.length} {t(`countLabel.${activeTab}`, { count: filteredPosts.length })}
          </div>

          {/* Posts Grid */}
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <div className="text-center">
                <div className="animate-spin mb-4" style={{ fontSize: 32 }}>🐾</div>
                <p className="dim">{t("common:status.loading")}</p>
              </div>
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="glass text-center" style={{ padding: 48 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>{(EMPTY_ICON as any)[activeTab]}</div>
              <h3 className="text-xl font-bold mb-2">{t(`emptyTitle.${activeTab}`)}</h3>
              <p className="dim mb-6">{t(`emptyDesc.${activeTab}`)}</p>
              {activeTab === "found" && (
                <button onClick={handleOpenFoundPetForm} className="btn btn-primary">{t("emptyBtn.found")}</button>
              )}
              {activeTab === "rescue" && (
                <button onClick={handleReportRescue} className="btn btn-warm">{t("emptyBtn.rescue")}</button>
              )}
              {activeTab === "adoption" && (
                <button onClick={handleMarkForAdoption} className="btn btn-primary">{t("emptyBtn.adoption")}</button>
              )}
            </div>
          ) : (
            <div className="help-grid">
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
        </main>



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
      `}</style>
    </>
  );
}

// SSR: when a shared link carries ?post=ID&type=TYPE, fetch the post server-side
// so crawlers (FB/WhatsApp/Twitter) see per-pet OG tags. The client deep-link
// effect still opens the modal — ogPost only feeds <Head>.
const OG_ENDPOINTS: Record<string, string> = {
  lost: "/v1/lost-found/lost",
  found: "/v1/lost-found/found",
  rescue: "/v1/rescue-adoption/rescue",
  adoption: "/v1/rescue-adoption/adoption",
};

export async function getServerSideProps({ query }: any) {
  const postId = query?.post as string | undefined;
  const postType = query?.type as string | undefined;
  if (!postId || !postType || !OG_ENDPOINTS[postType]) {
    return { props: { ogPost: null } };
  }

  const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
  try {
    const r = await fetch(`${base}${OG_ENDPOINTS[postType]}/${encodeURIComponent(postId)}`);
    if (!r.ok) return { props: { ogPost: null } };
    const data = await r.json();
    if (!data?.post) return { props: { ogPost: null } };
    return { props: { ogPost: { type: postType, ...data.post } } };
  } catch {
    return { props: { ogPost: null } };
  }
}

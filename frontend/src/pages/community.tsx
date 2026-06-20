import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { useNavbar } from "../context/NavbarContext";
import { communityAPI, getImageUrl } from "../lib/api";
import { useCommunityFeed } from "../lib/useCommunityFeed";
import CommunityPostCard from "../components/Community/CommunityPostCard";
import CommunityComposeModal from "../components/Community/CommunityComposeModal";
import CommunityPostDetailsModal from "../components/Community/CommunityPostDetailsModal";
import type { CommunityPost, CommunityTag } from "../types";

export default function CommunityPage({ ogPost = null }: any) {
  const { t } = useTranslation("community");
  const { user } = useAuth();
  const { openAuth } = useNavbar();
  const router = useRouter();

  const [tags, setTags] = useState<CommunityTag[]>([]);
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [composeOpen, setComposeOpen] = useState(false);
  const [editPost, setEditPost] = useState<CommunityPost | null>(null);
  const [detailsPost, setDetailsPost] = useState<CommunityPost | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const { posts, isLoadingInitial, isLoadingMore, hasMore, loadMore, error, prependPost, replacePost, removePost } =
    useCommunityFeed(activeTags);

  // Load tag list
  useEffect(() => {
    communityAPI.getTags().then((d: any) => setTags(d.tags || [])).catch(() => {});
  }, []);

  // Deep-link: ?post=ID → open details
  useEffect(() => {
    if (!router.isReady) return;
    const postId = router.query.post as string | undefined;
    if (!postId) return;
    communityAPI.getPost(postId).then((d: any) => {
      if (d?.post) setDetailsPost(d.post);
    }).catch(() => {});
    router.replace("/community", undefined, { shallow: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, router.query.post]);

  // Infinite scroll
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting && hasMore && !isLoadingMore) loadMore(); },
      { rootMargin: "400px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, isLoadingMore, loadMore]);

  const openCompose = () => {
    if (!user) { openAuth("login"); return; }
    setEditPost(null);
    setComposeOpen(true);
  };

  const toggleTag = useCallback((slug: string) => {
    setActiveTags((cur) => (cur.includes(slug) ? cur.filter((s) => s !== slug) : [...cur, slug]));
  }, []);

  return (
    <>
      <Head>
        <title>{ogPost?.body ? `${String(ogPost.body).slice(0, 60)} | Pawliz` : "Community | Pawliz"}</title>
        <meta name="description" content={ogPost?.body ? String(ogPost.body).slice(0, 150) : "The Pawliz community — share tips, ask questions, help other pet parents."} key="description" />
        <meta property="og:title" content={ogPost?.author_name ? `${ogPost.author_name} on Pawliz Community` : "Pawliz Community"} key="og:title" />
        <meta property="og:description" content={ogPost?.body ? String(ogPost.body).slice(0, 150) : "Join the Pawliz community."} key="og:description" />
        {ogPost?.images?.[0] && <meta property="og:image" content={getImageUrl(ogPost.images[0]) ?? ""} key="og:image" />}
      </Head>

      <div className="min-h-screen bg-[var(--bg-primary)] px-3 sm:px-6 py-6" style={{ paddingTop: "calc(var(--header-height) + 16px)" }}>
        <div className="w-full">
          <h1 className="text-3xl font-bold font-syne text-[var(--text-primary)] mb-1">{t("title")}</h1>
          <p className="text-[var(--text-secondary)] mb-5">{t("subtitle")}</p>

          {/* Composer pill — always shown; click prompts login when logged out */}
          <button
            onClick={openCompose}
            className="w-full flex items-center gap-3 bg-[var(--bg-card)] border border-[var(--border)] rounded-full px-4 py-3 mb-4 hover:shadow transition-all text-left"
          >
            {user?.profile_picture ? (
              <img src={getImageUrl(user.profile_picture) ?? undefined} alt="" className="w-9 h-9 rounded-full object-cover" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-[var(--accent)] flex items-center justify-center text-white text-sm font-bold">{user?.name?.charAt(0).toUpperCase() || "?"}</div>
            )}
            <span className="text-[var(--text-secondary)]">{t("composePrompt")}</span>
          </button>

          {/* Tag filter pills */}
          <div className="sticky z-10 -mx-3 px-3 py-2 bg-[var(--bg-primary)]" style={{ top: "var(--header-height)" }}>
            <div className="flex gap-2 overflow-x-auto pb-1">
              <button
                onClick={() => setActiveTags([])}
                className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap border transition-all ${activeTags.length === 0 ? "bg-[var(--accent)] border-[var(--accent)] text-white" : "border-[var(--border)] text-[var(--text-secondary)]"}`}
              >
                {t("filter.all")}
              </button>
              {tags.map((tg) => {
                const active = activeTags.includes(tg.slug);
                return (
                  <button
                    key={tg.id}
                    onClick={() => toggleTag(tg.slug)}
                    className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap border transition-all ${active ? "bg-[var(--accent)] border-[var(--accent)] text-white" : "border-[var(--border)] text-[var(--text-secondary)]"}`}
                  >
                    {tg.label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              {activeTags.length > 0 ? t("feed.window45") : t("feed.window20")}
            </p>
          </div>

          {/* Feed — equal-height grid: single column on mobile, multi-column on wide screens */}
          {isLoadingInitial ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg h-[360px] animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <p className="text-center text-[var(--text-secondary)] py-12">{t("feed.loadError")}</p>
          ) : posts.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">🐾</div>
              <p className="text-[var(--text-secondary)]">{activeTags.length > 0 ? t("feed.emptyFiltered") : t("feed.empty")}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-4 items-stretch">
              {posts.map((post) => (
                <CommunityPostCard
                  key={post.id}
                  post={post}
                  onOpen={setDetailsPost}
                  onEdit={(p) => { setEditPost(p); setComposeOpen(true); }}
                  onDeleted={removePost}
                  onReported={removePost}
                />
              ))}
            </div>
          )}

          <div ref={sentinelRef} className="h-10" />
          {isLoadingMore && <p className="text-center text-[var(--text-secondary)] py-4">…</p>}
        </div>
      </div>

      <CommunityComposeModal
        open={composeOpen}
        onClose={() => { setComposeOpen(false); setEditPost(null); }}
        tags={tags}
        editPost={editPost}
        onCreated={(p) => prependPost(p)}
        onUpdated={(p) => replacePost(p)}
      />

      <CommunityPostDetailsModal
        open={!!detailsPost}
        onClose={() => setDetailsPost(null)}
        post={detailsPost}
      />
    </>
  );
}

// SSR OG tags for shared ?post= links.
export async function getServerSideProps({ query }: any) {
  const postId = query?.post as string | undefined;
  if (!postId) return { props: { ogPost: null } };
  const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
  try {
    const r = await fetch(`${base}/v1/community/posts/${encodeURIComponent(postId)}`);
    if (!r.ok) return { props: { ogPost: null } };
    const data = await r.json();
    return { props: { ogPost: data?.post ?? null } };
  } catch {
    return { props: { ogPost: null } };
  }
}

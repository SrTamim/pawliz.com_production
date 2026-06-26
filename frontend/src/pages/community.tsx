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

      <main className="shell">
        <div className="page-head">
          <span className="eyebrow">{t("title")}</span>
          <h1>{t("subtitle")}</h1>
        </div>

        {/* Composer pill — highlighted primary CTA; click prompts login when logged out */}
        <button
          onClick={openCompose}
          className="glass compose-pill w-full flex items-center gap-3 text-left"
          style={{ padding: "14px 16px", borderRadius: "var(--pill)", marginBottom: 18 }}
        >
          {user?.profile_picture ? (
            <span className="avatar sm"><img src={getImageUrl(user.profile_picture) ?? undefined} alt="" /></span>
          ) : (
            <span className="avatar sm">{user?.name?.charAt(0).toUpperCase() || "?"}</span>
          )}
          <span className="muted">{t("composePrompt")}</span>
        </button>

        {/* Tag filter — segmented pills, full-bleed on mobile (square edges, no card bg) */}
        <div className="tag-strip sticky z-10 py-2" style={{ top: "var(--header-height)", marginBottom: 8 }}>
          <div className="tabs" role="tablist" style={{ maxWidth: "100%", overflowX: "auto", flexWrap: "nowrap" }}>
            <button
              role="tab"
              aria-selected={activeTags.length === 0}
              onClick={() => setActiveTags([])}
            >
              {t("filter.all")}
            </button>
            {tags.map((tg) => (
              <button
                key={tg.id}
                role="tab"
                aria-selected={activeTags.includes(tg.slug)}
                onClick={() => toggleTag(tg.slug)}
                style={{ whiteSpace: "nowrap" }}
              >
                {tg.label}
              </button>
            ))}
          </div>
          <p className="text-xs muted mt-1" style={{ marginLeft: 6 }}>
            {activeTags.length > 0 ? t("feed.window45") : t("feed.window20")}
          </p>
        </div>

        {/* Feed — equal-height card grid */}
        {isLoadingInitial ? (
          <div className="card-grid" style={{ marginTop: 8 }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="glass h-[360px] animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <p className="text-center muted py-12">{t("feed.loadError")}</p>
        ) : posts.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🐾</div>
            <p className="muted">{activeTags.length > 0 ? t("feed.emptyFiltered") : t("feed.empty")}</p>
          </div>
        ) : (
          <div className="card-grid items-stretch" style={{ marginTop: 8 }}>
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
        {isLoadingMore && <p className="text-center muted py-4">…</p>}
      </main>

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

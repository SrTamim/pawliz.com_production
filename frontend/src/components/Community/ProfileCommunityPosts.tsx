import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { communityAPI } from "../../lib/api";
import CommunityPostCard from "./CommunityPostCard";
import CommunityPostDetailsModal from "./CommunityPostDetailsModal";
import CommunityComposeModal from "./CommunityComposeModal";
import type { CommunityPost, CommunityTag } from "../../types";

/** The author's own community posts, shown on /profile (consistent with pets). */
export default function ProfileCommunityPosts({ userId }: { userId: number }) {
  const { t } = useTranslation("community");
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [tags, setTags] = useState<CommunityTag[]>([]);
  const [detailsPost, setDetailsPost] = useState<CommunityPost | null>(null);
  const [editPost, setEditPost] = useState<CommunityPost | null>(null);

  useEffect(() => {
    communityAPI.getUserPosts(userId).then((d: any) => setPosts(d.posts || [])).catch(() => {}).finally(() => setLoading(false));
    communityAPI.getTags().then((d: any) => setTags(d.tags || [])).catch(() => {});
  }, [userId]);

  if (loading) return null;

  return (
    <div style={{ marginBottom: 20 }}>
      <h2 style={{ margin: "0 0 18px", fontSize: 20, fontWeight: 800, color: "var(--text-primary)" }}>
        {t("profile.title")} ({posts.length})
      </h2>
      {posts.length === 0 ? (
        <p className="text-[var(--text-secondary)]">{t("profile.empty")}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch">
          {posts.map((post) => (
            <CommunityPostCard
              key={post.id}
              post={post}
              onOpen={setDetailsPost}
              onEdit={(p) => setEditPost(p)}
              onDeleted={(id) => setPosts((cur) => cur.filter((p) => p.id !== id))}
              onReported={(id) => setPosts((cur) => cur.filter((p) => p.id !== id))}
            />
          ))}
        </div>
      )}

      <CommunityPostDetailsModal open={!!detailsPost} onClose={() => setDetailsPost(null)} post={detailsPost} />
      <CommunityComposeModal
        open={!!editPost}
        onClose={() => setEditPost(null)}
        tags={tags}
        editPost={editPost}
        onUpdated={(p) => { setPosts((cur) => cur.map((x) => (x.id === p.id ? p : x))); setEditPost(null); }}
      />
    </div>
  );
}

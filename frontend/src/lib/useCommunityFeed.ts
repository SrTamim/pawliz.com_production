import { useCallback, useMemo } from "react";
import useSWRInfinite from "swr/infinite";
import { communityAPI } from "./api";
import type { CommunityPost } from "../types";

interface FeedPage {
  posts: CommunityPost[];
  next_cursor: string | null;
  has_more: boolean;
}

const PAGE_LIMIT = 10;

/**
 * Keyset-paginated community feed via SWR infinite. The cursor for page N comes
 * from page N-1's `next_cursor`. Tags drive the server's 20/45-day window.
 *
 * The mutate helpers (prepend/replace/remove) edit the cached pages in place so
 * an optimistic create / edit / delete / report-hide is reflected immediately
 * in an open scroll without a full refetch.
 */
export function useCommunityFeed(tags: string[]) {
  const tagKey = tags.slice().sort().join(",");

  const getKey = useCallback(
    (pageIndex: number, previousPage: FeedPage | null) => {
      if (previousPage && !previousPage.has_more) return null; // reached the end
      const cursor = pageIndex === 0 ? null : previousPage?.next_cursor;
      if (pageIndex > 0 && !cursor) return null;
      return ["community-feed", tagKey, cursor || ""] as const;
    },
    [tagKey],
  );

  const fetcher = useCallback(
    ([, , cursor]: readonly [string, string, string]) =>
      communityAPI.getFeed({ tags, cursor: cursor || null, limit: PAGE_LIMIT }),
    [tags],
  );

  const swr = useSWRInfinite<FeedPage>(getKey, fetcher, {
    revalidateFirstPage: true,
    revalidateOnFocus: true,
  });

  const { data, size, setSize, mutate, isValidating } = swr;

  const posts = useMemo(() => (data ? data.flatMap((p) => p.posts) : []), [data]);
  const hasMore = data ? data[data.length - 1]?.has_more ?? false : true;
  const isLoadingInitial = !data && !swr.error;
  const isLoadingMore = isValidating && !!data && size > data.length;

  const loadMore = useCallback(() => {
    if (hasMore) setSize((s) => s + 1);
  }, [hasMore, setSize]);

  // ── In-place cache helpers ────────────────────────────────────────────────
  const prependPost = useCallback(
    (post: CommunityPost) => {
      mutate((pages) => {
        if (!pages || pages.length === 0) return [{ posts: [post], next_cursor: null, has_more: false }];
        const [first, ...rest] = pages;
        return [{ ...first, posts: [post, ...first.posts] }, ...rest];
      }, false);
    },
    [mutate],
  );

  const replacePost = useCallback(
    (post: CommunityPost) => {
      mutate(
        (pages) => pages?.map((pg) => ({ ...pg, posts: pg.posts.map((p) => (p.id === post.id ? post : p)) })),
        false,
      );
    },
    [mutate],
  );

  const removePost = useCallback(
    (postId: number) => {
      mutate(
        (pages) => pages?.map((pg) => ({ ...pg, posts: pg.posts.filter((p) => p.id !== postId) })),
        false,
      );
    },
    [mutate],
  );

  return {
    posts,
    error: swr.error,
    isLoadingInitial,
    isLoadingMore,
    hasMore,
    loadMore,
    refresh: () => mutate(),
    prependPost,
    replacePost,
    removePost,
  };
}

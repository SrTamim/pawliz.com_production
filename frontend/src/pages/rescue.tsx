import { useEffect } from "react";
import { useRouter } from "next/router";

export default function RescueRedirect() {
  const router = useRouter();

  useEffect(() => {
    if (!router.isReady) return;
    const { post, type } = router.query;
    const query: any = { tab: "rescue" };
    if (post) query.post = post;
    if (type) query.type = type;
    router.replace({ pathname: "/help-board", query });
  }, [router.isReady]);

  return null;
}

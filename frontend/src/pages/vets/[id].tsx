import { useRouter } from "next/router";
import Head from "next/head";
import dynamic from "next/dynamic";
import { getImageUrl } from "../../lib/api";

// VetDetailPage uses Leaflet-free UI but pulls heavy sub-deps; load client-side
// only (same as the home page does) to keep the SSR HTML lean. Sections still
// render from initialVet on first paint via the fullPage layout.
const VetDetailPage = dynamic(() => import("../../components/Vet/VetDetailPage"), {
  ssr: false,
});

export default function PublicVetProfile({ initialVet = null }: any) {
  const router = useRouter();
  const { id } = router.query;

  const ogImage = (() => {
    const raw = initialVet?.cover_image || initialVet?.image;
    return raw ? getImageUrl(raw) : null;
  })();

  const title = initialVet ? `${initialVet.name} — Pawliz` : "Vet Profile — Pawliz";
  const description = initialVet
    ? `${initialVet.name}${initialVet.location_name ? ` in ${initialVet.location_name}` : ""} — view this veterinary profile, reviews & contact on Pawliz.`
    : "View this veterinary profile on Pawliz.";

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} key="description" />
        <meta property="og:title" content={title} key="og:title" />
        <meta property="og:description" content={description} key="og:description" />
        {ogImage && <meta property="og:image" content={ogImage} key="og:image" />}
        {ogImage && <meta name="twitter:image" content={ogImage} key="twitter:image" />}
      </Head>
      <VetDetailPage
        vetId={id}
        open
        fullPage
        initialVet={initialVet}
        onClose={() => router.push("/")}
        onAuthRequired={() => router.push("/")}
      />
    </>
  );
}

// SSR the PUBLIC vet so crawlers get real OG tags. Fail-safe: any error returns
// { initialVet: null } and VetDetailPage's client effect still fetches via
// vetsAPI.getById — same data path as the home-page modal. Mirrors pet/[petId].
export async function getServerSideProps({ params }: any) {
  const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
  try {
    const r = await fetch(`${base}/v1/vets/${encodeURIComponent(params.id)}`);
    if (!r.ok) return { props: { initialVet: null } };
    const data = await r.json();
    return { props: { initialVet: data.vet || null } };
  } catch {
    return { props: { initialVet: null } };
  }
}

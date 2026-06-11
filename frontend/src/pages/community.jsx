import Head from "next/head";
import Link from "next/link";
import { useTranslation } from "react-i18next";

export default function CommunityPage() {
  const { t } = useTranslation("home");
  return (
    <>
      <Head>
        <title>Community — Coming Soon | Pawliz</title>
        <meta
          name="description"
          content="The Pawliz community hub — connect with pet owners and vets across Bangladesh. Coming soon."
          key="description"
        />
        <meta property="og:title" content="Pawliz Community — Coming Soon" key="og:title" />
        <meta
          property="og:description"
          content="The Pawliz community hub — connect with pet owners and vets across Bangladesh. Coming soon."
          key="og:description"
        />
      </Head>
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-4 text-center">
        <div className="max-w-md w-full">
          <div className="text-7xl mb-6 select-none">🐾</div>
          <h1 className="text-4xl font-bold text-white font-syne mb-3">
            {t("community.title")}
          </h1>
          <div className="inline-block bg-accent/10 border border-accent/30 text-accent text-sm font-semibold px-4 py-1.5 rounded-full mb-6">
            {t("community.comingSoon")}
          </div>
          <p className="text-gray-400 text-base leading-relaxed mb-8">
            {t("community.description")}
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-accent hover:bg-accent/90 text-gray-950 font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            {t("community.backHome")}
          </Link>
        </div>
      </div>
    </>
  );
}

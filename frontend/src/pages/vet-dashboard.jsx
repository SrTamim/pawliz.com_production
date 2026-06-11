import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/router";
import Head from "next/head";
import { useAuth } from "../context/AuthContext";
import { vetDashboardAPI } from "../lib/api";
import VetDashboardLayout from "../components/VetDashboard/VetDashboardLayout";
import VetOverview from "../components/VetDashboard/VetOverview";
import VetProfileDetails from "../components/VetDashboard/VetProfileDetails";
import VetReviews from "../components/VetDashboard/VetReviews";

export default function VetDashboardPage() {
  const { user, loading: authLoading, isVet } = useAuth();
  const router = useRouter();
  const { t } = useTranslation("vet");
  const [section, setSection] = useState("overview");
  const [data, setData] = useState(null);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.replace("/");
      } else if (!isVet) {
        router.replace(user.role === "admin" ? "/admin" : "/profile");
      }
    }
  }, [user, authLoading, isVet, router]);

  const fetchProfile = useCallback(async () => {
    if (!isVet) return;
    try {
      setLoadingData(true);
      const res = await vetDashboardAPI.getProfile();
      setData(res);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingData(false);
    }
  }, [isVet]);

  const silentRefresh = useCallback(async () => {
    if (!isVet) return;
    try {
      const res = await vetDashboardAPI.getProfile();
      setData(res);
    } catch {
      // silent
    }
  }, [isVet]);

  useEffect(() => {
    if (isVet) fetchProfile();
  }, [isVet, fetchProfile]);

  const claimed_vet_status = data?.claimed_vet?.status;
  const isClaimPending = claimed_vet_status === "pending_claim";

  useEffect(() => {
    if (isClaimPending && (section === "profile" || section === "reviews")) {
      setSection("overview");
    }
  }, [isClaimPending, section]);

  if (authLoading || (!user && !authLoading)) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-page)", color: "var(--text-secondary)" }}>
        {t("common:status.loading")}
      </div>
    );
  }

  if (user && !isVet) return null;

  if (loadingData) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-page)", color: "var(--text-secondary)" }}>
        {t("dashboard.loadingDashboard")}
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-page)", color: "#ff4f6a" }}>
        {error}
      </div>
    );
  }

  const { vet, qualifications, documents, clinic_contacts, clinic_vets, reviews, claimed_vet, owner } = data || {};

  return (
    <>
      <Head>
        <title>{vet?.name || "Vet Dashboard"} — Pawliz</title>
      </Head>
      <VetDashboardLayout
        activeSection={section}
        onSectionChange={setSection}
        vet={vet}
        claimedVet={claimed_vet}
      >
        {section === "overview" && (
          <VetOverview
            vet={vet}
            qualifications={qualifications}
            documents={documents}
            clinicVets={clinic_vets}
            clinicContacts={clinic_contacts}
            reviews={reviews}
            claimedVet={claimed_vet}
            onSectionChange={setSection}
            onRefresh={silentRefresh}
          />
        )}
        {section === "profile" && (
          <VetProfileDetails
            vet={vet}
            qualifications={qualifications}
            documents={documents}
            clinicVets={clinic_vets}
            clinicContacts={clinic_contacts}
            owner={owner}
            onRefresh={silentRefresh}
          />
        )}
        {section === "reviews" && (
          <VetReviews reviews={reviews} />
        )}
      </VetDashboardLayout>
    </>
  );
}

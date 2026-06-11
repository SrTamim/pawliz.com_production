import Head from "next/head";
import { useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../context/AuthContext";
import AdminDashboard from "../components/Admin/AdminDashboard";

export default function AdminPage() {
  const { user, loading, isStaff } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!user || !isStaff)) {
      router.replace("/");
    }
  }, [user, loading, isStaff]);

  if (loading || !user || !isStaff) return null;

  return (
    <>
      <Head>
        <title>Admin Panel — Pawliz</title>
      </Head>
      <AdminDashboard />
    </>
  );
}

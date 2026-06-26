import { useState, useEffect, useRef } from "react";
import { adminAPI, adminCommunityAPI, vetsAPI, reviewsAPI, donationsAPI, getImageUrl, API_SERVER } from "../../../lib/api";
import { Button, Loading, EmptyState, Alert, Badge, Pagination, Input, Spinner } from "../../UI";
import { useToast } from "../../../context/ToastContext";
import { useAuth } from "../../../context/AuthContext";
import WeeklyScheduleEditor, { buildScheduleFromLegacy } from "../../VetDashboard/WeeklyScheduleEditor";
import { SectionTitle, TableWrapper, Tr, Th, Td, StatCard, MiniBarChart, DonutChart, getAdminImageUrl } from "./primitives";

export default function ReviewsSection() {
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const searchRef = useRef(false);
  const { toast } = useToast();
  const { can } = useAuth();
  const canDelete = can("reviews.delete");
  const LIMIT = 15;

  const load = (p = page, s = search) => {
    setLoading(true);
    reviewsAPI
      .getAll({ page: p, limit: LIMIT, ...(s ? { search: s } : {}) })
      .then((r: any) => {
        setReviews(r.reviews || []);
        setTotal(r.total || 0);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load(page);
  }, [page]);

  useEffect(() => {
    if (!searchRef.current) { searchRef.current = true; return; }
    const t = setTimeout(() => { setPage(1); load(1, search); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const handleDelete = async (id: any) => {
    if (!confirm("Delete this review?")) return;
    try {
      await reviewsAPI.delete(id);
      toast("Review deleted");
      load();
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  return (
    <div>
      <SectionTitle>Manage Reviews</SectionTitle>
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <Input value={search} onChange={(e: any) => setSearch(e.target.value)} placeholder="Search by user, clinic or comment..." style={{ flex: 1 }} />
      </div>
      {loading ? (
        <Loading />
      ) : (
        <>
          <TableWrapper title={`All Reviews (${total})`}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <Tr header>
                  <Th>User</Th>
                  <Th>Clinic</Th>
                  <Th>Rating</Th>
                  <Th>Comment</Th>
                  <Th>Date</Th>
                  {canDelete && <Th>Action</Th>}
                </Tr>
              </thead>
              <tbody>
                {reviews.map((r: any) => (
                  <Tr key={r.id}>
                    <Td bold>{r.user_name}</Td>
                    <Td>{r.vet_name}</Td>
                    <Td>
                      <span style={{ color: "var(--gold)" }}>
                        {"★".repeat(r.rating)}
                        {"☆".repeat(5 - r.rating)}
                      </span>
                    </Td>
                    <Td
                      style={{
                        maxWidth: 200,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {r.comment || "–"}
                    </Td>
                    <Td>
                      {new Date(r.created_at).toLocaleDateString("en-BD")}
                    </Td>
                    {canDelete && (
                      <Td>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleDelete(r.id)}
                        >
                          Delete
                        </Button>
                      </Td>
                    )}
                  </Tr>
                ))}
              </tbody>
            </table>
          </TableWrapper>
          <Pagination
            page={page}
            total={total}
            limit={LIMIT}
            onChange={(p: any) => {
              setPage(p);
              load(p);
            }}
          />
        </>
      )}
    </div>
  );
}
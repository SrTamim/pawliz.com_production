import { useState, useEffect, useRef } from "react";
import { adminAPI, adminCommunityAPI, vetsAPI, reviewsAPI, donationsAPI, getImageUrl, API_SERVER } from "../../../lib/api";
import { Button, Loading, EmptyState, Alert, Badge, Pagination, Input, Spinner } from "../../UI";
import { useToast } from "../../../context/ToastContext";
import { useAuth } from "../../../context/AuthContext";
import WeeklyScheduleEditor, { buildScheduleFromLegacy } from "../../VetDashboard/WeeklyScheduleEditor";
import { SectionTitle, TableWrapper, Tr, Th, Td, StatCard, MiniBarChart, DonutChart, getAdminImageUrl } from "./primitives";

export default function ClaimRequestsSection() {
  const { toast } = useToast();
  const { can } = useAuth();
  const canAct = can("claim-requests.edit");
  const [claims, setClaims] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<any>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await adminAPI.getClaimRequests();
      setClaims(data.claims);
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handle = async (vetId: any, action: any) => {
    setActing(vetId);
    try {
      if (action === "approve") await adminAPI.approveClaimRequest(vetId);
      else await adminAPI.rejectClaimRequest(vetId);
      toast(action === "approve" ? "Claim approved" : "Claim rejected", "success");
      load();
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setActing(null);
    }
  };

  if (loading) return <Loading />;
  if (!claims.length) return <EmptyState title="No pending claim requests" />;

  return (
    <TableWrapper title="Pending Claim Requests">
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <Th>Vet / Clinic</Th>
            <Th>Requested By</Th>
            <Th>Contact</Th>
            <Th>Requested At</Th>
            <Th>Documents</Th>
            {canAct && <Th>Actions</Th>}
          </tr>
        </thead>
        <tbody>
          {claims.map((c: any) => (
            <Tr key={c.id}>
              <Td>{c.name || c.clinic_name}</Td>
              <Td>{c.requester_name}</Td>
              <Td>
                {c.requester_phone}
                <br />
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{c.email}</span>
              </Td>
              <Td>{new Date(c.claim_requested_at).toLocaleDateString()}</Td>
              <Td>
                {c.documents?.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {c.documents.map((d: any, i: any) => (
                      <a
                        key={i}
                        href={`${API_SERVER}${d.file_path}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ fontSize: 12, color: "var(--accent)", textDecoration: "none" }}
                      >
                        {d.doc_type.replace(/_/g, " ")} — {d.original_name}
                      </a>
                    ))}
                  </div>
                ) : (
                  <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>No docs</span>
                )}
              </Td>
              {canAct && (
                <Td>
                  <div style={{ display: "flex", gap: 6 }}>
                    <Button size="sm" variant="accent" loading={acting === c.id} onClick={() => handle(c.id, "approve")}>Approve</Button>
                    <Button size="sm" variant="danger" loading={acting === c.id} onClick={() => handle(c.id, "reject")}>Reject</Button>
                  </div>
                </Td>
              )}
            </Tr>
          ))}
        </tbody>
      </table>
    </TableWrapper>
  );
}
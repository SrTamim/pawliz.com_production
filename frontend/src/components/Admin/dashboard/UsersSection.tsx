import { useState, useEffect, useRef } from "react";
import { adminAPI, adminCommunityAPI, vetsAPI, reviewsAPI, donationsAPI, getImageUrl, API_SERVER } from "../../../lib/api";
import { Button, Loading, EmptyState, Alert, Badge, Pagination, Input, Spinner } from "../../UI";
import { useToast } from "../../../context/ToastContext";
import { useAuth } from "../../../context/AuthContext";
import WeeklyScheduleEditor, { buildScheduleFromLegacy } from "../../VetDashboard/WeeklyScheduleEditor";
import { SectionTitle, TableWrapper, Tr, Th, Td, StatCard, MiniBarChart, DonutChart, getAdminImageUrl } from "./primitives";

export default function UsersSection() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const searchRef = useRef(false);
  const [resetTarget, setResetTarget] = useState<any>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetting, setResetting] = useState(false);
  const [roleOptions, setRoleOptions] = useState<any[]>([]);
  const { toast } = useToast();
  const { can } = useAuth();
  const LIMIT = 15;

  // Per-page UI permissions (admin → all true via can()).
  const canReset = can("users.reset_password");
  const canDeactivate = can("users.deactivate");
  const canRole = can("users.role");
  const showActions = canReset || canDeactivate || canRole;

  // Assignable roles for the inline role dropdown. admin is intentionally
  // excluded — it cannot be assigned via the dashboard (backend also rejects it).
  useEffect(() => {
    if (!canRole) return;
    adminAPI
      .getRoles()
      .then((r: any) => setRoleOptions((r.roles || []).filter((x: any) => x.name !== "admin")))
      .catch(() => {});
  }, [canRole]);

  const handleAssignRole = async (id: any, role: any) => {
    try {
      await adminAPI.assignUserRole(id, role);
      toast("Role updated", "success");
      load();
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  const load = (p = page, s = search) => {
    setLoading(true);
    adminAPI
      .getUsers({ page: p, limit: LIMIT, ...(s ? { search: s } : {}) })
      .then((r: any) => {
        setUsers(r.users || []);
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

  const handleDeactivate = async (id: any) => {
    if (!confirm("Deactivate this user?")) return;
    try {
      await adminAPI.deleteUser(id);
      toast("User deactivated");
      load();
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  const handleActivate = async (id: any) => {
    if (!confirm("Activate this user?")) return;
    try {
      await adminAPI.updateUser(id, { is_active: true });
      toast("User activated");
      load();
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast("Password must be at least 6 characters", "error");
      return;
    }
    setResetting(true);
    try {
      await adminAPI.resetUserPassword(resetTarget.id, newPassword);
      toast(`Password reset for ${resetTarget.name}`, "success");
      setResetTarget(null);
      setNewPassword("");
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setResetting(false);
    }
  };

  return (
    <div>
      <SectionTitle>Manage Users</SectionTitle>
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <Input value={search} onChange={(e: any) => setSearch(e.target.value)} placeholder="Search by name, phone or email..." style={{ flex: 1 }} />
      </div>
      {loading ? (
        <Loading />
      ) : (
        <>
          <TableWrapper title={`All Users (${total})`}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <Tr header>
                  <Th>Name</Th>
                  <Th>Phone</Th>
                  <Th>Email</Th>
                  <Th>Role</Th>
                  <Th>Pets</Th>
                  <Th>Status</Th>
                  {showActions && <Th>Actions</Th>}
                </Tr>
              </thead>
              <tbody>
                {users.map((u: any) => (
                  <Tr key={u.id}>
                    <Td bold>{u.name}</Td>
                    <Td>{u.phone}</Td>
                    <Td>{u.email || "–"}</Td>
                    <Td>
                      <Badge color={u.role === "admin" ? "gold" : "accent"}>
                        {u.role}
                      </Badge>
                    </Td>
                    <Td>{u.pet_count}</Td>
                    <Td>
                      <Badge color={u.is_active ? "accent" : "danger"}>
                        {u.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </Td>
                    {showActions && (
                      <Td>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                          {canReset && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => { setResetTarget(u); setNewPassword(""); }}
                            >
                              🔑 Reset PW
                            </Button>
                          )}
                          {canRole && u.role !== "admin" && (
                            <select
                              className="input-field"
                              value={u.role}
                              onChange={(e: any) => handleAssignRole(u.id, e.target.value)}
                              style={{ height: 30, padding: "0 8px", fontSize: 12, width: "auto" }}
                              title="Assign role"
                            >
                              {/* Ensure the user's current role is selectable even if not in options */}
                              {!roleOptions.find((r: any) => r.name === u.role) && (
                                <option value={u.role}>{u.role}</option>
                              )}
                              {roleOptions.map((r: any) => (
                                <option key={r.name} value={r.name}>{r.name}</option>
                              ))}
                            </select>
                          )}
                          {canDeactivate && u.role !== "admin" &&
                            (u.is_active ? (
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => handleDeactivate(u.id)}
                              >
                                Deactivate
                              </Button>
                            ) : (
                              <Button
                                variant="accent"
                                size="sm"
                                onClick={() => handleActivate(u.id)}
                              >
                                Activate
                              </Button>
                            ))}
                        </div>
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

      {/* Password Reset Modal */}
      {resetTarget && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 4000, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setResetTarget(null)}>
          <div onClick={(e: any) => e.stopPropagation()} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 28, width: "100%", maxWidth: 400 }}>
            <h3 style={{ fontFamily: "Roboto, sans-serif", fontWeight: 700, marginBottom: 8 }}>Reset Password</h3>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>
              Set new password for <strong style={{ color: "var(--text-primary)" }}>{resetTarget.name}</strong> ({resetTarget.phone})
            </p>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6, textTransform: "uppercase" }}>New Password</label>
              <input
                type="password"
                className="input-field"
                value={newPassword}
                onChange={(e: any) => setNewPassword(e.target.value)}
                placeholder="Min. 6 characters"
                autoFocus
              />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <Button variant="primary" onClick={handleResetPassword} disabled={resetting} style={{ flex: 1 }}>
                {resetting ? "Saving..." : "Set Password"}
              </Button>
              <Button variant="ghost" onClick={() => setResetTarget(null)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
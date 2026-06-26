import { useState, useEffect, useRef } from "react";
import { adminAPI, adminCommunityAPI, vetsAPI, reviewsAPI, donationsAPI, getImageUrl, API_SERVER } from "../../../lib/api";
import { Button, Loading, EmptyState, Alert, Badge, Pagination, Input, Spinner } from "../../UI";
import { useToast } from "../../../context/ToastContext";
import { useAuth } from "../../../context/AuthContext";
import WeeklyScheduleEditor, { buildScheduleFromLegacy } from "../../VetDashboard/WeeklyScheduleEditor";
import { SectionTitle, TableWrapper, Tr, Th, Td, StatCard, MiniBarChart, DonutChart, getAdminImageUrl } from "./primitives";

export default function RolesSection() {
  const [roles, setRoles] = useState<any[]>([]);
  const [registry, setRegistry] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null); // role object or {} for create
  const { toast } = useToast();

  const load = () => {
    setLoading(true);
    Promise.all([adminAPI.getRoles(), adminAPI.getPermissionRegistry()])
      .then(([r, reg]) => {
        setRoles(r.roles || []);
        setRegistry(reg.pages || []);
      })
      .catch((e: any) => toast(e.message, "error"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (role: any) => {
    if (!confirm(`Delete role "${role.name}"? This cannot be undone.`)) return;
    try {
      await adminAPI.deleteRole(role.name);
      toast("Role deleted");
      load();
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  const pageCount = (role: any) =>
    Array.isArray(role.permissions?.pages) ? role.permissions.pages.length : 0;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <SectionTitle>Role Manager</SectionTitle>
        <Button variant="accent" onClick={() => setEditing({})}>+ Create Role</Button>
      </div>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: -14, marginBottom: 20 }}>
        Create roles with specific dashboard page access. Assign them to users in Manage Users.
        The <strong>admin</strong> role has full access and is managed directly in the database.
      </p>
      {loading ? (
        <Loading />
      ) : (
        <TableWrapper title={`All Roles (${roles.length})`}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <Tr header>
                <Th>Name</Th>
                <Th>Description</Th>
                <Th>Pages</Th>
                <Th>Users</Th>
                <Th>Actions</Th>
              </Tr>
            </thead>
            <tbody>
              {roles.map((r: any) => (
                <Tr key={r.name}>
                  <Td bold>
                    {r.name}{" "}
                    {r.is_system && <Badge color="gray">System</Badge>}
                  </Td>
                  <Td>{r.description || "–"}</Td>
                  <Td>{r.is_system && r.name === "admin" ? "all" : pageCount(r)}</Td>
                  <Td>{r.user_count}</Td>
                  <Td>
                    {r.is_system ? (
                      <span style={{ color: "var(--text-muted)", fontSize: 12 }}>—</span>
                    ) : (
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <Button variant="outline" size="sm" onClick={() => setEditing(r)}>
                          Edit
                        </Button>
                        <Button variant="danger" size="sm" onClick={() => handleDelete(r)}>
                          Delete
                        </Button>
                      </div>
                    )}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </table>
        </TableWrapper>
      )}

      {editing && (
        <RoleEditorModal
          role={editing.name ? editing : null}
          registry={registry}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}
function RoleEditorModal({ role, registry, onClose, onSaved }: any) {
  const isEdit = !!role;
  const { toast } = useToast();
  const [name, setName] = useState(role?.name || "");
  const [description, setDescription] = useState(role?.description || "");
  const [pages, setPages] = useState(
    () => new Set(role?.permissions?.pages || []),
  );
  const [ui, setUi] = useState(() => new Set(role?.permissions?.ui || []));
  const [saving, setSaving] = useState(false);

  const togglePage = (key: any) => {
    setPages((prev: any) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        // Drop this page's UI flags when the page is removed.
        const pg = registry.find((p: any) => p.key === key);
        if (pg) setUi((u: any) => {
          const nu = new Set(u);
          (pg.ui || []).forEach((f: any) => nu.delete(f.key));
          return nu;
        });
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const toggleUi = (flagKey: any) => {
    setUi((prev: any) => {
      const next = new Set(prev);
      next.has(flagKey) ? next.delete(flagKey) : next.add(flagKey);
      return next;
    });
  };

  const save = async () => {
    const payload = {
      description,
      permissions: { pages: [...pages], ui: [...ui] },
    };
    setSaving(true);
    try {
      if (isEdit) {
        await adminAPI.updateRole(role.name, payload);
        toast("Role updated", "success");
      } else {
        await adminAPI.createRole({ name: name.trim().toLowerCase(), ...payload });
        toast("Role created", "success");
      }
      onSaved();
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 4000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={onClose}
    >
      <div
        onClick={(e: any) => e.stopPropagation()}
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 28, width: "100%", maxWidth: 520, maxHeight: "85vh", overflowY: "auto" }}
      >
        <h3 style={{ fontFamily: "Roboto, sans-serif", fontWeight: 700, marginBottom: 18 }}>
          {isEdit ? `Edit Role: ${role.name}` : "Create Role"}
        </h3>

        {!isEdit && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6, textTransform: "uppercase" }}>
              Role Name
            </label>
            <input
              className="input-field"
              value={name}
              onChange={(e: any) => setName(e.target.value)}
              placeholder="e.g. manager"
              autoFocus
            />
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              Lowercase letters, digits, _ or - (2–50 chars).
            </span>
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6, textTransform: "uppercase" }}>
            Description
          </label>
          <input
            className="input-field"
            value={description}
            onChange={(e: any) => setDescription(e.target.value)}
            placeholder="Short description"
          />
        </div>

        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 10, textTransform: "uppercase" }}>
          Page Access & Permissions
        </label>
        <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 12, marginBottom: 22 }}>
          {registry.map((pg: any) => {
            const pageOn = pages.has(pg.key);
            return (
              <div key={pg.key} style={{ marginBottom: 10 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
                  <input type="checkbox" checked={pageOn} onChange={() => togglePage(pg.key)} />
                  {pg.icon} {pg.label}
                </label>
                {(pg.ui || []).length > 0 && (
                  <div style={{ paddingLeft: 26, marginTop: 4, display: "flex", flexDirection: "column", gap: 4 }}>
                    {pg.ui.map((f: any) => (
                      <label
                        key={f.key}
                        style={{ display: "flex", alignItems: "center", gap: 8, cursor: pageOn ? "pointer" : "not-allowed", fontSize: 13, color: pageOn ? "var(--text-secondary)" : "var(--text-muted)", opacity: pageOn ? 1 : 0.5 }}
                      >
                        <input
                          type="checkbox"
                          disabled={!pageOn}
                          checked={ui.has(f.key)}
                          onChange={() => toggleUi(f.key)}
                        />
                        {f.label}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <Button variant="accent" onClick={save} disabled={saving || (!isEdit && !name.trim())} style={{ flex: 1 }}>
            {saving ? "Saving..." : isEdit ? "Save Changes" : "Create Role"}
          </Button>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </div>
  );
}
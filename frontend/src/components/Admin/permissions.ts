// ─── RBAC permission registry (frontend mirror) ──────────────────────────────
//
// Mirror of backend/utils/permissions.js. Drives sidebar nav, the role-editor
// checkbox tree, and per-page UI gating. Keep in sync with the backend file.
//
// `key` matches the AdminDashboard `section` id. `adminOnly` pages (Role Manager)
// are shown in the sidebar for admins (superuser) but are never grantable to a
// custom role — the role editor pulls its checkbox list from the backend
// /admin/roles/registry endpoint, which already excludes them.
//
// `category` is frontend-only presentation metadata: it groups the sidebar tabs
// under the headings defined in PAGE_CATEGORIES below. It is NOT part of the RBAC
// contract and is ignored by the backend / role registry. Do not touch `key` or
// `ui` values — those must stay byte-identical to the backend mirror.

// Sidebar category headings, in display order. Each page's `category` field
// references one of these `id`s. A heading only renders when ≥1 of its pages is
// visible to the current user (see AdminDashboard sidebar render).
export const PAGE_CATEGORIES = [
  { id: "dashboard", label: "Dashboard" },
  { id: "users", label: "Users" },
  { id: "vet", label: "Vet & Clinic" },
  { id: "pet", label: "Pet" },
  { id: "community", label: "Community" },
  { id: "settings", label: "Website Settings" },
];

export const PAGES = [
  // ── Dashboard ──
  { key: "overview", icon: "📊", label: "Overview", ui: [], category: "dashboard" },

  // ── Users ──
  {
    key: "users", icon: "👥", label: "Manage Users", category: "users",
    ui: [
      { key: "users.reset_password", label: "Reset password" },
      { key: "users.deactivate", label: "Deactivate / Activate" },
      { key: "users.role", label: "Assign role" },
    ],
  },

  // ── Vet & Clinic ──
  {
    key: "vets", icon: "🏥", label: "Manage Vets", category: "vet",
    ui: [
      { key: "vets.create", label: "Add Vet Clinic" },
      { key: "vets.edit", label: "Edit" },
      { key: "vets.approve", label: "Approve / Reject" },
      { key: "vets.delete", label: "Deactivate / Delete" },
    ],
  },
  {
    key: "claim-requests", icon: "📋", label: "Claim Requests", category: "vet",
    ui: [{ key: "claim-requests.edit", label: "Approve / reject claims" }],
  },
  {
    key: "reviews", icon: "⭐", label: "Reviews", category: "vet",
    ui: [{ key: "reviews.delete", label: "Delete review (Actions column)" }],
  },

  // ── Pet ──
  {
    key: "pets", icon: "🐾", label: "Manage Pets", category: "pet",
    ui: [
      { key: "pets.edit", label: "Edit" },
      { key: "pets.delete", label: "Delete (Actions column)" },
    ],
  },
  { key: "lost-pets-mgmt", icon: "🐕", label: "Lost Pets", ui: [], category: "pet" },
  { key: "adoptable-pets", icon: "🏡", label: "Adoptable Pets", ui: [], category: "pet" },
  {
    key: "found-pets", icon: "🔍", label: "Found Reports", category: "pet",
    ui: [
      { key: "found-pets.edit", label: "Edit" },
      { key: "found-pets.delete", label: "Delete (Actions column)" },
    ],
  },
  {
    key: "rescue-pets", icon: "🚑", label: "Rescue Reports", category: "pet",
    ui: [
      { key: "rescue-pets.edit", label: "Edit" },
      { key: "rescue-pets.delete", label: "Delete (Actions column)" },
    ],
  },

  // ── Community ──
  {
    key: "comments", icon: "🚩", label: "Comments", category: "community",
    ui: [{ key: "comments.delete", label: "Delete / dismiss (Actions column)" }],
  },
  {
    key: "community-posts", icon: "📰", label: "Reported Posts", category: "community",
    ui: [{ key: "community-posts.delete", label: "Delete / dismiss (Actions column)" }],
  },

  // ── Website Settings ──
  {
    key: "donation", icon: "💝", label: "Donation", category: "settings",
    ui: [{ key: "donation.edit", label: "Edit donation settings" }],
  },
  {
    key: "settings", icon: "🎨", label: "Settings", category: "settings",
    ui: [{ key: "settings.edit", label: "Edit site settings" }],
  },
  {
    key: "sms-settings", icon: "📱", label: "SMS Update", category: "settings",
    ui: [{ key: "sms-settings.edit", label: "Edit SMS settings" }],
  },
  { key: "roles", icon: "🛡️", label: "Role Manager", ui: [], adminOnly: true, category: "settings" },
];

// ─── RBAC permission registry (frontend mirror) ──────────────────────────────
//
// Mirror of backend/utils/permissions.js. Drives sidebar nav, the role-editor
// checkbox tree, and per-page UI gating. Keep in sync with the backend file.
//
// `key` matches the AdminDashboard `section` id. `adminOnly` pages (Role Manager)
// are shown in the sidebar for admins (superuser) but are never grantable to a
// custom role — the role editor pulls its checkbox list from the backend
// /admin/roles/registry endpoint, which already excludes them.

export const PAGES = [
  { key: "overview", icon: "📊", label: "Overview", ui: [] },
  {
    key: "vets", icon: "🏥", label: "Manage Vets",
    ui: [
      { key: "vets.create", label: "Add Vet Clinic" },
      { key: "vets.edit", label: "Edit" },
      { key: "vets.approve", label: "Approve / Reject" },
      { key: "vets.delete", label: "Deactivate / Delete" },
    ],
  },
  {
    key: "claim-requests", icon: "📋", label: "Claim Requests",
    ui: [{ key: "claim-requests.edit", label: "Approve / reject claims" }],
  },
  {
    key: "users", icon: "👥", label: "Manage Users",
    ui: [
      { key: "users.reset_password", label: "Reset password" },
      { key: "users.deactivate", label: "Deactivate / Activate" },
      { key: "users.role", label: "Assign role" },
    ],
  },
  {
    key: "pets", icon: "🐾", label: "Manage Pets",
    ui: [
      { key: "pets.edit", label: "Edit" },
      { key: "pets.delete", label: "Delete (Actions column)" },
    ],
  },
  { key: "lost-pets-mgmt", icon: "🐕", label: "Lost Pets", ui: [] },
  { key: "adoptable-pets", icon: "🏡", label: "Adoptable Pets", ui: [] },
  {
    key: "found-pets", icon: "🔍", label: "Found Reports",
    ui: [
      { key: "found-pets.edit", label: "Edit" },
      { key: "found-pets.delete", label: "Delete (Actions column)" },
    ],
  },
  {
    key: "rescue-pets", icon: "🚑", label: "Rescue Reports",
    ui: [
      { key: "rescue-pets.edit", label: "Edit" },
      { key: "rescue-pets.delete", label: "Delete (Actions column)" },
    ],
  },
  {
    key: "reviews", icon: "⭐", label: "Reviews",
    ui: [{ key: "reviews.delete", label: "Delete review (Actions column)" }],
  },
  {
    key: "donation", icon: "💝", label: "Donation",
    ui: [{ key: "donation.edit", label: "Edit donation settings" }],
  },
  {
    key: "comments", icon: "🚩", label: "Comments",
    ui: [{ key: "comments.delete", label: "Delete / dismiss (Actions column)" }],
  },
  {
    key: "settings", icon: "🎨", label: "Settings",
    ui: [{ key: "settings.edit", label: "Edit site settings" }],
  },
  {
    key: "sms-settings", icon: "📱", label: "SMS Update",
    ui: [{ key: "sms-settings.edit", label: "Edit SMS settings" }],
  },
  { key: "roles", icon: "🛡️", label: "Role Manager", ui: [], adminOnly: true },
];

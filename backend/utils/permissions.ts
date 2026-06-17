'use strict';

// ─── RBAC permission registry (single source of truth) ───────────────────────
//
// Each entry = one admin-dashboard page (key MUST match the `section` id used in
// frontend AdminDashboard.jsx) plus optional per-page UI sub-flags that gate
// individual actions/columns inside that page.
//
// A role's stored permissions are { pages: string[], ui: string[] }:
//   - page access  = pages[] includes the page key
//   - a UI action  = ui[] includes "<page>.<flag>" AND pages[] includes <page>
//
// The frontend mirrors this file (frontend/src/components/Admin/permissions.js).
// Keep the two in sync when adding pages/flags.
//
// `adminOnly: true` pages (Role Manager) can NEVER be granted to a custom role —
// they are reserved for the built-in `admin` superuser. They are excluded from
// the assignable registry returned to the role editor.

import type { RolePermissions } from '../types/models';

export interface UiFlag {
  key: string;
  label: string;
}

export interface PageDef {
  key: string;
  icon: string;
  label: string;
  ui: UiFlag[];
  adminOnly?: boolean;
}

/** Minimal user shape permission checks rely on (req.user-compatible).
 *  permissions is unknown by contract: normalize() default-denies malformed blobs. */
interface PermissionUser {
  role: string;
  permissions?: unknown;
}

export const PAGES: PageDef[] = [
  { key: 'overview',        icon: '📊', label: 'Overview',       ui: [] },
  {
    key: 'vets', icon: '🏥', label: 'Manage Vets',
    ui: [
      { key: 'vets.create',  label: 'Add Vet Clinic' },
      { key: 'vets.edit',    label: 'Edit' },
      { key: 'vets.approve', label: 'Approve / Reject' },
      { key: 'vets.delete',  label: 'Deactivate / Delete' },
    ],
  },
  { key: 'claim-requests',  icon: '📋', label: 'Claim Requests',
    ui: [
      { key: 'claim-requests.edit', label: 'Approve / reject claims' },
    ],
  },
  {
    key: 'users', icon: '👥', label: 'Manage Users',
    ui: [
      { key: 'users.reset_password', label: 'Reset password' },
      { key: 'users.deactivate',     label: 'Deactivate / Activate' },
      { key: 'users.role',           label: 'Assign role' },
    ],
  },
  {
    key: 'pets', icon: '🐾', label: 'Manage Pets',
    ui: [
      { key: 'pets.edit',   label: 'Edit' },
      { key: 'pets.delete', label: 'Delete (Actions column)' },
    ],
  },
  { key: 'lost-pets-mgmt',  icon: '🐕', label: 'Lost Pets',      ui: [] },
  { key: 'adoptable-pets',  icon: '🏡', label: 'Adoptable Pets', ui: [] },
  {
    key: 'found-pets', icon: '🔍', label: 'Found Reports',
    ui: [
      { key: 'found-pets.edit',   label: 'Edit' },
      { key: 'found-pets.delete', label: 'Delete (Actions column)' },
    ],
  },
  {
    key: 'rescue-pets', icon: '🚑', label: 'Rescue Reports',
    ui: [
      { key: 'rescue-pets.edit',   label: 'Edit' },
      { key: 'rescue-pets.delete', label: 'Delete (Actions column)' },
    ],
  },
  {
    key: 'reviews', icon: '⭐', label: 'Reviews',
    ui: [
      { key: 'reviews.delete', label: 'Delete review (Actions column)' },
    ],
  },
  {
    key: 'donation', icon: '💝', label: 'Donation',
    ui: [
      { key: 'donation.edit', label: 'Edit donation settings' },
    ],
  },
  {
    key: 'comments', icon: '🚩', label: 'Comments',
    ui: [
      { key: 'comments.delete', label: 'Delete / dismiss (Actions column)' },
    ],
  },
  {
    key: 'community-posts', icon: '📰', label: 'Reported Posts',
    ui: [
      { key: 'community-posts.delete', label: 'Delete / dismiss (Actions column)' },
    ],
  },
  {
    key: 'settings', icon: '🎨', label: 'Settings',
    ui: [
      { key: 'settings.edit', label: 'Edit site settings' },
    ],
  },
  {
    key: 'sms-settings', icon: '📱', label: 'SMS Update',
    ui: [
      { key: 'sms-settings.edit', label: 'Edit SMS settings' },
    ],
  },
  // Reserved: admin-superuser-only. Never grantable to a custom role.
  { key: 'roles', icon: '🛡️', label: 'Role Manager', ui: [], adminOnly: true },
];

export const PAGE_KEYS = new Set(PAGES.map((p) => p.key));
export const UI_KEYS = new Set(
  PAGES.flatMap((p) => (p.ui || []).map((u) => u.key)),
);
export const ADMIN_ONLY_PAGE_KEYS = new Set(
  PAGES.filter((p) => p.adminOnly).map((p) => p.key),
);

// Registry exposed to the role editor — excludes adminOnly (non-grantable) pages.
export const ASSIGNABLE_PAGES = PAGES.filter((p) => !p.adminOnly);

/**
 * Normalize a stored permissions blob into a safe { pages:Set, ui:Set } shape.
 * Defensive against null / malformed JSONB (default-deny, see L2).
 */
export function normalize(permissions: unknown): { pages: Set<string>; ui: Set<string> } {
  const p = (permissions && typeof permissions === 'object' ? permissions : {}) as Partial<RolePermissions>;
  const pages = Array.isArray(p.pages) ? p.pages : [];
  const ui = Array.isArray(p.ui) ? p.ui : [];
  return { pages: new Set(pages), ui: new Set(ui) };
}

/**
 * Does this user hold permission `key`?
 * - admin role  → always true (superuser short-circuit).
 * - page key    → granted if pages includes it.
 * - "<page>.<flag>" → granted only if ui includes the flag AND pages includes
 *   the parent page (L3: an orphan UI flag never grants access).
 * Default-deny on missing/malformed perms (L2).
 */
export function hasPermission(user: PermissionUser | null | undefined, key: string): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  const { pages, ui } = normalize(user.permissions);
  if (key.includes('.')) {
    const parent = key.slice(0, key.indexOf('.'));
    return pages.has(parent) && ui.has(key);
  }
  return pages.has(key);
}

/** True if the user can open the admin dashboard at all (admin OR ≥1 page). */
export function hasAnyAdminAccess(user: PermissionUser | null | undefined): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return normalize(user.permissions).pages.size > 0;
}

/**
 * Validate + rebuild a permissions object from untrusted input, keeping ONLY
 * known keys (L5: never store raw request body). Strips adminOnly pages and the
 * `roles` reserved permission so a custom role can never be made admin-equal.
 * Returns { pages, ui } with validated, deduped values.
 */
export function sanitizePermissions(input: unknown): RolePermissions {
  const src = (input && typeof input === 'object' ? input : {}) as Partial<RolePermissions>;
  const inPages = Array.isArray(src.pages) ? src.pages : [];
  const inUi = Array.isArray(src.ui) ? src.ui : [];

  const pages = [...new Set(inPages)].filter(
    (k) => PAGE_KEYS.has(k) && !ADMIN_ONLY_PAGE_KEYS.has(k),
  );
  const pageSet = new Set(pages);
  // A UI flag survives only if its key is known AND its parent page is granted.
  const ui = [...new Set(inUi)].filter((k) => {
    if (!UI_KEYS.has(k)) return false;
    const parent = k.slice(0, k.indexOf('.'));
    return pageSet.has(parent);
  });
  return { pages, ui };
}

/** Does a requested permissions blob try to grant a reserved/adminOnly page? */
export function requestsReservedPage(input: unknown): boolean {
  const inPages = Array.isArray((input as Partial<RolePermissions> | null | undefined)?.pages)
    ? (input as RolePermissions).pages
    : [];
  return inPages.some((k) => ADMIN_ONLY_PAGE_KEYS.has(k));
}

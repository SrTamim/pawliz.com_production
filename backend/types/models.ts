// Shared backend domain types.
// Types describe pg runtime reality: NUMERIC/DECIMAL columns arrive as strings,
// TIMESTAMP columns as Date, JSONB as parsed objects, LEFT JOIN misses as null.

/** roles.permissions JSONB — may be null (LEFT JOIN miss) or malformed; always
 *  pass through utils/permissions normalize()/hasPermission() (default-deny). */
export interface RolePermissions {
  pages: string[];
  ui: string[];
}

/** Shape attached to req.user by middleware/auth (USER_SELECT + roles join). */
export interface AuthUser {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  role: string;
  is_active: boolean;
  permissions: RolePermissions | null;
}

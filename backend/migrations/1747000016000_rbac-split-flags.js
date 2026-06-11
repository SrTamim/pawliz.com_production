'use strict';

// RBAC flag split (REFINEMENT 3). Existing custom roles store the old coarse UI
// flags; remap them to the new finer-grained keys so managers keep working after
// the registry change. Touches only custom roles (is_system = false) — system
// roles carry no stored permissions.
//
// Remap applied to each role's permissions.ui array:
//   users.edit   -> users.reset_password   (old "edit" flag gated Reset PW)
//   users.delete -> users.deactivate       (old "delete" flag gated Deactivate)
//   vets.edit    -> vets.edit + vets.approve (old edit covered Approve/Reject too)
// Everything else (pets/found/rescue/comments/reviews/etc.) is unchanged.
//
// Implemented as set-based SQL (pgm.sql, like every other migration here) so it
// needs no JS DB handle. Each statement is idempotent: a JSONB rebuild that
// removes the old key and adds the new one(s); re-running is a no-op because the
// old keys are already gone. De-dup via SELECT DISTINCT in the rebuild.
//
// DEPLOYED-SAFETY: runs in `npm run migrate && node server.js` on Render before
// the server starts; must not throw. WHERE is_system=false → only a handful of
// custom-role rows. JSONB ops below are null-safe (COALESCE).

// Helper SQL: rebuild permissions.ui by replacing `oldKey` with the elements of
// `newKeys` (a JSONB array literal), de-duplicated, only for roles that actually
// contain oldKey. pages array is preserved untouched.
function remap(pgm, oldKey, newKeysJsonbArray) {
  pgm.sql(`
    UPDATE roles r
    SET permissions = jsonb_set(
          COALESCE(r.permissions, '{"pages":[],"ui":[]}'::jsonb),
          '{ui}',
          (
            SELECT COALESCE(jsonb_agg(DISTINCT elem), '[]'::jsonb)
            FROM (
              SELECT jsonb_array_elements(
                       (COALESCE(r.permissions->'ui', '[]'::jsonb) - '${oldKey}')
                       || '${newKeysJsonbArray}'::jsonb
                     ) AS elem
            ) s
          )
        ),
        updated_at = CURRENT_TIMESTAMP
    WHERE r.is_system = false
      AND COALESCE(r.permissions->'ui', '[]'::jsonb) ? '${oldKey}'
  `);
}

exports.up = (pgm) => {
  remap(pgm, 'users.edit', '["users.reset_password"]');
  remap(pgm, 'users.delete', '["users.deactivate"]');
  // vets.edit stays AND gains vets.approve. Use a no-op for the old key (keep it)
  // by mapping it to itself + approve.
  remap(pgm, 'vets.edit', '["vets.edit","vets.approve"]');
};

// Best-effort down: remove vets.approve (added by up). users.reset_password /
// users.deactivate are left in place — harmless under the old registry (sanitize
// drops unknown keys on next save). Old users.edit/users.delete are not restored.
exports.down = (pgm) => {
  pgm.sql(`
    UPDATE roles r
    SET permissions = jsonb_set(
          COALESCE(r.permissions, '{"pages":[],"ui":[]}'::jsonb),
          '{ui}',
          (COALESCE(r.permissions->'ui', '[]'::jsonb) - 'vets.approve')
        ),
        updated_at = CURRENT_TIMESTAMP
    WHERE r.is_system = false
      AND COALESCE(r.permissions->'ui', '[]'::jsonb) ? 'vets.approve'
  `);
};

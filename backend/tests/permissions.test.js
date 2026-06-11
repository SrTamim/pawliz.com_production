'use strict';

const P = require('../utils/permissions');

describe('RBAC permissions helpers', () => {
  describe('hasPermission', () => {
    it('admin superuser passes any key including roles', () => {
      expect(P.hasPermission({ role: 'admin' }, 'users.delete')).toBe(true);
      expect(P.hasPermission({ role: 'admin' }, 'roles')).toBe(true);
    });

    it('grants page + matching ui flag, denies ungranted', () => {
      const mgr = { role: 'manager', permissions: { pages: ['overview', 'users'], ui: ['users.reset_password'] } };
      expect(P.hasPermission(mgr, 'users')).toBe(true);
      expect(P.hasPermission(mgr, 'users.reset_password')).toBe(true);
      expect(P.hasPermission(mgr, 'users.deactivate')).toBe(false);
      expect(P.hasPermission(mgr, 'pets')).toBe(false);
    });

    it('default-denies on null/empty/missing perms (L2)', () => {
      expect(P.hasPermission({ role: 'x', permissions: null }, 'users')).toBe(false);
      expect(P.hasPermission({ role: 'x', permissions: {} }, 'users')).toBe(false);
      expect(P.hasPermission(null, 'users')).toBe(false);
    });

    it('denies an orphan ui flag whose parent page is not granted (L3)', () => {
      const orphan = { role: 'x', permissions: { pages: [], ui: ['users.deactivate'] } };
      expect(P.hasPermission(orphan, 'users.deactivate')).toBe(false);
    });
  });

  describe('hasAnyAdminAccess', () => {
    it('true for admin and any-page staff, false for plain user', () => {
      expect(P.hasAnyAdminAccess({ role: 'admin' })).toBe(true);
      expect(P.hasAnyAdminAccess({ role: 'm', permissions: { pages: ['users'] } })).toBe(true);
      expect(P.hasAnyAdminAccess({ role: 'user', permissions: { pages: [] } })).toBe(false);
      expect(P.hasAnyAdminAccess(null)).toBe(false);
    });
  });

  describe('sanitizePermissions (L5 mass-assign defense)', () => {
    it('keeps only known, grantable keys and drops the reserved roles page', () => {
      const s = P.sanitizePermissions({
        pages: ['users', 'roles', 'bogus'],
        ui: ['users.reset_password', 'pets.delete', 'evil'],
      });
      expect(s.pages).toEqual(['users']); // roles + bogus stripped
      expect(s.ui).toEqual(['users.reset_password']); // pets.delete orphaned, evil unknown
    });

    it('returns empty arrays for garbage input', () => {
      expect(P.sanitizePermissions(null)).toEqual({ pages: [], ui: [] });
      expect(P.sanitizePermissions('x')).toEqual({ pages: [], ui: [] });
    });
  });

  describe('requestsReservedPage', () => {
    it('flags an attempt to grant the roles page', () => {
      expect(P.requestsReservedPage({ pages: ['users', 'roles'] })).toBe(true);
      expect(P.requestsReservedPage({ pages: ['users'] })).toBe(false);
    });
  });

  describe('ASSIGNABLE_PAGES', () => {
    it('excludes the adminOnly roles page', () => {
      expect(P.ASSIGNABLE_PAGES.find((p) => p.key === 'roles')).toBeUndefined();
    });
  });
});

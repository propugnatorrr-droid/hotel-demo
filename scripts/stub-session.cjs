const ctx = () => globalThis.__smokeCtx;
module.exports = {
  ACTIVE_ORG_COOKIE: 'active_org',
  requireOrg: async () => ctx(),
  requireUser: async () => ({ user: ctx().user, profile: ctx().profile }),
  requireModule: async () => ctx(),
  requireRole: async () => ctx(),
  getSessionUser: async () => ctx().user,
  hasModule: (c, k) => c.modules.has(k),
};

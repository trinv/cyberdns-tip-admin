// The complete set of assignable account roles — the single source of truth
// for RBAC. In its own tiny module (no DB / pg imports on the path) so the
// query layer AND the API-validation layer (src/middleware/validateBody.ts)
// can both import it without pulling the pg Pool into a unit test.
//
//   Analyst  — propose + edit single domains
//   Reviewer — + resolve the review queue, bulk-action the blocklist
//   Admin    — + all config (categories, feed sources, users, DNS nodes, ACL)
export const VALID_ROLES = ['Analyst', 'Reviewer', 'Admin'] as const;
export type Role = (typeof VALID_ROLES)[number];

export function assertValidRole(role: string | undefined) {
  if (role !== undefined && !VALID_ROLES.includes(role as Role)) {
    throw new Error(`Vai trò không hợp lệ: "${role}". Chỉ chấp nhận ${VALID_ROLES.join(', ')}.`);
  }
}

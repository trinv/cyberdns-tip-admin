// The one real "published blocklist" URL shape this app has — a plain-text
// list of active domains per category, served by GET /v1/blocklist/:category.txt
// (see server.ts / getBlocklistTextForCategory in src/db/queries.ts). Both
// the Dashboard's quick-copy card and the dedicated "Blocklist đã phát hành"
// page build this same URL — pulled out here so neither drifts out of sync
// with the other or with the real route.
export function buildBlocklistUrl(categoryId: string): string {
  return `${window.location.origin}/v1/blocklist/${categoryId}.txt`;
}

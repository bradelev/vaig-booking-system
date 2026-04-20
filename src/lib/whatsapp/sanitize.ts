// Meta rejects template text parameters containing newlines, tabs, or 5+
// consecutive spaces with error 132018. Collapse to a single line using " · "
// as paragraph separator, and drop empty segments so missing env vars or
// empty placeholders don't leave dangling separators.
export function sanitizeTemplateParam(text: string): string {
  const parts = text
    .replace(/\t/g, " ")
    .split(/\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return parts.join(" · ").replace(/ {5,}/g, "    ");
}

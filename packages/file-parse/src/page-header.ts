/**
 * Checks if a header title consists solely of a page indicator and a number
 * (e.g. "Page 59", "page 59", "pg. 59", "pag. 59", "pág. 59", "p. 59", "Page IV", or standalone "59").
 */
export function isInvalidPageHeaderTitle(title: string): boolean {
  const trimmed = title.trim()
  if (!trimmed) return true

  // Standalone numbers (e.g. "59")
  if (/^\d+$/.test(trimmed)) return true

  // Page indicator + number or Roman numeral (e.g. "Page 59", "pg. 12", "pag. 3", "pág. 5", "p. 1", "Page IV")
  if (/^(?:page|pg\.?|pag\.?|pág\.?|p\.?)\s*(?:\d+|[ivxlcdm]+)$/i.test(trimmed)) {
    return true
  }

  return false
}

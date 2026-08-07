/**
 * Chat display stamp: the conversation's creation time in a compact local
 * YYYYMMDD-HHMM shape (e.g. 20260807-0915), used as the chat session name so
 * picking a past conversation by date/hour/minute is trivial.
 */
export function formatChatTimestamp(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  const pad = (value: number): string => String(value).padStart(2, '0')
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `-${pad(date.getHours())}${pad(date.getMinutes())}`
  )
}

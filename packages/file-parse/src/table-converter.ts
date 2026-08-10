/**
 * Converts HTML <table> blocks into clean Markdown tables:
 *
 * Example input:
 * <table>
 *  <tr>
 *   <th>Activity</th>
 *   <th>Time<br/>expended<br/>Per</th>
 *   <th>Cost</th>
 *  </tr>
 *  <tr>
 *   <td>Customize the definitions<br/>for the Data Quality dimensions</td>
 *   <td>2 hours</td>
 *   <td>$247.74</td>
 *  </tr>
 * </table>
 *
 * Converts to:
 * | Activity | Time expended Per | Cost |
 * | --- | --- | --- |
 * | Customize the definitions for the Data Quality dimensions | 2 hours | $247.74 |
 */

function unescapeHtml(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

function cleanCellText(cellHtml: string): string {
  // Replace <br>, <br/>, <br />, \r\n, \n with spaces
  let text = cellHtml.replace(/<br\s*\/?>/gi, ' ').replace(/[\r\n]+/g, ' ')
  // Strip remaining HTML tags
  text = text.replace(/<[^>]*>/g, '')
  text = unescapeHtml(text).trim()
  // Escape pipe characters inside cells
  return text.replace(/\|/g, '\\|')
}

export function convertHtmlTableToMarkdown(htmlTable: string): string {
  // Match rows <tr> ... </tr>
  const trMatches = htmlTable.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)
  if (!trMatches || trMatches.length === 0) return ''

  const rows: Array<{ isHeader: boolean; cells: string[] }> = []

  for (const trHtml of trMatches) {
    // Extract <th> or <td> cells
    const cellMatches = Array.from(
      trHtml.matchAll(/<(th|td)\b[^>]*>([\s\S]*?)<\/\1>/gi),
    )
    if (cellMatches.length === 0) continue

    const isHeader = cellMatches.some((m) => m[1].toLowerCase() === 'th')
    const cells = cellMatches.map((m) => cleanCellText(m[2]))

    rows.push({ isHeader, cells })
  }

  if (rows.length === 0) return ''

  // Determine max column count
  const colCount = Math.max(...rows.map((r) => r.cells.length))
  if (colCount === 0) return ''

  // Pad rows that have fewer cells
  for (const row of rows) {
    while (row.cells.length < colCount) {
      row.cells.push('')
    }
  }

  // Header row index: first row with <th> cells, or row 0
  let headerIndex = rows.findIndex((r) => r.isHeader)
  if (headerIndex === -1) headerIndex = 0

  const markdownLines: string[] = []

  // Format header row and divider
  const headerRow = rows[headerIndex]!
  const headerLine = `| ${headerRow.cells.join(' | ')} |`
  const dividerLine = `| ${Array(colCount).fill('---').join(' | ')} |`

  markdownLines.push(headerLine)
  markdownLines.push(dividerLine)

  // Format data rows
  for (let i = 0; i < rows.length; i++) {
    if (i === headerIndex) continue
    const dataLine = `| ${rows[i]!.cells.join(' | ')} |`
    markdownLines.push(dataLine)
  }

  return markdownLines.join('\n')
}

export function convertHtmlTablesToMarkdown(text: string): string {
  if (!/<table\b/i.test(text)) return text

  return text.replace(/<table\b[^>]*>[\s\S]*?<\/table>/gi, (tableHtml) => {
    const mdTable = convertHtmlTableToMarkdown(tableHtml)
    return mdTable ? `\n\n${mdTable}\n\n` : tableHtml
  })
}

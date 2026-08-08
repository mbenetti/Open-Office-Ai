/** Clean pasted Word/web HTML: mso conditional comments, <o:p>, unwrapping <li><p>x</p></li>, <font>/<u> tags, and foreign font/size/color/underline overrides */
export function cleanPastedHtml(html: string): string {
  let cleaned = html
    .replace(/<!--\[if[\s\S]*?<!\[endif\]-->/g, '')
    .replace(/<o:p>[\s\S]*?<\/o:p>/g, '')
    .replace(/<li([^>]*)>\s*<p[^>]*>([\s\S]*?)<\/p>\s*<\/li>/g, '<li$1>$2</li>')
    .replace(/<font[^>]*>([\s\S]*?)<\/font>/gi, '$1')
    .replace(/<u[^>]*>([\s\S]*?)<\/u>/gi, '$1')

  // Remove foreign font-family, font-size, line-height, text-decoration, and color style rules unless data-doc-style is present
  cleaned = cleaned.replace(
    /style="([^"]*)"/gi,
    (match, styleContent: string, offset: number, fullString: string) => {
      const prefix = fullString.slice(Math.max(0, offset - 120), offset)
      if (prefix.includes('data-doc-style')) {
        return match
      }
      const cleanedStyle = styleContent
        .split(';')
        .filter((rule) => {
          const prop = rule.split(':')[0]?.trim().toLowerCase()
          if (!prop) return false
          if (
            prop === 'font-family' ||
            prop === 'font-size' ||
            prop === 'line-height' ||
            prop === 'text-decoration' ||
            prop === 'color' ||
            prop.startsWith('mso-')
          ) {
            return false
          }
          return true
        })
        .join(';')
      return cleanedStyle ? `style="${cleanedStyle}"` : ''
    },
  )

  return cleaned
}

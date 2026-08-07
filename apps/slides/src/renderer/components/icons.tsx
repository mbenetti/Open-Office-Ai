/** Small monochrome SVG icons approximating Word's ribbon glyphs. */

import type { ReactNode } from 'react'
import type { AnimEffectKind } from '../../shared/ipc'

interface IconProps {
  size?: number
}

/** Constant painted stroke instead of proportional scaling: ~1.5px lines on
 *  20px+ glyphs, ~1.25px on the 13-19px ones, ~1.1px below (a proportional
 *  1.5-unit stroke would paint 1.75px at 28px and hairlines at small sizes).
 *  stroke-width is in 24-canvas units: units = painted-px × 24 / rendered-px. */
function pinnedStroke(size: number): number {
  const painted = size >= 20 ? 1.5 : size >= 13 ? 1.25 : 1.1
  return (painted * 24) / size
}

function Svg({ size = 24, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={pinnedStroke(size)}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  )
}

/** Renders gallery glyph markup (inner SVG for a 24×24 viewBox, stroke=currentColor). */
export function IconGlyph({ body, size = 18 }: { body: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={pinnedStroke(size)}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      dangerouslySetInnerHTML={{ __html: body }}
    />
  )
}

export function IconFind(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="10.13" cy="10.13" r="5.61" />
      <path d="M 14.41 14.41 L 19.48 19.48" />
    </Svg>
  )
}

export function IconBullets(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="5.48" cy="6.67" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="5.48" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="5.48" cy="17.33" r="1.3" fill="currentColor" stroke="none" />
      <path d="M 9.63 6.67 h 9.48 M 9.63 12 h 9.48 M 9.63 17.33 h 9.48" />
    </Svg>
  )
}

export function IconNumbered(props: IconProps) {
  return (
    <Svg {...props}>
      <text
        x="1.5"
        y="8.1"
        fontSize="8.1"
        fill="currentColor"
        stroke="none"
        fontFamily="Segoe UI, sans-serif"
      >
        1
      </text>
      <text
        x="1.5"
        y="15.6"
        fontSize="8.1"
        fill="currentColor"
        stroke="none"
        fontFamily="Segoe UI, sans-serif"
      >
        2
      </text>
      <text
        x="1.5"
        y="23.1"
        fontSize="8.1"
        fill="currentColor"
        stroke="none"
        fontFamily="Segoe UI, sans-serif"
      >
        3
      </text>
      <path d="M9.75 5.25 h12 M9.75 12.75 h12 M9.75 20.25 h12" />
    </Svg>
  )
}

export function IconIndentDec(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M 4.53 5.15 h 14.94 M 12 9.26 h 7.47 M 12 12.62 h 7.47 M 12 15.98 h 7.47 M 4.53 19.47 h 14.94" />
      <path d="M 8.51 9.26 4.78 12.62 l 3.74 3.36 z" fill="currentColor" stroke="none" />
    </Svg>
  )
}

export function IconIndentInc(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M 4.53 5.15 h 14.94 M 12 9.26 h 7.47 M 12 12.62 h 7.47 M 12 15.98 h 7.47 M 4.53 19.47 h 14.94" />
      <path d="M 4.78 9.26 l 3.74 3.36 -3.73 3.36 z" fill="currentColor" stroke="none" />
    </Svg>
  )
}

export function IconAlignLeft(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M 4.53 5.78 h 14.94 M 4.53 9.51 h 9.96 M 4.53 13.25 h 14.94 M 4.53 16.98 h 9.96" />
    </Svg>
  )
}

export function IconAlignCenter(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M 4.53 5.78 h 14.94 M 7.02 9.51 h 9.96 M 4.53 13.25 h 14.94 M 7.02 16.98 h 9.96" />
    </Svg>
  )
}

export function IconAlignRight(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M 4.53 5.78 h 14.94 M 9.51 9.51 h 9.96 M 4.53 13.25 h 14.94 M 9.51 16.98 h 9.96" />
    </Svg>
  )
}

export function IconAlignJustify(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M 4.53 5.78 h 14.94 M 4.53 9.51 h 14.94 M 4.53 13.25 h 14.94 M 4.53 16.98 h 14.94" />
    </Svg>
  )
}

export function IconLineSpacing(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M 12 5.85 h 7.38 M 12 10.03 h 7.38 M 12 14.21 h 7.38 M 12 18.4 h 7.38" />
      <path d="M 6.47 6.1 v 11.81 M 4.37 8.56 l 2.09 -2.46 2.09 2.46 M 4.37 15.44 l 2.09 2.46 2.09 -2.46" />
    </Svg>
  )
}

export function IconClearFormat(props: IconProps) {
  return (
    <Svg {...props}>
      {/* letter A with a wiped-off stroke at its top left */}
      <path d="M3.75 18.75 8.25 6l4.5 12.75" />
      <path d="M5.55 14.25h5.4" />
      <path d="M4.35 8.85l1.8-1.8" />
      {/* compact diagonal eraser at the lower right (the old diamond's spot), outline only, band facing the A */}
      <g transform="rotate(45 17.4 17.4)">
        <rect
          x="13.65"
          y="14.7"
          width="7.5"
          height="5.4"
          rx="0.75"
          stroke="var(--ribbon-accent-2, #A33FB5)"
        />
        <path d="M15.75 14.7v5.4" stroke="var(--ribbon-accent-2, #A33FB5)" />
      </g>
    </Svg>
  )
}

export function IconGrowFont(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3.25 19 8.5 5.25 13.75 19M5.1 14.25h6.8" />
      <path d="M18 17.5V6.75M14.9 9.85 18 6.75l3.1 3.1" />
    </Svg>
  )
}

export function IconShrinkFont(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3.25 19 8.5 5.25 13.75 19M5.1 14.25h6.8" />
      <path d="M18 6.75V17.5M14.9 14.4l3.1 3.1 3.1-3.1" />
    </Svg>
  )
}

/** Character spacing (MS-style): AV above a double-headed arrow */
export function IconCharSpacing(props: IconProps) {
  return (
    <Svg {...props}>
      <TextGlyph x={4} y={13.5} s={13}>
        AV
      </TextGlyph>
      <path
        d="M4.5 18.75 h15 M7.2 16.05 4.5 18.75 l2.7 2.7 M16.8 16.05 19.5 18.75 l-2.7 2.7"
        stroke="var(--ribbon-accent, #2B7CD3)"
      />
    </Svg>
  )
}

/** MS-style text highlighter: marker nib only; the color bar is rendered by the button */
export function IconTextHighlight(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4.5 16.5 14.25 6.75 a2.1 2.1 0 0 1 3 0 l0.75 0.75 a2.1 2.1 0 0 1 0 3 L8.25 20.25 H4.5 z" />
    </Svg>
  )
}

export function IconHighlight(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        d="M 4.95 15.38 14.5 5.83 a 2.06 2.06 0 0 1 2.94 0 l 0.73 0.73 a 2.06 2.06 0 0 1 0 2.94 L 8.62 19.05 H 4.95 z"
        fill="none"
      />
      <rect
        x="3.78"
        y="17.87"
        width="5.87"
        height="2.35"
        rx="1.17"
        fill="currentColor"
        stroke="none"
      />
    </Svg>
  )
}

/* ---------- shared shapes ---------- */

/** page outline used by many icons */
const PAGE = <path d="M6 2.25 h9 l3.75 3.75 v15.75 h-12.75 z" />

function TextGlyph({
  x,
  y,
  s,
  children,
  bold,
}: {
  x: number
  y: number
  s: number
  children: string
  bold?: boolean
}) {
  return (
    <text
      x={x}
      y={y}
      fontSize={s}
      fill="currentColor"
      stroke="none"
      fontFamily="Segoe UI, sans-serif"
      fontWeight={bold ? 700 : 400}
    >
      {children}
    </text>
  )
}

/* ---------- clipboard (Home) ---------- */

export function IconPaste(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="6.38" y="5.81" width="11.25" height="13.5" rx="1.13" />
      <rect x="9.52" y="4.35" width="4.95" height="2.93" rx="0.79" fill="var(--surface, #fff)" />
      <path d="M 9.19 10.31 h 5.63 M 9.19 13.13 h 5.63 M 9.19 15.94 h 3.38" />
    </Svg>
  )
}

export function IconCut(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M 16.36 4.53 9.01 14.99 M 7.64 4.53 l 7.35 10.46" />
      <circle cx="7.27" cy="16.98" r="2.49" />
      <circle cx="16.73" cy="16.98" r="2.49" />
    </Svg>
  )
}

export function IconCopy(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="9.11" y="7.96" width="9.24" height="11.55" rx="1.16" />
      <path d="M 14.89 7.96 v -2.31 a 1.16 1.16 0 0 0 -1.15 -1.15 h -6.93 a 1.16 1.16 0 0 0 -1.15 1.16 v 10.4 a 1.16 1.16 0 0 0 1.16 1.16 h 2.31" />
    </Svg>
  )
}

export function IconFormatPainter(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="6" y="4.8" width="12" height="4.8" rx="0.96" />
      <path d="M 18 7.2 h 1.8 v 4.8 H 12.6 v 2.4" />
      <rect
        x="10.8"
        y="14.4"
        width="3.6"
        height="5.4"
        rx="0.96"
        fill="currentColor"
        stroke="none"
      />
    </Svg>
  )
}

/** Slide layout: slide frame + title line + two content placeholders */
export function IconSlideLayout(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4.53" y="5.15" width="14.94" height="13.69" rx="1" />
      <path d="M 7.64 8.89 h 8.72" />
      <rect x="7.64" y="11.38" width="3.74" height="4.36" rx="0.5" />
      <rect x="12.62" y="11.38" width="3.74" height="4.36" rx="0.5" />
    </Svg>
  )
}

/* ---------- Insert ---------- */

export function IconTable(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4.53" y="5.15" width="14.94" height="13.69" rx="1" />
      <path d="M 4.53 9.76 h 14.94 M 4.53 14.37 h 14.94 M 9.51 5.15 v 13.69 M 14.49 5.15 v 13.69" />
    </Svg>
  )
}

export function IconPicture(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4.53" y="5.78" width="14.94" height="12.45" rx="1" />
      <circle cx="8.76" cy="9.76" r="1.37" />
      <path d="M 5.15 16.98 10.13 12 l 3.74 3.74 2.49 -2.49 2.49 2.49" />
    </Svg>
  )
}

export function IconShapes(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="9.42" cy="9.42" r="4.64" />
      <rect x="11.36" y="11.36" width="8.39" height="8.39" rx="1.03" fill="var(--surface, #fff)" />
    </Svg>
  )
}

export function IconLink(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M 10.35 13.65 13.65 10.35" />
      <path d="M 11.31 7.59 13.38 5.52 a 3.59 3.59 0 0 1 5.1 5.1 L 16.41 12.69" />
      <path d="M 12.69 16.41 10.62 18.48 a 3.59 3.59 0 0 1 -5.1 -5.1 l 2.07 -2.07" />
    </Svg>
  )
}

export function IconComment(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M 4.51 4.87 h 14.99 v 10.22 h -8.18 L 7.23 19.18 v -4.09 h -2.73 z" />
      <path d="M 7.91 8.28 h 8.18 M 7.91 11.68 h 5.45" />
    </Svg>
  )
}

export function IconPageBreak(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M 7.38 4.49 h 9.24 v 5.2 M 7.38 4.49 v 5.2 M 7.38 19.51 h 9.24 v -5.2 M 7.38 19.51 v -5.2" />
      <path d="M 4.49 12 h 2.31 M 8.54 12 h 2.31 M 12.58 12 h 2.31 M 16.62 12 h 2.89" />
    </Svg>
  )
}

export function IconHeader(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="6.23" y="4.49" width="11.55" height="15.02" rx="0.92" />
      <path d="M 7.96 7.38 h 8.09 M 7.96 9.46 h 8.09" opacity="0.9" />
    </Svg>
  )
}

export function IconFooter(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="6.23" y="4.49" width="11.55" height="15.02" rx="0.92" />
      <path d="M 7.96 14.54 h 8.09 M 7.96 16.62 h 8.09" opacity="0.9" />
    </Svg>
  )
}

export function IconPageNumber(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="6.25" y="4.5" width="11.5" height="15" rx="0.95" />
      <TextGlyph x={9.2} y={15.5} s={8}>
        #
      </TextGlyph>
    </Svg>
  )
}

export function IconSymbol(props: IconProps) {
  return (
    <Svg {...props}>
      <TextGlyph x={3.4} y={20.4} s={24}>
        Ω
      </TextGlyph>
    </Svg>
  )
}

export function IconEquation(props: IconProps) {
  return (
    <Svg {...props}>
      <TextGlyph x={5.4} y={17.75} s={22}>
        π
      </TextGlyph>
    </Svg>
  )
}

/* ---------- Design ---------- */

export function IconSlideMaster(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4.2" y="4.8" width="12" height="8.4" rx="1.2" />
      <path d="M 6.6 7.8 h 7.2 M 6.6 10.2 h 4.8" />
      <rect x="9.6" y="15" width="9.6" height="4.8" rx="0.96" />
    </Svg>
  )
}

export function IconTheme(props: IconProps) {
  return (
    <Svg {...props}>
      <TextGlyph x={2.25} y={17.25} s={16.5}>
        A
      </TextGlyph>
      <TextGlyph x={12.75} y={17.25} s={12}>
        a
      </TextGlyph>
      <rect
        x="3.75"
        y="19.35"
        width="16.5"
        height="2.7"
        rx="1.35"
        fill="currentColor"
        stroke="none"
      />
    </Svg>
  )
}

export function IconThemeFonts(props: IconProps) {
  return (
    <Svg {...props}>
      <TextGlyph x={3} y={18} s={16.5}>
        F
      </TextGlyph>
      <path d="M14.25 18 18 6.75 21.75 18 M15.45 14.4 h5.1" />
    </Svg>
  )
}

export function IconThemeColors(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="7.32" cy="7.63" r="2.81" />
      <circle cx="16.68" cy="7.63" r="2.81" />
      <circle cx="7.32" cy="16.32" r="2.81" />
      <circle cx="16.68" cy="16.32" r="2.81" fill="currentColor" />
    </Svg>
  )
}

export function IconPageColor(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M 12.84 5.04 6.6 11.28 a 1.56 1.56 0 0 0 0 2.16 l 3.96 3.96 a 1.56 1.56 0 0 0 2.16 0 l 6.24 -6.24 z" />
      <path d="M 12.84 5.04 10.8 7.2" />
      <path
        d="M 18.72 15.12 s 1.68 2.04 1.68 3.24 a 1.68 1.68 0 0 1 -3.36 0 c 0 -1.2 1.68 -3.24 1.68 -3.24 z"
        fill="currentColor"
        stroke="none"
      />
    </Svg>
  )
}

export function IconWatermark(props: IconProps) {
  return (
    <Svg {...props}>
      {PAGE}
      <path d="M7.8 17.25 16.2 7.5" opacity="0.45" />
    </Svg>
  )
}

export function IconPageBorders(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4.53" y="4.53" width="14.94" height="14.94" rx="1" />
      <rect x="7.52" y="7.52" width="8.96" height="8.96" />
    </Svg>
  )
}

/* ---------- Layout ---------- */

export function IconMargins(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="6.23" y="4.49" width="11.55" height="15.02" rx="0.92" />
      <rect x="8.77" y="7.03" width="6.47" height="9.93" strokeDasharray="2.4 2.1" />
    </Svg>
  )
}

export function IconOrientation(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4.8" y="7.2" width="9" height="12" rx="0.96" />
      <rect x="9" y="11.4" width="10.8" height="7.8" rx="0.96" fill="var(--surface, #fff)" />
      <path d="M 15.6 5.04 a 6 6 0 0 1 3.6 3.12 M 19.2 5.4 v 3 h -3" />
    </Svg>
  )
}

export function IconPageSize(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="6.23" y="4.49" width="11.55" height="15.02" rx="0.92" />
      <path d="M 9.11 12 h 5.78 M 12 9.11 v 5.78 M 10.5 10.5 9.11 9.11 m 4.62 0 -1.39 1.39 m 0 4.16 1.39 1.39 m -4.62 0 1.39 -1.39" />
    </Svg>
  )
}

export function IconColumns(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M 4.47 5.15 h 6.16 M 4.47 8.58 h 6.16 M 4.47 12 h 6.16 M 4.47 15.42 h 6.16 M 4.47 18.85 h 6.16" />
      <path d="M 13.37 5.15 h 6.16 M 13.37 8.58 h 6.16 M 13.37 12 h 6.16 M 13.37 15.42 h 6.16 M 13.37 18.85 h 6.16" />
    </Svg>
  )
}

/* ---------- References ---------- */

export function IconToc(props: IconProps) {
  return (
    <Svg {...props}>
      {PAGE}
      <path d="M8.25 7.5 h7.5 M10.05 10.95 h5.7 M10.05 14.4 h5.7 M8.25 17.85 h7.5" />
    </Svg>
  )
}

export function IconRefresh(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M 19.02 9.98 a 7.29 7.29 0 0 0 -13.5 -1.62 M 4.98 14.03 a 7.29 7.29 0 0 0 13.5 1.62" />
      <path d="M 19.43 4.57 v 4.05 h -4.05 M 4.57 19.43 v -4.05 h 4.05" />
    </Svg>
  )
}

export function IconTrash(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M 4.67 7.33 h 14.67 M 9.6 7.33 V 5.6 a .93 .93 0 0 1 .93 -.93 h 2.93 a .93 .93 0 0 1 .93 .93 v 1.73" />
      <path d="M 6.67 7.33 l .93 11.09 a 1.33 1.33 0 0 0 1.33 1.2 h 6.13 a 1.33 1.33 0 0 0 1.33 -1.2 l .93 -11.09" />
      <path d="M 10.13 10.67 v 5.33 M 13.87 10.67 v 5.33" />
    </Svg>
  )
}

export function IconFootnote(props: IconProps) {
  return (
    <Svg {...props}>
      <TextGlyph x={2.25} y={18} s={13.5}>
        AB
      </TextGlyph>
      <TextGlyph x={17.25} y={12} s={10.5} bold>
        1
      </TextGlyph>
    </Svg>
  )
}

export function IconEndnote(props: IconProps) {
  return (
    <Svg {...props}>
      <TextGlyph x={2.25} y={18} s={13.5}>
        AB
      </TextGlyph>
      <TextGlyph x={16.95} y={12} s={10.5} bold>
        n
      </TextGlyph>
    </Svg>
  )
}

export function IconCitation(props: IconProps) {
  return (
    <Svg {...props}>
      <TextGlyph x={3} y={18.75} s={21} bold>
        “”
      </TextGlyph>
    </Svg>
  )
}

export function IconBook(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M 12 6.13 C 10.43 4.95 7.82 4.43 4.82 4.69 v 13.57 c 3 -0.26 5.61 0.26 7.18 1.44 1.57 -1.17 4.18 -1.7 7.18 -1.44 V 4.69 c -3 -0.26 -5.61 0.26 -7.18 1.44 z" />
      <path d="M 12 6.13 v 13.57" />
    </Svg>
  )
}

export function IconCaption(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M 4.53 7.64 h 10.58 L 19.47 12 l -4.36 4.36 H 4.53 z" />
      <circle cx="8.27" cy="12" r="1.12" fill="currentColor" stroke="none" />
    </Svg>
  )
}

export function IconIndex(props: IconProps) {
  return (
    <Svg {...props}>
      <TextGlyph x={2.7} y={9.75} s={9.75}>
        A
      </TextGlyph>
      <TextGlyph x={2.7} y={20.25} s={9.75}>
        B
      </TextGlyph>
      <path d="M12 6.75 h9 M12 12 h9 M12 17.25 h9" />
    </Svg>
  )
}

/* ---------- Review ---------- */

export function IconWordCount(props: IconProps) {
  return (
    <Svg {...props}>
      <TextGlyph x={2.4} y={12} s={12}>
        123
      </TextGlyph>
      <path d="M3 16.5 h18 M3 20.25 h12" />
    </Svg>
  )
}

export function IconSpellcheck(props: IconProps) {
  return (
    <Svg {...props}>
      <TextGlyph x={2.1} y={12.75} s={11.25}>
        abc
      </TextGlyph>
      <path d="M9 17.25 12.75 20.25 19.5 11.25" />
    </Svg>
  )
}

export function IconSparkle(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        d="M 12 4.55 C 12 8.67 15.33 12 19.45 12 C 15.33 12 12 15.33 12 19.45 C 12 15.33 8.67 12 4.55 12 C 8.67 12 12 8.67 12 4.55 Z"
        fill="currentColor"
        stroke="none"
      />
    </Svg>
  )
}

export function IconWand(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M 5.4 18.6 14.4 9.6" />
      <path
        d="M 16.56 4.2 l 0.84 2.28 2.28 0.84 -2.28 0.84 -0.84 2.28 -0.84 -2.28 -2.28 -0.84 2.28 -0.84 z"
        fill="currentColor"
        stroke="none"
      />
      <path
        d="M 18.6 12.6 l 0.48 1.32 1.32 0.48 -1.32 0.48 -0.48 1.32 -0.48 -1.32 -1.32 -0.48 1.32 -0.48 z"
        fill="currentColor"
        stroke="none"
      />
    </Svg>
  )
}

export function IconTranslate(props: IconProps) {
  return (
    <Svg {...props}>
      <TextGlyph x={1.8} y={13.5} s={12.75}>
        文
      </TextGlyph>
      <path d="M13.2 20.25 17.25 9.75 21.3 20.25 M14.55 16.95 h5.4" />
    </Svg>
  )
}

export function IconTrackChanges(props: IconProps) {
  return (
    <Svg {...props}>
      {PAGE}
      <path d="M8.25 8.25 h7.5 M8.25 12 h4.5" />
      <path d="M12.75 19.8 20.4 12.15 l1.8 1.8 -7.65 7.65 -2.7 0.9 z" fill="var(--surface, #fff)" />
    </Svg>
  )
}

export function IconAccept(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3.75 12.75 9 18 l11.25 -12" />
    </Svg>
  )
}

export function IconReject(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3.75 3.75 20.25 20.25 M20.25 3.75 l-16.5 16.5" />
    </Svg>
  )
}

export function IconCompare(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4.49" y="6.23" width="6.35" height="11.55" rx="0.92" />
      <rect x="13.16" y="6.23" width="6.35" height="11.55" rx="0.92" />
      <path d="M 9.69 12 h 4.62 M 12.69 10.38 14.31 12 l -1.62 1.62" />
    </Svg>
  )
}

export function IconLock(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="6.4" y="10.76" width="11.21" height="9.34" rx="1.24" />
      <path d="M 8.89 10.76 V 8.27 a 3.11 3.11 0 0 1 6.23 0 v 2.49" />
      <circle cx="12" cy="15.11" r="1.24" fill="currentColor" stroke="none" />
    </Svg>
  )
}

/* ---------- View ---------- */

function Magnifier({ children }: { children?: ReactNode }) {
  return (
    <>
      <circle cx="10.5" cy="10.5" r="7.2" />
      <path d="M15.9 15.9 21 21" />
      {children}
    </>
  )
}

export function IconZoomOut(props: IconProps) {
  return (
    <Svg {...props}>
      <Magnifier>
        <path d="M7.2 10.5 h6.6" />
      </Magnifier>
    </Svg>
  )
}

export function IconZoomIn(props: IconProps) {
  return (
    <Svg {...props}>
      <Magnifier>
        <path d="M7.2 10.5 h6.6 M10.5 7.2 v6.6" />
      </Magnifier>
    </Svg>
  )
}

export function IconZoom100(props: IconProps) {
  return (
    <Svg {...props}>
      <Magnifier>
        <TextGlyph x={5.7} y={13.5} s={7.5} bold>
          1:1
        </TextGlyph>
      </Magnifier>
    </Svg>
  )
}

export function IconPageWidth(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4.53" y="4.53" width="14.94" height="14.94" rx="1" />
      <path d="M 7.02 12 h 9.96 M 9.26 9.76 7.02 12 l 2.24 2.24 M 14.74 9.76 16.98 12 l -2.24 2.24" />
    </Svg>
  )
}

export function IconWholePage(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="6.23" y="4.49" width="11.55" height="15.02" rx="0.92" />
      <path d="M 9.11 12 h 5.78 M 12 9.11 v 5.78" />
    </Svg>
  )
}

export function IconAiPanel(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4.49" y="5.65" width="15.02" height="12.71" rx="0.92" />
      <path d="M 14.08 5.65 v 12.71" />
      <path
        d="M 15.47 9.92 l 0.58 1.5 1.5 0.58 -1.5 0.58 -0.58 1.5 -0.58 -1.5 -1.5 -0.58 1.5 -0.58 z"
        fill="currentColor"
        stroke="none"
      />
    </Svg>
  )
}

export function IconMoon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M 18.79 14.35 A 7.57 7.57 0 0 1 9.65 5.21 a 7.57 7.57 0 1 0 9.14 9.14 z" />
    </Svg>
  )
}

export function IconReadMode(props: IconProps) {
  return <IconBook {...props} />
}

export function IconOutlineView(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="5.48" cy="6.13" r="1.31" fill="currentColor" stroke="none" />
      <path d="M 8.74 6.13 h 10.44" />
      <circle cx="8.74" cy="12" r="1.31" fill="currentColor" stroke="none" />
      <path d="M 12 12 h 7.18" />
      <circle cx="8.74" cy="17.87" r="1.31" fill="currentColor" stroke="none" />
      <path d="M 12 17.87 h 7.18" />
    </Svg>
  )
}

export function IconRuler(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4.49" y="9.11" width="15.02" height="5.78" rx="0.92" />
      <path d="M 7.96 9.11 v 2.31 M 10.85 9.11 v 3.47 M 13.73 9.11 v 2.31 M 16.62 9.11 v 3.47" />
    </Svg>
  )
}

export function IconNavPane(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4.49" y="5.65" width="15.02" height="12.71" rx="0.92" />
      <path d="M 9.69 5.65 v 12.71" />
      <path d="M 5.99 8.54 h 2.31 M 5.99 11.42 h 2.31 M 5.99 14.31 h 2.31" />
    </Svg>
  )
}

export function IconSplit(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4.53" y="4.53" width="14.94" height="14.94" rx="1" />
      <path d="M 4.53 12 h 14.94" />
    </Svg>
  )
}

export function IconPrintLayout(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="6.8" y="4.49" width="10.4" height="15.02" rx="0.92" />
      <path d="M 9.11 7.96 h 5.78 M 9.11 10.85 h 5.78 M 9.11 13.73 h 5.78 M 9.11 16.62 h 3.47" />
    </Svg>
  )
}

export function IconWebLayout(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4.49" y="5.65" width="15.02" height="12.71" rx="0.92" />
      <path d="M 4.49 8.54 h 15.02" />
      <path d="M 6.8 11.42 h 10.4 M 6.8 13.73 h 10.4 M 6.8 16.04 h 6.93" />
    </Svg>
  )
}

export function IconGridlines(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4.53" y="4.53" width="14.94" height="14.94" rx="1" />
      <path d="M 4.53 9.51 h 14.94 M 4.53 14.49 h 14.94 M 9.51 4.53 v 14.94 M 14.49 4.53 v 14.94" />
    </Svg>
  )
}

export function IconNewWindow(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4.49" y="7.96" width="11.55" height="11.55" rx="0.92" />
      <path d="M 7.96 7.96 v -2.31 a 1.16 1.16 0 0 1 1.16 -1.15 h 9.24 a 1.16 1.16 0 0 1 1.16 1.16 v 9.24 a 1.16 1.16 0 0 1 -1.15 1.16 h -2.31" />
      <path d="M 10.27 13.73 h 4.62 M 12.58 11.42 v 4.62" />
    </Svg>
  )
}

export function IconArrangeAll(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4.49" y="5.07" width="15.02" height="6.01" rx="0.92" />
      <rect x="4.49" y="12.92" width="15.02" height="6.01" rx="0.92" />
    </Svg>
  )
}

export function IconSwitchWindows(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4.49" y="9.11" width="10.4" height="9.24" rx="0.92" />
      <path d="M 8.54 9.11 v -2.31 a 1.16 1.16 0 0 1 1.16 -1.15 h 8.66 a 1.16 1.16 0 0 1 1.16 1.16 v 8.09 a 1.16 1.16 0 0 1 -1.15 1.16 h -3.46" />
    </Svg>
  )
}

export function IconPosition(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4.49" y="4.49" width="15.02" height="15.02" rx="1.16" />
      <rect x="8.54" y="8.54" width="6.93" height="6.93" />
    </Svg>
  )
}

export function IconWrapText(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4.49" y="8.54" width="6.93" height="6.93" />
      <path d="M 13.73 5.07 h 5.78 M 13.73 8.54 h 5.78 M 13.73 12 h 5.78 M 13.73 15.47 h 5.78 M 4.49 18.93 h 15.02 M 4.49 5.07 h 6.93" />
    </Svg>
  )
}

export function IconDoc(props: IconProps) {
  return (
    <Svg {...props}>
      {PAGE}
      <path d="M15 2.25 V6 h3.75" />
      <path d="M8.25 9.75 h7.5 M8.25 13.5 h7.5 M8.25 17.25 h5.25" />
    </Svg>
  )
}

/* ---------- AI panel ---------- */

export function IconSend(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M 4.52 12 19.48 5.03 15.87 18.97 11.48 14.06 z" />
      <path d="M 11.48 14.06 19.48 5.03" />
    </Svg>
  )
}

export function IconStop(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="5" y="5" width="14" height="14" rx="2.625" fill="currentColor" stroke="none" />
    </Svg>
  )
}

export function IconGear(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="2.67" />
      <path d="M 12 4.47 v 2.43 M 12 17.1 v 2.43 M 19.53 12 h -2.43 M 6.9 12 h -2.43 M 17.35 6.65 l -1.7 1.7 M 8.36 15.65 l -1.7 1.7 M 17.35 17.35 15.65 15.65 M 8.36 8.36 6.65 6.65" />
    </Svg>
  )
}

/** collapse the right sidebar: panel outline + arrow pushing into it */
export function IconSidebarCollapse(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4.49" y="5.65" width="15.02" height="12.71" rx="1.16" />
      <path d="M 14.89 5.65 v 12.71" />
      <path d="M 6.8 12 h 5.08 M 9.92 9.57 12.35 12 l -2.43 2.43" />
    </Svg>
  )
}

/** Mirror of IconSidebarCollapse for the LEFT-docked AI panel (right panes keep the original) */
export function IconSidebarCollapseLeft(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4.49" y="5.65" width="15.02" height="12.71" rx="1.16" />
      <path d="M 9.11 5.65 v 12.71" />
      <path d="M 17.2 12 h -5.08 M 14.08 9.57 11.65 12 l 2.43 2.43" />
    </Svg>
  )
}

export function IconClock(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="7.47" />
      <path d="M 12 8.02 V 12 l 2.86 1.99" />
    </Svg>
  )
}

export function IconPaperclip(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M 18.75 10.92 12.27 17.4 a 4.59 4.59 0 0 1 -6.48 -6.48 l 6.75 -6.75 a 3.11 3.11 0 0 1 4.32 4.32 l -6.75 6.75 a 1.49 1.49 0 0 1 -2.16 -2.16 l 6.21 -6.21" />
    </Svg>
  )
}

export function IconNewChat(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M 19.01 10.98 v -3.82 A 2.17 2.17 0 0 0 16.85 4.99 H 7.15 a 2.17 2.17 0 0 0 -2.17 2.17 v 7.78 a 2.17 2.17 0 0 0 2.17 2.17 h 1.4 v 2.55 l 3.32 -2.55 h 1.66" />
      <path d="M 17.36 13.79 v 5.1 M 14.81 16.34 h 5.1" />
    </Svg>
  )
}

/* ---------- titlebar quick access ---------- */

export function IconSave(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M 4.82 6.13 a 1.31 1.31 0 0 1 1.31 -1.3 h 10.44 L 19.83 8.09 v 9.79 a 1.31 1.31 0 0 1 -1.3 1.31 H 6.13 a 1.31 1.31 0 0 1 -1.3 -1.3 z" />
      <path d="M 8.09 4.82 V 9.39 h 7.18 V 5.08" />
      <rect x="8.09" y="13.31" width="7.83" height="5.87" />
    </Svg>
  )
}

export function IconUndo(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M 4.43 8.98 h 10.05 a 5.03 5.03 0 0 1 0 10.05 H 8.74" />
      <path d="M 8.46 4.96 4.43 8.98 l 4.02 4.02" />
    </Svg>
  )
}

export function IconRedo(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M 19.57 8.98 H 9.51 a 5.03 5.03 0 0 0 0 10.05 h 5.75" />
      <path d="M 15.54 4.96 19.57 8.98 l -4.02 4.02" />
    </Svg>
  )
}

export function IconCursor(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M 5.97 4.52 18.03 12.8 l -5.12 1.21 L 10.49 19.43 5.97 4.52 Z" />
    </Svg>
  )
}

export function IconPen(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m 3.78 20.22 1.17 -4.41 L 14.94 5.83 a 2.06 2.06 0 0 1 2.94 0 l 0.29 0.29 a 2.06 2.06 0 0 1 0 2.94 L 8.18 19.05 3.78 20.22 Z" />
      <path d="M 13.47 7.3 16.7 10.53" />
    </Svg>
  )
}

export function IconHighlighterPen(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M 8.85 13.89 15.53 7.21 a 1.64 1.64 0 0 1 2.39 0 l -1.13 -1.13 1.13 1.13 a 1.64 1.64 0 0 1 0 2.39 L 11.24 16.28 l -3.28 0.88 0.88 -3.28 Z" />
      <rect
        x="5.7"
        y="18.05"
        width="12.6"
        height="3.02"
        rx="1.51"
        fill="currentColor"
        stroke="none"
        opacity="0.5"
      />
    </Svg>
  )
}

export function IconEraser(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m12.495 5.29 6.765 6.765 a1.98 1.98 0 0 1 0 2.805 L14.64 19.48 H10.02 L4.74 14.2 a1.98 1.98 0 0 1 0 -2.805 l4.95 -4.95 a1.98 1.98 0 0 1 2.805 0 Z" />
      <path d="M7.875 8.92 15.63 16.675" />
      <path d="M10.02 19.48 h10.56" />
    </Svg>
  )
}

export function IconTextBox(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4.49" y="5.65" width="15.02" height="12.71" rx="1.16" />
      <path d="M 8.54 9.11 h 6.93 M 12 9.11 v 6.35" />
    </Svg>
  )
}

/** New slide (MS-style): slide frame with a title band and a split content area */
export function IconNewSlide(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4.53" y="6.4" width="14.94" height="11.21" rx="0.62" />
      <path d="M 4.53 10.13 h 14.94" />
      <path d="M 13.25 10.13 V 17.6" />
    </Svg>
  )
}

/** Section: divider + disclosure triangle, slide thumbnails grouped beneath */
export function IconSection(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M 4.53 5.78 h 14.94" />
      <path d="M 4.78 8.89 l 3.24 2.37 -3.24 2.37 z" fill="currentColor" stroke="none" />
      <rect x="10.13" y="8.89" width="9.34" height="4.36" rx="0.62" />
      <rect x="10.13" y="15.11" width="9.34" height="4.36" rx="0.62" />
    </Svg>
  )
}

export function IconRect(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4.49" y="6.8" width="15.02" height="10.4" />
    </Svg>
  )
}

export function IconRoundRect(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4.49" y="6.8" width="15.02" height="10.4" rx="2.89" />
    </Svg>
  )
}

export function IconEllipse(props: IconProps) {
  return (
    <Svg {...props}>
      <ellipse cx="12" cy="12" rx="7.51" ry="5.2" />
    </Svg>
  )
}

/** Slide show: from beginning (screen + play triangle) */
export function IconPlayFromStart(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4.49" y="5.65" width="15.02" height="10.4" rx="0.92" />
      <path d="M 10.27 8.3 v 5.08 l 4.39 -2.54 z" fill="currentColor" stroke="none" />
      <path d="M 12 16.04 v 2.31 M 9.11 18.35 h 5.78" />
    </Svg>
  )
}

/** Slide show: from current slide (half screen + play triangle) */
export function IconPlayCurrent(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M 4.49 10.27 v -3.7 a 0.92 0.92 0 0 1 0.92 -0.92 h 13.17 a 0.92 0.92 0 0 1 0.92 0.92 v 9.7 a 0.92 0.92 0 0 1 -0.92 0.92 H 12" />
      <path d="M 4.49 13.39 h 4.62 M 4.49 16.27 h 4.62 M 4.49 19.16 h 4.62" />
      <path d="M 12.23 9.23 v 5.08 l 4.39 -2.54 z" fill="currentColor" stroke="none" />
    </Svg>
  )
}

/** Presenter view: main screen + small presenter screen */
export function IconPresenterView(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4.49" y="5.65" width="10.4" height="8.09" rx="0.92" />
      <rect x="12.58" y="11.42" width="6.93" height="5.78" rx="0.92" />
      <circle cx="16.04" cy="13.62" r="1.04" />
      <path d="M 14.19 16.27 c 0.35 -1.04 3.35 -1.04 3.7 0" />
    </Svg>
  )
}

/** Custom show: screen + gear dots */
export function IconCustomShow(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4.49" y="5.65" width="15.02" height="10.4" rx="0.92" />
      <path d="M 7.96 9.11 h 8.09 M 7.96 12 h 4.62" />
      <path d="M 12 16.04 v 2.31 M 9.11 18.35 h 5.78" />
    </Svg>
  )
}

/** Set up slide show: screen + wrench slash */
export function IconSetupShow(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4.49" y="5.65" width="15.02" height="10.4" rx="0.92" />
      <path d="M 8.54 13.73 13.73 8.54 M 13.16 8.54 h 1.73 v 1.73" />
      <path d="M 12 16.04 v 2.31 M 9.11 18.35 h 5.78" />
    </Svg>
  )
}

/** Hide slide: slide + slash */
export function IconHideSlide(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="5.65" y="6.8" width="12.71" height="10.4" rx="0.92" />
      <path d="M 4.49 19.51 19.51 4.49" />
    </Svg>
  )
}

/** Rehearse timings: stopwatch */
export function IconRehearse(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="13.25" r="6.23" />
      <path d="M 12 10.13 V 13.25 l 2.24 1.74" />
      <path d="M 10.13 4.53 h 3.74 M 12 4.53 v 2.24" />
    </Svg>
  )
}

/** Record slide show: recording dot */
export function IconRecord(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="7.48" />
      <circle cx="12" cy="12" r="3.1" fill="currentColor" stroke="none" />
    </Svg>
  )
}

/** Chart: bar chart */
export function IconChart(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M 4.53 4.53 v 14.94 h 14.94" />
      <rect x="7.64" y="12" width="2.74" height="4.98" fill="currentColor" stroke="none" />
      <rect x="12" y="8.27" width="2.74" height="8.72" fill="currentColor" stroke="none" />
      <rect x="16.36" y="10.13" width="2.74" height="6.85" fill="currentColor" stroke="none" />
    </Svg>
  )
}

/** SmartArt: connected nodes */
export function IconSmartArt(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="9.11" y="4.49" width="5.78" height="4.16" rx="0.92" />
      <rect x="4.49" y="14.89" width="5.78" height="4.16" rx="0.92" />
      <rect x="13.73" y="14.89" width="5.78" height="4.16" rx="0.92" />
      <path d="M 12 8.65 v 2.77 M 12 11.42 L 7.38 14.89 M 12 11.42 l 4.62 3.47" />
    </Svg>
  )
}

/** WordArt: outlined A */
export function IconWordArt(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M 5.2 19.48 L 12 4.52 l 6.8 14.97 M 7.92 14.45 h 8.16" />
    </Svg>
  )
}

/** Icon gallery: smiley */
export function IconIconLib(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="7.47" />
      <circle cx="9.26" cy="10.13" r="0.87" fill="currentColor" stroke="none" />
      <circle cx="14.74" cy="10.13" r="0.87" fill="currentColor" stroke="none" />
      <path d="M 8.64 13.99 a 4.23 4.23 0 0 0 6.72 0" />
    </Svg>
  )
}

/** Video: film play */
export function IconVideo(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4.49" y="6.8" width="15.02" height="10.4" rx="1.62" />
      <path d="M 10.5 9.69 l 3.93 2.31 -3.93 2.31 z" fill="currentColor" stroke="none" />
    </Svg>
  )
}

/** Audio: speaker */
export function IconAudio(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M 5.15 9.76 h 2.99 L 12.62 5.78 v 12.45 L 8.14 14.24 H 5.15 z" />
      <path d="M 15.49 9.01 a 4.23 4.23 0 0 1 0 5.98 M 17.98 6.77 a 7.47 7.47 0 0 1 0 10.46" />
    </Svg>
  )
}

/** Screen recording: screen + record dot */
export function IconScreenRec(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4.49" y="5.65" width="15.02" height="10.4" rx="1.39" />
      <path d="M 9.11 18.93 h 5.78" />
      <circle cx="12" cy="10.85" r="2.31" fill="currentColor" stroke="none" />
    </Svg>
  )
}

/** 3D model: cube */
export function Icon3d(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M 12 4.47 l 6.68 3.77 v 7.53 L 12 19.53 l -6.68 -3.77 V 8.23 z" />
      <path d="M 12 12 l 6.68 -3.77 M 12 12 L 5.32 8.23 M 12 12 v 7.53" />
    </Svg>
  )
}

/** Zoom link: jump arrow + page */
export function IconZoomJump(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4.53" y="4.53" width="9.96" height="7.47" rx="1" />
      <rect x="9.51" y="12" width="9.96" height="7.47" rx="1" />
      <path d="M 14.49 8.27 l 3.74 0 M 18.22 8.27 l -1.74 -1.74 M 18.22 8.27 l -1.74 1.74" />
    </Svg>
  )
}

/** Date-time: calendar + hour hand */
export function IconDateTime(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4.93" y="6.3" width="10.83" height="10.83" rx="1.37" />
      <path d="M 4.93 9.72 h 10.83 M 8.01 4.93 V 7.44 M 13.14 4.93 V 7.44" />
      <circle cx="16.56" cy="15.99" r="3.42" fill="var(--surface, #fff)" />
      <path d="M 16.56 14.28 v 1.71 l 1.25 1.03" />
    </Svg>
  )
}

/** Format painter: brush shape + a colored stripe (representing "format") */
/** Format painter (MS-style): flat wide brush at 45° — short dark handle,
    widened trapezoid head in orange, solid orange band along the flat tip */
export function IconFormatBrush(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M18.7 3.05 20.95 5.3 17.35 8.9 15.05 6.65 z" />
      <path
        d="M15.05 6.65 17.35 8.9 17.15 12.35 10.65 18.45 5.55 13.35 11.65 6.85 z"
        stroke="var(--ribbon-accent-warm, #ED8733)"
      />
      <path
        d="M5.55 13.35 10.65 18.45 12.21 16.89 7.11 11.79 z"
        fill="var(--ribbon-accent-warm, #ED8733)"
        stroke="none"
      />
    </Svg>
  )
}

/** Object align/distribute (distinct from paragraph text alignment IconAlign*): color blocks + alignment baseline */
export function IconObjAlignLeft(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M 5.65 4.49 v 15.02" />
      <rect x="7.96" y="6.23" width="10.4" height="4.16" rx="0.69" />
      <rect x="7.96" y="13.62" width="6.35" height="4.16" rx="0.69" />
    </Svg>
  )
}

export function IconObjAlignCenterH(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M 12 4.49 v 15.02" />
      <rect x="6.23" y="6.23" width="11.55" height="4.16" rx="0.69" />
      <rect x="8.77" y="13.62" width="6.47" height="4.16" rx="0.69" />
    </Svg>
  )
}

export function IconObjAlignRight(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M 18.35 4.49 v 15.02" />
      <rect x="5.65" y="6.23" width="10.4" height="4.16" rx="0.69" />
      <rect x="9.69" y="13.62" width="6.35" height="4.16" rx="0.69" />
    </Svg>
  )
}

export function IconObjAlignTop(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M 4.49 5.65 h 15.02" />
      <rect x="6.23" y="7.96" width="4.16" height="10.4" rx="0.69" />
      <rect x="13.62" y="7.96" width="4.16" height="6.35" rx="0.69" />
    </Svg>
  )
}

export function IconObjAlignMiddle(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="6.23" y="6.23" width="4.16" height="11.55" rx="0.69" />
      <rect x="13.62" y="8.77" width="4.16" height="6.47" rx="0.69" />
      <path d="M 4.49 12 H 6.23 M 10.38 12 h 3.23 M 17.77 12 h 1.73" />
    </Svg>
  )
}

export function IconObjAlignBottom(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M 4.49 18.35 h 15.02" />
      <rect x="6.23" y="5.65" width="4.16" height="10.4" rx="0.69" />
      <rect x="13.62" y="9.69" width="4.16" height="6.35" rx="0.69" />
    </Svg>
  )
}

export function IconObjDistributeH(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4.53" y="6.4" width="3.24" height="11.21" rx="0.75" />
      <rect x="10.38" y="6.4" width="3.24" height="11.21" rx="0.75" />
      <rect x="16.23" y="6.4" width="3.24" height="11.21" rx="0.75" />
    </Svg>
  )
}

export function IconObjDistributeV(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="6.4" y="4.53" width="11.21" height="3.24" rx="0.75" />
      <rect x="6.4" y="10.38" width="11.21" height="3.24" rx="0.75" />
      <rect x="6.4" y="16.23" width="11.21" height="3.24" rx="0.75" />
    </Svg>
  )
}

export function IconSwitchRowCol(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M 6.27 9.88 A 6.47 6.47 0 0 1 17.1 7.64" />
      <path d="M 17.73 4.53 v 3.36 H 14.37" />
      <path d="M 17.73 14.12 A 6.47 6.47 0 0 1 6.9 16.36" />
      <path d="M 6.27 19.47 v -3.36 h 3.36" />
    </Svg>
  )
}

export function IconEditChartData(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="5.3" y="5.3" width="10.15" height="10.15" rx="0.86" />
      <path d="M 5.3 8.65 h 10.15 M 8.65 5.3 v 10.15" />
      <path d="M 17.62 13.19 l 1.84 1.84 -4.64 4.64 -2.48 0.65 0.65 -2.48 z" />
    </Svg>
  )
}

export function IconChangeChartType(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M 6.79 8.8 A 5.81 5.81 0 0 1 16.74 6.9" />
      <path d="M 17.45 4.3 v 3.08 H 14.37" />
      <rect x="5.6" y="13.9" width="2.96" height="5.45" fill="currentColor" stroke="none" />
      <rect x="10.34" y="11.29" width="2.96" height="8.06" fill="currentColor" stroke="none" />
      <rect x="15.08" y="12.59" width="2.96" height="6.75" fill="currentColor" stroke="none" />
    </Svg>
  )
}

// ── Animation effect icons (Animations tab; color comes from .rb-anim-* via currentColor) ──

const ANIM_EFFECT_BODIES: Record<AnimEffectKind, ReactNode> = {
  // entrance
  appear: (
    <>
      <rect x="4" y="5" width="16" height="14" rx="1.5" strokeDasharray="3 2.2" />
      <rect x="8.2" y="9.2" width="7.6" height="5.6" fill="currentColor" stroke="none" />
    </>
  ),
  fade: (
    <>
      <rect
        x="4.5"
        y="6.5"
        width="4.6"
        height="11"
        fill="currentColor"
        stroke="none"
        opacity="0.2"
      />
      <rect
        x="9.7"
        y="6.5"
        width="4.6"
        height="11"
        fill="currentColor"
        stroke="none"
        opacity="0.5"
      />
      <rect x="14.9" y="6.5" width="4.6" height="11" fill="currentColor" stroke="none" />
    </>
  ),
  flyIn: (
    <>
      <rect x="5.5" y="3.5" width="13" height="8" rx="1" />
      <path d="M12 21 V14.5 M8.8 17.4 L12 14.2 l3.2 3.2" />
    </>
  ),
  wipe: (
    <>
      <rect x="3.5" y="6" width="17" height="12" rx="1" />
      <rect x="3.5" y="6" width="8.2" height="12" fill="currentColor" stroke="none" />
      <path d="M13.3 12 h4.8 M15.9 9.8 l2.2 2.2 -2.2 2.2" />
    </>
  ),
  wipeDown: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="1" />
      <rect x="3.5" y="4.5" width="17" height="6.4" fill="currentColor" stroke="none" />
      <path d="M12 12.6 V17.3 M9.9 15.3 L12 17.4 l2.1 -2.1" />
    </>
  ),
  splitIn: (
    <>
      <rect x="3.5" y="6" width="17" height="12" rx="1" />
      <path d="M5.8 12 h4.4 M8.3 9.9 l2.1 2.1 -2.1 2.1 M18.2 12 h-4.4 M15.7 9.9 l-2.1 2.1 2.1 2.1" />
    </>
  ),
  bounce: (
    <>
      <path d="M3.5 19.5 C6 7.5, 8.5 7.5, 11 19.5 C12.8 13, 14.6 13, 16.4 19.5" />
      <circle cx="19.3" cy="17.8" r="1.9" fill="currentColor" stroke="none" />
    </>
  ),
  flipIn: (
    <>
      <rect x="4" y="6" width="7" height="12" />
      <path d="M13.5 4.2 L20 6.4 V17.6 L13.5 19.8 Z" />
    </>
  ),
  zoom: (
    <>
      <rect x="9.2" y="9.2" width="5.6" height="5.6" fill="currentColor" stroke="none" />
      <path d="M8 8 L4.5 4.5 M4.5 8 V4.5 H8" />
      <path d="M16 16 L19.5 19.5 M19.5 16 V19.5 H16" />
    </>
  ),
  // emphasis
  pulse: (
    <>
      <circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="5.6" opacity="0.65" />
      <circle cx="12" cy="12" r="9" opacity="0.35" />
    </>
  ),
  spin: (
    <>
      <path d="M12 5.4 A 6.6 6.6 0 1 1 5.4 12" />
      <path d="M3.3 13.9 L5.4 11.5 7.7 13.8" />
    </>
  ),
  grow: (
    <>
      <rect x="7.5" y="7.5" width="9" height="9" />
      <path d="M4.5 19.5 L19.5 4.5 M4.5 15.2 V19.5 H8.8 M19.5 8.8 V4.5 H15.2" />
    </>
  ),
  teeter: (
    <>
      <rect x="5" y="9.5" width="14" height="9" rx="1" transform="rotate(-8 12 14)" />
      <path d="M6 6.6 A 7.5 4.5 0 0 1 18 6.6" />
      <path d="M5.2 4.2 L6 6.8 8.6 6.1 M18.8 4.2 L18 6.8 15.4 6.1" />
    </>
  ),
  // exit
  disappear: <rect x="4" y="5" width="16" height="14" rx="1.5" strokeDasharray="3 2.2" />,
  fadeOut: (
    <>
      <rect x="4.5" y="6.5" width="4.6" height="11" fill="currentColor" stroke="none" />
      <rect
        x="9.7"
        y="6.5"
        width="4.6"
        height="11"
        fill="currentColor"
        stroke="none"
        opacity="0.5"
      />
      <rect
        x="14.9"
        y="6.5"
        width="4.6"
        height="11"
        fill="currentColor"
        stroke="none"
        opacity="0.2"
      />
    </>
  ),
  flyOut: (
    <>
      <rect x="5.5" y="3.5" width="13" height="8" rx="1" />
      <path d="M12 14.2 V20.7 M8.8 17.5 L12 20.7 l3.2 -3.2" />
    </>
  ),
  wipeOut: (
    <>
      <rect x="3.5" y="6" width="17" height="12" rx="1" />
      <rect x="12.3" y="6" width="8.2" height="12" fill="currentColor" stroke="none" />
      <path d="M10.7 12 H5.9 M8.1 9.8 L5.9 12 l2.2 2.2" />
    </>
  ),
  shrink: (
    <>
      <rect
        x="9.6"
        y="9.6"
        width="4.8"
        height="4.8"
        fill="currentColor"
        stroke="none"
        transform="rotate(15 12 12)"
      />
      <path d="M4.5 4.5 L8.3 8.3 M8.3 5.1 V8.3 H5.1" />
      <path d="M19.5 19.5 L15.7 15.7 M15.7 18.9 V15.7 H18.9" />
    </>
  ),
  zoomOut: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="1" strokeDasharray="2.6 2" />
      <path d="M5.6 5.6 L9.4 9.4 M9.4 6.2 V9.4 H6.2" />
      <path d="M18.4 18.4 L14.6 14.6 M14.6 17.8 V14.6 H17.8" />
    </>
  ),
  motionPath: (
    <>
      <path d="M4.5 6 C10 3, 14 9, 18.6 15.8" strokeDasharray="3 2.2" />
      <path d="M18.9 10.9 l0.5 5.4 -5.4 -0.6" />
    </>
  ),
}

export function AnimEffectIcon({ kind, size }: { kind: AnimEffectKind; size?: number }) {
  return <Svg size={size}>{ANIM_EFFECT_BODIES[kind]}</Svg>
}

/* ---------- transition gallery (drawn to the shared icon standard, replacing
   the old unicode text glyphs whose size and weight came from the font) ---- */

export function IconTransNone(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4.75" y="6" width="14.5" height="12" rx="1.5" />
      <path d="M6.5 16.5 17.5 7.5" />
    </Svg>
  )
}

export function IconTransMorph(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4.75 9h11.5M13.5 6.25 16.25 9l-2.75 2.75" />
      <path d="M19.25 15H7.75M10.5 17.75 7.75 15l2.75-2.75" />
    </Svg>
  )
}

export function IconTransFade(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4.75" y="4.75" width="11" height="9.5" rx="1.4" strokeDasharray="2.4 2.2" />
      <rect x="8.25" y="9.75" width="11" height="9.5" rx="1.4" />
    </Svg>
  )
}

export function IconTransPush(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4.75" y="6" width="14.5" height="12" rx="1.5" />
      <path d="M12 15.5v-6M9.25 12.25 12 9.5l2.75 2.75" />
    </Svg>
  )
}

export function IconTransWipe(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4.75" y="6" width="14.5" height="12" rx="1.5" />
      <path d="M7.5 12h6M11.25 9.75 13.5 12l-2.25 2.25" />
    </Svg>
  )
}

export function IconTransSplit(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4.75" y="6" width="14.5" height="12" rx="1.5" />
      <path d="M12 8.5v7" />
      <path d="M9.5 12H7M8.25 10.75 7 12l1.25 1.25M14.5 12H17M15.75 10.75 17 12l-1.25 1.25" />
    </Svg>
  )
}

export function IconTransCircle(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="7.25" />
      <circle cx="12" cy="12" r="3.25" />
    </Svg>
  )
}

export function IconTransCover(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M14.5 8.25V6.25a1.5 1.5 0 0 0-1.5-1.5H6.25a1.5 1.5 0 0 0-1.5 1.5V13a1.5 1.5 0 0 0 1.5 1.5h2" />
      <rect x="9.75" y="9.75" width="9.5" height="9.5" rx="1.5" />
    </Svg>
  )
}

export function IconTransPull(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4.75" y="4.75" width="9.5" height="9.5" rx="1.5" />
      <path d="M9.5 15.75v2a1.5 1.5 0 0 0 1.5 1.5h6.75a1.5 1.5 0 0 0 1.5-1.5V11a1.5 1.5 0 0 0-1.5-1.5h-2" />
    </Svg>
  )
}

export function IconTransDissolve(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4.75" y="6" width="14.5" height="12" rx="1.5" />
      <circle cx="9" cy="10" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="13.75" cy="9.25" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="15.75" cy="13.25" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="8.25" cy="14" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="12" cy="14.75" r="0.8" fill="currentColor" stroke="none" />
    </Svg>
  )
}

export function IconTransZoom(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M14 4.75h5.25V10M19 5 13.75 10.25" />
      <path d="M10 19.25H4.75V14M5 19 10.25 13.75" />
    </Svg>
  )
}

export function IconTransRandom(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="5" y="5" width="14" height="14" rx="2.5" />
      <circle cx="9.25" cy="9.25" r="1" fill="currentColor" stroke="none" />
      <circle cx="14.75" cy="9.25" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="9.25" cy="14.75" r="1" fill="currentColor" stroke="none" />
      <circle cx="14.75" cy="14.75" r="1" fill="currentColor" stroke="none" />
    </Svg>
  )
}

/* ---------- animation gallery chrome (star / none / motion paths) -------- */

export function IconAnimStar(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m12 4.5 2.15 4.9 5.35.5-4 3.6 1.15 5.25L12 16l-4.65 2.75 1.15-5.25-4-3.6 5.35-.5Z" />
    </Svg>
  )
}

export function IconAnimNone(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="7.25" />
      <path d="M6.9 17.1 17.1 6.9" />
    </Svg>
  )
}

export function IconPathRight(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4.75 12H18M14.75 8.75 18 12l-3.25 3.25" />
    </Svg>
  )
}

export function IconPathDown(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 4.75V18M8.75 14.75 12 18l3.25-3.25" />
    </Svg>
  )
}

export function IconPathDiagonal(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5.5 5.5 18 18M18 13.4V18h-4.6" />
    </Svg>
  )
}

export function IconPathCircle(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="6.75" />
      <path d="M15.5 3.9 12.7 5.2l1.3 2.75" />
    </Svg>
  )
}

export function IconPathZigzag(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4.75 15.5 8.75 9.5l3.75 5.5 4.25-6.25" />
      <path d="M17.5 12.9V8.25h-4.6" />
    </Svg>
  )
}

export function IconCrop(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8 4.75v11.25h11.25" />
      <path d="M4.75 8H16v11.25" />
    </Svg>
  )
}

export function IconNoneX(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m6.5 6.5 11 11M17.5 6.5l-11 11" />
    </Svg>
  )
}

/** AI feature glyphs shared by the ribbon Home tab and the canvas AI bar.
 * Fixed 1.5-unit stroke (not pinnedStroke) to keep the ribbon rendering,
 * where CSS sizes them; `size` is for other hosts. */
function AiFeatureSvg({ size, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  )
}

export function IconAiBeautify(props: IconProps) {
  return (
    <AiFeatureSvg {...props}>
      <path d="m9.5 11.6 7.7-7.7a2.05 2.05 0 1 1 2.9 2.9l-7.7 7.7" />
      <path d="M7.3 14.7c-1.55 0-2.8 1.26-2.8 2.82 0 1.24-1.4 1.85-1 2.3 1 1.03 2.02 1.68 3.43 1.68 2.06 0 3.73-1.68 3.73-3.77a2.81 2.81 0 0 0-2.8-2.82Z" />
    </AiFeatureSvg>
  )
}

export function IconAiFactCheck(props: IconProps) {
  return (
    <AiFeatureSvg {...props}>
      <path d="M12 3.5 5.5 5.9v4.9c0 4.2 2.7 7 6.5 8.7 3.8-1.7 6.5-4.5 6.5-8.7V5.9L12 3.5Z" />
      <path d="m9.2 11.8 2 2 3.8-3.8" />
    </AiFeatureSvg>
  )
}

export function IconAiImage(props: IconProps) {
  return (
    <AiFeatureSvg {...props}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <circle cx="9" cy="9.5" r="1.6" />
      <path d="m3.5 16.5 4.8-4.3 4.2 3.8 3.5-3 4.5 3.8" />
    </AiFeatureSvg>
  )
}

/** Genspark brand mark (rounded-square sparkle badge), inline so it renders
 * crisply at device resolution instead of going through <img> rasterization */
const IMAGEN10_DATA_URL = 'data:image/png;base64,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';

export function GensparkMark({ size = 30 }: { size?: number }) {
  return (
    <img
      src={IMAGEN10_DATA_URL}
      width={size}
      height={size}
      alt="Open Office Ai"
      style={{ borderRadius: '20%', objectFit: 'contain', display: 'inline-block', verticalAlign: 'middle' }}
    />
  );
}

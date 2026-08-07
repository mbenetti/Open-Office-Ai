/** Small monochrome SVG icons approximating Word's ribbon glyphs. */

import type { ReactNode } from 'react'

interface IconProps {
  size?: number
}

/** Constant painted stroke instead of proportional scaling: ~1.5px lines on
 *  20px+ glyphs, ~1.25px on the 13-19px ones, ~1.1px below (a proportional
 *  1-unit stroke would paint 1.75px at 28px and hairlines at small sizes).
 *  stroke-width is in 16-canvas units: units = painted-px × 16 / rendered-px. */
function pinnedStroke(size: number): number {
  const painted = size >= 20 ? 1.5 : size >= 13 ? 1.25 : 1.1
  return (painted * 16) / size
}

function Svg({ size = 20, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
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

export function IconBullets(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="3.66" cy="4.45" r="0.87" fill="currentColor" stroke="none" />
      <circle cx="3.66" cy="8" r="0.87" fill="currentColor" stroke="none" />
      <circle cx="3.66" cy="11.56" r="0.87" fill="currentColor" stroke="none" />
      <path d="M 6.42 4.45 h 6.32 M 6.42 8 h 6.32 M 6.42 11.56 h 6.32" />
    </Svg>
  )
}

export function IconNumbered(props: IconProps) {
  return (
    <Svg {...props}>
      <text
        x="1"
        y="5.4"
        fontSize="5.4"
        fill="currentColor"
        stroke="none"
        fontFamily="Segoe UI, sans-serif"
      >
        1
      </text>
      <text
        x="1"
        y="10.4"
        fontSize="5.4"
        fill="currentColor"
        stroke="none"
        fontFamily="Segoe UI, sans-serif"
      >
        2
      </text>
      <text
        x="1"
        y="15.4"
        fontSize="5.4"
        fill="currentColor"
        stroke="none"
        fontFamily="Segoe UI, sans-serif"
      >
        3
      </text>
      <path d="M6.5 3.5h8M6.5 8.5h8M6.5 13.5h8" />
    </Svg>
  )
}

export function IconMultilevel(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="2.61" y="3.84" width="1.39" height="1.39" fill="currentColor" stroke="none" />
      <path d="M 5.69 4.54 h 6.93" />
      <rect x="4.54" y="7.31" width="1.39" height="1.39" fill="currentColor" stroke="none" />
      <path d="M 7.62 8 h 5.01" />
      <rect x="6.46" y="10.77" width="1.39" height="1.39" fill="currentColor" stroke="none" />
      <path d="M 9.54 11.47 h 3.08" />
    </Svg>
  )
}

export function IconIndentDec(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M 3.02 3.44 h 9.96 M 8 6.17 h 4.98 M 8 8.41 h 4.98 M 8 10.66 h 4.98 M 3.02 12.98 h 9.96" />
      <path d="M 5.68 6.17 3.19 8.41 l 2.49 2.24 z" fill="currentColor" stroke="none" />
    </Svg>
  )
}

export function IconIndentInc(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M 3.02 3.44 h 9.96 M 8 6.17 h 4.98 M 8 8.41 h 4.98 M 8 10.66 h 4.98 M 3.02 12.98 h 9.96" />
      <path d="M 3.19 6.17 l 2.49 2.24 -2.49 2.24 z" fill="currentColor" stroke="none" />
    </Svg>
  )
}

export function IconAlignLeft(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M 3.02 3.85 h 9.96 M 3.02 6.34 h 6.64 M 3.02 8.83 h 9.96 M 3.02 11.32 h 6.64" />
    </Svg>
  )
}

export function IconAlignCenter(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M 3.02 3.85 h 9.96 M 4.68 6.34 h 6.64 M 3.02 8.83 h 9.96 M 4.68 11.32 h 6.64" />
    </Svg>
  )
}

export function IconAlignRight(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M 3.02 3.85 h 9.96 M 6.34 6.34 h 6.64 M 3.02 8.83 h 9.96 M 6.34 11.32 h 6.64" />
    </Svg>
  )
}

export function IconAlignJustify(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M 3.02 3.85 h 9.96 M 3.02 6.34 h 9.96 M 3.02 8.83 h 9.96 M 3.02 11.32 h 9.96" />
    </Svg>
  )
}

export function IconDirLtr(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M 3.02 3.85 h 9.96 M 3.02 6.34 h 6.64 M 3.02 11.32 h 7.1" />
      <path d="M 9.8 9.4 l 2.9 1.92 -2.9 1.92 z" fill="currentColor" stroke="none" />
    </Svg>
  )
}

export function IconDirRtl(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M 3.02 3.85 h 9.96 M 6.34 6.34 h 6.64 M 5.88 11.32 h 7.1" />
      <path d="M 6.2 9.4 l -2.9 1.92 2.9 1.92 z" fill="currentColor" stroke="none" />
    </Svg>
  )
}

export function IconLineSpacing(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M 8 3.9 h 4.92 M 8 6.69 h 4.92 M 8 9.48 h 4.92 M 8 12.26 h 4.92" />
      <path d="M 4.31 4.06 v 7.87 M 2.92 5.7 l 1.39 -1.64 1.39 1.64 M 2.92 10.3 l 1.39 1.64 1.39 -1.64" />
    </Svg>
  )
}

export function IconClearFormat(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M2.17 12.67 5.67 3.5l3.5 9.17M3.4 9.5h4.55" />
      <path d="m10.4 9.1 3.4 3.4M13.8 9.1l-3.4 3.4" />
    </Svg>
  )
}

export function IconGrowFont(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M2.17 12.67 5.67 3.5l3.5 9.17M3.4 9.5h4.55" />
      <path d="M12 11.67V4.5M9.93 6.57 12 4.5l2.07 2.07" />
    </Svg>
  )
}

export function IconShrinkFont(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M2.17 12.67 5.67 3.5l3.5 9.17M3.4 9.5h4.55" />
      <path d="M12 4.5v7.17M9.93 9.6 12 11.67l2.07-2.07" />
    </Svg>
  )
}

export function IconHighlight(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 10.5 9.5 4a1.4 1.4 0 0 1 2 0l0.5 0.5a1.4 1.4 0 0 1 0 2L5.5 13H3z" fill="none" />
      <path d="M2.2 13h4" strokeWidth="1" />
    </Svg>
  )
}

/* ---------- shared shapes ---------- */

/** page outline used by many icons */
const PAGE = <path d="M4.92 3h4.62l1.93 1.93v8.09h-6.55z" />

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
      <rect x="4.25" y="3.88" width="7.5" height="9" rx="0.75" />
      <rect x="6.35" y="2.9" width="3.3" height="1.95" rx="0.52" fill="var(--surface, #fff)" />
      <path d="M 6.13 6.88 h 3.75 M 6.13 8.75 h 3.75 M 6.13 10.63 h 2.25" />
    </Svg>
  )
}

export function IconCut(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M 10.91 3.02 6.01 9.99 M 5.1 3.02 l 4.9 6.97" />
      <circle cx="4.85" cy="11.32" r="1.66" />
      <circle cx="11.15" cy="11.32" r="1.66" />
    </Svg>
  )
}

export function IconCopy(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="6.08" y="5.31" width="6.16" height="7.7" rx="0.77" />
      <path d="M 9.93 5.31 v -1.54 a 0.77 0.77 0 0 0 -0.77 -0.77 h -4.62 a 0.77 0.77 0 0 0 -0.77 0.77 v 6.93 a 0.77 0.77 0 0 0 0.77 0.77 h 1.54" />
    </Svg>
  )
}

export function IconFormatPainter(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="3.2" width="8" height="3.2" rx="0.64" />
      <path d="M 12 4.8 h 1.2 v 3.2 H 8.4 v 1.6" />
      <rect x="7.2" y="9.6" width="2.4" height="3.6" rx="0.64" fill="currentColor" stroke="none" />
    </Svg>
  )
}

/* ---------- Insert ---------- */

export function IconTable(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.02" y="3.44" width="9.96" height="9.13" rx="0.66" />
      <path d="M 3.02 6.51 h 9.96 M 3.02 9.58 h 9.96 M 6.34 3.44 v 9.13 M 9.66 3.44 v 9.13" />
    </Svg>
  )
}

export function IconPicture(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.02" y="3.85" width="9.96" height="8.3" rx="0.66" />
      <circle cx="5.84" cy="6.51" r="0.91" />
      <path d="M 3.44 11.32 6.76 8 l 2.49 2.49 1.66 -1.66 1.66 1.66" />
    </Svg>
  )
}

export function IconRemoveBg(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.02" y="3.85" width="9.96" height="8.3" rx="0.66" strokeDasharray="2.2 1.6" />
      <circle cx="8" cy="6.92" r="1.41" />
      <path d="M 5.43 12.15 c 0.33 -1.91 1.41 -2.9 2.57 -2.9 s 2.24 1 2.57 2.91" />
    </Svg>
  )
}

export function IconCrop(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M 5.41 2.97 v 7.62 h 7.62" />
      <path d="M 2.97 5.41 h 7.62 v 7.62" />
    </Svg>
  )
}

export function IconReplacePicture(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="2.87" y="6.03" width="7.11" height="6.32" rx="0.63" />
      <circle cx="4.92" cy="8" r="0.71" />
      <path d="M 3.26 11.79 l 2.13 -2.13 1.5 1.5 1.11 -1.11 1.42 1.42" />
      <path d="M 9.19 3.73 h 3.63 m 0 0 -1.34 -1.26 m 1.34 1.26 -1.34 1.26" />
    </Svg>
  )
}

export function IconChart(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M 2.99 2.99 v 10.01 h 10.01" />
      <rect x="4.81" y="8" width="1.82" height="5.01" />
      <rect x="7.55" y="5.27" width="1.82" height="7.74" />
      <rect x="10.27" y="6.64" width="1.82" height="6.37" />
    </Svg>
  )
}

export function IconShapes(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="6.28" cy="6.28" r="3.1" />
      <rect x="7.57" y="7.57" width="5.59" height="5.59" rx="0.69" fill="var(--surface, #fff)" />
    </Svg>
  )
}

export function IconLink(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M 6.91 9.09 9.09 6.91" />
      <path d="M 7.55 5.09 8.91 3.72 a 2.37 2.37 0 0 1 3.37 3.37 L 10.91 8.46" />
      <path d="M 8.46 10.91 7.09 12.28 a 2.37 2.37 0 0 1 -3.37 -3.37 l 1.37 -1.36" />
    </Svg>
  )
}

export function IconComment(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M 2.99 3.91 h 10.01 v 6.83 h -5.46 L 4.81 13.46 v -2.73 h -1.82 z" />
      <path d="M 5.27 6.18 h 5.46 M 5.27 8.46 h 3.64" />
    </Svg>
  )
}

export function IconPageBreak(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M 4.92 3 h 6.16 v 3.47 M 4.92 3 v 3.47 M 4.92 13.01 h 6.16 v -3.46 M 4.92 13.01 v -3.46" />
      <path
        d="M 3 8 h 1.54 M 5.69 8 h 1.54 M 8.39 8 h 1.54 M 11.08 8 h 1.93"
        strokeDasharray="none"
      />
    </Svg>
  )
}

export function IconHeader(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4.15" y="3" width="7.7" height="10.01" rx="0.62" />
      <path d="M 5.31 4.92 h 5.39 M 5.31 6.31 h 5.39" strokeWidth="1" opacity="0.9" />
    </Svg>
  )
}

export function IconFooter(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4.15" y="3" width="7.7" height="10.01" rx="0.62" />
      <path d="M 5.31 9.69 h 5.39 M 5.31 11.08 h 5.39" strokeWidth="1" opacity="0.9" />
    </Svg>
  )
}

export function IconPageNumber(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4.15" y="3" width="7.7" height="10.01" rx="0.62" />
      <TextGlyph x={6.15} y={10.31} s={5.39}>
        #
      </TextGlyph>
    </Svg>
  )
}

export function IconSymbol(props: IconProps) {
  return (
    <Svg {...props}>
      <TextGlyph x={3.2} y={13} s={13}>
        Ω
      </TextGlyph>
    </Svg>
  )
}

export function IconEquation(props: IconProps) {
  return (
    <Svg {...props}>
      <TextGlyph x={4} y={12.5} s={12}>
        π
      </TextGlyph>
    </Svg>
  )
}

/* ---------- Table Design / Layout ---------- */

export function IconTableDelete(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.26" y="3.62" width="8.03" height="7.3" rx="0.58" />
      <path
        d="M 3.26 6.03 h 8.03 M 3.26 8.51 h 8.03 M 5.96 3.62 v 7.3 M 8.58 3.62 v 7.3"
        strokeWidth="1"
      />
      <path d="M 9.17 9.17 h 4.09 v 4.09 H 9.17 z" fill="var(--surface, #fff)" stroke="none" />
      <path d="m 9.97 9.97 2.63 2.63 M 12.6 9.97 l -2.63 2.63" strokeWidth="1" />
    </Svg>
  )
}

export function IconRowInsertAbove(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M 8 6.18 V 2.98 M 6.63 4.35 8 2.98 l 1.37 1.37" />
      <rect x="3.44" y="7.62" width="9.12" height="5.32" rx="0.61" />
      <path d="M 3.44 10.28 h 9.12 M 8 7.62 v 5.32" strokeWidth="1" />
    </Svg>
  )
}

export function IconRowInsertBelow(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.44" y="3.06" width="9.12" height="5.32" rx="0.61" />
      <path d="M 3.44 5.72 h 9.12 M 8 3.06 v 5.32" strokeWidth="1" />
      <path d="M 8 9.82 v 3.19 M 6.63 11.65 8 13.02 l 1.37 -1.37" />
    </Svg>
  )
}

export function IconColInsertLeft(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M 6.18 8 H 2.98 M 4.35 6.63 2.98 8 l 1.37 1.37" />
      <rect x="7.62" y="3.44" width="5.32" height="9.12" rx="0.61" />
      <path d="M 10.28 3.44 v 9.12 M 7.62 8 h 5.32" strokeWidth="1" />
    </Svg>
  )
}

export function IconColInsertRight(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.06" y="3.44" width="5.32" height="9.12" rx="0.61" />
      <path d="M 5.72 3.44 v 9.12 M 3.06 8 h 5.32" strokeWidth="1" />
      <path d="M 9.82 8 h 3.19 M 11.65 6.63 13.02 8 l -1.37 1.37" />
    </Svg>
  )
}

export function IconMergeCells(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="4.15" width="10.01" height="7.7" rx="0.62" />
      <path d="M 8 4.15 v 1.54 M 8 10.31 v 1.54" strokeWidth="1" />
      <path d="M 4.46 8 h 2.31 M 5.77 7 6.77 8 5.77 9" />
      <path d="M 11.54 8 h -2.31 M 10.23 7 9.23 8 l 1 1" />
    </Svg>
  )
}

export function IconSplitCells(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="4.15" width="10.01" height="7.7" rx="0.62" />
      <path d="M 8 4.15 v 7.7" strokeWidth="1" />
      <path d="M 6.92 8 h -2.31 M 5.61 7 4.61 8 l 1 1" />
      <path d="M 9.08 8 h 2.31 M 10.39 7 11.39 8 l -1 1" />
    </Svg>
  )
}

export function IconRowDelete(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.02" y="3.44" width="9.96" height="9.13" rx="0.66" />
      <path d="M 3.02 6.51 h 9.96 M 3.02 9.49 h 9.96" strokeWidth="1" />
      <path d="m 6.01 6.92 3.98 2.16 M 9.99 6.92 6.01 9.08" />
    </Svg>
  )
}

export function IconColDelete(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.44" y="3.02" width="9.13" height="9.96" rx="0.66" />
      <path d="M 6.51 3.02 v 9.96 M 9.49 3.02 v 9.96" strokeWidth="1" />
      <path d="m 6.92 6.01 2.16 3.98 M 9.08 6.01 6.92 9.99" />
    </Svg>
  )
}

export function IconCellAlignTop(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.02" y="3.44" width="9.96" height="9.13" rx="0.66" />
      <path d="M 5.1 5.68 h 5.81 M 5.1 7.5 h 3.74" />
    </Svg>
  )
}

export function IconCellAlignMiddle(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.02" y="3.44" width="9.96" height="9.13" rx="0.66" />
      <path d="M 5.1 7.09 h 5.81 M 5.1 8.91 h 3.74" />
    </Svg>
  )
}

export function IconCellAlignBottom(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.02" y="3.44" width="9.96" height="9.13" rx="0.66" />
      <path d="M 5.1 8.5 h 5.81 M 5.1 10.32 h 3.74" />
    </Svg>
  )
}

export function IconBorderAll(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.02" y="3.02" width="9.96" height="9.96" rx="0.42" />
      <path d="M 3.02 8 h 9.96 M 8 3.02 v 9.96" />
    </Svg>
  )
}

export function IconBorderOuter(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.02" y="3.02" width="9.96" height="9.96" rx="0.42" />
      <path
        d="M 3.02 8 h 9.96 M 8 3.02 v 9.96"
        strokeWidth="1"
        strokeDasharray="1.5 1.7"
        opacity="0.55"
      />
    </Svg>
  )
}

export function IconBorderInner(props: IconProps) {
  return (
    <Svg {...props}>
      <rect
        x="3.02"
        y="3.02"
        width="9.96"
        height="9.96"
        rx="0.42"
        strokeWidth="1"
        strokeDasharray="1.5 1.7"
        opacity="0.55"
      />
      <path d="M 3.02 8 h 9.96 M 8 3.02 v 9.96" />
    </Svg>
  )
}

export function IconBorderNone(props: IconProps) {
  return (
    <Svg {...props}>
      <rect
        x="3.02"
        y="3.02"
        width="9.96"
        height="9.96"
        rx="0.42"
        strokeWidth="1"
        strokeDasharray="1.5 1.7"
        opacity="0.55"
      />
      <path
        d="M 3.02 8 h 9.96 M 8 3.02 v 9.96"
        strokeWidth="1"
        strokeDasharray="1.5 1.7"
        opacity="0.55"
      />
    </Svg>
  )
}

/* ---------- Design ---------- */

export function IconTheme(props: IconProps) {
  return (
    <Svg {...props}>
      <TextGlyph x={1.5} y={11.5} s={11}>
        A
      </TextGlyph>
      <TextGlyph x={8.5} y={11.5} s={8}>
        a
      </TextGlyph>
      <path d="M2.5 13.8h11" strokeWidth="1" />
    </Svg>
  )
}

export function IconThemeFonts(props: IconProps) {
  return (
    <Svg {...props}>
      <TextGlyph x={2} y={12} s={11}>
        F
      </TextGlyph>
      <path d="M9.5 12 12 4.5 14.5 12M10.3 9.6h3.4" strokeWidth="1" />
    </Svg>
  )
}

export function IconThemeColors(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="4.89" cy="5.33" r="1.87" />
      <circle cx="11.11" cy="5.33" r="1.87" />
      <circle cx="4.89" cy="11.11" r="1.87" />
      <circle cx="11.11" cy="11.11" r="1.87" fill="currentColor" />
    </Svg>
  )
}

export function IconPageColor(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M 8.56 3.36 4.4 7.52 a 1.04 1.04 0 0 0 0 1.44 l 2.64 2.64 a 1.04 1.04 0 0 0 1.44 0 l 4.16 -4.16 z" />
      <path d="M 8.56 3.36 7.2 4.8" />
      <path
        d="M 12.48 10.08 s 1.12 1.36 1.12 2.16 a 1.12 1.12 0 0 1 -2.24 0 c 0 -0.8 1.12 -2.16 1.12 -2.16 z"
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
      <path d="M 5.84 10.7 10.16 5.69" strokeWidth="1" opacity="0.45" />
    </Svg>
  )
}

export function IconPageBorders(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.02" y="3.02" width="9.96" height="9.96" rx="0.66" />
      <rect x="5.01" y="5.01" width="5.98" height="5.98" />
    </Svg>
  )
}

/* ---------- Layout ---------- */

export function IconMargins(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4.15" y="3" width="7.7" height="10.01" rx="0.62" />
      <rect x="5.84" y="4.69" width="4.31" height="6.62" strokeDasharray="1.6 1.4" />
    </Svg>
  )
}

export function IconOrientation(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.2" y="4.8" width="6" height="8" rx="0.64" />
      <rect x="6" y="7.6" width="7.2" height="5.2" rx="0.64" fill="var(--surface, #fff)" />
      <path d="M 10.4 3.36 a 4 4 0 0 1 2.4 2.08 M 12.8 3.6 v 2 h -2" strokeWidth="1" />
    </Svg>
  )
}

export function IconPageSize(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4.15" y="3" width="7.7" height="10.01" rx="0.62" />
      <path
        d="M 6.08 8 h 3.85 M 8 6.08 v 3.85 M 7 7 6.08 6.08 m 3.08 0 -0.92 0.92 m 0 2.77 0.92 0.92 m -3.08 0 0.92 -0.92"
        strokeWidth="1"
      />
    </Svg>
  )
}

export function IconColumns(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M 2.99 3.45 h 4.1 M 2.99 5.73 h 4.1 M 2.99 8 h 4.1 M 2.99 10.27 h 4.1 M 2.99 12.55 h 4.1" />
      <path d="M 8.91 3.45 h 4.1 M 8.91 5.73 h 4.1 M 8.91 8 h 4.1 M 8.91 10.27 h 4.1 M 8.91 12.55 h 4.1" />
    </Svg>
  )
}

/* ---------- References ---------- */

export function IconToc(props: IconProps) {
  return (
    <Svg {...props}>
      {PAGE}
      <path d="M 6.08 5.69 h 3.85 M 7 7.46 h 2.93 M 7 9.23 h 2.93 M 6.08 11 h 3.85" />
    </Svg>
  )
}

export function IconRefresh(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M 12.68 6.65 a 4.86 4.86 0 0 0 -9 -1.08 M 3.32 9.35 a 4.86 4.86 0 0 0 9 1.08" />
      <path d="M 12.95 3.05 v 2.7 h -2.7 M 3.05 12.95 v -2.7 h 2.7" />
    </Svg>
  )
}

export function IconFootnote(props: IconProps) {
  return (
    <Svg {...props}>
      <TextGlyph x={1.5} y={12} s={9}>
        AB
      </TextGlyph>
      <TextGlyph x={11.5} y={8} s={7} bold>
        1
      </TextGlyph>
    </Svg>
  )
}

export function IconEndnote(props: IconProps) {
  return (
    <Svg {...props}>
      <TextGlyph x={1.5} y={12} s={9}>
        AB
      </TextGlyph>
      <TextGlyph x={11.3} y={8} s={7} bold>
        n
      </TextGlyph>
    </Svg>
  )
}

export function IconCitation(props: IconProps) {
  // drawn quote marks, not a font glyph: text quotes hug the ascender line, so
  // the old TextGlyph version floated small at the top of the canvas
  return (
    <Svg {...props}>
      <path
        d="M6.9 4.9c-2 .7-3.3 2.3-3.3 4.3 0 1.3.9 2.3 2.1 2.3s2.1-1 2.1-2.2c0-1.2-.8-2.1-1.9-2.1.3-.8 1-1.4 1.9-1.8z"
        fill="currentColor"
        stroke="none"
      />
      <path
        d="M12.9 4.9c-2 .7-3.3 2.3-3.3 4.3 0 1.3.9 2.3 2.1 2.3s2.1-1 2.1-2.2c0-1.2-.8-2.1-1.9-2.1.3-.8 1-1.4 1.9-1.8z"
        fill="currentColor"
        stroke="none"
      />
    </Svg>
  )
}

export function IconBook(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M 8 4.09 C 6.96 3.3 5.22 2.95 3.22 3.13 v 9.05 c 2 -0.17 3.74 0.17 4.79 0.96 1.04 -0.78 2.78 -1.13 4.79 -0.96 V 3.13 c -2 -0.17 -3.74 0.17 -4.78 0.96 z" />
      <path d="M 8 4.09 v 9.05" />
    </Svg>
  )
}

export function IconCaption(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M 3.02 5.1 h 7.06 L 12.98 8 l -2.9 2.91 H 3.02 z" />
      <circle cx="5.51" cy="8" r="0.75" fill="currentColor" stroke="none" />
    </Svg>
  )
}

export function IconIndex(props: IconProps) {
  return (
    <Svg {...props}>
      <TextGlyph x={1.8} y={6.5} s={6.5}>
        A
      </TextGlyph>
      <TextGlyph x={1.8} y={13.5} s={6.5}>
        B
      </TextGlyph>
      <path d="M8 4.5h6M8 8h6M8 11.5h6" />
    </Svg>
  )
}

/* ---------- Review ---------- */

export function IconWordCount(props: IconProps) {
  return (
    <Svg {...props}>
      <TextGlyph x={1.6} y={8} s={8}>
        123
      </TextGlyph>
      <path d="M2 11h12M2 13.5h8" />
    </Svg>
  )
}

export function IconSpellcheck(props: IconProps) {
  return (
    <Svg {...props}>
      <TextGlyph x={1.4} y={8.5} s={7.5}>
        abc
      </TextGlyph>
      <path d="M6 11.5 8.5 13.5 13 7.5" strokeWidth="1" />
    </Svg>
  )
}

export function IconSparkle(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        d="M 8 3.03 C 8 5.78 10.22 8 12.97 8 C 10.22 8 8 10.22 8 12.97 C 8 10.22 5.78 8 3.03 8 C 5.78 8 8 5.78 8 3.03 Z"
        fill="currentColor"
        stroke="none"
      />
    </Svg>
  )
}

export function IconWand(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M 3.6 12.4 9.6 6.4" strokeWidth="1" />
      <path
        d="M 11.04 2.8 l 0.56 1.52 1.52 0.56 -1.52 0.56 -0.56 1.52 -0.56 -1.52 -1.52 -0.56 1.52 -0.56 z"
        fill="currentColor"
        stroke="none"
      />
      <path
        d="M 12.4 8.4 l 0.32 0.88 0.88 0.32 -0.88 0.32 -0.32 0.88 -0.32 -0.88 -0.88 -0.32 0.88 -0.32 z"
        fill="currentColor"
        stroke="none"
      />
    </Svg>
  )
}

export function IconTranslate(props: IconProps) {
  return (
    <Svg {...props}>
      <TextGlyph x={1.2} y={9} s={8.5}>
        文
      </TextGlyph>
      <path d="M8.8 13.5 11.5 6.5 14.2 13.5M9.7 11.3h3.6" strokeWidth="1" />
    </Svg>
  )
}

export function IconTrackChanges(props: IconProps) {
  return (
    <Svg {...props}>
      {PAGE}
      <path d="M 6.08 6.08 h 3.85 M 6.08 8 h 2.31" />
      <path
        d="M 8.38 12 12.31 8.08 l 0.92 0.92 -3.93 3.93 -1.39 0.46 z"
        fill="var(--surface, #fff)"
      />
    </Svg>
  )
}

export function IconAccept(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M 3.91 9.36 7.09 12.55 l 6.83 -7.28" />
    </Svg>
  )
}

export function IconReject(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m4.5 4.5 9 9M13.5 4.5l-9 9" />
    </Svg>
  )
}

export function IconCompare(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="4.15" width="4.24" height="7.7" rx="0.62" />
      <rect x="8.77" y="4.15" width="4.24" height="7.7" rx="0.62" />
      <path d="M 6.46 8 h 3.08 M 8.46 6.92 9.54 8 l -1.08 1.08" strokeWidth="1" />
    </Svg>
  )
}

export function IconLock(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4.27" y="7.17" width="7.47" height="6.23" rx="0.83" />
      <path d="M 5.93 7.17 V 5.51 a 2.07 2.07 0 0 1 4.15 0 v 1.66" />
      <circle cx="8" cy="10.07" r="0.83" fill="currentColor" stroke="none" />
    </Svg>
  )
}

/* ---------- View ---------- */

function Magnifier({ children }: { children?: ReactNode }) {
  return (
    <>
      <circle cx="7.15" cy="7.15" r="4.08" />
      <path d="M 10.21 10.21 13.1 13.1" strokeWidth="1" />
      {children}
    </>
  )
}

export function IconZoomOut(props: IconProps) {
  return (
    <Svg {...props}>
      <Magnifier>
        <path d="M 5.28 7.15 h 3.74" />
      </Magnifier>
    </Svg>
  )
}

export function IconZoomIn(props: IconProps) {
  return (
    <Svg {...props}>
      <Magnifier>
        <path d="M 5.28 7.15 h 3.74 M 7.15 5.28 v 3.74" />
      </Magnifier>
    </Svg>
  )
}

export function IconZoom100(props: IconProps) {
  return (
    <Svg {...props}>
      <Magnifier>
        <TextGlyph x={4.43} y={8.85} s={4.25} bold>
          1:1
        </TextGlyph>
      </Magnifier>
    </Svg>
  )
}

export function IconPageWidth(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.02" y="3.02" width="9.96" height="9.96" rx="0.66" />
      <path
        d="M 4.68 8 h 6.64 M 6.17 6.51 4.68 8 l 1.49 1.49 M 9.83 6.51 11.32 8 l -1.49 1.49"
        strokeWidth="1"
      />
    </Svg>
  )
}

export function IconWholePage(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4.15" y="3" width="7.7" height="10.01" rx="0.62" />
      <path d="M 6.08 8 h 3.85 M 8 6.08 v 3.85" strokeWidth="1" />
    </Svg>
  )
}

export function IconAiPanel(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="3.76" width="10.01" height="8.47" rx="0.62" />
      <path d="M 9.39 3.76 v 8.47" />
      <path
        d="M 10.31 6.61 l 0.39 1 1 0.39 -1 0.39 -0.38 1 -0.38 -1 -1 -0.38 1 -0.38 z"
        fill="currentColor"
        stroke="none"
      />
    </Svg>
  )
}

export function IconMoon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M 12.52 9.57 A 5.05 5.05 0 0 1 6.43 3.48 a 5.05 5.05 0 1 0 6.09 6.09 z" />
    </Svg>
  )
}

export function IconReadMode(props: IconProps) {
  return <IconBook {...props} />
}

export function IconOutlineView(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="3.65" cy="4.09" r="0.87" fill="currentColor" stroke="none" />
      <path d="M 5.83 4.09 h 6.96" />
      <circle cx="5.83" cy="8" r="0.87" fill="currentColor" stroke="none" />
      <path d="M 8 8 h 4.79" />
      <circle cx="5.83" cy="11.92" r="0.87" fill="currentColor" stroke="none" />
      <path d="M 8 11.92 h 4.79" />
    </Svg>
  )
}

export function IconRuler(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="6.08" width="10.01" height="3.85" rx="0.62" />
      <path
        d="M 5.31 6.08 v 1.54 M 7.23 6.08 v 2.31 M 9.16 6.08 v 1.54 M 11.08 6.08 v 2.31"
        strokeWidth="1"
      />
    </Svg>
  )
}

export function IconNavPane(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="3.76" width="10.01" height="8.47" rx="0.62" />
      <path d="M 6.46 3.76 v 8.47" />
      <path d="M 4 5.69 h 1.54 M 4 7.62 h 1.54 M 4 9.54 h 1.54" strokeWidth="1" />
    </Svg>
  )
}

export function IconSplit(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.02" y="3.02" width="9.96" height="9.96" rx="0.66" />
      <path d="M 3.02 8 h 9.96" strokeWidth="1" />
    </Svg>
  )
}

export function IconPrintLayout(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4.54" y="3" width="6.93" height="10.01" rx="0.62" />
      <path
        d="M 6.08 5.31 h 3.85 M 6.08 7.23 h 3.85 M 6.08 9.16 h 3.85 M 6.08 11.08 h 2.31"
        strokeWidth="1"
      />
    </Svg>
  )
}

export function IconWebLayout(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="3.76" width="10.01" height="8.47" rx="0.62" />
      <path d="M 3 5.69 h 10.01" />
      <path d="M 4.54 7.62 h 6.93 M 4.54 9.16 h 6.93 M 4.54 10.7 h 4.62" strokeWidth="1" />
    </Svg>
  )
}

export function IconGridlines(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.02" y="3.02" width="9.96" height="9.96" rx="0.66" />
      <path
        d="M 3.02 6.34 h 9.96 M 3.02 9.66 h 9.96 M 6.34 3.02 v 9.96 M 9.66 3.02 v 9.96"
        strokeWidth="1"
      />
    </Svg>
  )
}

export function IconNewWindow(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="5.31" width="7.7" height="7.7" rx="0.62" />
      <path d="M 5.31 5.31 v -1.54 a 0.77 0.77 0 0 1 0.77 -0.77 h 6.16 a 0.77 0.77 0 0 1 0.77 0.77 v 6.16 a 0.77 0.77 0 0 1 -0.77 0.77 h -1.54" />
      <path d="M 6.85 9.16 h 3.08 M 8.39 7.62 v 3.08" />
    </Svg>
  )
}

export function IconArrangeAll(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="3.38" width="10.01" height="4" rx="0.62" />
      <rect x="3" y="8.62" width="10.01" height="4" rx="0.62" />
    </Svg>
  )
}

export function IconSwitchWindows(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="6.08" width="6.93" height="6.16" rx="0.62" />
      <path d="M 5.69 6.08 v -1.54 a 0.77 0.77 0 0 1 0.77 -0.77 h 5.78 a 0.77 0.77 0 0 1 0.77 0.77 v 5.39 a 0.77 0.77 0 0 1 -0.77 0.77 h -2.31" />
    </Svg>
  )
}

export function IconPosition(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="3" width="10.01" height="10.01" rx="0.77" />
      <rect x="5.69" y="5.69" width="4.62" height="4.62" />
    </Svg>
  )
}

export function IconWrapText(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="5.69" width="4.62" height="4.62" />
      <path d="M 9.16 3.38 h 3.85 M 9.16 5.69 h 3.85 M 9.16 8 h 3.85 M 9.16 10.31 h 3.85 M 3 12.62 h 10.01 M 3 3.38 h 4.62" />
    </Svg>
  )
}

export function IconDoc(props: IconProps) {
  return (
    <Svg {...props}>
      {PAGE}
      <path d="M 9.54 3 V 4.92 h 1.93" />
      <path d="M 6.08 6.84 h 3.85 M 6.08 8.77 h 3.85 M 6.08 10.7 h 2.7" />
    </Svg>
  )
}

/* ---------- AI panel ---------- */

export function IconSend(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M 3.01 8 12.99 3.36 10.58 12.64 7.66 9.38 z" strokeLinejoin="round" />
      <path d="M 7.66 9.38 12.99 3.36" />
    </Svg>
  )
}

export function IconStop(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="3" width="10" height="10" rx="1.88" fill="currentColor" stroke="none" />
    </Svg>
  )
}

export function IconGear(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="8" cy="8" r="1.78" />
      <path d="M 8 2.98 v 1.62 M 8 11.4 v 1.62 M 13.02 8 h -1.62 M 4.6 8 h -1.62 M 11.56 4.44 l -1.13 1.13 M 5.57 10.43 l -1.13 1.13 M 11.56 11.56 10.43 10.43 M 5.57 5.57 4.44 4.44" />
    </Svg>
  )
}

/** collapse the right sidebar: panel outline + arrow pushing into it */
export function IconSidebarCollapse(props: IconProps) {
  // Mirrored glyph: the AI panel docks on the LEFT, so the divider and arrow point left
  return (
    <Svg {...props}>
      <rect x="3" y="3.76" width="10.01" height="8.47" rx="0.77" />
      <path d="M 6.07 3.76 v 8.47" />
      <path
        d="M 11.46 8 h -3.39 M 9.39 6.38 7.77 8 l 1.62 1.62"
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

export function IconClock(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="8" cy="8" r="4.98" />
      <path d="M 8 5.34 V 8 l 1.91 1.33" />
    </Svg>
  )
}

export function IconPaperclip(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        d="M 12.5 7.28 8.18 11.6 a 3.06 3.06 0 0 1 -4.32 -4.32 l 4.5 -4.5 a 2.07 2.07 0 0 1 2.88 2.88 l -4.5 4.5 a 0.99 0.99 0 0 1 -1.44 -1.44 l 4.14 -4.14"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

export function IconNewChat(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        d="M 12.68 7.32 v -2.55 A 1.44 1.44 0 0 0 11.23 3.33 H 4.77 a 1.44 1.44 0 0 0 -1.44 1.44 v 5.19 a 1.44 1.44 0 0 0 1.44 1.44 h 0.94 v 1.7 l 2.21 -1.7 h 1.11"
        strokeLinejoin="round"
      />
      <path d="M 11.57 9.19 v 3.4 M 9.87 10.89 h 3.4" />
    </Svg>
  )
}

/* ---------- titlebar quick access ---------- */

export function IconSave(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M 3.22 4.09 a 0.87 0.87 0 0 1 0.87 -0.87 h 6.96 L 13.22 5.39 v 6.53 a 0.87 0.87 0 0 1 -0.87 0.87 H 4.09 a 0.87 0.87 0 0 1 -0.87 -0.87 z" />
      <path d="M 5.39 3.22 V 6.26 h 4.79 V 3.39" />
      <rect x="5.39" y="8.87" width="5.22" height="3.92" />
    </Svg>
  )
}

export function IconUndo(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 6.5h7a3.5 3.5 0 0 1 0 7H6" />
      <path d="M5.8 3.7 3 6.5l2.8 2.8" />
    </Svg>
  )
}

export function IconRedo(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M13 6.5H6a3.5 3.5 0 0 0 0 7h4" />
      <path d="M10.2 3.7 13 6.5l-2.8 2.8" />
    </Svg>
  )
}

export function IconCursor(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 2.5 12 8l-3.4.8L7 12.4 4 2.5Z" />
    </Svg>
  )
}

export function IconPen(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m3 13 .8-3L10.6 3.2a1.4 1.4 0 0 1 2 0l.2.2a1.4 1.4 0 0 1 0 2L6 12.2 3 13Z" />
      <path d="M9.6 4.2 11.8 6.4" />
    </Svg>
  )
}

export function IconHighlighterPen(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M 5.68 9.4 10.6 4.47 a 1.21 1.21 0 0 1 1.77 0 l -0.84 -0.84 0.84 0.84 a 1.21 1.21 0 0 1 0 1.77 L 7.44 11.16 l -2.42 0.65 0.65 -2.42 Z" />
      <path d="M 3.35 13.58 h 9.3" strokeWidth="1" opacity="0.5" />
    </Svg>
  )
}

export function IconEraser(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m8.3 3.6 4.1 4.1a1.2 1.2 0 0 1 0 1.7L9.6 12.2H6.8L3.6 9a1.2 1.2 0 0 1 0-1.7l3-3a1.2 1.2 0 0 1 1.7 0Z" />
      <path d="M5.5 5.8 10.2 10.5" />
      <path d="M6.8 12.2h6.4" />
    </Svg>
  )
}

export function IconTextBox(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="4.7" width="10" height="6.6" rx="0.85" />
      <path d="M5.5 7.2h5" />
      <path d="M8 7.2v3.3" />
    </Svg>
  )
}

export function IconWordArt(props: IconProps) {
  return (
    <Svg {...props}>
      {/* stylized A with gradient effect hint */}
      <path d="M8 3 3.5 13h2.3l1-2.5h2.4l1 2.5h2.3L8 3Z" />
      <path d="M5.6 9.2h4.8" />
    </Svg>
  )
}

export function IconTrash(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3.11 4.89h9.79M6.4 4.89V3.73a.62.62 0 0 1 .62-.62h1.96a.62.62 0 0 1 .62.62v1.16" />
      <path d="M4.44 4.89l.62 7.39a.89.89 0 0 0 .89.8h4.09a.89.89 0 0 0 .89-.8l.62-7.39" />
      <path d="M6.75 7.11v3.56M9.25 7.11v3.56" />
    </Svg>
  )
}

/** Thin dropdown chevron replacing the ▾ text glyph (same path as the slides ribbon's RbCaret);
 *  1.5 stroke on a 24 viewBox keeps the 1 : 16 stroke : canvas ratio. */
export function IconCaret({ size = 10 }: IconProps) {
  return (
    <svg
      className="rb-caret-svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5.5 9.25 12 15.75l6.5-6.5" />
    </svg>
  )
}

export function IconPalette(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8 12.98a4.98 4.98 0 1 1 4.98-4.98c0 2.44-1.74 2.49-2.74 2.49-.8 0-1.25.5-1.25 1.25 0 .7-.45 1.25-1 1.25Z" />
      <circle cx="8.83" cy="4.93" r="0.71" fill="currentColor" stroke="none" />
      <circle cx="11.07" cy="6.71" r="0.71" fill="currentColor" stroke="none" />
      <circle cx="6.09" cy="5.51" r="0.71" fill="currentColor" stroke="none" />
      <circle cx="4.93" cy="8.25" r="0.71" fill="currentColor" stroke="none" />
    </Svg>
  )
}

export function IconSort(props: IconProps) {
  return (
    <Svg {...props}>
      <TextGlyph x={1.5} y={7.2} s={7}>
        A
      </TextGlyph>
      <TextGlyph x={1.5} y={14.5} s={7}>
        Z
      </TextGlyph>
      <path d="M11.5 2.5V13M11.5 13 9.3 10.8M11.5 13l2.2-2.2" />
    </Svg>
  )
}

export function IconPilcrow(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M 12.1 2.99 H 7.45 a 2.73 2.73 0 0 0 0 5.46 h 1.91 M 9.36 2.99 v 10.01 M 12.1 2.99 v 10.01" />
    </Svg>
  )
}

export function IconShading(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="2.99" y="3.91" width="10.01" height="8.19" rx="0.46" />
      <path
        d="M 2.99 7.55 6.64 3.91 M 2.99 11.18 10.27 3.91 M 5.27 12.1 13.01 4.36 M 8.91 12.1 13.01 8"
        opacity="0.55"
      />
    </Svg>
  )
}

export function IconCheck(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M2.8 8.6 6.2 12l7-7.5" />
    </Svg>
  )
}

export function IconCheckbox(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="2.99" y="2.99" width="10.01" height="10.01" rx="1.37" />
    </Svg>
  )
}

export function IconCheckboxChecked(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="2.99" y="2.99" width="10.01" height="10.01" rx="1.37" />
      <path d="M 5.45 8.27 l 1.91 2 3.37 -4.19" />
    </Svg>
  )
}

export function IconClose(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
    </Svg>
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

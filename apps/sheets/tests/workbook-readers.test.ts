import { describe, expect, it } from 'vitest'

import { getActiveSheetInfo, type WorkbookReadContext } from '../src/renderer/ai/workbook-readers'
import type { InMemoryWorkbookAdapter } from '../src/domain/in-memory-workbook'
import type { LazyWorkbookState, UniverRuntime } from '../src/renderer/univer-state'

/**
 * Minimal fakes of the Univer 0.25 facade shapes the readers touch:
 * FWorksheet.getSelection() -> FSelection.getActiveRangeList() -> FRange[].
 * The real FSelection facade has no getRanges()/getSelections(), and the
 * workbook has no getActiveRanges()/getActiveRangeList() — only getActiveRange()
 * (the range holding the active cell), which is the "only the last cell" trap.
 */
function makeRange(address: string) {
  const col = address.charCodeAt(0) - 65
  const row = Number(address.slice(1)) - 1
  return {
    getRow: () => row,
    getColumn: () => col,
    getHeight: () => 1,
    getWidth: () => 1,
    getA1Notation: () => address,
  }
}

function fakeWorkbook(selection: string[]) {
  const ranges = selection.map(makeRange)
  const cellText: Record<string, string> = {
    B59: 'The proposed system must comply with ISO 27001. A de...',
    D59: '',
  }
  const worksheet = {
    getSheetId: () => 'sheet-1',
    getSheetName: () => 'isreal_gov',
    getMergedRanges: () => [],
    getSelection: () => ({ getActiveRangeList: () => ranges }),
    getRange: (address: string) => ({
      getValue: () => cellText[address] ?? '',
      getFormula: () => null,
    }),
  }
  const workbook = {
    getActiveSheet: () => worksheet,
    getSheets: () => [worksheet],
    // Univer 0.25: the only workbook-level accessor is the active range.
    getActiveRange: () => ranges[ranges.length - 1] ?? null,
  }
  return workbook
}

function ctx(workbook: unknown): WorkbookReadContext {
  return {
    univerRef: {
      current: { univerAPI: { getActiveWorkbook: () => workbook } } as unknown as UniverRuntime,
    },
    lazyWorkbookRef: {
      current: {
        file: { sheets: [{ id: 'sheet-1', rowCount: 241, columnCount: 11 }], visuals: [] },
        editJournal: { visualAdds: [] },
        loadedRanges: new Map(),
      } as unknown as LazyWorkbookState,
    },
    adapterRef: {
      current: { getSnapshot: () => ({ sheets: [], revision: 0 }) } as unknown as InMemoryWorkbookAdapter,
    },
  }
}

describe('getActiveSheetInfo multi-selection capture', () => {
  it('lists every selected cell (B59 + D59), not just the active one', () => {
    const info = getActiveSheetInfo(ctx(fakeWorkbook(['B59', 'D59'])))

    expect(info.mode).toBe('lazy')
    expect(info.selection).toBe('B59, D59')
    expect(info.selectedCells?.map((cell) => cell.address)).toEqual(['B59', 'D59'])
    expect(info.selectedCells?.[0]?.text).toBe(
      'The proposed system must comply with ISO 27001. A de...',
    )
    expect(info.selectedCells?.[1]?.text).toBe('')
  })

  it('falls back to the active range only when no multi-selection API exists', () => {
    // Simulate an older facade where the selection exposes no range list at all:
    // only getActiveRange() (the active cell) is available.
    const workbook = fakeWorkbook(['B59', 'D59'])
    const bareWorkbook = {
      ...workbook,
      getActiveSheet: () => ({
        ...workbook.getActiveSheet(),
        getSelection: () => null,
      }),
    }
    const info = getActiveSheetInfo(ctx(bareWorkbook))

    expect(info.selection).toBe('D59')
    expect(info.selectedCells?.map((cell) => cell.address)).toEqual(['D59'])
  })
})

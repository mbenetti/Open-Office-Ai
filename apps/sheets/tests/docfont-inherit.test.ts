/**
 * docFontOf: AI-written cells inherit the document font from the column
 * above / row left. Regression test for the 0-based bounds bug — the scan
 * must reach row 0 and column 0 (the cells that usually carry the document's
 * header font); before the fix `r >= 1`/`c >= 1` skipped them and AI cells
 * kept the default font instead of the workbook font.
 */
import { describe, expect, it } from 'vitest'
import { LocaleService, LocaleType, LogLevel, mergeLocales, Univer } from '@univerjs/core'
import { FUniver } from '@univerjs/core/lib/facade'
import { UniverSheetsPlugin } from '@univerjs/sheets'
import '@univerjs/sheets/lib/facade'

import enUs from '@univerjs/preset-sheets-core/locales/en-US'

import { docFontOf } from '../src/renderer/univer-sync'

function makeUniver(): { univer: Univer; api: FUniver } {
  const univer = new Univer({ logLevel: LogLevel.SILENT, locale: LocaleType.EN_US })
  univer.registerPlugin(UniverSheetsPlugin)
  const injector = univer.__getInjector()
  injector.get(LocaleService).load(mergeLocales(enUs.default ?? enUs) as never)
  injector.get(LocaleService).setLocale(LocaleType.EN_US)
  const api = FUniver.newAPI(univer)
  api.createWorkbook({
    id: 'file-test',
    name: 'Test',
    sheetOrder: ['sheet-1'],
    sheets: { 'sheet-1': { id: 'sheet-1', name: 'Data', rowCount: 100, columnCount: 26, cellData: {} } },
  })
  return { univer, api }
}

type Ws = ReturnType<NonNullable<ReturnType<FUniver['getActiveWorkbook']>>['getActiveSheet']>

describe('docFontOf inheritance', () => {
  it('inherits the font from row 0 (A1) for a target at A2', () => {
    const { univer, api } = makeUniver()
    const ws = api.getActiveWorkbook()!.getActiveSheet() as Ws
    ws.getRange('A1').setValues([[{ v: 'Header', s: { ff: 'Aptos', fs: 12 } }]])
    expect(docFontOf(ws, 'A2')).toEqual({ ff: 'Aptos', fs: 12 })
    univer.dispose()
  })

  it('inherits the top-row font even when intermediate rows are unstyled', () => {
    const { univer, api } = makeUniver()
    const ws = api.getActiveWorkbook()!.getActiveSheet() as Ws
    ws.getRange('A1').setValues([[{ v: 'Header', s: { ff: 'Aptos', fs: 12 } }]])
    ws.getRange('A2').setValues([[{ v: 'plain' }]])
    expect(docFontOf(ws, 'A5')).toEqual({ ff: 'Aptos', fs: 12 })
    univer.dispose()
  })

  it('inherits the left-column font from column A for a target at B2', () => {
    const { univer, api } = makeUniver()
    const ws = api.getActiveWorkbook()!.getActiveSheet() as Ws
    ws.getRange('A2').setValues([[{ v: 'Row label', s: { ff: 'Arial', fs: 10 } }]])
    expect(docFontOf(ws, 'B2')).toEqual({ ff: 'Arial', fs: 10 })
    univer.dispose()
  })

  it('returns null when no styled cell is above or left', () => {
    const { univer, api } = makeUniver()
    const ws = api.getActiveWorkbook()!.getActiveSheet() as Ws
    ws.getRange('A1').setValues([[{ v: 'no style' }]])
    expect(docFontOf(ws, 'B2')).toBeNull()
    univer.dispose()
  })
})

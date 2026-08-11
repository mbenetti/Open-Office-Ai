import { contextBridge, ipcRenderer } from 'electron'
import type { Lang } from '@genoffice/i18n'
import type { AiStreamChunk } from '@genoffice/ai-provider'
import type { ProjectApi } from '@genoffice/project-store'
import { AI_CHANNELS, PDF_CHANNELS } from '../shared/ipc'
import type { PdfApi } from '../shared/ipc'

const api: PdfApi = {
  consumePending: () => ipcRenderer.invoke(PDF_CHANNELS.consumePending),
  readFile: (path) => ipcRenderer.invoke(PDF_CHANNELS.readFile, path),
  save: (request) => ipcRenderer.invoke(PDF_CHANNELS.save, request),
  extractPages: (request) => ipcRenderer.invoke(PDF_CHANNELS.extractPages, request),
  insertPdf: (request) => ipcRenderer.invoke(PDF_CHANNELS.insertPdf, request),
  exportImages: (request) => ipcRenderer.invoke(PDF_CHANNELS.exportImages, request),
  setDirty: (dirty) => ipcRenderer.send(PDF_CHANNELS.dirtyChanged, dirty),
  onCloseSaveRequest: (handler) => {
    const listener = () => handler()
    ipcRenderer.on(PDF_CHANNELS.closeSaveRequest, listener)
    return () => ipcRenderer.removeListener(PDF_CHANNELS.closeSaveRequest, listener)
  },
  sendCloseSaveResult: (ok) => ipcRenderer.send(PDF_CHANNELS.closeSaveResult, ok),
  onSaveAsRequest: (handler) => {
    const listener = (_e: Electron.IpcRendererEvent, targetPath: string) => handler(targetPath)
    ipcRenderer.on(PDF_CHANNELS.saveAsRequest, listener)
    return () => ipcRenderer.removeListener(PDF_CHANNELS.saveAsRequest, listener)
  },
  sendSaveAsResult: (ok) => ipcRenderer.send(PDF_CHANNELS.saveAsResult, ok),
  onSaveAsFlow: (handler) => {
    const listener = (_e: Electron.IpcRendererEvent, inFlight: boolean) => handler(inFlight)
    ipcRenderer.on(PDF_CHANNELS.saveAsFlow, listener)
    return () => ipcRenderer.removeListener(PDF_CHANNELS.saveAsFlow, listener)
  },
  getLanguage: () => ipcRenderer.invoke(PDF_CHANNELS.getLanguage),
  onLanguageChanged: (handler) => {
    const listener = (_e: Electron.IpcRendererEvent, lang: Lang) => handler(lang)
    ipcRenderer.on(PDF_CHANNELS.languageChanged, listener)
    return () => ipcRenderer.removeListener(PDF_CHANNELS.languageChanged, listener)
  },
  getAiSettings: () => ipcRenderer.invoke(AI_CHANNELS.getSettings),
  correctGrammar: (text: string, language?: string) =>
    ipcRenderer.invoke('ai:correct-grammar', { text, language }),
  aiStream: (request) => ipcRenderer.invoke(AI_CHANNELS.stream, request),
  aiStreamCancel: (requestId) => ipcRenderer.invoke(AI_CHANNELS.streamCancel, requestId),
  onAiStream: (handler) => {
    const listener = (_e: Electron.IpcRendererEvent, chunk: AiStreamChunk) => handler(chunk)
    ipcRenderer.on(AI_CHANNELS.streamChunk, listener)
    return () => ipcRenderer.removeListener(AI_CHANNELS.streamChunk, listener)
  },
  listKnowledgeBases: () => ipcRenderer.invoke('knowledge:list-kb'),
  listSkills: () => ipcRenderer.invoke('skills:list'),
  getSkill: (name: string) => ipcRenderer.invoke('skills:get', name),
  searchKnowledgeBase: (query: string, knowledgeBaseId?: string, topK?: number) =>
    ipcRenderer.invoke('knowledge:search', { query, knowledgeBaseId, topK }),
}

/** Per-document chat history (same channels as docs/sheets/slides; registered by the pdf main process in standalone, by the shell otherwise) */
const projectApi: ProjectApi = {
  resolveChat: (args) => ipcRenderer.invoke('project:resolveChat', args),
  newChat: (args) => ipcRenderer.invoke('project:newChat', args),
  listChats: (args) => ipcRenderer.invoke('project:listChats', args),
  selectChat: (args) => ipcRenderer.invoke('project:selectChat', args),
  appendChat: (args) => ipcRenderer.invoke('project:appendChat', args),
  loadChat: (args) => ipcRenderer.invoke('project:loadChat', args),
  clearChat: (args) => ipcRenderer.invoke('project:clearChat', args),
  rebindChat: (args) => ipcRenderer.invoke('project:rebindChat', args),
  listProjects: () => ipcRenderer.invoke('project:list'),
  createProject: (args) => ipcRenderer.invoke('project:create', args),
  renameProject: (args) => ipcRenderer.invoke('project:rename', args),
  deleteProject: (args) => ipcRenderer.invoke('project:delete', args),
  moveFile: (args) => ipcRenderer.invoke('project:moveFile', args),
  getTimeline: (args) => ipcRenderer.invoke('project:timeline', args),
}

contextBridge.exposeInMainWorld('pdfApi', api)
contextBridge.exposeInMainWorld('projectApi', projectApi)

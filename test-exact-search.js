const fs = require('fs')
const path = require('path')
const os = require('os')

const storePath = path.join(os.homedir(), 'Library/Application Support/GenOffice/knowledge-store.json')
const raw = fs.readFileSync(storePath, 'utf8')
const data = JSON.parse(raw)

console.log('Store Path:', storePath)
console.log('Folders:', data.folders)
console.log('Documents:', data.documents.map(d => ({ id: d.id, name: d.name, kbId: d.knowledgeBaseId })))
console.log('Chunks Count:', data.chunks.length)

function searchKnowledgeBase(query, knowledgeBaseId, topK = 5) {
  const trimmedQuery = query.trim()
  if (!trimmedQuery) return []

  let eligibleChunks = data.chunks
  if (knowledgeBaseId) {
    const allowedSet = new Set(
      Array.isArray(knowledgeBaseId)
        ? knowledgeBaseId.filter(Boolean)
        : [knowledgeBaseId].filter(Boolean),
    )
    if (allowedSet.size > 0 && !allowedSet.has('ALL') && !allowedSet.has('ALL_KBS')) {
      const filtered = eligibleChunks.filter((c) => allowedSet.has(c.knowledgeBaseId))
      if (filtered.length > 0) {
        eligibleChunks = filtered
      }
    }
  }

  console.log('Eligible Chunks count:', eligibleChunks.length)

  const docMap = new Map(data.documents.map((d) => [d.id, d.name]))
  const folderMap = new Map(data.folders.map((f) => [f.id, f.name]))

  const matches = []
  const queryLower = trimmedQuery.toLowerCase()
  const qTerms = queryLower.split(/[\s,;&+/\\]+/).filter((t) => t.length > 0)

  for (const chunk of eligibleChunks) {
    const textLower = chunk.text.toLowerCase()
    let termHits = 0
    for (const term of qTerms) {
      if (textLower.includes(term)) termHits++
    }
    const termScore = qTerms.length > 0 ? termHits / qTerms.length : 0
    const phraseBonus = textLower.includes(queryLower) ? 0.5 : 0
    const score = Math.min(1.0, termScore * 0.8 + phraseBonus)

    if (score >= 0.0) {
      matches.push({
        documentName: docMap.get(chunk.documentId) ?? 'Document',
        chunkIndex: chunk.chunkIndex,
        similarityScore: Math.round(score * 100) / 100,
        text: chunk.text.slice(0, 100),
      })
    }
  }

  matches.sort((a, b) => b.similarityScore - a.similarityScore)
  const positive = matches.filter((m) => m.similarityScore > 0)
  const resultList = positive.length > 0 ? positive : matches
  return resultList.slice(0, topK)
}

console.log('--- Test Query: "ISO 27001" with knowledgeBaseId=undefined ---')
console.log(searchKnowledgeBase("ISO 27001", undefined))

console.log('--- Test Query: "ISO 27001" with knowledgeBaseId="default-kb" ---')
console.log(searchKnowledgeBase("ISO 27001", "default-kb"))

console.log('--- Test Query: "ISO 27001" with knowledgeBaseId="ad341737-2927-4ce6-962a-d0e5ad12c40f" (DAM) ---')
console.log(searchKnowledgeBase("ISO 27001", "ad341737-2927-4ce6-962a-d0e5ad12c40f"))

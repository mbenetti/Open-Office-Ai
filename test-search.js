const fs = require('fs')
const path = require('path')
const os = require('os')

const storePath = path.join(os.homedir(), 'Library/Application Support/GenOffice/knowledge-store.json')
const data = JSON.parse(fs.readFileSync(storePath, 'utf8'))

const query = 'ISO 27001 ISO 27018 MITRE ATT&CK ISO 27017 SOC 2 Type II CSA STAR FedRAMP GDPR Evaluation'
const queryLower = query.toLowerCase()
const qTerms = queryLower.split(/[\s,;&+/\\]+/).filter((t) => t.length > 0)

console.log('qTerms:', qTerms)

for (const chunk of data.chunks) {
  const textLower = chunk.text.toLowerCase()
  let termHits = 0
  for (const term of qTerms) {
    if (textLower.includes(term)) termHits++
  }
  const termScore = qTerms.length > 0 ? termHits / qTerms.length : 0
  const phraseBonus = textLower.includes(queryLower) ? 0.5 : 0
  const score = Math.min(1.0, termScore * 0.8 + phraseBonus)
  
  console.log('Chunk:', chunk.headerPath)
  console.log('termHits:', termHits, 'termScore:', termScore, 'score:', score)
}

import { KnowledgeStore } from './apps/shell/src/main/knowledge-store'
import { join } from 'path'
import { homedir } from 'os'

async function test() {
  const store = new KnowledgeStore(join(homedir(), 'Library/Application Support/GenOffice/knowledge-store.json'))
  const results = await store.searchKnowledgeBase('ISO 27001 ISO 27018 MITRE ATT&CK ISO 27017 SOC 2 Type II CSA STAR FedRAMP GDPR Evaluation')
  console.log('Results:', results.length)
  console.log(results)
}

test().catch(console.error)

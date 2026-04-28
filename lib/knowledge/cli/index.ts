#!/usr/bin/env node
import { initVault } from '../vault/initVault'
import { scanVault } from '../vault/scanVault'
import { getPGliteDbPath, PGliteKnowledgeStore } from '../adapters/PGliteKnowledgeStore'

async function main(): Promise<void> {
  const [command, vaultPath, ...rest] = process.argv.slice(2)
  if (!command || !vaultPath) {
    printUsage()
    process.exitCode = 1
    return
  }

  if (command === 'init') {
    const vault = await initVault(vaultPath)
    await vault.store.close()
    console.log(JSON.stringify({ workspace: vault.workspace, config: vault.config }, null, 2))
    return
  }

  if (command === 'scan') {
    console.log(JSON.stringify(await scanVault(vaultPath), null, 2))
    return
  }

  if (command === 'search') {
    const query = rest.join(' ').trim()
    if (!query) throw new Error('search requires a query')
    const vault = await initVault(vaultPath)
    const store = new PGliteKnowledgeStore(getPGliteDbPath(vault.vaultPath))
    await vault.store.close()
    await store.init()
    const results = await store.searchChunks(vault.workspace.id, query)
    await store.close()
    console.log(JSON.stringify(results, null, 2))
    return
  }

  if (command === 'serve') {
    process.env.VAULT_PATH = vaultPath
    await import('../../../backend/server')
    return
  }

  printUsage()
  process.exitCode = 1
}

function printUsage(): void {
  console.error('Usage: npm run knowx -- <init|scan|search|serve> <vaultPath> [query]')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})


import { spawn } from 'child_process'

const KNOWX_COMMANDS = new Set(['init', 'scan', 'search', 'serve'])
const args = process.argv.slice(2)
const command = args[0]
const target = command && KNOWX_COMMANDS.has(command)
  ? ['tsx', 'lib/knowledge/cli/index.ts', ...args]
  : ['next', 'dev', ...args]

const child = spawn(target[0], target.slice(1), {
  stdio: 'inherit',
  shell: process.platform === 'win32',
})

child.on('exit', (code) => {
  process.exit(code ?? 0)
})


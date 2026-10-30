import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const builtIndex = resolve(projectRoot, 'mmel_customer_portal/public/customer_portal/index.html')
const pageDirectory = resolve(projectRoot, 'mmel_customer_portal/www')
const pageTarget = resolve(pageDirectory, 'customer_portal.html')

const html = await readFile(builtIndex, 'utf8')
if (!html.includes('/assets/mmel_customer_portal/customer_portal/')) {
  throw new Error('The Frappe build does not contain the expected app asset base.')
}

await mkdir(pageDirectory, { recursive: true })
await writeFile(pageTarget, html, 'utf8')
console.log(`Synced ${pageTarget}`)

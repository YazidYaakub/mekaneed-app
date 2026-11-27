import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'

const port = Number(process.argv[2] ?? 4173)
const files = new Map([
  ['/', ['index.html', 'text/html']],
  ['/styles.css', ['styles.css', 'text/css']],
  ['/app.mjs', ['app.mjs', 'text/javascript']],
  ['/review.mjs', ['review.mjs', 'text/javascript']],
  ['/comparison.mjs', ['comparison.mjs', 'text/javascript']],
])

const server = createServer(async (request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end()
    return
  }
  const route = files.get((request.url ?? '').split('?')[0])
  if (!route) {
    response.writeHead(404).end('Not found')
    return
  }
  const [filename, type] = route
  try {
    const contents = await readFile(new URL(filename, import.meta.url))
    response.writeHead(200, { 'Content-Type': type + '; charset=utf-8' })
    response.end(request.method === 'HEAD' ? undefined : contents)
  } catch {
    response.writeHead(500).end('Could not load the demo file')
  }
})

server.on('error', error => {
  console.error(`Could not start Mekaneed on port ${port}: ${error.message}`)
  process.exitCode = 1
})
server.listen(port, '127.0.0.1', () => {
  console.log(`Mekaneed demo · http://127.0.0.1:${server.address().port}`)
})

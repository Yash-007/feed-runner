import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DATA_FILE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'comments.json'
)

// Dev-server API that reads and writes the source comments.json,
// so edits made in the UI persist to the original file.
function commentsApi() {
  return {
    name: 'comments-api',
    configureServer(server) {
      server.middlewares.use('/api/comments', (req, res) => {
        if (req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json')
          res.end(fs.readFileSync(DATA_FILE, 'utf8'))
          return
        }
        if (req.method === 'PUT') {
          let body = ''
          req.on('data', (chunk) => (body += chunk))
          req.on('end', () => {
            try {
              const data = JSON.parse(body)
              fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2) + '\n')
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ ok: true }))
            } catch (err) {
              res.statusCode = 400
              res.end(JSON.stringify({ ok: false, error: String(err) }))
            }
          })
          return
        }
        res.statusCode = 405
        res.end()
      })
    },
  }
}

// On static hosts (e.g. Vercel) there is no dev-server API, so ship a
// snapshot of comments.json with the build for the app to fall back on.
function commentsStatic() {
  return {
    name: 'comments-static',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'comments.json',
        source: fs.readFileSync(DATA_FILE, 'utf8'),
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), commentsApi(), commentsStatic()],
})

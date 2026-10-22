/**
 * dsh-maple-skins — host half.
 *
 * Serves the bundled MapleStory skins over the dsh web server and owns the
 * active-skin selection:
 *
 *   GET  /api/maple-skins/catalog            skin list + active id
 *   GET  /api/maple-skins/active             { active }
 *   POST /api/maple-skins/active             { skin } — persist the selection
 *   GET  /api/maple-skins/skins/<id>/...     scoped stylesheet / patches /
 *                                            raw assets (assets/, preview/,
 *                                            hooks.mjs)
 *
 * An index tap stamps every served document with `html[data-dsh-skin]` plus
 * the active skin's stylesheet links, so a page reload starts directly in
 * the active skin with no flash of the stock theme.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { scopeSkinCss } from './scoping.js'

export const name = 'dsh-maple-skins'
export const inject = ['webServer']

export const API_PREFIX = '/api/maple-skins'
/** The "original skin": no skin attribute, the stock DSH theme. */
export const DEFAULT_SKIN = 'default'

const HERE = dirname(fileURLToPath(import.meta.url))
const SKINS_DIR = resolve(HERE, '..', 'skins')

/**
 * The app's body-level official token set (snapshot of
 * @deepseek-ai/dsh-client-ui-theme design-platform.css, `body` and
 * `body[data-ds-dark-theme]` blocks, DSH 0.1.0-rc.8). The :root reset block
 * resets exactly these — tokens the app defines at body level, which the
 * skin's body copy must win against; tokens defined at :root level (e.g.
 * shadows) are deliberately not reset.
 */
function loadBodyTokens() {
  try {
    return new Set(JSON.parse(readFileSync(join(HERE, 'body-tokens.json'), 'utf8')))
  } catch {
    return new Set()
  }
}
const BODY_TOKENS = loadBodyTokens()

const CONTENT_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
}

// ---------------------------------------------------------------- active state

function dshHome() {
  return process.env.DSH_HOME || join(homedir(), '.dsh')
}

export function defaultActiveStatePath() {
  return join(dshHome(), 'skins', 'maple-skin-active.json')
}

function legacyStatePath() {
  return join(dshHome(), 'skins', 'skin-center-active.json')
}

export function readActiveSelection(path = defaultActiveStatePath()) {
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'))
    const id = parsed?.active
    return typeof id === 'string' ? id : ''
  } catch {
    return ''
  }
}

export function writeActiveSelection(id, path = defaultActiveStatePath()) {
  writeFileSync(path, `${JSON.stringify({ active: id ?? '' }, null, 2)}\n`)
}

// ---------------------------------------------------------------- catalog

/**
 * One catalog entry per bundled skin directory carrying a readable
 * skin.json. Invalid manifests are excluded (fail-closed) so a broken skin
 * can never take down the switcher.
 */
export function loadSkinCatalog(skinsDir = SKINS_DIR) {
  const skins = []
  let entries = []
  try {
    entries = readdirSync(skinsDir, { withFileTypes: true })
  } catch {
    return skins
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const dir = join(skinsDir, entry.name)
    let manifest
    try {
      manifest = JSON.parse(readFileSync(join(dir, 'skin.json'), 'utf8'))
    } catch {
      continue
    }
    if (manifest === null || typeof manifest !== 'object' || typeof manifest.id !== 'string') continue
    const id = manifest.id
    const preview = (kind) => {
      const rel = manifest.preview?.[kind]
      return typeof rel === 'string' && rel !== '' ? `/skins/${id}/${rel}` : null
    }
    skins.push({
      id,
      name: typeof manifest.name === 'string' ? manifest.name : id,
      nameEn: typeof manifest.nameEn === 'string' ? manifest.nameEn : '',
      tagline: typeof manifest.tagline === 'string' ? manifest.tagline : '',
      accent: typeof manifest.accent === 'string' ? manifest.accent : '',
      version: typeof manifest.version === 'string' ? manifest.version : '',
      order: typeof manifest.order === 'number' ? manifest.order : 0,
      preview: { light: preview('light'), dark: preview('dark') },
      hasPatches: existsSync(join(dir, 'patches.css')),
      hasHooks: Boolean(manifest.facets?.client?.entry),
      hasBackground: Boolean(manifest.contributes?.backgroundMedia),
      backgroundMedia: manifest.contributes?.backgroundMedia ?? null,
    })
  }
  skins.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
  return skins
}

function knownSkinIds(skins) {
  return new Set(skins.map((s) => s.id))
}

// One-time bridge: adopt the skin-center selection when we have none yet,
// provided it names a skin this bundle actually carries.
function migrateLegacySelection() {
  if (existsSync(defaultActiveStatePath())) return
  try {
    const legacy = JSON.parse(readFileSync(legacyStatePath(), 'utf8'))
    const id = typeof legacy?.active === 'string' ? legacy.active : ''
    if (id === '' || id === DEFAULT_SKIN) return
    if (knownSkinIds(loadSkinCatalog()).has(id)) {
      writeActiveSelection(id)
      console.info(`[maple-skins] migrated active skin from skin-center: ${id}`)
    }
  } catch {
    // no legacy state — nothing to migrate
  }
}

// ---------------------------------------------------------------- http helpers

function sendJson(res, status, value) {
  const body = JSON.stringify(value)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
  })
  res.end(body)
}

function sendText(res, status, body, type) {
  res.writeHead(status, {
    'content-type': type,
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
  })
  res.end(body)
}

function sendFile(res, filePath) {
  let data
  try {
    data = readFileSync(filePath)
  } catch {
    sendJson(res, 404, { error: 'not found' })
    return
  }
  const dot = filePath.slice(filePath.lastIndexOf('.'))
  res.writeHead(200, {
    'content-type': CONTENT_TYPES[dot] ?? 'application/octet-stream',
    'content-length': data.length,
    'cache-control': 'no-store',
  })
  res.end(data)
}

function notFound(res) {
  sendJson(res, 404, { error: 'not found' })
}

function readBody(req, limit = 64 * 1024) {
  return new Promise((resolveBody, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > limit) {
        reject(new Error('body too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolveBody(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

/** Resolve a relative path inside one skin directory; refuse escapes. */
function resolveInsideSkin(skinDir, rel) {
  if (rel === '' || rel.includes('\0')) return null
  const base = resolve(skinDir)
  const target = resolve(base, rel)
  if (target !== base && !target.startsWith(base + (base.endsWith('/') ? '' : '/'))) return null
  return target
}

// ---------------------------------------------------------------- routes

export function makeMapleSkinRoutes() {
  const catalogPrefix = `${API_PREFIX}/skins`

  const catalogRoute = {
    kind: 'exact',
    path: `${API_PREFIX}/catalog`,
    handler: (req, res) => {
      sendJson(res, 200, {
        active: readActiveSelection(),
        default: DEFAULT_SKIN,
        skins: loadSkinCatalog(),
      })
    },
  }

  const activeRoute = {
    kind: 'exact',
    path: `${API_PREFIX}/active`,
    handler: async (req, res) => {
      if (req.method === 'GET') {
        sendJson(res, 200, { active: readActiveSelection() })
        return
      }
      if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'method not allowed' })
        return
      }
      let skin = ''
      try {
        skin = JSON.parse((await readBody(req)) || '{}').skin
      } catch {
        sendJson(res, 400, { error: 'invalid body' })
        return
      }
      if (typeof skin !== 'string' || (skin !== '' && skin !== DEFAULT_SKIN && !knownSkinIds(loadSkinCatalog()).has(skin))) {
        sendJson(res, 400, { error: 'unknown skin' })
        return
      }
      writeActiveSelection(skin)
      sendJson(res, 200, { active: readActiveSelection() })
    },
  }

  const skinsRoute = {
    kind: 'prefix',
    path: catalogPrefix,
    handler: (req, res) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        sendJson(res, 405, { error: 'method not allowed' })
        return
      }
      const parts = decodeURIComponentSafe(req.url ?? '')
        .split('?')[0]
        .split('/')
        .filter(Boolean)
      const at = parts.indexOf('skins')
      const id = parts[at + 1]
      const rel = parts.slice(at + 2).join('/')
      if (!/^[a-z0-9][a-z0-9-]*$/.test(id ?? '') || rel === '') {
        notFound(res)
        return
      }
      const skinDir = join(SKINS_DIR, id)
      if (!existsSync(skinDir)) {
        notFound(res)
        return
      }
      if (rel === 'stylesheet') {
        const raw = readSkinFile(join(skinDir, 'skin.css'))
        if (raw === null) {
          notFound(res)
          return
        }
        sendText(res, 200, scopeSkinCss(raw, id, BODY_TOKENS, { includeDerived: true }), CONTENT_TYPES['.css'])
        return
      }
      if (rel === 'patches') {
        const raw = readSkinFile(join(skinDir, 'patches.css'))
        if (raw === null) {
          notFound(res)
          return
        }
        sendText(res, 200, scopeSkinCss(raw, id, BODY_TOKENS, { includeDerived: false }), CONTENT_TYPES['.css'])
        return
      }
      if (rel === 'hooks.mjs' || rel.startsWith('assets/') || rel.startsWith('preview/')) {
        const target = resolveInsideSkin(skinDir, rel)
        if (target === null) {
          notFound(res)
          return
        }
        sendFile(res, target)
      } else {
        notFound(res)
      }
    },
  }

  return [catalogRoute, activeRoute, skinsRoute]
}

function decodeURIComponentSafe(url) {
  const path = url.split('#')[0]
  try {
    return decodeURIComponent(path)
  } catch {
    return path
  }
}

function readSkinFile(path) {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return null
  }
}

// ---------------------------------------------------------------- index tap

/**
 * Stamp served index documents for the active skin: the html attribute plus
 * the stylesheet links. The stock theme (no active skin) is untouched.
 */
export function makeMapleSkinIndexTap() {
  return (html) => {
    const active = readActiveSelection()
    if (active === '' || active === DEFAULT_SKIN) return html
    const entry = loadSkinCatalog().find((s) => s.id === active)
    if (entry === undefined) return html
    let out = html
    if (!out.includes('data-dsh-skin')) {
      out = out.replace(/<html(\s[^>]*)?>/i, (tag) => tag.replace(/<html/i, `<html data-dsh-skin="${active}"`))
    }
    if (!out.includes('data-dsh-maple-link')) {
      const links = [`<link rel="stylesheet" href="${API_PREFIX}/skins/${active}/stylesheet" data-dsh-maple-link="stylesheet">`]
      if (entry.hasPatches) links.push(`<link rel="stylesheet" href="${API_PREFIX}/skins/${active}/patches" data-dsh-maple-link="patches">`)
      out = out.includes('</head>') ? out.replace(/<\/head>/i, `${links.join('')}</head>`) : `${links.join('')}${out}`
    }
    return out
  }
}

// ---------------------------------------------------------------- plugin

/** @param {import('@deepseek-ai/cordis').Context} ctx */
export function apply(ctx) {
  migrateLegacySelection()
  try {
    ctx.effect(() => {
      const disposers = []
      try {
        for (const route of makeMapleSkinRoutes()) disposers.push(ctx.webServer.register(route))
        disposers.push(ctx.webServer.tapIndex(makeMapleSkinIndexTap()))
      } catch (error) {
        for (const dispose of disposers) dispose()
        throw error
      }
      return () => {
        for (const dispose of disposers) dispose()
      }
    }, 'maple-skins: routes')
  } catch (error) {
    console.error('[maple-skins] route registration failed:', error)
  }
}

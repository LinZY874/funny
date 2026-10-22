/**
 * Validate lib/scoping.js against the live skin-center serving pipeline.
 *
 * The running dsh instance (with @linxin666/dsh-client-ui-skin-center) serves
 * the authoritative scoped CSS at /api/skin-center/v2/skins/<id>/stylesheet
 * and /patches. This test scopes the raw source files with the same inputs
 * and compares rule-by-rule: selectors (with @media nesting path) and
 * normalized declaration maps (duplicate declarations collapse — the
 * skin-center reset block repeats group-head tokens, which is a generator
 * quirk with no cascade effect).
 *
 * Usage: node test/scoping.mjs [baseUrl] [sourceSkinDir] [ids...]
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { scopeSkinCss } from '../lib/scoping.js'

const HERE = fileURLToPath(new URL('.', import.meta.url))
const BASE = process.argv[2] ?? 'http://127.0.0.1:3080'
const SKIN_SRC = process.argv[3] ?? join(HERE, '..', 'skins')
const IDS = process.argv.slice(4).length
  ? process.argv.slice(4)
  : ['v1', 'v2', 'v3']
const bodyTokens = new Set(
  JSON.parse(readFileSync(join(HERE, '..', 'lib', 'body-tokens.json'), 'utf8')),
)

// ------------------------------------------------------------ css parsing

function stripComments(css) {
  let out = ''
  let i = 0
  while (i < css.length) {
    if (css[i] === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2)
      i = end === -1 ? css.length : end + 2
      continue
    }
    out += css[i]
    i += 1
  }
  return out
}

/** Collect every rule as { path, body } with @-nesting flattened into path. */
function collectRules(css, prefix, out) {
  let pos = 0
  const n = css.length
  while (pos < n) {
    let i = pos
    while (i < n && /[\s,]/.test(css[i])) i += 1
    if (i >= n) break
    let j = i
    let quote = null
    let paren = 0
    let brace = -1
    while (j < n) {
      const c = css[j]
      if (quote !== null) {
        if (c === '\\') j += 1
        else if (c === quote) quote = null
      } else if (c === '"' || c === "'") {
        quote = c
      } else if (c === '(') {
        paren += 1
      } else if (c === ')') {
        paren -= 1
      } else if (c === '{' && paren === 0) {
        brace = j
        break
      }
      j += 1
    }
    if (brace === -1) break
    const head = css.slice(i, brace).trim()
    // find matching close
    let depth = 1
    let k = brace + 1
    quote = null
    while (k < n && depth > 0) {
      const c = css[k]
      if (quote !== null) {
        if (c === '\\') k += 1
        else if (c === quote) quote = null
      } else if (c === '"' || c === "'") {
        quote = c
      } else if (c === '{') {
        depth += 1
      } else if (c === '}') {
        depth -= 1
      }
      k += 1
    }
    const body = css.slice(brace + 1, k - 1)
    if (head.startsWith('@keyframes')) {
      // frame-level rules only (keyframe name is global)
      const name = head.replace(/^@(-webkit-)?keyframes\s+/, '').trim()
      collectFrames(body, `@keyframes ${name}`, out)
    } else if (head.startsWith('@media') || head.startsWith('@supports') || head.startsWith('@layer')) {
      collectRules(body, `${prefix} ${head}`.trim(), out)
    } else if (head.startsWith('@')) {
      out.push({ path: `${prefix} ${head}`.trim(), body })
    } else {
      // normalize: one fingerprint entry per selector in a comma list, so a
      // split output and a combined-list output compare equal
      for (const sel of splitTopLevelCommas(head)) {
        const s = sel.trim()
        if (s !== '') out.push({ path: prefix === '' ? s : `${prefix} :: ${s}`, body })
      }
    }
    pos = k
  }
}

function splitTopLevelCommas(head) {
  const parts = []
  let start = 0
  let paren = 0
  let quote = null
  for (let i = 0; i < head.length; i += 1) {
    const c = head[i]
    if (quote !== null) {
      if (c === '\\' && quote !== null) i += 1
      else if (c === quote) quote = null
      continue
    }
    if (c === '"' || c === "'") {
      quote = c
      continue
    }
    if (c === '(') paren += 1
    else if (c === ')') paren -= 1
    else if (c === ',' && paren === 0) {
      parts.push(head.slice(start, i))
      start = i + 1
    }
  }
  parts.push(head.slice(start))
  return parts
}

function collectFrames(body, path, out) {
  // frames look like `0%, 100% { ... }` (and to/from aliases)
  let pos = 0
  const n = body.length
  while (pos < n) {
    let i = pos
    while (i < n && /[\s,]/.test(body[i])) i += 1
    if (i >= n) break
    let j = i
    while (j < n && body[j] !== '{') j += 1
    if (j >= n) break
    const frame = body.slice(i, j).trim()
    let depth = 1
    let k = j + 1
    while (k < n && depth > 0) {
      if (body[k] === '{') depth += 1
      else if (body[k] === '}') depth -= 1
      k += 1
    }
    out.push({ path: `${path} :: ${frame}`, body: body.slice(j + 1, k - 1) })
    pos = k
  }
}

/**
 * Normalize a declaration block into a canonical prop->value string
 * (whitespace collapsed, duplicate declarations folded — the reference
 * pipeline repeats group-head tokens in its reset block, which has no
 * cascade effect).
 */
function normDecls(body) {
  const map = new Map()
  // split on ; outside quotes (comments stripped up front)
  const text = stripComments(body)
  const parts = []
  let cur = ''
  let quote = null
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i]
    if (quote !== null) {
      cur += c
      if (c === quote && text[i - 1] !== '\\') quote = null
      continue
    }
    if (c === '"' || c === "'") {
      quote = c
      cur += c
      continue
    }
    if (c === ';') {
      parts.push(cur)
      cur = ''
      continue
    }
    cur += c
  }
  if (cur.trim() !== '') parts.push(cur)
  for (const part of parts) {
    const t = part.trim()
    if (t === '' || t.startsWith('/*')) continue
    const idx = t.indexOf(':')
    if (idx === -1) continue
    const prop = t.slice(0, idx).trim()
    const value = t.slice(idx + 1).replace(/\s+/g, ' ').trim()
    if (prop !== '') map.set(prop, value)
  }
  return [...map.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([p, v]) => `${p}:${v}`).join(' | ')
}

function fingerprint(css) {
  const rules = []
  collectRules(stripComments(css), '', rules)
  const map = new Map()
  for (const r of rules) {
    const p = r.path.replace(/\s+/g, ' ').trim()
    if (!map.has(p)) map.set(p, new Set())
    map.get(p).add(normDecls(r.body))
  }
  return map
}

/** Compare two fingerprints: same selector->decl-set pairs. */
function fingerprintsEqual(a, b) {
  const aKeys = new Set(a.keys())
  const bKeys = new Set(b.keys())
  if (aKeys.size !== bKeys.size) return { ok: false, missing: [...bKeys].filter((s) => !aKeys.has(s)), extra: [...aKeys].filter((s) => !bKeys.has(s)), diff: [] }
  const missing = [...bKeys].filter((s) => !aKeys.has(s))
  const extra = [...aKeys].filter((s) => !bKeys.has(s))
  const diff = []
  for (const sel of bKeys) {
    if (!aKeys.has(sel)) continue
    const A = [...a.get(sel)].sort().join(' + ')
    const B = [...b.get(sel)].sort().join(' + ')
    if (A !== B) diff.push(sel)
  }
  return { ok: missing.length === 0 && extra.length === 0 && diff.length === 0, missing, extra, diff }
}

// ------------------------------------------------------------ comparison

let failures = 0
for (const id of IDS) {
  for (const [kind, file] of [['stylesheet', 'skin.css'], ['patches', 'patches.css']]) {
    const raw = readFileSync(join(SKIN_SRC, id, file), 'utf8')
    const res = await fetch(`${BASE}/api/skin-center/v2/skins/${id}/${kind}`)
    if (!res.ok) {
      console.log(`skip ${id}/${kind}: served ${res.status}`)
      continue
    }
    const served = await res.text()
    const mine = scopeSkinCss(raw, id, bodyTokens, { includeDerived: kind === 'stylesheet' })
    const a = fingerprint(mine)
    const b = fingerprint(served)
    const { ok, missing, extra, diff } = fingerprintsEqual(a, b)
    if (ok) {
      console.log(`ok   ${id}/${kind}: ${b.size} selectors match`)
    } else {
      failures += 1
      console.log(`FAIL ${id}/${kind}:`)
      if (missing.length) console.log(`  missing (${missing.length}):`, missing.slice(0, 8))
      if (extra.length) console.log(`  extra   (${extra.length}):`, extra.slice(0, 8))
      for (const sel of diff.slice(0, 4)) {
        console.log(`  decls differ: ${sel}`)
        console.log(`    mine:   ${[...a.get(sel)].sort().join(' + ').slice(0, 400)}`)
        console.log(`    served: ${[...b.get(sel)].sort().join(' + ').slice(0, 400)}`)
      }
    }
  }
}
console.log(failures === 0 ? '\nALL MATCH' : `\n${failures} FAILURES`)
process.exit(failures === 0 ? 0 : 1)

'use strict'

/**
 * Scope a raw skin stylesheet under `html[data-dsh-skin="<id>"]` so every
 * rule matches only while that skin is active. The transform mirrors the
 * official skin-center serving pipeline, which the live dsh runtime
 * validates against:
 *
 *   :root { D }          -> 1) html[data-dsh-skin="id"] { D }
 *                            2) html[data-dsh-skin="id"] { --dsw-*: initial }
 *                               one reset per touched body-level official
 *                               token (the app's body token set), so the html
 *                               element itself carries no skin token values
 *                            3) html[data-dsh-skin="id"] body { D - color }
 *                               the body copy is the one that wins the
 *                               cascade against the app's body-level tokens;
 *                               the `color` declaration stays html-only
 *   sel1, sel2 { D }     -> html[data-dsh-skin="id"] sel1,
 *                            html[data-dsh-skin="id"] sel2 { D }
 *   @keyframes N { ... } -> unchanged (keyframe names are global)
 *   @media ... { rules } -> inner rules scoped recursively
 *
 * Appended after every scoped sheet:
 *   html[data-dsh-skin="id"] [id="root"] { background: transparent; }
 *   (so the app's opaque #root container never hides the body background)
 * and, for the main stylesheet only, a derived-token block: for each entry
 * of the derivation table whose target the skin does not define anywhere,
 * a `color-mix` tint of the entry's base token is emitted at body level.
 *
 * url(assets/...) references stay relative: the caller serves the scoped
 * stylesheet from a URL whose base resolves them (e.g.
 * /api/maple-skins/skins/<id>/stylesheet with assets under
 * /api/maple-skins/skins/<id>/assets/).
 */

const ROOT_SELECTOR = ':root'

/**
 * Derivation table: official tokens a skin may leave undefined, each derived
 * as a semi-transparent tint of a base token the skin is expected to define.
 * Order: alphabetical by target (matches the reference pipeline).
 */
const DERIVATION_TABLE = [
  ['--dsw-alias-bg-module-platform', '--dsw-alias-bg-layer-1', 65],
  ['--dsw-alias-bg-multi-select', '--dsw-alias-bg-layer-1', 65],
  ['--dsw-alias-border-inverted2', '--dsw-alias-border-l2', 55],
  ['--dsw-alias-border-l2-darkmode-thin', '--dsw-alias-border-l2', 55],
  ['--dsw-alias-interactive-bg-hover-accent', '--dsw-alias-bg-layer-1', 65],
  ['--dsw-alias-interactive-bg-hover-danger', '--dsw-alias-bg-layer-1', 65],
  ['--dsw-alias-interactive-bg-hover-solid', '--dsw-alias-bg-layer-1', 65],
  ['--dsw-alias-label-primary-bluish', '--dsw-alias-label-primary', 70],
  ['--dsw-specific-bubble', '--dsw-alias-bg-layer-1', 60],
  ['--dsw-specific-bubble-highlight', '--dsw-alias-bg-layer-1', 60],
  ['--dsw-specific-input-major', '--dsw-alias-bg-layer-1', 60],
  ['--dsw-specific-login-input', '--dsw-alias-bg-layer-1', 60],
  ['--dsw-specific-menu', '--dsw-alias-bg-layer-1', 60],
  ['--dsw-specific-selector', '--dsw-alias-bg-layer-1', 60],
  ['--dsw-specific-sidebar-nav-item-active-accent', '--dsw-alias-bg-layer-1', 60],
  ['--dsw-specific-tip', '--dsw-alias-bg-layer-1', 60],
]

/**
 * @param {string} css raw skin stylesheet text
 * @param {string} skinId the skin manifest id
 * @param {ReadonlySet<string>} officialTokens official body-level token names
 * @param {{ includeDerived?: boolean }} [options] append the derived-token
 *   block (main stylesheet; not the patches sheet)
 * @returns {string} the scoped stylesheet
 */
export function scopeSkinCss(css, skinId, officialTokens, options = {}) {
  const scope = `html[data-dsh-skin="${skinId}"]`
  let out = scopeRuleList(css, scope, officialTokens)
  out = `${out.replace(/\s+$/, '')}\n\n${scope} [id="root"] { background: transparent; }\n`
  if (options.includeDerived !== false) {
    const defined = definedCustomProperties(css)
    const derived = DERIVATION_TABLE
      .filter(([target]) => !defined.has(target))
      .map(([target, base, pct]) => `  ${target}: color-mix(in srgb, var(${base}) ${pct}%, transparent);`)
    if (derived.length > 0) out += `\n${scope} body {\n${derived.join('\n')}\n}\n`
  }
  return out
}

/** Every custom property defined anywhere in the sheet (any nesting). */
function definedCustomProperties(css) {
  const text = stripCssComments(css)
  const names = new Set()
  const re = /(^|[;{])\s*(--[a-zA-Z0-9_-]+)\s*:/g
  let m
  while ((m = re.exec(text)) !== null) names.add(m[2])
  return names
}

/** Remove the top-level `color` declaration from a declaration block. */
function stripColorDecl(body) {
  return body.replace(/(^|[;{])\s*color\s*:[^;]*;/g, (match, boundary) => boundary)
}

/** Scan from `from` for the start of the next rule head (top level). */
function findRuleHead(css, from) {
  let i = from
  const n = css.length
  while (i < n) {
    const c = css[i]
    if (c === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2)
      if (end === -1) return -1
      i = end + 2
      continue
    }
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '\f') {
      i += 1
      continue
    }
    return i
  }
  return -1
}

/** First `{` outside strings and parentheses at or after `from`. */
function findTopLevelBrace(css, from) {
  let i = from
  const n = css.length
  let paren = 0
  let quote = null
  while (i < n) {
    const c = css[i]
    if (quote !== null) {
      if (c === '\\') i += 2
      else {
        if (c === quote) quote = null
        i += 1
      }
      continue
    }
    if (c === '"' || c === "'") {
      quote = c
      i += 1
      continue
    }
    if (c === '(') paren += 1
    else if (c === ')') paren -= 1
    else if (c === '{' && paren === 0) return i
    i += 1
  }
  return -1
}

/** Matching `}` for the `{` just before `from`. Returns -1 on mismatch. */
function findMatchingClose(css, from) {
  let i = from
  const n = css.length
  let depth = 1
  let quote = null
  while (i < n) {
    const c = css[i]
    if (quote !== null) {
      if (c === '\\') i += 2
      else {
        if (c === quote) quote = null
        i += 1
      }
      continue
    }
    if (c === '"' || c === "'") {
      quote = c
      i += 1
      continue
    }
    if (c === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2)
      if (end === -1) return -1
      i = end + 2
      continue
    }
    if (c === '{') depth += 1
    else if (c === '}') {
      depth -= 1
      if (depth === 0) return i
    }
    i += 1
  }
  return -1
}

/** Split a selector list on top-level commas (outside strings/parens). */
function splitSelectorList(head) {
  const parts = []
  let start = 0
  let paren = 0
  let quote = null
  for (let i = 0; i < head.length; i += 1) {
    const c = head[i]
    if (quote !== null) {
      if (c === '\\') i += 1
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

/**
 * Touched body-level official custom properties inside a declaration block,
 * in first-use order. Comments are stripped first so a declaration preceded
 * by a comment still matches the boundary scan.
 */
function touchedOfficialTokens(body, officialTokens) {
  const text = stripCssComments(body)
  const names = []
  const seen = new Set()
  const re = /(^|[;{}])\s*(--[a-zA-Z0-9_-]+)\s*:/g
  let m
  while ((m = re.exec(text)) !== null) {
    const name = m[2]
    if (!officialTokens.has(name) || seen.has(name)) continue
    seen.add(name)
    names.push(name)
  }
  return names
}

/** Remove CSS comments (string-aware). */
function stripCssComments(css) {
  let out = ''
  let i = 0
  const n = css.length
  while (i < n) {
    const c = css[i]
    if (c === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2)
      i = end === -1 ? n : end + 2
      continue
    }
    if (c === '"' || c === "'") {
      out += c
      i += 1
      while (i < n) {
        const d = css[i]
        out += d
        if (d === '\\') {
          out += css[i + 1] ?? ''
          i += 2
          continue
        }
        i += 1
        if (d === c) break
      }
      continue
    }
    out += c
    i += 1
  }
  return out
}

/** Scope one rule: head + raw body -> scoped rule text (or list of rules). */
function scopeRule(head, body, scope, officialTokens) {
  const trimmed = head.trim()
  if (trimmed.startsWith('@')) {
    if (
      trimmed.startsWith('@media') ||
      trimmed.startsWith('@supports') ||
      trimmed.startsWith('@layer')
    ) {
      return `${head} {${scopeRuleList(body, scope, officialTokens)}}`
    }
    return `${head} {${body}}` // @keyframes, @font-face, @import, ... verbatim
  }
  const parts = []
  for (const raw of splitSelectorList(trimmed)) {
    const sel = raw.trim()
    if (sel === '') continue
    if (sel === ROOT_SELECTOR) {
      parts.push(`${scope} {\n${body}\n}`)
      const resets = touchedOfficialTokens(body, officialTokens)
      if (resets.length > 0) {
        parts.push(`${scope} {\n${resets.map((t) => `  ${t}: initial;`).join('\n')}\n}`)
      }
      parts.push(`${scope} body {\n${stripColorDecl(body)}\n}`)
    } else {
      parts.push(`${scope} ${sel} {\n${body}\n}`)
    }
  }
  return parts.join('\n')
}

/** Walk one stylesheet level, scoping each top-level rule in place. */
function scopeRuleList(css, scope, officialTokens) {
  const out = []
  let pos = 0
  const n = css.length
  while (pos < n) {
    const headStart = findRuleHead(css, pos)
    if (headStart === -1) break
    const brace = findTopLevelBrace(css, headStart)
    if (brace === -1) break // malformed tail: leave the remainder untouched
    const close = findMatchingClose(css, brace + 1)
    if (close === -1) break
    const head = css.slice(headStart, brace)
    const body = css.slice(brace + 1, close)
    out.push(css.slice(pos, headStart))
    out.push(scopeRule(head, body, scope, officialTokens))
    pos = close + 1
  }
  out.push(css.slice(pos))
  return out.join('')
}

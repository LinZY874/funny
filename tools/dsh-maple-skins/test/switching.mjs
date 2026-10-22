/**
 * Regression test for the first-switch bug: switching from the booted skin
 * Va to Vb used to adopt Va's leftover head links as Vb's (ensureLinks keyed
 * on the data-dsh-maple-link attribute only), so the old activation's
 * disposal deleted the only stylesheet links in the head while
 * html[data-dsh-skin] already pointed at Vb — the skin "failed" until the
 * next switch. Now ensureLinks only adopts links whose href points at the
 * skin being activated.
 *
 * Drives the real lib/client.js activate() against a minimal fake DOM:
 *   boot on va (index-tap stamped links) -> vb -> vc -> va -> default
 * and asserts the head always carries exactly the active skin's links.
 *
 * Usage: node test/switching.mjs
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = fileURLToPath(new URL('.', import.meta.url))
const CLIENT_SOURCE = readFileSync(join(HERE, '..', 'lib', 'client.js'), 'utf8')

// ------------------------------------------------------------ fake DOM

class FakeElement {
  constructor(tag) {
    this.tagName = tag
    this.attrs = new Map()
    this.children = []
    this.parentElement = null
    this.sheet = null
    this.style = { cssText: '' }
    this.listeners = new Map()
  }
  setAttribute(k, v) { this.attrs.set(k, v) }
  getAttribute(k) { return this.attrs.has(k) ? this.attrs.get(k) : null }
  hasAttribute(k) { return this.attrs.has(k) }
  removeAttribute(k) { this.attrs.delete(k) }
  appendChild(child) {
    if (child.parentElement !== null) child.parentElement.children.splice(child.parentElement.children.indexOf(child), 1)
    child.parentElement = this
    this.children.push(child)
    // Simulate the browser: a stylesheet link "loads" on the next microtask.
    if (child.tagName === 'link' && child.attrs.get('rel') === 'stylesheet') {
      queueMicrotask(() => {
        if (child.sheet === null) child.sheet = {}
        for (const fn of child.listeners.get('load') ?? []) fn()
      })
    }
    return child
  }
  remove() {
    const p = this.parentElement
    if (p === null) return
    const i = p.children.indexOf(this)
    if (i !== -1) p.children.splice(i, 1)
    this.parentElement = null
  }
  addEventListener(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, [])
    this.listeners.get(type).push(fn)
  }
  querySelectorAll(sel) {
    if (sel !== 'link[data-dsh-maple-link]') throw new Error(`unexpected selector: ${sel}`)
    const out = []
    const walk = (el) => {
      for (const c of el.children) {
        if (c.tagName === 'link' && c.attrs.has('data-dsh-maple-link')) out.push(c)
        walk(c)
      }
    }
    walk(this)
    return out
  }
  get href() { return this.attrs.get('href') ?? '' }
  set href(v) { this.attrs.set('href', v) }
}

const head = new FakeElement('head')
const body = new FakeElement('body')
const html = new FakeElement('html')
const documentStub = {
  head,
  body,
  documentElement: html,
  createElement: (tag) => new FakeElement(tag),
}

globalThis.MutationObserver = class { observe() {} disconnect() {} }

// ------------------------------------------------------------ stubs

let captured = null
const windowStub = { __ModuleLoader__: { load: (m) => { captured = m } } }
// client.js is a plain script; run it with the fake window/document in scope
new Function('window', 'document', 'MutationObserver', CLIENT_SOURCE)(
  windowStub,
  documentStub,
  globalThis.MutationObserver,
)
if (captured === null) throw new Error('ModuleLoader.load was not called')

const mod = captured.factory((name) => {
  if (name === 'react') return { createElement: () => null }
  throw new Error(`unexpected require: ${name}`)
})

const SKINS = ['va', 'vb', 'vc'].map((id) => ({
  id,
  name: id,
  hasPatches: true,
  hasHooks: false,
  hasBackground: false,
  backgroundMedia: null,
  preview: null,
}))

const persisted = []
const bootActive = { id: 'va' }
globalThis.fetch = async (url, init) => {
  if (url === '/api/maple-skins/catalog') {
    return { json: async () => ({ skins: SKINS, active: bootActive.id, default: 'default' }) }
  }
  if (url === '/api/maple-skins/active' && init?.method === 'POST') {
    persisted.push(JSON.parse(init.body).skin)
    return { json: async () => ({ active: persisted.at(-1) }) }
  }
  throw new Error(`unexpected fetch: ${url}`)
}

// The index tap stamped the active skin's links into the served document.
const stamp = (kind, skin) => {
  const link = new FakeElement('link')
  link.setAttribute('rel', 'stylesheet')
  link.setAttribute('href', `/api/maple-skins/skins/${skin}/${kind}`)
  link.setAttribute('data-dsh-maple-link', kind)
  link.sheet = {}
  head.appendChild(link)
  return link
}
stamp('stylesheet', 'va')
stamp('patches', 'va')

// ------------------------------------------------------------ assertions

let failures = 0
function check(label, actual, expected) {
  const a = JSON.stringify(actual)
  const b = JSON.stringify(expected)
  if (a === b) {
    console.log(`ok   ${label}`)
  } else {
    failures += 1
    console.log(`FAIL ${label}\n  expected: ${b}\n  actual:   ${a}`)
  }
}

/** Kinds of skin links currently in the head, e.g. ['stylesheet','patches'] */
function linksOf(skin) {
  return head.querySelectorAll('link[data-dsh-maple-link]')
    .filter((l) => (l.getAttribute('href') ?? '').includes(`/skins/${skin}/`))
    .map((l) => l.getAttribute('data-dsh-maple-link'))
    .sort()
}
function allLinkKinds() {
  return head.querySelectorAll('link[data-dsh-maple-link]')
    .map((l) => `${l.getAttribute('href')}#${l.getAttribute('data-dsh-maple-link')}`)
    .sort()
}

const tick = () => new Promise((r) => setTimeout(r, 10))

// ------------------------------------------------------------ run

mod.apply({ get: () => undefined })
await tick() // let the boot activate settle (serialized via withSerial)

check('boot: attribute', html.getAttribute('data-dsh-skin'), 'va')
check('boot: va links adopted (no duplicates)', linksOf('va'), ['patches', 'stylesheet'])
check('boot: no other links', allLinkKinds().length, 2)

// The user's literal repro: first switch after boot, Va -> Vb.
await mod.__test.activate('vb')
await tick()
check('va->vb: attribute', html.getAttribute('data-dsh-skin'), 'vb')
check('va->vb: vb links installed', linksOf('vb'), ['patches', 'stylesheet'])
check('va->vb: va links removed', linksOf('va'), [])
check('va->vb: persisted', persisted.at(-1), 'vb')

// Second switch: Vb -> Vc (worked before, must keep working).
await mod.__test.activate('vc')
await tick()
check('vb->vc: attribute', html.getAttribute('data-dsh-skin'), 'vc')
check('vb->vc: vc links installed', linksOf('vc'), ['patches', 'stylesheet'])
check('vb->vc: vb links removed', linksOf('vb'), [])
check('vb->vc: persisted', persisted.at(-1), 'vc')

// Round trip back to the booted skin: fresh links, no orphans.
await mod.__test.activate('va')
await tick()
check('vc->va: attribute', html.getAttribute('data-dsh-skin'), 'va')
check('vc->va: va links reinstalled', linksOf('va'), ['patches', 'stylesheet'])
check('vc->va: vc links removed', linksOf('vc'), [])

// Back to the stock theme: every link goes.
await mod.__test.activate('default')
await tick()
check('va->default: attribute removed', html.getAttribute('data-dsh-skin'), null)
check('va->default: no links left', allLinkKinds(), [])
check('va->default: persisted empty', persisted.at(-1), '')

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURES`)
process.exit(failures === 0 ? 0 : 1)

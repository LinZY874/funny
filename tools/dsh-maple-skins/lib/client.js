/**
 * dsh-maple-skins — client half.
 *
 * A minimal skin switcher:
 *   - boots the persisted active skin (the index tap already stamped the
 *     document; this half ensures the links, background media, and hooks)
 *   - applies a skin chosen in the "冒险岛皮肤" settings section:
 *     scoped stylesheets first, then the html[data-dsh-skin] flip, then the
 *     previous activation is disposed — the page never loses its look
 *   - "原皮肤" removes the skin and restores the stock DSH theme
 *
 * No try-on, no background sliders, no wallpaper bridge: just switching.
 */
window.__ModuleLoader__.load({
  id: 'dsh-maple-skins',
  factory: (require) => {
    const module = { exports: {} }
    const React = require('react')
    const e = React.createElement

    const API = '/api/maple-skins'
    const LINK_ATTR = 'data-dsh-maple-link'
    const DEFAULT_SKIN = 'default'

    // ---------------------------------------------------------------- theme

    const themeListeners = new Set()
    let themeObserver = null

    function themeGet() {
      const body = document.body
      return body !== null && body.hasAttribute('data-ds-dark-theme') ? 'dark' : 'light'
    }

    function notifyTheme() {
      const theme = themeGet()
      for (const fn of [...themeListeners]) {
        try { fn(theme) } catch (err) { console.error('[maple-skins] theme listener', err) }
      }
    }

    function subscribeTheme(fn) {
      themeListeners.add(fn)
      return () => { themeListeners.delete(fn) }
    }

    function startThemeObserver() {
      if (themeObserver !== null || document.body === null) return
      themeObserver = new MutationObserver(notifyTheme)
      themeObserver.observe(document.body, { attributes: true, attributeFilter: ['data-ds-dark-theme'] })
    }

    // ---------------------------------------------------------------- layers

    /** The six fixed decoration layers (skin-hooks contract v1alpha1). */
    const LAYER_STYLES = {
      background: 'position:fixed;top:0;right:0;bottom:0;left:0;z-index:-2;pointer-events:none;',
      ambient: 'position:fixed;top:0;right:0;bottom:0;left:0;z-index:30;pointer-events:none;',
      top: 'position:fixed;top:0;left:0;right:0;z-index:40;pointer-events:none;',
      bottom: 'position:fixed;bottom:0;left:0;right:0;z-index:40;pointer-events:none;',
      sidebar: 'position:fixed;top:0;bottom:0;left:0;z-index:40;pointer-events:none;',
      foreground: 'position:fixed;top:0;right:0;bottom:0;left:0;z-index:41;pointer-events:none;',
    }

    function createLayers() {
      const layers = {}
      for (const key of Object.keys(LAYER_STYLES)) {
        const el = document.createElement('div')
        el.className = `maple-skin-layer maple-skin-layer-${key}`
        el.setAttribute('aria-hidden', 'true')
        el.style.cssText = LAYER_STYLES[key]
        document.body.appendChild(el)
        layers[key] = el
      }
      return layers
    }

    // ---------------------------------------------------------------- activation

    let catalogCache = []
    let activation = null
    let switching = null

    function makeActivation() {
      return { id: null, linkEls: [], layers: null, background: null, hooks: null, cleanups: [] }
    }

    function disposeActivation(act) {
      if (act === null) return
      if (act.hooks !== null) {
        try { if (typeof act.hooks.dispose === 'function') act.hooks.dispose() } catch (err) { console.error('[maple-skins] hooks.dispose', err) }
      }
      for (const fn of act.cleanups) {
        try { fn() } catch (err) { console.error('[maple-skins] cleanup', err) }
      }
      act.cleanups = []
      if (act.layers !== null) {
        for (const el of Object.values(act.layers)) el.remove()
        act.layers = null
      }
      if (act.background !== null) {
        act.background.remove()
        act.background = null
      }
      for (const link of act.linkEls) link.remove()
      act.linkEls = []
    }

    function skinLinks(entry) {
      const links = [['stylesheet', `${API}/skins/${entry.id}/stylesheet`]]
      if (entry.hasPatches) links.push(['patches', `${API}/skins/${entry.id}/patches`])
      return links
    }

    /**
     * Ensure the skin's stylesheet links are in the head. On first boot the
     * index tap may already have inserted them — adopt those instead of
     * duplicating. A leftover link is adoptable only when its href points at
     * THIS skin's stylesheet: adopting another skin's link made the old
     * activation's disposal delete the very sheet the new skin depended on
     * (first switch after boot dropped every skin CSS while the attribute
     * already pointed at the new skin).
     */
    function linkKey(link) {
      return `${link.getAttribute(LINK_ATTR)}\u0000${link.getAttribute('href') ?? ''}`
    }

    function ensureLinks(entry, act) {
      const existing = new Map(
        [...document.head.querySelectorAll(`link[${LINK_ATTR}]`)].map((link) => [linkKey(link), link]),
      )
      for (const [kind, href] of skinLinks(entry)) {
        const prior = existing.get(`${kind}\u0000${href}`)
        if (prior !== undefined) {
          act.linkEls.push(prior)
          continue
        }
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.href = href
        link.setAttribute(LINK_ATTR, kind)
        document.head.appendChild(link)
        act.linkEls.push(link)
      }
    }

    function waitForLinks(act) {
      return Promise.all(act.linkEls.map((link) => new Promise((resolve) => {
        if (link.sheet !== null) {
          resolve()
          return
        }
        let settled = false
        const done = () => {
          if (settled) return
          settled = true
          clearTimeout(timer)
          resolve()
        }
        const timer = setTimeout(done, 3000)
        link.addEventListener('load', done)
        link.addEventListener('error', done)
      })))
    }

    function installBackground(entry, act) {
      const media = entry.backgroundMedia
      if (media === null || media === undefined || act.layers === null) return
      const variantOf = () => (themeGet() === 'dark' ? media.dark ?? media.light : media.light ?? media.dark)
      if (variantOf() === undefined) return
      const assetBase = `${API}/skins/${entry.id}/`
      const holder = document.createElement('div')
      holder.className = 'maple-skin-background'
      holder.style.cssText = 'position:absolute;inset:0;overflow:hidden;'
      const rebuild = () => {
        const variant = variantOf()
        holder.innerHTML = ''
        if (variant === undefined) return
        if (variant.type === 'image' && typeof variant.src === 'string') {
          const img = document.createElement('img')
          img.src = assetBase + variant.src
          img.alt = ''
          img.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;'
          holder.appendChild(img)
        }
        if (typeof variant.scrim === 'string') {
          const scrim = document.createElement('div')
          scrim.style.cssText = `position:absolute;inset:0;background:${variant.scrim};`
          holder.appendChild(scrim)
        }
      }
      rebuild()
      act.layers.background.appendChild(holder)
      act.background = holder
      act.cleanups.push(subscribeTheme(() => {
        if (activation === act) rebuild()
      }))
    }

    /**
     * Load and run the skin's optional hooks.mjs. Per the skin-hooks
     * contract, hook errors never break the static part of the skin.
     */
    async function installHooks(entry, act) {
      const assetBase = `${API}/skins/${entry.id}/`
      try {
        const mod = await import(`${assetBase}hooks.mjs`)
        const factory = mod && mod.default
        if (typeof factory !== 'function') throw new Error('hooks.mjs must default-export defineSkinHooks()')
        const hooks = factory()
        if (hooks === null || typeof hooks.apply !== 'function') throw new Error('defineSkinHooks() must return { apply }')
        const hookCtx = {
          skinId: entry.id,
          scopeAttr: entry.id,
          assetBase,
          layers: act.layers,
          theme: { get: themeGet, subscribe: (fn) => subscribeTheme(fn) },
          onCleanup: (fn) => { if (typeof fn === 'function') act.cleanups.push(fn) },
        }
        hooks.apply(hookCtx)
        act.hooks = hooks
      } catch (err) {
        console.error(`[maple-skins] hooks failed for ${entry.id}`, err)
      }
    }

    async function activate(id) {
      if (activation !== null && activation.id === id) return
      const entry = id === '' || id === DEFAULT_SKIN ? null : catalogCache.find((s) => s.id === id)
      if (entry === undefined) throw new Error(`unknown skin: ${id}`)
      const next = makeActivation()
      next.id = entry === null ? null : entry.id
      if (entry !== null) {
        // 1. styles first — the attribute flips only after the CSS arrives
        ensureLinks(entry, next)
        await waitForLinks(next)
        // 2. layers, background, hooks for the new activation
        if (entry.hasBackground || entry.hasHooks) next.layers = createLayers()
        if (entry.hasBackground && next.layers !== null) installBackground(entry, next)
        if (entry.hasHooks && next.layers !== null) await installHooks(entry, next)
      }
      // 3. flip: the new activation is ready, dispose the old one
      const prev = activation
      activation = next
      disposeActivation(prev)
      // Defensive sweep: drop any link the new activation does not own
      // (orphans a failed switch could otherwise leave in the head forever).
      for (const link of [...document.head.querySelectorAll(`link[${LINK_ATTR}]`)]) {
        if (!next.linkEls.includes(link)) link.remove()
      }
      const html = document.documentElement
      if (next.id !== null) html.setAttribute('data-dsh-skin', next.id)
      else html.removeAttribute('data-dsh-skin')
      // 4. persist the selection
      try {
        await fetch(`${API}/active`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ skin: next.id === null ? '' : next.id }),
        })
      } catch (err) {
        console.error('[maple-skins] persist failed', err)
      }
    }

    function withSerial(fn) {
      const run = (switching === null ? Promise.resolve() : switching).then(fn)
      switching = run.catch(() => {})
      return run
    }

    async function loadCatalog() {
      const res = await fetch(`${API}/catalog`, { headers: { accept: 'application/json' } })
      const data = await res.json()
      catalogCache = Array.isArray(data.skins) ? data.skins : []
      return data
    }

    // ---------------------------------------------------------------- UI

    const ui = {
      page: { display: 'flex', flexDirection: 'column', gap: '10px' },
      hint: { fontSize: '12px', lineHeight: 1.5, color: 'var(--dsw-alias-label-tertiary)' },
      error: { fontSize: '12px', color: 'var(--dsw-alias-state-error-primary, #b42318)' },
      card: {
        display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px',
        border: '1px solid var(--dsw-alias-border-l2)', borderRadius: '10px',
        background: 'var(--dsw-alias-bg-layer-2)',
      },
      cardActive: { borderColor: 'var(--dsw-alias-brand-primary)' },
      thumb: {
        width: '96px', height: '60px', objectFit: 'cover', borderRadius: '6px', flex: 'none',
        border: '1px solid var(--dsw-alias-border-l3)', background: 'var(--dsw-alias-bg-layer-1)',
      },
      thumbPlaceholder: {
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '11px', color: 'var(--dsw-alias-label-tertiary)', textAlign: 'center', padding: '4px',
      },
      meta: { display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0, flex: 1 },
      name: { fontSize: '13.5px', fontWeight: 600, color: 'var(--dsw-alias-label-primary)' },
      tagline: { fontSize: '12px', lineHeight: 1.45, color: 'var(--dsw-alias-label-secondary)' },
      badge: {
        fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '999px', whiteSpace: 'nowrap',
        background: 'var(--dsw-alias-state-success-tertiary, #dcf3e5)',
        color: 'var(--dsw-alias-state-success-primary, #0f6b3a)',
      },
      button: {
        fontSize: '12px', lineHeight: 1, padding: '6px 12px', borderRadius: '7px', whiteSpace: 'nowrap',
        border: '1px solid var(--dsw-alias-border-l3)',
        background: 'var(--dsw-alias-bg-layer-2)', color: 'var(--dsw-alias-label-primary)', cursor: 'pointer',
      },
    }

    function SkinRow(props) {
      const entry = props.entry
      const isActive = props.active === entry.id
      return e('div', { style: { ...ui.card, ...(isActive ? ui.cardActive : {}) } },
        entry.preview !== null && entry.preview.light !== null
          ? e('img', { src: `${API}${entry.preview.light}`, alt: '', style: ui.thumb })
          : e('div', {
              style: {
                ...ui.thumb, ...ui.thumbPlaceholder,
                ...(entry.accent ? { borderTop: `3px solid ${entry.accent}` } : {}),
              },
            }, entry.id === DEFAULT_SKIN ? '官方默认' : (entry.nameEn || entry.id)),
        e('div', { style: ui.meta },
          e('div', { style: ui.name }, entry.name),
          entry.tagline !== '' ? e('div', { style: ui.tagline }, entry.tagline) : null),
        isActive
          ? e('span', { style: ui.badge }, '使用中')
          : e('button', {
              type: 'button',
              style: { ...ui.button, ...(props.busy === entry.id ? { opacity: 0.55, cursor: 'default' } : {}) },
              disabled: props.busy !== '',
              onClick: () => props.onChoose(entry),
            }, props.busy === entry.id ? '应用中…' : '应用'),
      )
    }

    function MapleSkinSection() {
      const [state, setState] = React.useState({ skins: null, active: DEFAULT_SKIN, error: '' })
      const [busy, setBusy] = React.useState('')
      const refresh = () => loadCatalog().then((data) => {
        setState({ skins: data.skins, active: data.active === '' ? DEFAULT_SKIN : data.active, error: '' })
      }).catch(() => {
        setState((s) => ({ ...s, error: '加载皮肤列表失败' }))
      })
      React.useEffect(() => { refresh() }, [])
      const choose = (entry) => {
        setBusy(entry.id)
        withSerial(() => activate(entry.id))
          .then(refresh)
          .catch((err) => {
            console.error('[maple-skins] activate failed', err)
            setState((s) => ({ ...s, error: '皮肤应用失败，请查看控制台' }))
          })
          .finally(() => setBusy(''))
      }
      if (state.skins === null) {
        return e('div', { style: ui.hint }, state.error !== '' ? state.error : '加载皮肤列表…')
      }
      const rows = [
        { id: DEFAULT_SKIN, name: '原皮肤', tagline: '官方 DSH 原貌，不应用任何皮肤覆盖', accent: '', preview: null },
        ...state.skins,
      ]
      return e('div', { style: ui.page },
        e('div', { style: ui.hint }, '点击「应用」立即切换，刷新页面或重启后仍然生效。'),
        state.error !== '' ? e('div', { style: ui.error }, state.error) : null,
        ...rows.map((row) => e(SkinRow, { key: row.id, entry: row, active: state.active, busy, onChoose: choose })),
      )
    }

    // ---------------------------------------------------------------- plugin

    /** @param {any} ctx */
    function apply(ctx) {
      startThemeObserver()

      const slots = ctx.get('slots')
      if (slots !== undefined) {
        slots.inject('settings.section', () => slots.register(
          { name: 'settings.section', id: 'maple-skins', order: 130, label: () => '冒险岛皮肤' },
          MapleSkinSection,
        ))
      }

      // Boot the persisted active skin.
      loadCatalog()
        .then((data) => {
          const active = typeof data.active === 'string' ? data.active : ''
          if (active === '' || active === DEFAULT_SKIN) return
          // serialize with UI-triggered switches (no concurrent activations)
          return withSerial(() => activate(active))
        })
        .catch((err) => console.error('[maple-skins] boot activate failed', err))

      return () => {
        // Unload: restore the stock look, drop every side effect.
        try {
          const prev = activation
          activation = makeActivation()
          disposeActivation(prev)
          document.documentElement.removeAttribute('data-dsh-skin')
        } catch {
          // best effort
        }
      }
    }

    module.exports = {
      name: 'dsh-maple-skins',
      inject: ['slots'],
      apply,
      // test seam for test/switching.mjs (the client host ignores extra keys)
      __test: {
        activate: (id) => withSerial(() => activate(id)),
        activation: () => activation,
      },
    }
    return module.exports
  },
})

/**
 * 冒险岛 V2 — skin hooks (x-org.linxin666.skin-center/v1alpha1)
 *
 * 职责（全部幂等、随激活清理）：
 *  1. 浏览器标题 → "MapleStory V2 · DeepSeek Harness"
 *  2. meta theme-color 同步
 *  3. 侧栏品牌标文字 → "MapleStory"
 *  4. hero 文案 → "让枫叶飘进每一次对话" / "启程版"
 *  5. 标题栏铭牌 "MapleStory 079"
 *  6. 吉祥物排队：花蘑菇 + 绿水灵 + 蓝蜗牛（CSS 弹跳）
 *  7. 流云（浅色可见）/ 星月（深色可见）
 *  8. 飘落枫叶
 */
const SKIN_TITLE = 'MapleStory V2 · DeepSeek Harness'
const BRAND_TEXT = 'MapleStory'
const BRAND_ORIGINS = ['DSH Local Build', 'DSH']
const HERO_COPY = new Map([
  ['探索未至之境', '让枫叶飘进每一次对话'],
  ['预览版', '启程版'],
])
const CHROME_COLOR = { light: '#f7edd8', dark: '#1a1420' }
const MASCOTS = [
  ['flower-mushroom.png', 56],
  ['green-slime.png', 44],
  ['blue-snail.png', 20],
]
const LEAF_COUNT = 9
const CLOUD_COUNT = 4
/** 云朵模板：[left, top, width, height]，基准尺寸 */
const CLOUD_PARTS = [
  [0, 26, 130, 46],
  [55, 4, 95, 62],
  [105, 20, 115, 50],
]

function defineSkinHooks() {
  return {
    apply(ctx) {
      const doc = document
      const body = doc.body
      const asset = (name) => `${ctx.assetBase}/assets/${name}`
      const ownedNodes = []

      // ---- 1. 浏览器标题 ----
      const originalTitle = doc.title
      doc.title = SKIN_TITLE

      // ---- 2. meta theme-color ----
      const syncChrome = () => {
        const meta = doc.head.querySelector('meta[name="theme-color"]')
        if (meta) meta.setAttribute('content', CHROME_COLOR[ctx.theme.get()])
      }
      syncChrome()
      const unsubscribeTheme = ctx.theme.subscribe(syncChrome)

      // ---- 3 + 4. 文案替换 ----
      const patchTextNodes = (root) => {
        const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, null)
        let node
        while ((node = walker.nextNode())) {
          const value = node.nodeValue
          if (!value) continue
          const replacement = HERO_COPY.get(value.trim())
          if (replacement !== undefined) {
            node.nodeValue = value.replace(value.trim(), replacement)
          }
        }
      }

      const syncTexts = () => {
        const brandButtons = doc.querySelectorAll("button[class*='brand']")
        for (const btn of brandButtons) {
          const walker = doc.createTreeWalker(btn, NodeFilter.SHOW_TEXT, null)
          let node
          while ((node = walker.nextNode())) {
            const trimmed = node.nodeValue.trim()
            if (BRAND_ORIGINS.includes(trimmed)) {
              node.nodeValue = node.nodeValue.replace(trimmed, BRAND_TEXT)
            }
          }
        }
        const heroes = doc.querySelectorAll("[data-phase='hero']")
        for (const hero of heroes) patchTextNodes(hero)
      }

      let syncScheduled = false
      const scheduleTextSync = () => {
        if (syncScheduled) return
        syncScheduled = true
        requestAnimationFrame(() => {
          syncScheduled = false
          try {
            syncTexts()
          } catch {
            // 文案同步失败不影响静态皮肤
          }
        })
      }
      scheduleTextSync()
      const textObserver = new MutationObserver(scheduleTextSync)
      textObserver.observe(body, { childList: true, subtree: true, characterData: true })

      // ---- 5. 标题栏铭牌 ----
      const titlebar = doc.querySelector("[class*='titlebar']")
      if (titlebar && !titlebar.querySelector(".maple-titlebar-plaque")) {
        const plaque = doc.createElement('span')
        plaque.className = 'maple-titlebar-plaque'
        plaque.setAttribute('aria-hidden', 'true')
        plaque.textContent = 'MapleStory 079'
        titlebar.prepend(plaque)
        ownedNodes.push(plaque)
      }

      // ---- 6. 吉祥物排队 ----
      const line = doc.createElement('div')
      line.className = 'maple-mascot-line'
      line.setAttribute('aria-hidden', 'true')
      for (const [name, width] of MASCOTS) {
        const img = doc.createElement('img')
        img.src = asset(name)
        img.alt = ''
        img.style.width = `${width}px`
        line.appendChild(img)
      }
      body.appendChild(line)
      ownedNodes.push(line)

      // ---- 7a. 流云 ----
      for (let i = 0; i < CLOUD_COUNT; i += 1) {
        const cloud = doc.createElement('div')
        cloud.className = 'maple-cloud'
        cloud.setAttribute('aria-hidden', 'true')
        const scale = 0.7 + Math.random() * 0.9
        for (const [l, t, w, h] of CLOUD_PARTS) {
          const puff = doc.createElement('i')
          puff.style.cssText =
            `left:${Math.round(l * scale)}px;top:${Math.round(t * scale)}px;` +
            `width:${Math.round(w * scale)}px;height:${Math.round(h * scale)}px`
          cloud.appendChild(puff)
        }
        const duration = 80 + Math.random() * 70
        cloud.style.top = `${(4 + Math.random() * 24).toFixed(1)}vh`
        cloud.style.animationDuration = `${duration.toFixed(1)}s`
        cloud.style.animationDelay = `${(-Math.random() * duration).toFixed(1)}s`
        cloud.style.opacity = `${(0.45 + Math.random() * 0.3).toFixed(2)}`
        body.appendChild(cloud)
        ownedNodes.push(cloud)
      }

      // ---- 7b. 星空与月亮（深色主题时由 CSS 点亮） ----
      const stars = doc.createElement('div')
      stars.className = 'maple-stars'
      stars.setAttribute('aria-hidden', 'true')
      body.appendChild(stars)
      ownedNodes.push(stars)

      const moon = doc.createElement('div')
      moon.className = 'maple-moon'
      moon.setAttribute('aria-hidden', 'true')
      body.appendChild(moon)
      ownedNodes.push(moon)

      // ---- 8. 飘落枫叶 ----
      for (let i = 0; i < LEAF_COUNT; i += 1) {
        const leaf = doc.createElement('span')
        leaf.className = 'maple-leaf'
        leaf.textContent = '\u{1F341}'
        leaf.setAttribute('aria-hidden', 'true')
        const duration = 14 + Math.random() * 12
        leaf.style.left = `${(Math.random() * 96).toFixed(2)}vw`
        leaf.style.fontSize = `${(12 + Math.random() * 10).toFixed(1)}px`
        leaf.style.animationDuration = `${duration.toFixed(1)}s`
        leaf.style.animationDelay = `${(-Math.random() * duration).toFixed(1)}s`
        body.appendChild(leaf)
        ownedNodes.push(leaf)
      }

      // ---- 清理（幂等，可被多次调用） ----
      ctx.onCleanup(() => {
        textObserver.disconnect()
        unsubscribeTheme()
        for (const node of ownedNodes) {
          if (node.parentNode) node.parentNode.removeChild(node)
        }
        if (doc.title === SKIN_TITLE) doc.title = originalTitle
      })
    },
  }
}

export default defineSkinHooks

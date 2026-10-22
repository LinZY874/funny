/**
 * 冒险岛 V1 — skin hooks (x-org.linxin666.skin-center/v1alpha1)
 *
 * 职责（全部幂等、随激活清理）：
 *  1. 浏览器标题 → "MapleStory V1 · DeepSeek Harness"（cleanup 时还原）
 *  2. meta theme-color 同步暖木/夜色
 *  3. 侧栏品牌标文字 "DSH Local Build" → "MapleStory"
 *  4. 新会话空态 hero 文案：
 *     "探索未至之境" → "让枫叶飘进每一次对话"
 *     "预览版"       → "启程版"
 *     （MutationObserver 持续修正，React 重渲染后自动补回）
 *  5. 右下角吉祥物排队：花蘑菇 + 绿水灵 + 蓝蜗牛（蓝蜗牛最小）
 *  6. 飘落枫叶氛围（🍁，尊重 prefers-reduced-motion 由 CSS 关闭）
 */
const SKIN_TITLE = 'MapleStory V1 · DeepSeek Harness'
const BRAND_TEXT = 'MapleStory'
const BRAND_ORIGINS = ['DSH Local Build', 'DSH']
const HERO_COPY = new Map([
  ['探索未至之境', '让枫叶飘进每一次对话'],
  ['预览版', '启程版'],
])
const CHROME_COLOR = { light: '#f7edd8', dark: '#241a0e' }
const MASCOTS = [
  ['flower-mushroom.png', 56],
  ['green-slime.png', 44],
  ['blue-snail.png', 20],
]
const LEAF_COUNT = 9

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
        // 品牌标文字
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
        // 空态 hero 文案（仅在 hero 阶段存在时才扫描）
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

      // ---- 5. 吉祥物排队（右下角） ----
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

      // ---- 6. 飘落枫叶 ----
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

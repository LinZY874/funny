/**
 * Regression test for the snail interaction (冒险岛 V3 /
 * v3, 迪士尼 12 法则). 语义：
 *   - 速度：点击 = 从当前位置立即获得冲量（U0 指数衰减，τ=0.45s，60px），
 *     位置严格单调向前、零回退、零停顿；连续点击 = 每次点击重置冲量
 *   - 大小（JS 单一状态量，绝无双重放大）：
 *       · 悬停 = 一次性放大到 1.12（缓动进出）
 *       · 点击本身不放大，从精确当前大小启动"缩小段"逐渐回原大小
 *       · 缩小段中点击不重开、不再变大；冲刺中移入不放大
 *       · 缩小段走完 = 原大小（即使鼠标仍停在蜗牛上）
 *   - 迪士尼 12 法则（整体大小 = 面积均方根 gm，面积守恒 ⇒ 形变不影响它）：
 *       · Squash & Stretch：出手拉伸 横+15%L / 纵−15%L，gm 只减不增
 *       · Exaggeration：出手前倾 9°L（朝运动方向）
 *       · Follow Through：冲刺结束后 ±2% 阻尼落地摆动（约 0.48s，原地缩放）
 *       · 无垂直位移：全程不写 translate 通道
 *
 * 断言：
 *   1. 不上下飘动：translate 通道全程从未被写
 *   2. 悬停→点击（用户场景）：悬停放大 1.12；点击后首帧横拉纵压（sx>sy、
 *      前倾 rot<-4°）、gm < 1.12（无二次放大）；逐帧零回退、冲量期无刹停、
 *      额外推进 ≈60px、gm 单调不增；5 帧后出手形变衰减完毕（均匀缩小）
 *   3. 落地摆动：结束帧后先正后负的真摆动（面积守恒）、随后稳定回原大小
 *   4. 移开→再移入：新的悬停放大
 *   5. 冲量中点击：出手形变重演（sx 跳升）、gm 严格减小（无面积放大）、
 *      速度线变量立即回升、位置无跳变
 *   6. 缩小段中鼠标移走→移入：gm 继续减小（忙碌中不放大）
 *   7. 快速连点：全程无停顿、严格单调、gm 只减不增、结束后回原大小
 *   8. 无悬停时点击：出手形变播放但 gm ≤ 1（不放大）、速度照常
 *   9. 一整圈巡逻 + wrap：除入画出画外无回退
 *   10. cleanup 无残留、幂等；reduced-motion 下不写任何通道
 *
 * Drives the real skins/v3/hooks.mjs against a minimal
 * fake DOM with a hand-pumped rAF clock (100ms frame steps stay within
 * the hook's 0.1s dt clamp, so all dynamics are exact).
 *
 * Usage: node test/snail-dash.mjs
 */
import assert from 'node:assert/strict'

// ------------------------------------------------------------ fake DOM

class FakeClassList {
  constructor(el) { this.el = el }
  add(c) { this.el._classSet.add(c) }
  remove(c) { this.el._classSet.delete(c) }
  contains(c) { return this.el._classSet.has(c) }
}

class FakeElement {
  constructor(tag) {
    this.tagName = tag
    this.children = []
    this.parentNode = null
    const style = {}
    style.setProperty = (k, v) => { style[k] = v }
    this.style = style
    this.attrs = new Map()
    this.listeners = new Map()
    this._classSet = new Set()
    this.classList = new FakeClassList(this)
  }
  get className() { return [...this._classSet].join(' ') }
  set className(v) { this._classSet = new Set(String(v).split(/\s+/).filter(Boolean)) }
  setAttribute(k, v) { this.attrs.set(k, v) }
  getAttribute(k) { return this.attrs.has(k) ? this.attrs.get(k) : null }
  appendChild(child) {
    if (child.parentNode !== null) {
      const p = child.parentNode
      p.children.splice(p.children.indexOf(child), 1)
    }
    child.parentNode = this
    this.children.push(child)
    return child
  }
  removeChild(child) {
    const i = this.children.indexOf(child)
    if (i !== -1) this.children.splice(i, 1)
    child.parentNode = null
    return child
  }
  addEventListener(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, [])
    this.listeners.get(type).push(fn)
  }
  removeEventListener(type, fn) {
    const arr = this.listeners.get(type) ?? []
    const i = arr.indexOf(fn)
    if (i !== -1) arr.splice(i, 1)
  }
  trigger(type, timeStamp) {
    for (const fn of this.listeners.get(type) ?? []) fn({ timeStamp })
  }
  click(timeStamp) {
    this.trigger('click', timeStamp)
  }
}

const docElement = new FakeElement('html')
docElement.clientWidth = 1400
const body = new FakeElement('body')
globalThis.document = {
  documentElement: docElement,
  body,
  createElement: (tag) => new FakeElement(tag),
}

// Hand-pumped rAF clock.
let rafCb = null
let now = 0
globalThis.requestAnimationFrame = (cb) => { rafCb = cb; return 1 }
globalThis.cancelAnimationFrame = () => { rafCb = null }
let reducedMotion = false
globalThis.matchMedia = () => ({ get matches() { return reducedMotion } })
globalThis.window = { addEventListener() {}, removeEventListener() {} }

function pump(ms) {
  const end = now + ms
  while (now < end && rafCb !== null) {
    const cb = rafCb
    rafCb = null
    now = Math.min(end, now + 100)
    cb(now)
  }
}

// ------------------------------------------------------------ helpers

const parseX = (el) => {
  const m = /translateX\(([-\d.]+)px\)/.exec(el.style.transform ?? '')
  assert.ok(m !== null, `expected translateX transform, got: ${el.style.transform}`)
  return Number(m[1])
}
/** 内层形变：{sx, sy, rot}；无 transform = {1,1,0} */
const parseDeform = (el) => {
  const t = el.style.transform
  if (t === '' || t === undefined) return { sx: 1, sy: 1, rot: 0 }
  let sx = 1
  let sy = 1
  let rot = 0
  const m2 = /scale\(([-\d.]+),\s*([-\d.]+)\)/.exec(t)
  const m1 = /scale\(([-\d.]+)\)/.exec(t)
  const mr = /rotate\(([-\d.]+)deg\)/.exec(t)
  if (m2) {
    sx = Number(m2[1])
    sy = Number(m2[2])
  } else if (m1) {
    sx = sy = Number(m1[1])
  } else {
    assert.ok(false, `unrecognized transform: ${t}`)
  }
  if (mr) rot = Number(mr[1])
  return { sx, sy, rot }
}
/** 整体大小 = 面积均方根（squash&stretch 面积守恒 ⇒ 形变不影响它） */
const gm = (d) => Math.sqrt(d.sx * d.sy)
const boostVar = (el) => Number(el.style['--maple-boost'] ?? 0)

// 与 hooks.mjs 保持一致的参数
const TAU = 450
const HOVER = 1.12
const U0 = 60 / (TAU / 1000) // ≈ 133.33 px/s
const VW = docElement.clientWidth
const ENTRY = VW * 1.05
const SPEED = (ENTRY - (-60)) / 150 // 10.2 px/s
const PATROL_STEP = SPEED * 0.1 // 1.02 px/帧
// 冲量/缩小段结束帧序号（e^{-i*100/TAU} 首次 < 0.02 的帧）
const END_I = Math.floor((TAU * Math.log(50)) / 100) + 1
// 微晃/小弧镜像参数（断言精确值用）
const LAUNCH_TAU = 140

// ------------------------------------------------------------ load hooks

const { default: defineSkinHooks } = await import(
  new URL('../skins/v3/hooks.mjs', import.meta.url).href
)

{
  const hooks = defineSkinHooks()
  const cleanups = []
  hooks.apply({ onCleanup: (fn) => cleanups.push(fn) })

  assert.equal(body.children.length, 1, 'snail element injected once')
  const snail = body.children[0]
  const snailBody = snail.children[0]
  assert.ok(snail.classList.contains('maple-snail'))
  assert.ok(snailBody.classList.contains('maple-snail-body'))
  assert.equal(snail.getAttribute('aria-hidden'), 'true')
  assert.equal(String(snail.getAttribute('title')), 'null', 'no tooltip text')

  // 起始 = 视口外右侧入画点，匀速巡逻
  pump(200)
  const x0 = parseX(snail)
  assert.ok(Math.abs(x0 - (ENTRY - 0.2 * SPEED)) < 0.05, `start near entry: ${x0}`)

  // ---- 1. 不上下飘动：待机时 translate 通道不被写 ----
  pump(500) // 帧 300..700
  assert.equal(snailBody.style.translate, undefined, 'no vertical bob at idle')

  pump(2500) // 帧 800..3200
  const xBefore = parseX(snail)
  assert.ok(Math.abs(xBefore - (ENTRY - 3.2 * SPEED)) < 0.05, `patrol speed: ${xBefore}`)

  // ---- 2. 悬停 → 点击（用户场景）：放大一次、点击不放大、出手拉伸、逐渐缩小 ----
  snail.trigger('mouseenter', now) // 3200
  pump(600) // 帧 3300..3800：缓动到 1.12
  assert.equal(snailBody.style.transform, 'scale(1.120)', 'hover reaches 1.12')
  snail.click(now) // 3800

  let prevX = xBefore
  let extra = 0
  let prevGm = HOVER
  for (let i = 1; i <= END_I; i++) {
    pump(100) // 帧 3900..6200
    const x = parseX(snail)
    const step = prevX - x
    assert.ok(x <= prevX + 1e-9, `backward creep @frame ${i}: ${prevX} -> ${x}`)
    const d = parseDeform(snailBody)
    const g = gm(d)
    assert.equal(snailBody.style.translate, undefined, `no vertical motion @frame ${i}`)
    if (i < END_I) {
      assert.ok(step > PATROL_STEP - 0.02, `stalled @frame ${i}: step ${step}`)
      extra += step - PATROL_STEP
      assert.ok(g <= prevGm + 1e-6, `gm must not grow @frame ${i}: ${prevGm} -> ${g}`)
      if (i === 1) {
        // 出手首帧：横拉纵压 + 前倾 + 无整体放大（Squash&Stretch/Anticipation）
        assert.ok(d.sx > d.sy, `lunge stretches: sx ${d.sx} > sy ${d.sy}`)
        assert.ok(d.rot < -4, `lunge leans forward: rot ${d.rot}`)
        assert.ok(g < HOVER - 0.02, `no second grow: gm ${g} < 1.12`)
        const S1 = 1 + (HOVER - 1) * Math.exp(-100 / TAU)
        const L1 = Math.exp(-100 / LAUNCH_TAU)
        assert.ok(Math.abs(d.sx - S1 * (1 + 0.15 * L1)) < 0.002, `lunge sx exact: ${d.sx}`)
        assert.ok(Math.abs(d.sy - S1 * (1 - 0.15 * L1)) < 0.002, `lunge sy exact: ${d.sy}`)
      }
      if (i >= 6) {
        // 出手形变衰减完毕（140ms×ln(50) < 6 帧）：回到均匀缩小
        assert.ok(d.sx === d.sy, `lunge decayed, uniform shrink @frame ${i}: ${d.sx}/${d.sy}`)
        assert.equal(d.rot, 0, `lean back to 0 @frame ${i}`)
      }
    } else {
      // 结束帧：冲量与缩小段同时结束——平滑回归巡逻 + 落地摆动起步
      assert.ok(Math.abs(step - PATROL_STEP) < 0.1, `blend into patrol: step ${step}`)
      assert.ok(Math.abs(d.sx - 1) < 0.001 && Math.abs(d.sy - 1) < 0.001, 'settle starts at 1')
      assert.equal(boostVar(snailBody), 0, 'boost var reset')
    }
    prevX = x
    prevGm = g
  }
  assert.ok(extra > 45 && extra < 65, `single click advances ≈60px extra (got ${extra.toFixed(1)}px)`)
  assert.equal(snail.classList.contains('maple-snail-boost'), false, 'glow class removed')

  // ---- 3. 落地摆动（Follow Through）：先正后负、面积守恒、随后回原大小 ----
  pump(100) // 6300：w>0
  let d = parseDeform(snailBody)
  assert.ok(d.sx > 1 && d.sy < 1, `settle wobble up: ${d.sx}/${d.sy}`)
  assert.ok(Math.abs(d.sx * d.sy - 1) < 0.005, `settle area-preserving: ${d.sx * d.sy}`)
  pump(100) // 6400：w<0（真摆动，不是单调漂移）
  d = parseDeform(snailBody)
  assert.ok(d.sx < 1 && d.sy > 1, `settle wobble down: ${d.sx}/${d.sy}`)
  pump(400) // 6800：摆动窗口（480ms）过完 → 稳定回原大小
  assert.equal(snailBody.style.transform, '', 'settled back to original size')
  pump(200) // 7000：仍停着鼠标也保持原大小
  assert.equal(snailBody.style.transform, '', 'stays original while hovering (hint consumed)')

  // ---- 4. 移开 → 再移入：新的悬停放大 ----
  snail.trigger('mouseleave', now)
  snail.trigger('mouseenter', now)
  pump(100)
  assert.equal(snailBody.style.transform, 'scale(1.097)', 'fresh hover pop starts')
  pump(500) // 7600：收敛
  assert.equal(snailBody.style.transform, 'scale(1.120)', 'fresh hover reaches 1.12')

  // ---- 5. 冲量中点击：出手形变重演、gm 严格减小（无面积放大）、速度无跳变 ----
  snail.click(now) // 7600
  pump(100) // 7700
  d = parseDeform(snailBody)
  assert.ok(d.sx > d.sy, `mid-dash click re-lunges: sx ${d.sx} > sy ${d.sy}`)
  assert.ok(gm(d) < HOVER - 0.02, `mid-dash click no area grow: gm ${gm(d)}`)
  assert.ok(boostVar(snailBody) > 0.75, `impulse armed: ${boostVar(snailBody)}`)
  pump(500) // 8200：出手形变已衰减（均匀缩小）
  d = parseDeform(snailBody)
  assert.ok(d.sx === d.sy, `back to uniform shrink: ${d.sx}`)
  const xAt8200 = parseX(snail)
  pump(100) // 8300
  d = parseDeform(snailBody)
  const sizeB = d.sx
  const varB = boostVar(snailBody)
  const xAt8300 = parseX(snail)
  const stepDecaying = xAt8200 - xAt8300 // 衰减中的步长
  snail.click(now) // 8300（中途点击：不重开缩小段，出手形变重演）
  pump(100) // 8400
  const dC = parseDeform(snailBody)
  const sizeC = dC.sx
  const varC = boostVar(snailBody)
  const xAt8400 = parseX(snail)
  const stepReset = xAt8300 - xAt8400 // 冲量重置后的步长
  assert.ok(sizeC > sizeB + 0.02, `mid-dash click re-stretches: ${sizeB} -> ${sizeC}`)
  assert.ok(gm(dC) < sizeB, `mid-dash click area shrinks: gm ${gm(dC)} < ${sizeB}`)
  assert.ok(varC > varB, `impulse re-armed: ${varB} -> ${varC}`)
  assert.ok(stepReset > stepDecaying + 3, `velocity jump: ${stepDecaying} -> ${stepReset}`)
  assert.ok(stepReset <= (SPEED + U0) * 0.1 + 0.05, `velocity bounded: ${stepReset}`)

  // ---- 6. 缩小段中鼠标移走 → 移入：忙碌中不放大（gm 继续减小） ----
  snail.trigger('mouseleave', now)
  snail.trigger('mouseenter', now)
  pump(100) // 8500
  const g1 = gm(parseDeform(snailBody))
  pump(100) // 8600
  const g2 = gm(parseDeform(snailBody))
  assert.ok(g2 < g1, `no pop during episode: gm ${g1} -> ${g2}`)

  // ---- 7. 快速连点（8600/8800/9000）：无停顿、严格单调、gm 只减不增 ----
  snail.click(now) // 8600
  pump(200)
  snail.click(now) // 8800
  pump(200)
  snail.click(now) // 9000
  let sawReset = false
  prevGm = gm(parseDeform(snailBody))
  for (let i = 1; i <= 40; i++) {
    pump(100) // 帧 9100..13000
    const x = parseX(snail)
    const step = prevX - x
    assert.ok(x <= prevX + 1e-9, `burst backward @frame ${i}: ${prevX} -> ${x}`)
    assert.ok(step > PATROL_STEP - 0.02, `burst stall @frame ${i}: step ${step}`)
    const d2 = parseDeform(snailBody)
    const g3 = gm(d2)
    assert.ok(g3 <= prevGm + 0.001, `burst gm must not grow @frame ${i}: ${prevGm} -> ${g3}`)
    if (i === 1) assert.ok(boostVar(snailBody) > 0.75, `last burst click re-armed: ${boostVar(snailBody)}`)
    if (i <= 10) assert.ok(step > PATROL_STEP + 0.5, `burst dip @frame ${i}: step ${step}`)
    if (snailBody.style.transform === '' && g3 === 1) sawReset = true
    prevX = x
    prevGm = g3
  }
  assert.ok(sawReset, 'burst settles back to original size')
  assert.equal(snailBody.style.transform, '', 'burst fully settled')

  // ---- 8. 无悬停时点击：出手形变播放但 gm ≤ 1（不放大）、速度照常 ----
  snail.trigger('mouseleave', now) // 13000
  snail.click(now) // 13000
  pump(100) // 13100
  d = parseDeform(snailBody)
  assert.ok(d.sx > d.sy, `no-hover click still lunges: ${d.sx}/${d.sy}`)
  assert.ok(gm(d) <= 1.0005, `no-hover click does not grow: gm ${gm(d)}`)
  assert.ok(boostVar(snailBody) > 0.75, 'no-hover click arms impulse')
  pump(200) // 13300
  d = parseDeform(snailBody)
  assert.ok(d.sx > 1 && d.sy < 1, `lunge decays area-neutral: ${d.sx}/${d.sy}`)
  assert.ok(gm(d) <= 1.0005, `lunge stays ≤ original: gm ${gm(d)}`)

  // ---- 9. 一整圈巡逻 + wrap：除入画出画外无回退 ----
  {
    const start = parseX(snail)
    let wrapped = false
    prevX = start
    for (let i = 0; i < 2500; i++) {
      pump(100)
      const x = parseX(snail)
      if (x > prevX + 500) wrapped = true
      else assert.ok(x <= prevX + 1e-9, `lap backward @frame ${i}: ${prevX} -> ${x}`)
      prevX = x
    }
    assert.ok(wrapped, `lap wrap happened (start ${start})`)
  }

  // ---- 10. cleanup：无残留、幂等 ----
  for (const fn of cleanups) fn()
  assert.equal(body.children.length, 0, 'snail removed on cleanup')
  assert.equal(rafCb, null, 'rAF cancelled on cleanup')
  pump(300)
  assert.equal(rafCb, null, 'cleanup idempotent (no rAF reschedule)')
  for (const fn of cleanups) fn()
  assert.equal(body.children.length, 0, 'cleanup idempotent (no re-inject)')
}

// ---- 11. reduced-motion：不巡逻、不写任何通道、点击无副作用 ----
{
  reducedMotion = true
  const hooks = defineSkinHooks()
  const cleanups = []
  hooks.apply({ onCleanup: (fn) => cleanups.push(fn) })
  assert.equal(body.children.length, 1, 'element still injected')
  const snail = body.children[0]
  const snailBody = snail.children[0]
  snail.trigger('mouseenter', now)
  snail.click(now)
  pump(300)
  assert.equal(snail.style.transform, undefined, 'no position writes under reduced motion')
  assert.equal(snailBody.style.transform, undefined, 'no size writes under reduced motion')
  assert.equal(snailBody.style.translate, undefined, 'no bob writes under reduced motion')
  assert.equal(snailBody.style['--maple-boost'], undefined, 'no boost var under reduced motion')
  for (const fn of cleanups) fn()
  assert.equal(body.children.length, 0)
  reducedMotion = false
}

console.log('snail-dash: all checks passed')

/**
 * 冒险岛 V3 — skin hooks
 * (x-org.linxin666.skin-center/v1alpha1)
 *
 * 职责（全部幂等、随激活清理）：
 *  1. 蓝蜗牛巡逻：向 body 注入真实 .maple-snail 元素（外观由作用域后的
 *     patches.css 提供），rAF 驱动沿底部草缘自右向左慢速巡逻（150s/圈）；
 *     入画点 = 视口右缘外 5vw、出画点 = 左缘外 60px，均在视口外，
 *     循环切换永不穿模
 *  2. 点击助力（纯助力语义：位置严格单调向前、零回退、零停顿）：
 *     点击蜗牛 → 从当前位置立即获得额外速度 U0（≈133px/s），按指数
 *     规律衰减（时间常数 0.45s）：蜗牛向前冲，随后无缝融回巡逻速度，
 *     全程速度不低于巡逻速度，没有任何"刹停"或蓄力停顿；
 *     单次点击的总推进距离恰好 60px
 *  3. 连续点击：每次点击都把速度冲量重置回满值（不排队、不计数），
 *     连点即持续冲刺，松手后缓缓回归巡逻
 *  4. 大小（JS 单一状态量，绝无双重放大）：
 *     · 悬停 = 放大 12%（每次鼠标进入一次性提示，缓动 ≈160ms 进出）
 *     · 点击本身不放大——从精确当前大小启动"缩小段"（与冲量同律指数
 *       衰减回原大小，中途点击不重开、不再变大）
 *     · 缩小段走完 = 回到原大小（即使鼠标仍停在蜗牛上）
 *     · 冲刺中鼠标移入不放大；移走继续缩小；移开后再移入 = 新的悬停提示
 *
 *  迪士尼 12 法则的运动设计：
 *  · Squash & Stretch：点击瞬间的"出手拉伸"——横向拉伸 +15% / 纵向压扁
 *    −15%（面积守恒 = 绝不整体变大），140ms 快衰减；缩小段本身 = 形变
 *    逐渐恢复的过程
 *  · Anticipation：出手拉伸即动作起点的"预备"——位置同帧起步、零延迟，
 *    用形变而非停顿做预备
 *  · Follow Through & Overlapping：冲刺结束后 ±2% 的阻尼"落地摆动"
 *    （约 0.5s，面积守恒，原地缩放非位移），再稳稳回到原大小
 *  · Exaggeration：出手时 9° 前倾（朝运动方向压身，随冲量衰减归零）
 *  · Timing / Staging：速度线与壳金光由速度冲量比例逐帧驱动
 *
 *  通道划分：位置 = 根 transform: translateX（纯水平）；形变 = 内层
 *  transform: scale(sx,sy) rotate(r)（原地形变）；速度线/壳金光 =
 *  --maple-boost 变量与 boost 类。全部连续量，无动画生命周期。
 *  不上下飘动——无 translate 通道，蜗牛全程无垂直位移。
 */
const BOOST_CLASS = 'maple-snail-boost'
const BOOST_TAU_MS = 450 // 冲量指数衰减时间常数（τ），速度与缩小段共用
const BOOST_DIST = 60 // 单次点击总推进距离（px）= U0 * τ
const BOOST_U0 = BOOST_DIST / (BOOST_TAU_MS / 1000) // ≈ 133.3 px/s
const BOOST_EPS_F = 0.02 // 比例低于此值视为结束（< 2%，不可感知）
const HOVER_SCALE = 1.12 // 悬停放大倍率（一次性提示）
const POP_TAU_MS = 60 // 悬停放大缓动时间常数（≈160ms 收敛）
const LAUNCH_TAU_MS = 140 // 出手拉伸/前倾衰减时间常数（快）
const LAUNCH_EPS = 0.02
const LAUNCH_SQ = 0.15 // 出手形变幅度：横 +15% / 纵 −15%（面积守恒）
const LAUNCH_LEAN_DEG = 9 // 出手前倾角（朝运动方向）
const SETTLE_TAU_MS = 120 // 落地摆动衰减时间常数
const SETTLE_AMP = 0.02 // 落地摆动幅度（±2%，面积守恒）
const SETTLE_PERIOD_MS = 320 // 摆动周期
const SETTLE_MS = 480 // 摆动窗口
const LAP_S = 150 // 巡逻一圈时长（秒），与原 CSS 版一致
const EXIT_X = -60 // 出画点：精灵（宽 30px）完全离开左缘
const ENTRY_PAD = 0.05 // 入画点：视口右缘外 5vw（与原 105vw 起点一致）
const MAX_FRAME_S = 0.1 // 帧间隔上限：标签页切回/卡顿不产生瞬移
const TAU2PI = Math.PI * 2

function defineSkinHooks() {
  return {
    apply(ctx) {
      const doc = document
      const reduced = matchMedia('(prefers-reduced-motion: reduce)')
      let root = null
      let bodyEl = null
      let raf = null
      let disposed = false
      let lastNow = 0
      // 速度冲量：每次点击都重置（冲刺距离重置，不排队、不计数）
      let speedT0 = null
      let speedLive = false
      // 大小：悬停一次性放大 + 点击启动"缩小段"（当前大小 → 原大小）
      let hovering = false
      let hintUsed = false // 本次悬停放大已被点击消耗
      let epT0 = null // 缩小段起点（null = 不在缩小段）
      let epS0 = 1 // 缩小段起始大小（= 点击时的精确当前大小）
      let size = 1 // 当前大小（JS 单一状态量，连续变化）
      // 出手形变（每次点击重置）与落地摆动（冲刺完全结束后播放一次）
      let launchT0 = null
      let wasActive = false
      let settleT0 = 0
      let settlePending = false
      let lastDeformKey = '' // 内层 transform 写入键
      const state = { x: 0, v: 0 }

      const vw = () => doc.documentElement.clientWidth || 1024
      const entryX = () => vw() * (1 + ENTRY_PAD)
      const syncSpeed = () => {
        state.v = (entryX() - EXIT_X) / LAP_S
      }

      const frame = (now) => {
        if (disposed) return
        raf = requestAnimationFrame(frame)
        if (root === null || reduced.matches) return
        const dt = Math.min(MAX_FRAME_S, (now - lastNow) / 1000)
        lastNow = now

        // 速度冲量比例 sf：点击即满，指数衰减
        let sf = 0
        if (speedT0 !== null) {
          sf = Math.exp(-(now - speedT0) / BOOST_TAU_MS)
          if (sf > 1) sf = 1 // 防御：事件时间戳略晚于当前帧
          if (sf < BOOST_EPS_F) {
            speedT0 = null
            sf = 0
          }
        }

        state.x -= (state.v + BOOST_U0 * sf) * dt
        if (state.x < EXIT_X) state.x = entryX()
        root.style.transform = `translateX(${state.x.toFixed(2)}px)`

        // 速度表现层：速度线 + 壳金光（sf=0 时只写一次归位，之后零开销）
        if (sf > 0) {
          bodyEl.style.setProperty('--maple-boost', sf.toFixed(3))
          if (sf > 0.25) root.classList.add(BOOST_CLASS)
        } else if (speedLive) {
          bodyEl.style.setProperty('--maple-boost', '0')
          root.classList.remove(BOOST_CLASS)
        }
        speedLive = sf > 0

        // 大小：缩小段精确驱动（逐渐缩小回原大小）；其余时候缓动到
        // 悬停放大/原大小（一次性悬停提示，点击即消耗）
        let epF = 0
        if (epT0 !== null) {
          epF = Math.exp(-(now - epT0) / BOOST_TAU_MS)
          if (epF > 1) epF = 1
          if (epF < BOOST_EPS_F) epF = 0
        }
        if (epT0 !== null) {
          size = 1 + (epS0 - 1) * epF
          if (epF === 0) epT0 = null
        } else {
          const target = hovering && !hintUsed ? HOVER_SCALE : 1
          if (size !== target) {
            size += (target - size) * (1 - Math.exp(-(dt * 1000) / POP_TAU_MS))
            if (Math.abs(target - size) < 0.001) size = target
          }
        }

        // 出手形变 L：每次点击满值，快衰减（Squash & Stretch + Anticipation）
        let L = 0
        if (launchT0 !== null) {
          L = Math.exp(-(now - launchT0) / LAUNCH_TAU_MS)
          if (L > 1) L = 1
          if (L < LAUNCH_EPS) L = 0
        }

        const active = epT0 !== null || L > 0

        // 形变（内层 transform；无垂直位移通道）
        if (active) {
          // 出手拉伸：横 +15%L / 纵 −15%L（面积守恒），前倾 9°L
          const sx = size * (1 + LAUNCH_SQ * L)
          const sy = size * (1 - LAUNCH_SQ * L)
          const rot = -LAUNCH_LEAN_DEG * L
          const key =
            L > 0
              ? `scale(${sx.toFixed(3)}, ${sy.toFixed(3)}) rotate(${rot.toFixed(2)}deg)`
              : `scale(${sx.toFixed(3)})`
          if (key !== lastDeformKey) {
            bodyEl.style.transform = key
            lastDeformKey = key
          }
        } else if (settlePending) {
          // 落地摆动（Follow Through）：±2% 阻尼摆动，面积守恒
          const t = now - settleT0
          if (t < 0 || t >= SETTLE_MS) {
            settlePending = false
          } else {
            const w =
              SETTLE_AMP *
              Math.exp(-t / SETTLE_TAU_MS) *
              Math.sin((TAU2PI * t) / SETTLE_PERIOD_MS)
            const key = `scale(${(1 + w).toFixed(3)}, ${(1 - w).toFixed(3)})`
            if (key !== lastDeformKey) {
              bodyEl.style.transform = key
              lastDeformKey = key
            }
          }
        } else {
          const key = size === 1 ? '' : `scale(${size.toFixed(3)})`
          if (key !== lastDeformKey) {
            bodyEl.style.transform = key
            lastDeformKey = key
          }
        }

        // 冲刺完全结束（缩小段与出手都走完）→ 触发一次落地摆动
        if (wasActive && !active && !settlePending) {
          settleT0 = now
          settlePending = true
        }
        wasActive = active
      }

      const startBoost = (e) => {
        if (root === null || reduced.matches) return
        const t = typeof e?.timeStamp === 'number' ? e.timeStamp : performance.now()
        // 速度冲量：从当前位置立即重置（不排队、不计数）
        speedT0 = t
        // 出手形变：每次点击重新"出手"（形变，非整体放大）
        launchT0 = t
        settlePending = false
        // 悬停放大已被点击消耗：点击本身不再放大（杜绝双重放大）
        hintUsed = true
        // 缩小段：仅当前不在段内才启动；从精确当前大小开始（含缓动中途），
        // 中途点击不重开、不再变大
        if (epT0 === null) {
          epT0 = t
          epS0 = size
        }
      }

      const onEnter = () => {
        if (disposed || root === null) return
        hovering = true
        // 冲刺进行中移入：忙碌中不放大（段结束后保持原大小直到再次进入）
        hintUsed = epT0 !== null
      }
      const onLeave = () => {
        hovering = false
        hintUsed = false
      }

      const onResize = () => syncSpeed()

      const buildSnail = () => {
        const el = doc.createElement('div')
        el.className = 'maple-snail'
        el.setAttribute('aria-hidden', 'true')
        const inner = doc.createElement('div')
        inner.className = 'maple-snail-body'
        el.appendChild(inner)
        el.addEventListener('click', startBoost)
        el.addEventListener('mouseenter', onEnter)
        el.addEventListener('mouseleave', onLeave)
        doc.body.appendChild(el)
        root = el
        bodyEl = inner
      }

      syncSpeed()
      state.x = entryX()

      if (doc.body !== null) {
        buildSnail()
      } else {
        // 防御：hooks 在 body 就绪前被调用（正常流程不会发生）
        const pending = new MutationObserver(() => {
          if (doc.body === null || root !== null || disposed) return
          pending.disconnect()
          buildSnail()
        })
        pending.observe(doc.documentElement, { childList: true })
        ctx.onCleanup(() => pending.disconnect())
      }

      window.addEventListener('resize', onResize)
      raf = requestAnimationFrame(frame)

      // ---- 清理（幂等，可被多次调用） ----
      ctx.onCleanup(() => {
        disposed = true
        if (raf !== null) cancelAnimationFrame(raf)
        window.removeEventListener('resize', onResize)
        if (root !== null && root.parentNode !== null) {
          root.parentNode.removeChild(root)
        }
        root = null
        bodyEl = null
      })
    },
  }
}

export default defineSkinHooks

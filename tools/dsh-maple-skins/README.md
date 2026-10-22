# dsh-maple-skins

dsh Web GUI 的冒险岛皮肤包：内置 **原皮肤（官方默认）** + **冒险岛系列 3 个版本**，
自带一个最小换肤器（设置 → 冒险岛皮肤），只负责切换，没有试穿、背景滑杆、壁纸桥等额外功能。

| id | 名称 | 说明 |
| --- | --- | --- |
| `default` | 原皮肤 | 官方 DSH 原貌（移除所有皮肤覆盖） |
| `v1` | 冒险岛 V1（蜗牛花园） | 蜗牛花园底图 + 金钱镖 / 三小怪 hooks |
| `v2` | 冒险岛 V2（蘑菇村景） | 高分辨率蘑菇村底图 + 绿水灵 hooks |
| `v3` | 冒险岛 V3（原版用色 · 蜗牛冲刺） | 无底图，079 原版用色 + 草地地平线；蓝蜗牛可点击冲刺（hooks），主推展示版本 |

皮肤的目录、标识和界面名称统一为 V1、V2、V3；安装包版本为 1.0.0。

## 安装（web profile）

```sh
# 在 dsh 部署 checkout 目录（pnpm 工作区）里执行：
pnpm dsh plugin --profile web add link:/绝对路径/dsh-maple-skins
```

然后重启 `dsh web`，进入「设置 → 冒险岛皮肤」选择 V1、V2 或 V3，推荐 V3。皮肤是纯资产目录（`skins/<id>/`：`skin.json` + `skin.css` +
可选 `patches.css` / `hooks.mjs` / `assets/` / `preview/`），增删皮肤 = 增删目录，重启生效。

## 工作原理

- **Host 半区**（`lib/index.js`）：
  - `GET /api/maple-skins/catalog` — 皮肤清单 + 当前选中
  - `GET|POST /api/maple-skins/active` — 读取 / 持久化选中（`~/.dsh/skins/maple-skin-active.json`）
  - `GET /api/maple-skins/skins/<id>/stylesheet|patches` — 经作用域变换后的 CSS
  - `GET /api/maple-skins/skins/<id>/(assets|preview)/**、hooks.mjs` — 原始资产
  - `webServer.tapIndex` — 给每份 index 文档盖 `html[data-dsh-skin]` + 样式表链接，
    刷新后直接以当前皮肤启动，无原貌闪屏
- **作用域变换**（`lib/scoping.js`）：与官方皮肤中心服务管线逐规则一致
  （`test/scoping.mjs` 对线上服务输出做过逐规则比对）——
  `:root` → `html[data-dsh-skin]` 块 + 官方 body 级 token `initial` 重置块
  （`lib/body-tokens.json` 为应用 `body` 级 token 集合的快照，`:root` 级 token 如阴影不重置）
  + `html[data-dsh-skin] body` 块（body 副本用于赢得官方 body 级 token 的级联，
  其中的 `color` 声明留在 html 块）；其余选择器加作用域前缀，`@keyframes` 保持全局，
  `url(assets/...)` 保持相对路径。两份表尾均自动追加
  `html[data-dsh-skin] [id="root"] { background: transparent; }`（防止不透明的
  #root 遮住 body 背景）；stylesheet 另追加派生 token 块——皮肤未定义的官方
  token 按固定派生表（`color-mix` 半透明化其基 token）在 body 级补齐。
- **Client 半区**（`lib/client.js`）：
  - 启动时恢复持久化皮肤（样式表 → 翻转 `html[data-dsh-skin]` → 装饰层 / 背景 / hooks → 卸载旧激活）
  - 设置页「冒险岛皮肤」：原皮肤 + 各版本卡片，点击应用
  - hooks 按皮肤中心契约 `x-org.linxin666.skin-center/v1alpha1` 运行（同源 import，
    hooks 出错不影响皮肤静态部分）

## 素材

皮肤保留各自 `skin.json` 中的素材署名。游戏素材来源为 mxd079.dvg.cn（冒险岛 079 社区数据库 / 小册子）。

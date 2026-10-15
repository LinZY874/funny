# Funny · 趣味互动作品集

这里收集一些可以直接在浏览器里体验的小作品。目前有两件：黄色跑车变形成双足机器人的中文机械演示，以及用于积累创作素材的 ADD · 灵感收藏夹。后续会持续加入其他有趣的网页。

[打开作品集](https://linzy874.github.io/funny/)

## 项目

| 项目 | 内容 | 体验 |
| --- | --- | --- |
| 机甲变形实验室 | 8 个连续机械变形阶段，支持播放、暂停、进度拖动、逐步查看和播放速度切换，并说明汽车部件与机器人结构的对应关系。 | [打开演示](https://linzy874.github.io/funny/transformer/) |
| ADD · 灵感收藏夹 | 收集提示词、风格化的图片与教程链接，方便回看、整理和调用积累的内容。 | [打开 ADD](https://linzy874.github.io/add/) |

机甲变形实验室使用 HTML、CSS、JavaScript 和 SVG，动画在浏览器本地运行，不运行或调用 AI 模型。ADD 是已有的独立网站，本合集保存它的入口和创作记录；源码位于 [LinZY874/add](https://github.com/LinZY874/add)。

## 提示词与模型记录

每个作品在自己的记录目录中保留制作提示词和模型信息：

| 作品 | 创作记录 | 原始提示词 | 模型与来源信息 |
| --- | --- | --- | --- |
| 机甲变形实验室 | [查看记录](https://linzy874.github.io/funny/transformer/about.html) | [查看提示词](docs/transformer/prompt.md) | [GPT 5.6 Sol](docs/transformer/metadata.json) |
| ADD · 灵感收藏夹 | [查看记录](https://linzy874.github.io/funny/add/about.html) | [查看提示词](docs/add/prompt.md) | [GPT 6.1 Sol Ultra](docs/add/metadata.json) |

模型名称均由用户指定保存，未作为已核验的后台模型信息。ADD 的记录用于索引已有作品，不表示本次新建或重制了 ADD。

## 目录结构

```text
funny/
├── README.md
└── docs/                         # GitHub Pages 发布目录
    ├── index.html                # 作品集首页
    ├── projects.json             # 首页作品列表
    ├── assets/                   # 作品缩略图
    ├── transformer/
    │   ├── index.html            # 机甲变形演示
    │   ├── about.html            # 创作记录页面
    │   ├── prompt.md             # 原始制作提示词
    │   └── metadata.json         # 模型与作品来源信息
    └── add/
        ├── about.html            # ADD 外链作品的创作记录
        ├── prompt.md             # ADD 原始制作提示词
        └── metadata.json         # 模型、独立网站及源仓库信息
```

GitHub Pages 使用 `main` 分支的 `docs/` 目录发布，网站地址为 <https://linzy874.github.io/funny/>。

## 本地预览

在仓库根目录运行：

```sh
python3 -m http.server --directory docs
```

然后打开 <http://localhost:8000/>。机甲演示位于 <http://localhost:8000/transformer/>，ADD 的创作记录位于 <http://localhost:8000/add/about.html>。ADD 作品入口仍指向其独立网站。

## 添加下一个作品

1. 若作品托管在本仓库，在 `docs/<slug>/` 中放入作品，入口文件命名为 `index.html`，并使用相对路径引用资源。若索引已有外链作品，保留其独立网站和源仓库即可，无需复制或重制作品。
2. 在 `docs/<slug>/` 中保存 `about.html`、`prompt.md` 和 `metadata.json`，提供创作记录页面，并记录提示词、模型名称及信息来源；外链作品同时记录其网站与源仓库地址。
3. 按 `docs/projects.json` 中现有项目的字段格式添加一条记录：`url` 填本地作品的 `./<slug>/` 或外链作品的完整网址，`record` 填 `./<slug>/about.html`，`thumbnail` 指向 `docs/assets/` 中对应缩略图的相对路径；填写标题、简介、模型、日期与标签。
4. 本地检查首页入口和新作品，提交到 `main` 后由 GitHub Pages 发布。


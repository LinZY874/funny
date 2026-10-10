# Funny · 趣味互动作品集

这里收集一些可以直接在浏览器里体验的小作品。第一个项目是黄色跑车变形成双足机器人的中文机械演示，后续会持续加入其他有趣的网页。

[打开作品集](https://linzy874.github.io/funny/)

## 项目

| 项目 | 内容 | 体验 |
| --- | --- | --- |
| 机甲变形实验室 | 8 个连续机械变形阶段，支持播放、暂停、进度拖动、逐步查看和播放速度切换，并说明汽车部件与机器人结构的对应关系。 | [打开演示](https://linzy874.github.io/funny/transformer/) |

本项目使用 HTML、CSS、JavaScript 和 SVG，动画在浏览器本地运行，不运行或调用 AI 模型。

## 提示词与模型记录

每个作品在自己的目录中保留制作提示词和模型信息：

- [机甲变形实验室的原始提示词](docs/transformer/prompt.md)
- [机甲变形实验室的模型与来源信息](docs/transformer/metadata.json)

本作品记录的模型为 **GPT 5.6 Sol**。该名称由用户指定保存，未作为已核验的后台模型信息。

## 目录结构

```text
funny/
├── README.md
└── docs/                         # GitHub Pages 发布目录
    ├── index.html                # 作品集首页
    ├── projects.json             # 首页作品列表
    └── transformer/
        ├── index.html            # 机甲变形演示
        ├── prompt.md             # 原始制作提示词
        └── metadata.json         # 模型与作品来源信息
```

GitHub Pages 使用 `main` 分支的 `docs/` 目录发布，网站地址为 <https://linzy874.github.io/funny/>。

## 本地预览

在仓库根目录运行：

```sh
python3 -m http.server --directory docs
```

然后打开 <http://localhost:8000/>。机甲演示位于 <http://localhost:8000/transformer/>。

## 添加下一个作品

1. 在 `docs/<slug>/` 中放入新作品，入口文件命名为 `index.html`，并使用相对路径引用资源。
2. 在同一目录保存 `prompt.md` 和 `metadata.json`，记录提示词、模型名称及信息来源。
3. 按 `docs/projects.json` 中现有项目的字段格式添加一条记录，链接指向 `<slug>/`。
4. 本地检查首页入口和新作品，提交到 `main` 后由 GitHub Pages 发布。


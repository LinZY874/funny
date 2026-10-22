# Funny · 趣味互动作品集

这里收集一些可以直接在浏览器里体验的小作品和工具。目前有三件：黄色跑车变形成双足机器人的中文机械演示、用于积累创作素材的 ADD · 灵感收藏夹，以及带有 V3 互动预览与安装包的 DSH 冒险岛皮肤。后续会持续加入其他有趣的网页。

[打开作品集](https://linzy874.github.io/funny/)

## 项目

| 项目 | 内容 | 体验 |
| --- | --- | --- |
| 机甲变形实验室 | 8 个连续机械变形阶段，支持播放、暂停、进度拖动、逐步查看和播放速度切换，并说明汽车部件与机器人结构的对应关系。 | [打开演示](https://linzy874.github.io/funny/transformer/) |
| ADD · 灵感收藏夹 | 收集提示词、风格化的图片与教程链接，方便回看、整理和调用积累的内容。 | [打开 ADD](https://linzy874.github.io/add/) |
| DSH · 冒险岛皮肤 | 默认展示 V3，支持浅色、深色预览与蓝蜗牛点击冲刺；提供 `dsh-maple-skins` v1.0.0 插件下载和安装说明。 | [打开工具](https://linzy874.github.io/funny/maple-skins/) |

机甲变形实验室使用 HTML、CSS、JavaScript 和 SVG，动画在浏览器本地运行，不运行或调用 AI 模型。ADD 是已有的独立网站，本合集保存它的入口和创作记录；源码位于 [LinZY874/add](https://github.com/LinZY874/add)。

## 提示词与模型记录

每个作品在自己的记录目录中保留制作提示词和模型信息：

| 作品 | 创作记录 | 提示词记录 | 模型与来源信息 |
| --- | --- | --- | --- |
| 机甲变形实验室 | [查看记录](https://linzy874.github.io/funny/transformer/about.html) | [查看提示词](docs/transformer/prompt.md) | [GPT 5.6 Sol](docs/transformer/metadata.json) |
| ADD · 灵感收藏夹 | [查看记录](https://linzy874.github.io/funny/add/about.html) | [查看提示词](docs/add/prompt.md) | [GPT 6.1 Sol Ultra](docs/add/metadata.json) |
| DSH · 冒险岛皮肤 | [查看说明](https://linzy874.github.io/funny/maple-skins/about.html) | [查看脱敏收录请求](docs/maple-skins/prompt.md) | [未提供模型](docs/maple-skins/metadata.json) |

前两件作品的模型名称由用户指定保存，未作为已核验的后台模型信息。冒险岛插件的模型及原始创作提示词未提供，仅保留本次脱敏后的收录请求。ADD 的记录用于索引已有作品，不表示本次新建或重制了 ADD。

## 目录结构

```text
funny/
├── README.md
├── tools/
│   └── dsh-maple-skins/          # 冒险岛插件源码与内置皮肤
└── docs/                         # GitHub Pages 发布目录
    ├── index.html                # 作品集首页
    ├── projects.json             # 首页作品列表
    ├── assets/                   # 作品缩略图
    ├── transformer/
    │   ├── index.html            # 机甲变形演示
    │   ├── about.html            # 创作记录页面
    │   ├── prompt.md             # 原始制作提示词
    │   └── metadata.json         # 模型与作品来源信息
    ├── add/
    │   ├── about.html            # ADD 外链作品的创作记录
    │   ├── prompt.md             # ADD 原始制作提示词
    │   └── metadata.json         # 模型、独立网站及源仓库信息
    └── maple-skins/
        ├── index.html            # 默认 V3 的皮肤互动预览
        ├── about.html            # 工具介绍与安装说明
        ├── prompt.md             # 脱敏后的收录请求
        ├── metadata.json         # 版本与来源记录
        └── downloads/
            └── dsh-maple-skins-1.0.0.tar.gz
```

GitHub Pages 使用 `main` 分支的 `docs/` 目录发布，网站地址为 <https://linzy874.github.io/funny/>。

## 冒险岛皮肤插件

[打开 V3 预览](https://linzy874.github.io/funny/maple-skins/) · [下载插件 v1.0.0](https://linzy874.github.io/funny/maple-skins/downloads/dsh-maple-skins-1.0.0.tar.gz) · [查看插件源码](https://github.com/LinZY874/funny/tree/main/tools/dsh-maple-skins)

`dsh-maple-skins` 是 DeepSeek Harness Web GUI 的皮肤插件，包含原皮肤切换入口与三个冒险岛版本。本工具页优先展示“冒险岛 V3（原版用色 · 蜗牛冲刺）”：奶油色与草地色界面、蘑菇和绿水灵装饰，以及可以点击助力的蓝蜗牛。网页预览使用演示内容，实际 DSH 换肤需要安装插件。

三个皮肤统一为 **V1（蜗牛花园）**、**V2（蘑菇村景）**、**V3（原版用色 · 蜗牛冲刺）**，内部标识分别为 `v1`、`v2`、`v3`。插件包版本为 `1.0.0`。

下载后将插件解压为 `dsh-maple-skins` 目录，在自己的 DSH 部署目录中执行：

```sh
pnpm dsh plugin --profile web add link:/绝对路径/dsh-maple-skins
```

重启 `dsh web` 后，进入“设置 → 冒险岛皮肤 → 冒险岛 V3”并点击应用。需要恢复时，选择“原皮肤”。

插件声明 MIT 许可；游戏精灵与贴图保留原素材署名，来源为 [冒险岛 079 小册子](https://mxd079.dvg.cn/)，相关游戏素材权利归各自权利人。

## 本地预览

在仓库根目录运行：

```sh
python3 -m http.server --directory docs
```

然后打开 <http://localhost:8000/>。机甲演示位于 <http://localhost:8000/transformer/>，ADD 的创作记录位于 <http://localhost:8000/add/about.html>，冒险岛皮肤预览位于 <http://localhost:8000/maple-skins/>。ADD 作品入口仍指向其独立网站。

## 添加下一个作品

1. 若作品托管在本仓库，在 `docs/<slug>/` 中放入作品，入口文件命名为 `index.html`，并使用相对路径引用资源。若索引已有外链作品，保留其独立网站和源仓库即可，无需复制或重制作品。
2. 在 `docs/<slug>/` 中保存 `about.html`、`prompt.md` 和 `metadata.json`，提供创作记录页面，并记录提示词、模型名称及信息来源；外链作品同时记录其网站与源仓库地址。
3. 按 `docs/projects.json` 中现有项目的字段格式添加一条记录：`url` 填本地作品的 `./<slug>/` 或外链作品的完整网址，`record` 填 `./<slug>/about.html`，`thumbnail` 指向 `docs/assets/` 中对应缩略图的相对路径；填写标题、简介、模型、日期与标签。
4. 本地检查首页入口和新作品，提交到 `main` 后由 GitHub Pages 发布。


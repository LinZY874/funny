# 冒险岛 V3 · 资料与素材包

本包用于回看、参考和重构，不是完整独立插件安装包。

## 从哪里开始

1. `prompt.md`：根据真实制作反馈和当前源码合并的一条完整 V3 提示词，不是原始单次输入，不保证逐像素复现。
2. `materials.json`：11 项 PNG 的中文名称、尺寸、用途和来源说明。其中 10 项在用，红蜗牛是备用。
3. `skins/v3/`：V3 的素材、样式、清单、交互代码和原包随附示意图。示意图不是当前网页的截图，实际效果以交互预览和当前代码为准。
4. `creation.md`：脱敏后的精简创作过程。不含完整私人聊天和溯源索引。

要复用，请将完整提示词与本包一起提供给编码助手，并提供当前 DSH 的代码和完整插件基线。V3 的 CSS、hooks 和清单使用相对资源路径，需要保留 `skins/v3/` 的内部结构。不要把单独的 PNG 当作完整可安装皮肤。

## 在线入口

- [提示词与素材](https://linzy874.github.io/funny/maple-skins/resources.html)
- [互动预览](https://linzy874.github.io/funny/maple-skins/)
- [完整插件源码](https://github.com/LinZY874/funny/tree/main/tools/dsh-maple-skins)
- [完整插件下载](https://linzy874.github.io/funny/maple-skins/downloads/dsh-maple-skins-1.0.0.tar.gz)

完整插件另含 V1、V2 与 Host/Client 接入。真实 DSH 的安装方法见在线工具说明；本资料包本身不修改、启动或重启任何 DSH。

## 模型与素材权利

留存客户端记录中的创作模型标识包括 `deepseek-v4` 和 `qwen3.8-flash`；未独立核验服务商底层模型身份，也不表示成品由一次生成完成。

素材来自已有插件，并非本次 AI 新生成。沿用 mxd079.dvg.cn（冒险岛 079 小册子）的来源署名，相关游戏素材权利归各自权利人。软件代码的许可不等于游戏素材授权；木纹、饰条的独立作者与许可未单独注明，使用前请确认适用范围。

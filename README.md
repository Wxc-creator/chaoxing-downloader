<div align="center">

# 🎓 超星学习通课件与资料下载助手 (Chaoxing Downloader)

**一款现代、高效、无感知的超星学习通 / 泛雅平台课件与资料极速下载增强工具**

[![GitHub stars](https://img.shields.io/github/stars/Wxc-creator/chaoxing-downloader?style=social)](https://github.com/Wxc-creator/chaoxing-downloader)
[![GitHub forks](https://img.shields.io/github/forks/Wxc-creator/chaoxing-downloader?style=social)](https://github.com/Wxc-creator/chaoxing-downloader)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Release](https://img.shields.io/github/v/release/Wxc-creator/chaoxing-downloader?color=brightgreen&label=Release)](https://github.com/Wxc-creator/chaoxing-downloader/releases/latest)
[![Chrome](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome&logoColor=white)](manifest.json)
[![Edge](https://img.shields.io/badge/Edge-Addon-0078D7?logo=microsoftedge&logoColor=white)](manifest.json)
[![Tampermonkey](https://img.shields.io/badge/Tampermonkey-Supported-black?logo=tampermonkey&logoColor=white)](chaoxing-downloader.user.js)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/Wxc-creator/chaoxing-downloader/pulls)

---

**如果这个项目对你的网课学习和资料备份有帮助，请在右上角点一个 ⭐️ Star 支持一下！**  
**你的 Star 是作者持续维护更新的最大动力！**

</div>

<br/>

## 📖 项目简介

在超星学习通（泛雅教学系统）中，许多教师上传的优质 PPT、PDF 课件、作业附件以及课程参考资料常常被设置了“禁止下载”，或者被隐藏在多层内嵌的 `iframe` 和在线专用阅读器中，导致学生无法离线复习。

**Chaoxing Downloader** 正是为解决这一痛点而诞生：
- ⚡ **智能突破权限限制**：绕过限制开关，动态向官方调度中枢获取原版文件的真实下载链接。
- 📦 **格式与名称精准还原**：告别匿名哈希串或无后缀文件，精准恢复文件的原始标题与后缀（`.pdf`、`.docx`、`.pptx`、`.rar`、`.zip`、`.mp4` 等）。
- 🖥️ **双端体验覆盖**：原生提供 **Chromium 浏览器扩展版 (Manifest V3)** 与 **油猴脚本版 (Tampermonkey)**，无论是电脑端 Chrome/Edge 还是手机端 Kiwi/Via 浏览器，都能轻松使用。

---

## ✨ 核心特性

- 🛡️ **动静双轨鉴权与三级下载保障（v1.2.2 重磅）**  
  引入 Chrome MV3 标准的 `declarativeNetRequest` 动静双轨网络拦截引擎，自动为 CDN 资源（`*.cldisk.com`）注入合法的防盗链标头；构建“后台特权拉取 + 前台同源回退 + 原生 a[download]”三重防御体系，彻底杜绝“响应状态异常 403”，确保课件原名极速下载落盘！

- ⚡ **突破禁止下载与15字节报错拦截（v1.2.1）**  
  深入超星 Pan/cldisk 云盘调度架构，通过动态预览令牌穿透官方对课件下载权限的封锁，直连官方高速 CDN；彻底根除“无效的参数/无权限”等 15 字节纯文本错误误存为损坏 PDF 的问题，确保文件 100% 完整原样保存！

- 🌳 **全课程文件树递归透视（v1.2.0 重磅）**  
  一键自动递归穿透课程所有主文件夹与多层子目录，以 VS Code 级折叠树展示整门课的所有资料库，支持展开/折叠、查看文件数量与大小、单文件直下以及【打包下载该文件夹】。

- 🧲 **丝滑联动拖拽与四向智能自适应（v1.2.0 重磅）**  
  采用 60/120fps `requestAnimationFrame` + GPU Compositor 硬件加速，彻底告别生硬位移；悬浮小球与展开面板**双向联动**，面板标题栏同样支持随手拖动，并能根据屏幕象限智能四向自适应避障，永不溢出视口。

- 🔓 **解除下载与打印禁用**  
  智能穿透在线 PDF.js 阅读器与章节播放器，自动恢复被隐藏的下载与打印原生按钮。

- 🔍 **多层架构递归嗅探**  
  穿透顶层及任意深度的嵌套 `iframe`（如 `ans-attach-online`、`coursedata/stu-datalist`），精准提取挂载在原生 `window.mArg` 和 DOM 节点中的课件资源。

- ⚡ **就地增强注入**  
  访问课程“资料”或“作业”页面时，在每个文件行右侧自动注入醒目的 **【⬇ 下载】** 按钮，无需逐一点击在线预览，点击即可直达下载。

- 🛡️ **安全跨域与防风控机制**  
  请求全部由后台服务调度并模拟官方合法 Referer，批量下载内置安全延时队列（1.2 秒节流），避免触发平台并发风控。
  请求全部由后台服务调度并模拟官方合法 Referer，批量下载内置安全延时队列（1.2 秒节流），避免触发平台并发风控。

---

## 🚀 安装教程

本项目同时支持 **浏览器原生扩展** 和 **油猴脚本** 两种运行方式，任选一种即可：

### 方式一：浏览器扩展安装（推荐，功能最完整）

适用于 **Microsoft Edge**、**Google Chrome** 等所有 Chromium 内核浏览器：

> [!TIP]
> **🚀 最快捷安装入口**：无需 Git 环境，直接前往 👉 **[GitHub Releases 最新发布页](https://github.com/Wxc-creator/chaoxing-downloader/releases/latest)** 下载已打包好的 `chaoxing-downloader-v1.2.2.zip`，解压即用！

1. **获取扩展程序包（三选一）**：
   - **🌟 方式 A（最推荐，开箱即用）**：前往 [Releases 最新发布页](https://github.com/Wxc-creator/chaoxing-downloader/releases/latest) 下载 `chaoxing-downloader-v1.2.2.zip`，下载后解压到本地文件夹；
   - **方式 B（GitHub 源码 ZIP）**：点击本页面右上角绿色 **`Code`** 按钮，选择 **`Download ZIP`** 并解压；
   - **方式 C（Git 开发者克隆）**：
     ```bash
     git clone https://github.com/Wxc-creator/chaoxing-downloader.git
     ```
2. **打开扩展管理页面**：
   - **Edge 浏览器**：在地址栏输入 `edge://extensions/` 回车；
   - **Chrome 浏览器**：在地址栏输入 `chrome://extensions/` 回车。
3. **开启【开发者模式】**：
   - 打开扩展页面右上角或左侧边栏的 **“开发者模式”** 开关。
4. **加载扩展程序**：
   - 点击 **【加载已解压的扩展程序】**（Load unpacked）按钮；
   - 选择刚刚解压出来的项目根文件夹（即包含 `manifest.json` 的目录）。
5. **固定扩展**：
   - 点击浏览器右上角拼图图标，将 **超星学习通课件与资料下载助手** 点击“图钉”固定在工具栏即可！

---

### 方式二：油猴脚本安装（轻量便捷）

适用于已安装 **Tampermonkey（篡改猴）** 或 **ScriptCat（脚本猫）** 扩展的用户：

1. 点击打开仓库内的 [chaoxing-downloader.user.js](chaoxing-downloader.user.js) 文件；
2. 点击右上角 **`Raw`** 按钮，Tampermonkey 将自动弹出安装界面，点击 **【安装】** 即可；
3. 或者直接复制代码，在油猴仪表盘中点击“添加新脚本”，粘贴并保存。

---

## 🎯 效果演示与使用场景

| 场景 | 展现形式 | 操作方式 |
| :--- | :--- | :--- |
| **网课章节/课件预览** | 右下角悬浮球 badge | 点击展开课件清单，直接点击【下载】或【复制直链】 |
| **课程资料列表** | 文件行内注入按钮 | 列表右侧直出【⬇ 下载】按钮，一键调取官方 CDN 下载 |
| **文件夹层级目录** | 目录点击指引 | 点击进入具体子文件夹，文件出现时秒速解析真实下载地址 |
| **PDF 在线阅读器** | 恢复顶栏操作栏 | 自动解除 `hidden` 属性，恢复下载和打印按键 |

---

## 📂 项目结构

```text
chaoxing-downloader/
├── manifest.json              # Chrome/Edge 扩展配置文件 (Manifest V3)
├── background.js              # 后台 Service Worker（调度下载、直链解析与跨域处理）
├── content.js                 # 核心内容脚本（DOM 嗅探、解除限制、悬浮窗 UI）
├── content.css                # 悬浮窗面板与行内按钮的美化样式
├── inject.js                  # 页面主环境注入脚本（读取原生 window.mArg 课件参数）
├── popup.html                 # 扩展弹出面板 UI
├── popup.js                   # 弹出面板交互与设置逻辑
├── popup.css                  # 弹出面板样式
├── icons/                     # 插件各规格图标 (16x16, 48x48, 128x128, SVG)
├── chaoxing-downloader.user.js# 纯油猴脚本独立版
├── LICENSE                    # MIT 开源许可证
└── README.md                  # 项目中英文使用说明
```

---

## ❓ 常见问题 (FAQ)

<details>
<summary><b>Q1: 为什么提示“未能解析有效的下载地址”？</b></summary>
超星平台部分资料分类为“文件夹”（Folder），文件夹本身是一个容器而非具体文件。请点击该文件夹进入子列表，当显示具体的文件项（带文件大小）时，插件将自动解析出下载链接。
</details>

<details>
<summary><b>Q2: 为什么有些课件下载下来只有 15 字节且打不开？</b></summary>
这是由于教师在超星后台关闭了学生的课件直接下载权限，旧版插件通过普通接口下载时，平台返回了 15 字节的纯文本报错 <code>无效的参数</code> 或 <code>无权限下载</code>（5个汉字在UTF-8下恰好为15字节）。<br/>
在 <b>v1.2.1</b> 版本中，插件全面升级了 <b>Pan/cldisk 云盘穿透解析引擎</b>，通过动态鉴权令牌直接提取官方高速 CDN 直链，彻底突破了权限封锁，同时内置了小于 100 字节的错误文本拦截与提示保护，确保下载保存的均为完整可用的 PDF/课件！
</details>

<details>
<summary><b>Q2: 下载的文件为什么有些没有后缀名？</b></summary>
插件已内置智能文件命名机制，会优先读取超星服务端返回的原版文件名。如使用第三方下载器（如 IDM、Aria2），只需将插件提取的直链复制粘贴进去，下载器会自动获取服务端 `Content-Disposition` 标头以恢复原始文件名。
</details>

<details>
<summary><b>Q3: 手机浏览器可以使用吗？</b></summary>
可以！在支持扩展的手机浏览器（如 Kiwi Browser）中可以直接加载 Chrome 扩展版；在手机端 Via、X 浏览器中可以直接安装油猴脚本版。
</details>

---

## 📈 Star History

如果这个项目帮到了你，请给一个 ⭐️ Star 吧！

[![Star History Chart](https://api.star-history.com/svg?repos=Wxc-creator/chaoxing-downloader&type=Date)](https://star-history.com/#Wxc-creator/chaoxing-downloader&Date)

---

## 🤝 贡献与反馈

欢迎提交 PR 或 Issue 来完善这个项目！
- 如果遇到某些特定页面无法解析，欢迎提供脱敏后的页面链接或控制台报错截图；
- 代码遵循标准 JavaScript (ES6+)，代码规范，注释完整。

## 📄 开源许可证

本项目基于 [MIT License](LICENSE) 开源。仅供学习与学术交流使用，请勿用于非法用途。

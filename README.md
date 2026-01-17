# 休息闹钟（Alarm）

一个跨平台（macOS / Windows）的桌面闹钟：

- 默认 **20 分钟工作** → 提醒 **休息 20 秒**
- 支持在主界面调整工作/休息时长，并会自动保存（localStorage）
- 休息提醒页：全屏、置顶、醒目

## 开发运行

> 首次安装如果 Electron 下载慢，可使用镜像：
>
> `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm i`

```bash
npm install
npm start
```

## 使用说明

1. 点击 **开始**：进入工作倒计时
2. 工作结束自动进入休息，并弹出醒目的休息页面
3. 休息页可点击 **我已休息好，继续**（或在主界面点“结束休息”）提前结束
4. 可在主界面设置：
   - 工作时长（分钟）
   - 休息时长（秒）
   - 是否自动开始下一轮

## 打包（本机）

### macOS

```bash
npm run dist
```

会在 `dist/` 目录生成 `.dmg`。

### Windows

建议在 Windows 机器上执行：

```bash
npm run dist
```

会生成 NSIS 安装包（`.exe`）。

> 说明：electron-builder 通常不建议在 macOS 上直接交叉构建 Windows 安装包（依赖环境差异）。

## 通过 GitHub Actions 自动生成 Windows 安装包（.exe）

本仓库已提供工作流：`.github/workflows/windows-build.yml`。

- 每次 push 到 `main` 分支，会自动在 GitHub Actions 上构建 Windows NSIS 安装包（`.exe`）
- 下载位置：GitHub 仓库 → **Actions** → 选择对应的 workflow run → 页面底部 **Artifacts** → `WorkAlarm-windows`

## 目录结构

```text
src/
  main.js               # Electron 主进程：计时、窗口、通知、IPC
  preload.js            # 安全桥接：暴露 alarmApi 给渲染进程
  renderer/
    main.html           # 主界面
    break.html          # 休息提醒页
    renderer.js         # 主界面逻辑
    break.js            # 休息页逻辑
    styles.css          # UI 样式
```

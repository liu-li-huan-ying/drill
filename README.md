# 背呗 (drill)

一个完全离线、零订阅的背单词 App。React Native + Expo 构建，自己掌控数据，不向任何付费墙低头。

## 为什么有这个项目

受够了背单词软件把「单词上限」「优质词库」「例句与助记」做成付费点。这些能力在开源世界里基本都是免费的：

- 调度算法有 **FSRS**（开源，比 SM-2 少 20-30% 复习量达到同等留存率）
- 词库有 **ECDICT**（MIT 协议，150 万词条，带考纲标注与词频）
- 例句有 **Tatoeba**（CC BY，英中平行句对可离线打包）

所以——自己写一个。

## 核心设计

- **总库 + 标签模型**：3 万词全局词库（含 GRE 全覆盖），「词库」只是单词上的标签。同一个词无论属于几个词库，全局只有一条复习记录，不会重复背。
- **纯离线**：App 运行时完全不联网、不调 LLM。AI 只出现在离线数据准备阶段（补例句缺口）。
- **数据归你**：不做云同步，进度可导出为本地 JSON 备份，换设备导入接续。
- **FSRS 调度**：四档评分（Again / Hard / Good / Easy），完整发挥 FSRS 精度。

## 技术栈

| 层 | 选型 |
|---|---|
| 框架 | Expo SDK 57（React Native 0.86 + React 19.2） |
| 语言 | TypeScript strict |
| 路由 | Expo Router（文件路由） |
| 本地库 | expo-sqlite + Drizzle ORM |
| 调度算法 | ts-fsrs |
| 发音 | expo-speech（系统 TTS，零成本离线） |
| 样式 | StyleSheet + 统一 theme（见 [docs/设计系统.md](docs/设计系统.md)） |

## 状态

> 开发中，当前 **M1（数据管线 v1）+ UI 原型（v1）已完成**：
> - M1：ECDICT → SQLite 管线跑通，产出 500 词样本 `assets/db/dictionary.db`
> - UI：8 屏安卓真机比例原型 [`docs/ui-prototype.html`](docs/ui-prototype.html)（360×752dp，1px=1dp，亮暗双套）
>
> 下一步进入 **M2（最小闭环）**。完整设计见 [docs/开发计划.md](docs/开发计划.md)、[docs/对抗式审查.md](docs/对抗式审查.md)、[docs/设计系统.md](docs/设计系统.md)。

## 数据管线（离线跑一次）

词库是离线预处理产物，不进运行时。当前 `assets/db/dictionary.db` 是 500 词样本包（348KB），供 M2 端到端验证；全量 3 万词为 M3 目标。重跑流程：

```bash
bash tools/fetch_ecdict.sh   # 下载 ECDICT 主词典（MIT）到 tools/cache/（不进版本库）
python3 tools/build_dict.py  # 筛选高频词，构建 assets/db/dictionary.db
```

`dictionary.db` 一次建好全部表——`words`/`tags`/`word_tags` 为只读词库，`cards` 等用户表留空——App 首次启动将其拷贝到用户目录后直接在其上写进度，可跨表 JOIN，无需 M2 再建表。

## 本地开发

```bash
npm install
npm start          # 启动 Metro，扫码或连接设备
npm run android    # 真机 / 模拟器
```

## 许可证

MIT —— 见 [LICENSE](LICENSE)。

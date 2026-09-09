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
| 本地库 | expo-sqlite（原生 SQL） |
| 调度算法 | ts-fsrs |
| 发音 | expo-speech（系统 TTS，零成本离线） |
| 样式 | StyleSheet + 统一 theme（见 [docs/设计系统.md](docs/设计系统.md)） |

## 状态

> 开发中，当前 **M1（数据管线 v1）+ UI 原型（v2.1）+ M2（最小闭环）+ M3（全量词库 v1）已完成**：
> - M1：ECDICT → SQLite 管线跑通，产出 500 词样本 `assets/db/dictionary.db`
> - UI：9 屏「朱批」安卓真机原型 [`docs/ui-prototype.html`](docs/ui-prototype.html)（360×752dp，1px=1dp，亮暗双套，刻度环 / 可翻转卡片 / 条长编码间隔）
> - M2：Expo Router 路由 + 朱批设计令牌 + FSRS 调度 + 复习闭环（今日 → 复习 → 四档评分 → 写回 → 进度），含熟词校准、词库 / 统计 / 设置页骨架，全量 `tsc --noEmit` 通过
> - 真机验证修复：`rotateY` 翻转在 Android 上须用 JS 驱动（`useNativeDriver:false`）+ 顶层透明翻转层接管手势，否则卡片不响应点击；`app.json` 补 `scheme:drill` 消除 Linking 警告
> - M3：全量词库 **30,565 词**（核心高频 3 万 ∪ 考纲词并集，GRE 7,026 词 100% 覆盖），按考纲分 8 类标签 + 默认「核心词库」学习池；`user_version=2`，`Database.ts` 加版本门控——本地库版本更低时自动重新拷贝资产（整库换词库语义）。`assets/db/dictionary.db` 约 10.2MB
> - M4：词库页可**搜索**（子串直达详情）+ **按标签浏览**（分页词列表）；`word` 详情页（释义 / 词性 / 词根词缀 / 考纲标签 + **标为已掌握**开关）；**设置页**可调每日新词/复习上限并持久化 + **重置已掌握**；**自定义词库导入**（粘贴单词→匹配内置词典→建专属 tag+card，回报未收录词）；**全局词汇量测试**（按词频分层抽样 ~36 词，结束按频段认识比例估算词汇量）。全部离线、基于 M3 词库
> - **按标签过滤学习池（只背某考纲）**：`settings.study_tag` 持久化学习范围；`planSession()` 在查询时加 `IN (SELECT word_id FROM word_tags WHERE tag_id=?)` 子查询，不动 `cards` 表即可只练某纲；首页显示当前范围 + 「✕ 背全部」清除；`wordlist` 页「只背这一纲 →」一键设范围并 `dismissAll` 回首页
>
> 下一步 **M3.2（例句索引：Tatoeba 英中句对）** 进行中（已联网拉取 Tatoeba 英/中句 + links，构建 `examples` 表并接入 `word` 详情）。完整设计见 [docs/开发计划.md](docs/开发计划.md)、[docs/对抗式审查.md](docs/对抗式审查.md)、[docs/设计系统.md](docs/设计系统.md)。

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

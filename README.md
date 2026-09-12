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

> 开发中，当前 **M1（数据管线 v1）+ UI 原型（v2.1）+ M2（最小闭环）+ M3（全量词库 v1）+ M4（检索/详情/设置/导入/词汇量测试）+ M5（统计看板 + 备份导出导入）+ M6（词根词缀拆解 + 手写助记与检索）已完成**：
> - M1：ECDICT → SQLite 管线跑通，产出 500 词样本 `assets/db/dictionary.db`
> - UI：9 屏「朱批」安卓真机原型 [`docs/ui-prototype.html`](docs/ui-prototype.html)（360×752dp，1px=1dp，亮暗双套，刻度环 / 可翻转卡片 / 条长编码间隔）
> - M2：Expo Router 路由 + 朱批设计令牌 + FSRS 调度 + 复习闭环（今日 → 复习 → 四档评分 → 写回 → 进度），含熟词校准、词库 / 统计 / 设置页骨架，全量 `tsc --noEmit` 通过
> - 真机验证修复：`rotateY` 翻转在 Android 上须用 JS 驱动（`useNativeDriver:false`）+ 顶层透明翻转层接管手势，否则卡片不响应点击；`app.json` 补 `scheme:drill` 消除 Linking 警告
> - M3：全量词库 **30,565 词**（核心高频 3 万 ∪ 考纲词并集，GRE 7,026 词 100% 覆盖），按考纲分 8 类标签 + 默认「核心词库」学习池；`user_version=2`，`Database.ts` 加版本门控——本地库版本更低时自动重新拷贝资产（整库换词库语义）。`assets/db/dictionary.db` 约 10.2MB
> - M4：词库页可**搜索**（子串直达详情）+ **按标签浏览**（分页词列表）；`word` 详情页（释义 / 词性 / 词根词缀 / 考纲标签 + **标为已掌握**开关）；**设置页**可调每日新词/复习上限并持久化 + **重置已掌握**；**自定义词库导入**（粘贴单词→匹配内置词典→建专属 tag+card，回报未收录词）；**全局词汇量测试**（按词频分层抽样 ~36 词，结束按频段认识比例估算词汇量）。全部离线、基于 M3 词库
> - **按标签过滤学习池（只背某考纲）**：`settings.study_tag` 持久化学习范围；`planSession()` 在查询时加 `IN (SELECT word_id FROM word_tags WHERE tag_id=?)` 子查询，不动 `cards` 表即可只练某纲；首页显示当前范围 + 「✕ 背全部」清除；`wordlist` 页「只背这一纲 →」一键设范围并 `dismissAll` 回首页
> - **M3.2 例句索引（Tatoeba 英中句对）**：`build_examples.py` 在 Tatoeba 周更导出上构建 `examples(word_id, sentence_en, sentence_zh, ord)` 表，`word` 详情页接入「例句」区（衬线斜体英文 + 中文译文）。先交付**英文先行版**（`links.tar.bz2` 受代理网络限制未下全，退化为纯英文）；`links.tar.bz2`（149MB，EN→ZH 配对）下全后重建，`build_examples.py` 升 `user_version=4`、代码 `EXPECTED_DB_VERSION` 同步升 4 → 触发 App 整体换库把中文例句带进运行时。`eng` 命中 92,050 句 / 26,625 词有例句，`cmn` 经 links 配对解出 **8,779 行有中文译文**（占 111,655 行的 ~7.9%，Tatoeba 这批英文句对的中文译文本身有限，有则填、无则留英文），资产库 22.0MB。样例：`It's not something anyone can do.` → `这不是任何人都能做的事。`
> - **UI 规范对齐（朱批）**：按 [docs/设计系统.md](docs/设计系统.md) 修了一批细节——分割线统一 hairline `--bd`（移除临时 `rgba` 灰、刻度环未完格由 `--bd2` 改 `--bd`）、英文例句改衬线斜体、评分条三档去灰度梯度（统一中性、仅「重来」用朱砂）、导入框占位符修正换行实体、数字补 `tabular-nums`
> - **四处体验修复（用户反馈）**：① 多义项释义——词库数据以字面转义的 `\n`/`\r\n` 入库（19,826 行），渲染期统一还原真实换行并按义项分行，行首词性缩写（`v.`/`n.`…）与 `[计]` 标签用朱砂高亮；新增 `src/components/Definition.tsx`（`normalizeDef`/`splitSenses`/`DefinitionView`）在 `word`/`ReviewCard` 背面/`wordlist`/`library` 搜索结果四处复用 ② 词库头部「已装载 N 词」由「各标签词数求和」改为 `COUNT(*) FROM words`（去重，30,565），消除重复计数 ③ 底部标签栏方块标记放大（7→10dp、加圆角描边）并配清晰标签，栏体抬高加大（58→66dp），不再像「图片未加载」占位点 ④ 暗黑模式——`app.json` 的 `userInterfaceStyle` 由 `light` 改为 `automatic` 以跟随系统；并新增「外观」设置（跟随系统 / 浅色 / 深色，持久化到 `settings.theme_mode`，`ThemeProvider` 读取后覆盖系统跟随）
> - **复习进度持久化修复（用户反馈：学了几个退出去又得从头学）**：根因在 `src/srs/fsrs.ts` 的 `State` 枚举映射——旧代码按 1 起始（`New=1`）做 `-1/+1` 偏移，但 ts-fsrs v5 实际是 **0 起始**（`New=0, Learning=1, Review=2, Relearning=3`）。于是新卡首次评分（FSRS 置为 `Learning=1`）经 `stateName` 被错写成 `'new'`，卡永远留在本日新词池，下次进仍从同一批最低频词（the/be/and…）开始；且因 `wasNew` 恒为 true，`daily_stats.new_count` 还会重复累加。已改为直接下标映射（`STATE_NAMES[s]` / `indexOf(n)`），评分后新卡正确转为 `learning`/`review` 离开新词池，本日新词进度（`newDone`）与「下一次从第 N+1 个开始」恢复正常。⚠️ 旧版跑出的运行时库 `drill.db` 可能已有被错标为 `new` 的卡，清一次 App 数据 / 重装即可拿到干净库；已交互过的卡在下次评分时会自愈（重新走 `gradeNewCard` 写回正确状态）
> - **复习卡背面长释义滚动（用户反馈：of/be 这类词一屏装不下；首版仍划不动）**：根因是 JSX 层级顺序——`tap` 翻转层渲染在背面**之后**压在背面上方，滑动手势被翻转层当成「轻点翻面」截走，`ScrollView` 收不到触摸。修法：把背面移到翻转层**之后**（层级更高），`pointerEvents` 随翻转切 `auto/none`——未翻面时 none 让点按穿透到翻转层触发翻面、翻面后 auto 由 ScrollView 接管滚动，轻点（位移<10px、<300ms，区别于滚动）仍翻转回正面
> - **统计页不随学习更新（用户反馈：首页已记录、统计页没及时记录）**：根因 `stats.tsx` 在渲染时一次性取值、无 `useFocusEffect` 重读；Expo Router 切 tab 不重挂载，故停在初始旧值。已加 `useFocusEffect` 每次聚焦重读 `getTodayCounts`/`getMasteredCount`，与首页一致
> - **复习卡发音按钮压字（用户反馈：翻到背面仍有发音键、与中英文释义重叠）**：根因 `styles.sound` 用 `position:absolute; bottom:86; alignSelf:'center'`，浮在卡面中下方正压住背面居中的释义。已将发音键移到**右上角**（`top:14; right:14`，带 `acsf` 浅底强调），正反面都可重听且不再压字；背面滚动容器 `backContent` 顶部预留 60dp 内边距，长释义滚动时首行也不会被角标遮住。⚠️ 例句（含中文译文）显示在**单词详情页**「例句」区（`app/word.tsx`），不在复习卡背面（背面只放释义+词根用于专注回忆）；新装的中文例句需**彻底重启 App** 才会随 `EXPECTED_DB_VERSION=4` 的整库换库生效（热更新不触发 `initDatabase` 的拷贝）
>
> M3.2 已收尾：`links.tar.bz2`（149,551,113 字节，EN→ZH 配对）下全并重建 `examples` 表，8,779 行带中文译文已随 `dictionary.db`（`user_version=4`，22.0MB）进包；运行时经 `EXPECTED_DB_VERSION=4` 整库换库把中文例句带进 `drill.db`。例句当前在单词详情页展示；复习卡背面 / 词列表的例句微展示为后续可选项。
> - **M5 统计看板（里程碑下一步）**：`stats.tsx` 从「今日新词 / 今日复习 / 已掌握」三项扩展为完整看板——连续打卡（按本地 04:00 分界连续有记录的天数）、学习总览（累计学习 / 词库总量）、近 7 日趋势（自绘条形，每日新词 + 复习）、留存率（基于 `review_logs` 四档评分，Good/Easy 计正确）、记忆状态分布（新词 / 学习中 / 复习中 / 重新学习 占比）。数据全来自本地库，纯 RN View 自绘、不引图表库。新增 `queries.ts`：`getStreak` / `getDailyHistory` / `getRetention` / `getStateDistribution` / `getLearningStats` + 日期偏移辅助 `shiftDateKey`。`tsc` 通过。
> - **M5 备份导出 / 导入（已完成，待真机验证）**：新增 `app/backup.tsx` + `queries.ts` 的 `exportBackupData` / `restoreBackup`。导出 = 收集 cards/review_logs/daily_stats/user_notes/settings + 元信息（app/schema/version/exportedAt）→ JSON → `Paths.document.createFile` 写入文档目录 → `expo-sharing` 分享；导入 = `expo-document-picker` 选 JSON → `new File(uri).text()` 读 → 解析 → 合并本地（cards 按 `last_review_at` 取新、review_logs 追加、daily_stats 按日累加、user_notes 按 `updated_at` 取新、settings 覆盖），整批事务、失败回滚。设置页「工具」新增「备份与恢复」入口。依赖 `expo-file-system@57.0.6` / `expo-sharing@57.0.18` / `expo-document-picker@57.0.1`（见「依赖说明」）。⚠️ **SDK 57 的 expo-file-system v57 已移除旧版 `FileSystem.writeAsStringAsync` / `readAsStringAsync` / `documentDirectory` 扁平 API（运行时抛错），改用 `File` / `Paths` 新 API**——`Paths.document.createFile(name,'application/json')` 建句柄 + `file.write(json)` 写 + `file.uri` 分享 + `file.text()` 读。代码已按新 API 实现且 `tsc --noEmit` 通过。仍建议 Android 真机跑一次导出 / 导入确认原生行为。
> - **M6 词根词缀 · 运行时规则拆解**：随包词库 `words.root_affix` 字段全为 NULL（30565 词无一有值），故词根词缀改由**纯规则在运行时拆**。新增 `src/lib/morphology.ts`（无 DB 依赖、可单测）：前缀表 / 后缀表 / 约 150 条拉丁希腊词根表 + `decompose(word, isKnown)`。策略**宁缺毋滥**——同一词枚举所有「前缀 × 后缀」组合，逐条打分取最高分（**词根命中 ≫ 普通单词命中**；拼写无改动、词缀更全、词干更长者更可信），低于阈值直接返回 null 不显示，避免给出错误拆解误导记忆。个别易假命中短词的后缀（如 `-ion`：million→mill、companion→pan）对词干另设更长门槛。全量 30565 词中 **10545 词（34.5%）可拆**；`-ion` 假朋友人工抽检 ≈2–3% 误报且均形态可读。`queries.ts` 加 `decomposeWord`（惰性构建全词集验证词干），`src/components/Morphology.tsx` 渲染「前缀 + 词干/词根 + 后缀」分段（词缀朱砂、词干主文本色，段下标注）。单词详情页原先恒为空的 `root_affix` 死展示块已**删除**，改用 `MorphologyView`。
> - **M6 手写助记 · 编辑 + 检索**：`user_notes(word_id PK, mnemonic, note, updated_at)` 表落地为「我的助记」。详情页新增「我的助记」区——两条 `TextInput`（助记联想 / 补充备注），`onEndEditing` 即自动落库（`saveUserNote`，两栏皆空则删行，保持「有助记才有记录」），页内「已保存」轻提示。新增 `app/notes.tsx`「我的助记」检索页：`getNotes(q)` JOIN words 按 `updated_at` 倒序，支持按 **单词 / 助记 / 备注** 模糊检索，点行进详情继续编辑。设置页新增「学习记录」分组挂入口。`tsc --noEmit` 零错误、`npx expo export --platform android` 打包通过。
> - **数据清洗 · 繁→简 + 例句补缺口**：① 用 opencc `t2s` 把 `definition_zh`（11 行）与 `sentence_zh`（3,862 行）的繁体转简体，残余繁体 = 0，换库前备份 `assets/db/dictionary.db.bak_t2s` ② 缺例句单词原 **3,940** 个，按频率（`bnc`/`frq` 升序，**最常用优先**）手工撰写「英文句 + 简中译」补入 `examples(ord=1)`：累计已补 **3,926** 条，剩余 **14** 个 —— **本项已收尾**：这 14 个全为按策略刻意跳过的词，无需再补（`n't`/`mmmm`/`naw` 等口语碎片与噪声，`whitey`/`gook`/`kaffir`/`wetback`/`honky`/`jihadi`/`mujahedeen` 等冒犯性词，`ponce`/`goddam`/`moll` 等粗俗词，以及 `ooo` 这类无实义残条）。批次 29 曾误将 `coppery`/`circularity`/`timekeeping` 三词的 id↔例句错位，已修正并补回（最常用的一批 `bnc=0` 词早已耗尽，当前队首为 `bnc>0` 的中频至中低频词，如 `fungicide`/`ringlet`/`acetylcholine` 一带 `bnc≈26k–30k`；`n't` 等口语碎片及 `whitey`/`gook`/`kaffir`/`wetback`/`jihadi`/`mujahedeen`/`ponce`/`goddam` 等冒犯性/渎神词、`mmmm`/`naw` 等拟声/俚语碎片按策略跳过）。⚠️ **修正 OFFSET 漂移**：本会话初曾误用「累计 OFFSET」（`LIMIT 120 OFFSET N*120` 作用于会收缩的缺例句集合），导致每两块漏一块、且漏掉最常用的一批（`bnc=0`、`frq` 21k–30k）。已改为**始终取 `OFFSET 0` 当前队首**（无漂移），批次 18–20 已补回这批最常用词。`ponce` / `goddam` / `moll` 等少数粗俗 / 渎神词按既有策略跳过。所有新增例句经繁体字符扫描 = 0。
> - **数据清洗 · 新范围（用户补充）**：③ 例句「**有英文无中译**」共 **102,876** 条（Tatoeba 原始中文配对仅覆盖 ~7.9%，其余确无现成中译）→ 改由**人工逐句翻译**补入（离线 MT 方案已废弃，见下）。按「唯一 `sentence_en` 分组 + 词频升序（`bnc`/`frq`）」取队首批次，每批 120 条唯一句、按 `sentence_en` 回填 `sentence_zh`（一句多词时一次更新多行）。**批次 1–3 已完成（人工）：360 句 → 815 行（批次1=347、批次2=239、批次3=229），剩余 102,061 行 / 85,260 条唯一句**。⚠️ 废弃离线 MT 的原因：`argostranslate` 经 `stanza` 间接依赖 `torch`（124MB wheel、装后数 GB），本机走阿里云镜像仅约 41 kB/s 且反复超时；且机翻质量对**学习类例句**不可控（一词多义、俚语、截断句尤甚），故改人工。⚠️ **例句截断事实**：`build_examples.py` 导入时对超长句按 **181 字符硬截断并以 `…` 收尾**（全表 8,610 行受影响，其中待译 8,395 行 / 5,512 条唯一句）。人工翻译按**库中可见文本**译（`…` 处对译作「……」），不臆造被截掉的尾部；后续若要根治需调 `build_examples.py` 的截断上限并重跑。④ 释义「**中文比英文少**」经核查：词表 `def_en` 非空而 `def_zh` 为空 = 0（中文释义已全覆盖）；逐条比对后发现仅 **16 条为真缺口**（分词/动名词/过去分词缺真实动词义项，如 `shall`/`called`/`calling`/`taking`/`holding`/`caught`/`ought`/`breaking`/`born`/`stolen`/`proven`/`determining`/`coming`/`checking`/`something`/`illuminati`），已手工补全动词本义 + 词性标注。其余「中文比英文短」属功能词英文词典啰嗦（to/of/for/with/where/when…），中文已是正确精简标准形，补字反而降质，按策略保留。
>
> 完整设计见 [docs/开发计划.md](docs/开发计划.md)、[docs/对抗式审查.md](docs/对抗式审查.md)、[docs/设计系统.md](docs/设计系统.md)。

## 数据管线（离线跑一次）

词库是离线预处理产物，不进运行时。`assets/db/dictionary.db` 即随包词库（全量 30,565 词 + 例句），App 首次启动（或本地版本低于 `EXPECTED_DB_VERSION`）将其拷贝到用户目录后直接在其上写进度。重跑流程：

```bash
bash tools/fetch_ecdict.sh       # 下载 ECDICT 主词典（MIT）到 tools/cache/（不进版本库）
python3 tools/build_dict.py      # 筛选高频词 + 考纲标签，构建 assets/db/dictionary.db（user_version=2，M3）
python3 tools/build_examples.py  # 拉取 Tatoeba 英/中句 + links，构建 examples 表（user_version=4，M3.2）
```

`dictionary.db` 一次建好全部表——`words`/`tags`/`word_tags`/`examples` 为只读词库，`cards` 等用户表留空——App 首次启动将其拷贝到用户目录后直接在其上写进度，可跨表 JOIN，无需运行时再建表。`examples` 表由 `build_examples.py` 在 Tatoeba 周更导出上离线构建（`word_id, sentence_en, sentence_zh, ord`）：词→句通过词典词集合命中、句间翻译经 `links` 配对，纯字符串处理、可重跑；缺 links/cmn 时退化为纯英文例句。

## 本地开发

```bash
npm install
npm start          # 启动 Metro，扫码或连接设备
npm run android    # 真机 / 模拟器
```

## 依赖说明（重要，别踩坑）

本项目**必须用 `npm install --legacy-peer-deps`**：锁文件里 `react@19.2.3` 与 `react-dom@19.2.8` 版本不匹配（历史遗留），不带该 flag 会 `ERESOLVE` 直接中止安装。

但 `--legacy-peer-deps` 会**完全跳过 peerDependencies**——凡是只靠 peer 关系装上的包，npm 会当成「多余」清掉。`expo-router` 的原生必需依赖正是这种 peer：

- `react-native-safe-area-context`、`react-native-screens`、`expo-linking`、`expo-constants`

**规则：这些包必须在 `package.json` 里显式声明**（本项目已加）。否则一次 `npm install` 就会把它们剪掉，Metro 打包立刻报 `Unable to resolve "react-native-safe-area-context"`。

改完依赖后**务必验证三件事**再收工：

```bash
npm ls react-native-safe-area-context react-native-screens   # 1. 包在树上、版本对
npx tsc --noEmit                                             # 2. 类型零错误
npx expo export --platform android                            # 3. Metro 真打包能过
```

## 许可证

MIT —— 见 [LICENSE](LICENSE)。

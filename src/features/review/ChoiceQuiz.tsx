// 选择题复习：四选一（1 正确 + 3 随机干扰），两种题型轮换。
//
// **为什么要有它**：自评四档里「我记得了」永远是最省力的那一档 —— 一张卡只要翻过去看过答案，
// 就会被评成「会了」。于是 FSRS 在数据上照常调度，体验上却等于没有遗忘曲线：
// 主人反馈的「一分钟重学完全没有生效，怎么选都会觉得是学会了单词」，根因不在调度算法，
// 在**判定权交给了学习者自己**。选择题把判定权拿回来：有客观对错，答错就是 Again。
//
// 题型一「选意思」：给单词，选中文释义。
// 题型二「选单词」：给中文释义，选单词。
// 两者轮换（每张卡随机一次）—— 只做第一种会练出「认得形、说不出义」的单向记忆。
import React, { useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { getDistractors, getExamples, type ChoiceOption } from '../../db/queries';
import type { QueueItem } from '../../db/queries';
import { parseSenses } from '../../components/Definition';
import { RADIUS, SPACE, WEIGHT, TRACK, FONT, CONTROL, serif } from '../../theme/tokens';

// 选项文本 = **第一条义项的正文**，收束在 14 字以内、且只在逗号处收。
//
// 三条都是踩过的坑，别改回去：
// ① 释义里的换行是**字面量 `\n`**（两个字符），必须走 `parseSenses` 的归一化 ——
//    自己 split('\n') 切不开，屏幕上就会看到裸奔的 `\n[计] 后端`；
// ② 词性前缀（`n.` / `vt.`）与领域标签（`[计]`）必须剥掉：选项里露词性等于送答案，
//    四条里只有一条是 `art.`，那它就是答案，题目当场作废；
// ③ 不能按字数硬截断：`（使）成离子( ionized…` 会被切在英文括号中间。
function optionText(def: string | null | undefined, max = 14): string {
  const senses = parseSenses(def);
  if (!senses.length) return '';
  const body = senses[0].body.trim();
  if (body.length <= max) return body;
  const seg = body.slice(0, max);
  // 在窗口内找最后一个逗号，从那里收束；找不到（英文短语等）才退化为硬截。
  const cut = Math.max(seg.lastIndexOf('，'), seg.lastIndexOf(','));
  return (cut >= 4 ? seg.slice(0, cut) : seg) + '…';
}

type Mode = 'meaning' | 'word';

interface Option {
  key: number;
  label: string;
  correct: boolean;
}

function buildOptions(item: QueueItem, mode: Mode): { prompt: string; options: Option[]; answer: string } {
  const def = optionText(item.definition_zh);
  const correctLabel = mode === 'meaning' ? def : item.word;
  const ds: ChoiceOption[] = getDistractors(item, 3);
  const wrongRaw = ds.map((d) => (mode === 'meaning' ? optionText(d.definition_zh) : d.word));

  // 去重：干扰项与正确答案撞车（同形 / 同释义）会让那一项「选了也算对」，判定就废了。
  const seen = new Set<string>([correctLabel]);
  const wrong: string[] = [];
  for (const w of wrongRaw) {
    if (!w || seen.has(w)) continue;
    seen.add(w);
    wrong.push(w);
  }

  const all: Option[] = [
    { key: 0, label: correctLabel, correct: true },
    ...wrong.map((w, i) => ({ key: i + 1, label: w, correct: false })),
  ];
  // 洗牌：正确项不能总在同一个位置，否则练的是位置记忆。
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  return { prompt: mode === 'meaning' ? item.word : def, options: all, answer: correctLabel };
}

export function ChoiceQuiz({
  item,
  onAnswer,
  onContinue,
}: {
  item: QueueItem;
  /** 作答后立刻回调（正确 true / 错误 false），由调用方映射成 FSRS 评分。 */
  onAnswer: (correct: boolean) => void;
  onContinue: () => void;
}) {
  const { colors: c } = useTheme();
  // 题型每张卡定一次（useRef 而非 useState：重渲染不该换题型）。
  const mode = useRef<Mode>(Math.random() < 0.5 ? 'meaning' : 'word').current;
  const { prompt, options, answer } = useMemo(() => buildOptions(item, mode), [item, mode]);
  // 例句等到答完才取：这一屏的使命是判定，判定完才谈得上「顺便学一下」。
  const example = useMemo(
    () => (mode === 'meaning' ? getExamples(item.word_id, 1)[0] ?? null : null),
    [item.word_id, mode]
  );
  const [picked, setPicked] = useState<number | null>(null);
  const answered = picked !== null;
  const wasRight = answered && options[picked as number].correct;
  const phonetic = item.phonetic_uk || item.phonetic_us || '';

  const pick = (i: number) => {
    if (answered) return;
    setPicked(i);
    onAnswer(options[i].correct);
  };

  return (
    <View style={styles.wrap}>
      <Text style={[styles.kicker, { color: c.tx3 }]}>
        {mode === 'meaning' ? '这个词是什么意思' : '哪个单词是这个意思'}
      </Text>
      <Text
        style={[styles.prompt, { color: c.tx1, fontFamily: mode === 'meaning' ? serif : undefined }]}
        numberOfLines={mode === 'meaning' ? 1 : 3}
        adjustsFontSizeToFit
        minimumFontScale={0.5}
      >
        {prompt}
      </Text>

      <View style={styles.opts}>
        {options.map((o, i) => {
          const chosen = picked === i;
          // 答完之后：正确答案**一定**亮出来（朱底纸字 = 白文印），选错的那个描朱边 ——
          // 判定是给学习者的，不是给系统的：不告诉他哪个对，这一题就白错了。
          const showRight = answered && o.correct;
          const showWrong = answered && chosen && !o.correct;
          return (
            <TouchableOpacity
              key={o.key}
              activeOpacity={0.7}
              onPress={() => pick(i)}
              style={[
                styles.opt,
                {
                  backgroundColor: showRight ? c.ac : c.sf,
                  borderColor: showRight ? c.ac : showWrong ? c.ac : c.bd,
                },
              ]}
            >
              <Text
                style={[styles.optText, { color: showRight ? c.bg : showWrong ? c.ac : c.tx1 }]}
                numberOfLines={2}
              >
                {o.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {answered ? (
        <View style={styles.after}>
          <Text style={[styles.verdict, { color: wasRight ? c.tx2 : c.ac }]}>
            {wasRight ? '对了' : `不对 · 正确答案是「${answer}」`}
          </Text>
          {/* 答完给完整词条：只丢一个 14 字的选项文本就说「判完了」，那这一轮只剩考试、没有学习。 */}
          <View style={styles.entry}>
            <Text style={[styles.entryWord, { color: c.tx1 }]}>{item.word}</Text>
            {phonetic ? <Text style={[styles.ipa, { color: c.tx3 }]}>{phonetic}</Text> : null}
            <Text style={[styles.entryDef, { color: c.tx2 }]}>{answer}</Text>
            {example ? (
              <Text style={[styles.quote, { color: c.tx3 }]} numberOfLines={2}>
                {example.sentence_en}
              </Text>
            ) : null}
          </View>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={onContinue}
            style={[styles.next, { backgroundColor: c.ac }]}
          >
            <Text style={[styles.nextText, { color: c.bg }]}>继续</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingTop: SPACE.md },
  kicker: { fontSize: FONT.label, letterSpacing: TRACK.label, fontWeight: WEIGHT.semibold },
  // 题干：单词用衬线（与复习卡正面同一套字体语言），中文释义用正文黑体。
  prompt: { fontSize: FONT.wordSm, fontWeight: WEIGHT.semibold, marginTop: SPACE.sm, marginBottom: SPACE.lg },
  opts: { gap: SPACE.sm },
  opt: {
    minHeight: CONTROL.md,
    borderWidth: 1,
    borderRadius: RADIUS.ctrl,
    paddingHorizontal: SPACE.lg,
    justifyContent: 'center',
  },
  optText: { fontSize: FONT.def, fontWeight: WEIGHT.regular, lineHeight: 22 },
  after: { marginTop: SPACE.lg, gap: SPACE.md },
  verdict: { fontSize: FONT.body, fontWeight: WEIGHT.semibold },
  entry: { gap: 3 },
  entryWord: { fontFamily: serif, fontSize: FONT.def, fontWeight: WEIGHT.semibold },
  ipa: { fontSize: FONT.ipa },
  entryDef: { fontSize: FONT.def, lineHeight: 22 },
  // 例句原文保持斜体（体系规定：斜体只留给例句原文）。
  quote: { fontSize: FONT.quote, fontStyle: 'italic', lineHeight: 20, marginTop: 2 },
  next: {
    minHeight: CONTROL.md,
    borderRadius: RADIUS.ctrl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextText: { fontSize: FONT.body, fontWeight: WEIGHT.semibold, letterSpacing: TRACK.body },
});

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
  // 复合词性（`vt. & vi.` / `n. & a. & v.`）：parseSense 只剥头一个，
  // 剩下那个 `& vi.` 会漏进选项 —— 选项里露词性等于送答案（实测 23 词中招）。
  // 只剥带分隔符的续接词性，不误伤以括号开头的正常用法注解（那类有 550 词，是有效内容）。
  const body = senses[0].body.trim().replace(/^(?:\s*[&/、,，]\s*[a-z]{1,8}\.\s*)+/i, '');
  if (!body) return '';
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
  // 选项背后的那个词 + 它的释义。两条都要留着，是为了答错后做**混淆项辨析**：
  // 只标红不解释，学习者不知道自己到底把它想成了什么，同样的错会再犯一次
  // （不背单词把这个做成设置项「混淆项辨析」，默认开）。
  word: string;
  gloss: string;
  correct: boolean;
}

function toOption(word: string, defZh: string | null, mode: Mode, correct: boolean, key: number): Option {
  const gloss = optionText(defZh);
  return { key, label: mode === 'meaning' ? gloss : word, word, gloss, correct };
}

function buildOptions(item: QueueItem, mode: Mode): { prompt: string; options: Option[]; answer: string } {
  const correct = toOption(item.word, item.definition_zh, mode, true, 0);
  const ds: ChoiceOption[] = getDistractors(item, 3);

  // 去重：干扰项与正确答案撞车（同形 / 同释义）会让那一项「选了也算对」，判定就废了。
  const seen = new Set<string>([correct.label]);
  const all: Option[] = [correct];
  for (const d of ds) {
    const o = toOption(d.word, d.definition_zh, mode, false, all.length);
    if (!o.label || seen.has(o.label)) continue;
    seen.add(o.label);
    all.push(o);
  }
  // 洗牌：正确项不能总在同一个位置，否则练的是位置记忆。
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  return { prompt: mode === 'meaning' ? correct.word : correct.gloss, options: all, answer: correct.label };
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
  const pickedOpt = answered ? options[picked as number] : null;
  const wasRight = !!pickedOpt?.correct;
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
          {/* 混淆项辨析：答错时把**你选的那个**摊开讲清楚。
              只标红不解释，学习者不知道自己把它当成了什么 —— 同样的错下一轮会原样再犯。
              正确答案那一行是「该记什么」，这一行是「刚才错在哪」，两行并排才是完整反馈。 */}
          {!wasRight && pickedOpt ? (
            <Text style={[styles.confuse, { color: c.tx2 }]}>
              {mode === 'meaning'
                ? `你选的那个意思属于「${pickedOpt.word}」`
                : `「${pickedOpt.word}」的意思是「${pickedOpt.gloss}」`}
            </Text>
          ) : null}
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
  confuse: { fontSize: FONT.quote, lineHeight: 20, marginTop: -2 },
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

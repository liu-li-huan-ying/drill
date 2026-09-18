// 自定义词库导入：粘贴单词（每行/空格/逗号分隔）+ 列表名，匹配内置词典后建专属 tag 与卡片。
import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme/ThemeProvider';
import { RADIUS, WEIGHT, SPACE, CONTROL, FONT, TRACK } from '../src/theme/tokens';
import { PageEnter, Num } from '../src/components/ui';
import { importCustomList } from '../src/db/queries';
import { useSideInset, useTopPad } from '../src/lib/layout';

export default function ImportScreen() {
  const { colors: c } = useTheme();
  const side = useSideInset();
  const topPad = useTopPad();
  const router = useRouter();
  const [name, setName] = useState('');
  const [raw, setRaw] = useState('');
  const [result, setResult] = useState<ReturnType<typeof importCustomList> | null>(null);

  const run = () => {
    if (!raw.trim()) return;
    setResult(importCustomList(name, raw));
  };

  return (
    <PageEnter style={[styles.screen, { backgroundColor: c.bg, paddingHorizontal: side, paddingTop: topPad }]}>
      <View style={[styles.top, { borderBottomColor: c.bd }]}>
        <TouchableOpacity activeOpacity={0.6} onPress={() => router.back()}>
          <Text style={[styles.back, { color: c.tx2 }]}>‹ 返回</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: c.tx1 }]}>自 定 义 词 库</Text>        <View style={{ width: 48 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={[styles.label, { color: c.tx3 }]}>列表名（留空则用「自定义词库」）</Text>
        <TextInput
          style={[styles.nameInput, { backgroundColor: c.pg, borderColor: c.bd, color: c.tx1 }]}
          placeholder="如：考研核心 2000"
          placeholderTextColor={c.tx3}
          value={name}
          onChangeText={setName}
        />

        <Text style={[styles.label, { color: c.tx3, marginTop: 16 }]}>
          单词（每行 / 空格 / 逗号分隔，自动去重小写）
        </Text>
        <TextInput
          style={[styles.textInput, { backgroundColor: c.pg, borderColor: c.bd, color: c.tx1 }]}
          placeholder="apple，banana，abandon …"
          placeholderTextColor={c.tx3}
          value={raw}
          onChangeText={setRaw}
          multiline
          textAlignVertical="top"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={run}
          disabled={!raw.trim()}
          style={[styles.btn, { backgroundColor: c.ac, opacity: raw.trim() ? 1 : 0.5 }]}
        >
          <Text style={[styles.btnText, { color: c.acon }]}>导入</Text>
        </TouchableOpacity>

        {result ? (
          <View style={[styles.result, { backgroundColor: c.sf, borderColor: c.bd }]}>
            <View style={styles.resultRow}>
              <Text style={[styles.resultLine, { color: c.tx1 }]}>已收录</Text>
              <Num value={result.found} style={[styles.resultLine, { color: c.tx1 }]} />
              <Text style={[styles.resultLine, { color: c.tx1 }]}>词 → 标签「{result.tagName}」</Text>
            </View>
            {result.missing.length > 0 ? (
              <View style={styles.resultRow}>
                <Text style={[styles.miss, { color: c.tx3 }]}>未收录</Text>
                <Num value={result.missing.length} style={[styles.miss, { color: c.tx3 }]} />
                <Text style={[styles.miss, { color: c.tx3 }]}>
                  词：{result.missing.slice(0, 12).join('、')}
                  {result.missing.length > 12 ? ' …' : ''}
                </Text>
              </View>
            ) : null}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() =>
                router.push({
                  pathname: '/wordlist',
                  params: { tagId: String(result.tagId), name: result.tagName },
                })
              }
              style={[styles.viewBtn, { borderColor: c.bd2 }]}
            >
              <Text style={[styles.viewText, { color: c.ac }]}>查看这个词单 →</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>
    </PageEnter>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  top: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACE.xl, paddingBottom: 12, borderBottomWidth: 1,
  },
  back: { fontSize: FONT.body, width: 48 },
  title: { fontSize: 13, letterSpacing: TRACK.title, textTransform: 'uppercase', fontWeight: WEIGHT.semibold, flex: 1, textAlign: 'center' },
  body: { paddingHorizontal: SPACE.xl, paddingTop: 20, paddingBottom: 40 },
  label: { fontSize: 12, letterSpacing: TRACK.body, marginBottom: 8 },
  nameInput: { minHeight: CONTROL.md, borderRadius: RADIUS.ctrl, borderWidth: 1, paddingHorizontal: 14, fontSize: FONT.body },
  textInput: { height: 200, borderRadius: RADIUS.ctrl, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: FONT.body, lineHeight: 22 },
  btn: { marginTop: 18, minHeight: CONTROL.lg, borderRadius: RADIUS.ctrl, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontSize: FONT.body, letterSpacing: TRACK.body, fontWeight: WEIGHT.semibold },
  result: { marginTop: SPACE.xxl, borderRadius: RADIUS.card, borderWidth: 1, padding: SPACE.lg },
  resultRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap' },
  resultLine: { fontSize: 14, fontWeight: WEIGHT.semibold },
  miss: { fontSize: 12, lineHeight: 18, marginTop: 8 },
  viewBtn: { marginTop: 14, minHeight: CONTROL.md, borderRadius: RADIUS.ctrl, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  viewText: { fontSize: 14, letterSpacing: TRACK.body },
});

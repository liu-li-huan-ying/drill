// 词库（标签）列表：每个标签一条，含词数与占比条。M2 只读展示。
import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useTheme } from '../../src/theme/ThemeProvider';
import { type Tokens } from '../../src/theme/tokens';
import { getTags } from '../../src/db/queries';

export default function LibraryScreen() {
  const { colors: c } = useTheme();
  const tags = getTags();
  const total = tags.reduce((a, t) => a + t.count, 0);
  const max = Math.max(1, ...tags.map((t) => t.count));

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: c.bg }]}>
      <Text style={[styles.kicker, { color: c.tx3 }]}>词 库 · LIBRARY</Text>
      <Text style={[styles.head, { color: c.tx1 }]}>已装载 {total} 词</Text>

      <View style={{ marginTop: 20 }}>
        {tags.map((t) => {
          const w = (t.count / max) * 100;
          return (
            <View key={t.id} style={[styles.row, { borderBottomColor: c.bd }]}>
              <View style={[styles.dot, { backgroundColor: t.color || c.tx3 }]} />
              <View style={styles.rowMain}>
                <View style={styles.rowTop}>
                  <Text style={[styles.name, { color: c.tx1 }]}>{t.name}</Text>
                  <Text style={[styles.count, { color: c.tx2 }]}>{t.count}</Text>
                </View>
                <View style={[styles.barTrack, { backgroundColor: c.pg }]}>
                  <View style={[styles.barFill, { width: `${w}%`, backgroundColor: t.color || c.ac }]} />
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingTop: 64, paddingHorizontal: 24, paddingBottom: 40 },
  kicker: { fontSize: 10.5, letterSpacing: 3, textTransform: 'uppercase', fontWeight: '600' },
  head: { fontSize: 25, marginTop: 10, fontFamily: 'serif', fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1 },
  dot: { width: 7, height: 7, borderRadius: 1, marginRight: 12 },
  rowMain: { flex: 1 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  name: { fontSize: 15 },
  count: { fontSize: 13, fontVariant: ['tabular-nums'] },
  barTrack: { height: 4, borderRadius: 2, marginTop: 8, overflow: 'hidden' },
  barFill: { height: 4, borderRadius: 2 },
});

// 备份与恢复（M5）：导出全部进度为 JSON 文件并分享；从 JSON 文件导入并合并到本地库。
// 备份不含离线词库本身（随 App 分发），只含用户进度（卡片/日志/统计/助记/设置）。
// 使用 expo-file-system v57 的 File/Paths API（旧版 FileSystem.writeAsStringAsync 已废弃并会在运行时抛错）。
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { useTheme } from '../src/theme/ThemeProvider';
import { type Tokens } from '../src/theme/tokens';
import { exportBackupData, restoreBackup, type BackupData } from '../src/db/queries';
import { EXPECTED_DB_VERSION } from '../src/db/Database';

interface BackupFile {
  app: 'drill';
  schema: number;
  version: number;
  exportedAt: string;
  data: BackupData;
}

export default function BackupScreen() {
  const { colors: c } = useTheme();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const doExport = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const payload: BackupFile = {
        app: 'drill',
        schema: EXPECTED_DB_VERSION,
        version: 1,
        exportedAt: new Date().toISOString(),
        data: exportBackupData(),
      };
      const json = JSON.stringify(payload);
      // expo-file-system v57：用 Paths.document 定位文档目录，createFile 创建文件句柄后 write。
      const name = `drill-backup-${Date.now()}.json`;
      const file = Paths.document.createFile(name, 'application/json');
      file.write(json);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri);
      }
      setMsg({ text: `已导出备份（${name}，${(json.length / 1024).toFixed(0)} KB）`, ok: true });
    } catch (e) {
      setMsg({ text: `导出失败：${(e as Error).message}`, ok: false });
    } finally {
      setBusy(false);
    }
  };

  const doImport = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });
      if (res.canceled) return;
      const uri = res.assets?.[0]?.uri;
      if (!uri) throw new Error('未获取到文件');
      // expo-file-system v57：用 File 句柄读取文本。
      const file = new File(uri);
      const content = await file.text();
      const parsed = JSON.parse(content) as BackupFile;
      if (parsed.app !== 'drill' || !parsed.data) throw new Error('不是有效的背呗备份文件');
      if (typeof parsed.schema === 'number' && parsed.schema !== EXPECTED_DB_VERSION) {
        // 跨版本备份：仍尝试合并（按 last_review_at 取新），仅提示，不阻断。
        setMsg({ text: `检测到备份版本 v${parsed.schema}（当前 v${EXPECTED_DB_VERSION}），将尽量合并`, ok: true });
      }
      const sum = restoreBackup(parsed.data);
      setMsg({
        text: `已合并：卡片 ${sum.cards} · 日志 ${sum.logs} · 天数 ${sum.days} · 笔记 ${sum.notes}`,
        ok: true,
      });
    } catch (e) {
      setMsg({ text: `导入失败：${(e as Error).message}`, ok: false });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: c.bg }]}>
      <View style={[styles.top, { borderBottomColor: c.bd }]}>
        <TouchableOpacity activeOpacity={0.6} onPress={() => router.back()}>
          <Text style={[styles.back, { color: c.tx2 }]}>‹ 返回</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: c.tx1 }]}>备 份 与 恢 复</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Action title="导出备份" sub="导出全部学习进度为 JSON 文件，可分享到网盘 / 邮件保存" onPress={doExport} colors={c} />
        <Action title="导入备份" sub="从 JSON 文件恢复进度（与本地合并，按最近学习取新）" onPress={doImport} colors={c} />

        {busy ? <ActivityIndicator style={styles.spinner} color={c.ac} /> : null}
        {msg ? (
          <View style={[styles.msg, { borderColor: msg.ok ? c.ac : c.tx3, backgroundColor: c.sf }]}>
            <Text style={[styles.msgText, { color: msg.ok ? c.ac : c.tx2 }]}>{msg.text}</Text>
          </View>
        ) : null}

        <Text style={[styles.note, { color: c.tx3 }]}>
          备份包含：复习卡片、评分历史、每日统计、手写助记、设置。不含离线词库本身（随 App 分发）。
          换设备时导入即可接续进度。
        </Text>
      </ScrollView>
    </View>
  );
}

function Action({
  title,
  sub,
  onPress,
  colors: c,
}: {
  title: string;
  sub: string;
  onPress: () => void;
  colors: Tokens;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[styles.action, { backgroundColor: c.sf, borderColor: c.bd }]}
    >
      <Text style={[styles.actionTitle, { color: c.tx1 }]}>{title}</Text>
      <Text style={[styles.actionSub, { color: c.tx3 }]}>{sub}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingTop: 52 },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  back: { fontSize: 15, width: 56 },
  title: { fontSize: 13, letterSpacing: 3, textTransform: 'uppercase', fontWeight: '600', flex: 1, textAlign: 'center' },
  body: { padding: 24, paddingBottom: 40 },
  action: { borderRadius: 12, borderWidth: 1, padding: 18, marginBottom: 14 },
  actionTitle: { fontSize: 16, fontWeight: '600' },
  actionSub: { fontSize: 12, marginTop: 6, lineHeight: 17 },
  spinner: { marginTop: 18 },
  msg: { marginTop: 8, borderRadius: 10, borderWidth: 1, padding: 14 },
  msgText: { fontSize: 13, lineHeight: 18 },
  note: { fontSize: 12, lineHeight: 18, marginTop: 18, letterSpacing: 0.5 },
});

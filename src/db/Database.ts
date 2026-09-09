// 数据库初始化：首次启动把打包的 dictionary.db 拷贝为运行时库。
// dictionary.db 在建库时已包含所有表（words/tags/word_tags 只读，cards 等用户表留空），
// 拷贝后直接在其上写进度，可跨表 JOIN，无需运行时再建表。
import { openDatabaseSync, importDatabaseFromAssetAsync, type SQLiteDatabase } from 'expo-sqlite';

const DB_NAME = 'drill.db';

// 打开（首启若文件不存在会创建空库），随后由 initDatabase() 决定是否拷贝资产。
export const db: SQLiteDatabase = openDatabaseSync(DB_NAME);

let initialized = false;

export async function initDatabase(): Promise<void> {
  if (initialized) return;
  // 检测 cards 表是否已存在：不存在说明是空库（首启），需要拷贝资产。
  const row = db.getFirstSync<{ c: number }>(
    "SELECT count(*) AS c FROM sqlite_master WHERE type='table' AND name='cards'"
  );
  if (!row || row.c === 0) {
    await importDatabaseFromAssetAsync(DB_NAME, {
      assetId: require('../../assets/db/dictionary.db'),
      forceOverwrite: true,
    });
  }
  initialized = true;
}

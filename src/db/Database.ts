// 数据库初始化：首次启动把打包的 dictionary.db 拷贝为运行时库。
// dictionary.db 在建库时已包含所有表（words/tags/word_tags 只读，cards 等用户表留空），
// 拷贝后直接在其上写进度，可跨表 JOIN，无需运行时再建表。
//
// 关键：expo-sqlite 的 importDatabaseFromAssetAsync 会直接覆盖磁盘上的 db 文件，
// 若先 openDatabaseSync 再拷贝，已打开的连接仍指向被替换前的空库（报 no such table）。
// 因此不在模块加载时急着开库——首启时先检查、拷贝资产，再（重）打开连接，确保连接指向含表的新文件。
import { openDatabaseSync, importDatabaseFromAssetAsync, type SQLiteDatabase } from 'expo-sqlite';

const DB_NAME = 'drill.db';

let db: SQLiteDatabase | null = null;

// 懒打开 + 缓存。任何时刻都返回当前有效连接（首启拷贝后会重新打开）。
export function getDb(): SQLiteDatabase {
  if (!db) db = openDatabaseSync(DB_NAME);
  return db;
}

let initialized = false;

export async function initDatabase(): Promise<void> {
  if (initialized) return;
  const conn = getDb();
  const row = conn.getFirstSync<{ c: number }>(
    "SELECT count(*) AS c FROM sqlite_master WHERE type='table' AND name='cards'"
  );
  if (!row || row.c === 0) {
    await importDatabaseFromAssetAsync(DB_NAME, {
      assetId: require('../../assets/db/dictionary.db'),
      forceOverwrite: true,
    });
    // 资产拷贝覆盖了磁盘文件，旧连接仍指向空库——关闭并重开，让连接指向含表的新文件。
    conn.closeSync();
    db = null;
    getDb();
  }
  initialized = true;
}

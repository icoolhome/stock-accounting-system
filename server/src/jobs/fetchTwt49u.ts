import fs from 'fs';
import path from 'path';
import iconv from 'iconv-lite';
import { getDatabase, run, get } from '../database';

const TWSE_BASE_URL = 'https://www.twse.com.tw/';

// 將「114年12月19日」轉成「2025-12-19」
function parseRocDateToIso(dateStr: string): string | null {
  if (!dateStr) return null;
  const m = dateStr.match(/(\d+)年(\d+)月(\d+)日/);
  if (!m) return null;
  const rocYear = parseInt(m[1], 10);
  const year = rocYear + 1911;
  const month = parseInt(m[2], 10);
  const day = parseInt(m[3], 10);
  const d = new Date(year, month - 1, day);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function toNumber(value: string | null | undefined): number | null {
  if (!value) return null;
  const trimmed = value.trim().toUpperCase();
  if (!trimmed || trimmed === 'N/A') return null;
  const n = Number(trimmed.replace(/,/g, ''));
  return Number.isNaN(n) ? null : n;
}

async function getLatestRecordDate(): Promise<string | null> {
  const row = await get<{ latest?: string }>(
    'SELECT MAX(record_date) AS latest FROM twse_exrights'
  );
  return row?.latest || null;
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatTwseDateParam(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

async function downloadTwt49uCsv(
  startDate: Date,
  endDate: Date
): Promise<string | null> {
  const strDate = formatTwseDateParam(startDate);
  const end = formatTwseDateParam(endDate);
  const url = `${TWSE_BASE_URL}exchangeReport/TWT49U?response=csv&strDate=${strDate}&endDate=${end}`;

  console.log('[TWT49U] 下載網址:', url);

  const res = await fetch(url);
  if (!res.ok) {
    console.error('[TWT49U] 下載失敗:', res.status, res.statusText);
    return null;
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length < 3) {
    console.warn('[TWT49U] 回傳內容過小，可能無資料');
    return null;
  }

  // 轉成 UTF-8 字串
  const text = iconv.decode(buffer, 'big5');

  const dataDir = path.join(__dirname, '../../data/twse/TWT49U');
  fs.mkdirSync(dataDir, { recursive: true });
  const filename = `TWT49U_${strDate}_${end}.csv`;
  const filePath = path.join(dataDir, filename);
  fs.writeFileSync(filePath, text, 'utf8');
  console.log('[TWT49U] 已儲存 CSV 至', filePath);

  return text;
}

type CsvRow = Record<string, string>;

function parseTwt49uCsv(text: string): CsvRow[] {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  let headerLineIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('股票代號') && lines[i].includes('股票名稱')) {
      headerLineIndex = i;
      break;
    }
  }
  if (headerLineIndex === -1) {
    console.warn('[TWT49U] 找不到欄位列');
    return [];
  }

  const headerLine = lines[headerLineIndex];
  const headers = headerLine
    .replace(/^"|"$/g, '')
    .split('","')
    .map((h) => h.trim());

  const rows: CsvRow[] = [];

  for (let i = headerLineIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    // 備註 / 公式 之後就不用了
    if (line.startsWith('"備註') || line.startsWith('"公式')) {
      break;
    }

    if (!line.startsWith('"')) continue;

    const cols = line
      .replace(/^"|"$/g, '')
      .split('","')
      .map((c) => c.trim());

    if (cols.length < headers.length) {
      continue;
    }

    const row: CsvRow = {};
    headers.forEach((h, idx) => {
      row[h] = cols[idx] ?? '';
    });

    if (!row['股票代號'] || !row['資料日期']) continue;
    rows.push(row);
  }

  return rows;
}

async function saveRowsToDatabase(rows: CsvRow[]): Promise<void> {
  if (rows.length === 0) {
    console.log('[TWT49U] 無資料可匯入');
    return;
  }

  await run('BEGIN TRANSACTION', []);
  try {
    for (const row of rows) {
      const codeRaw = row['股票代號'];
      if (!codeRaw) continue;
      const code = codeRaw.replace(/^="?/, '').replace(/"?$/, '').trim();
      if (!code) continue;

      const isoDate = parseRocDateToIso(row['資料日期']);
      if (!isoDate) continue;

      const params = [
        isoDate, // record_date
        code, // stock_code
        row['股票名稱']?.trim() || null,
        toNumber(row['除權除息前收盤價']),
        toNumber(row['除權除息參考價']),
        toNumber(row['權值+息值']),
        row['權/息']?.trim() || null,
        toNumber(row['漲停價格']),
        toNumber(row['跌停價格']),
        toNumber(row['開盤競價基準']),
        toNumber(row['減除股利參考價']),
        row['詳細資料']?.trim() || null,
        row['最近一次申報資料 季別/日期']?.trim() || null,
        toNumber(row['最近一次申報每股 (單位)淨值']),
        toNumber(row['最近一次申報每股 (單位)盈餘']),
      ];

      await run(
        `
        INSERT INTO twse_exrights (
          record_date,
          stock_code,
          stock_name,
          pre_close_price,
          ex_ref_price,
          right_cash_value,
          right_or_dividend,
          limit_up_price,
          limit_down_price,
          opening_ref_price,
          dividend_deduction_ref,
          detail,
          last_fin_period,
          last_nav_per_share,
          last_eps,
          created_at,
          updated_at
        ) VALUES (
          ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
        )
        ON CONFLICT(record_date, stock_code) DO UPDATE SET
          stock_name = excluded.stock_name,
          pre_close_price = excluded.pre_close_price,
          ex_ref_price = excluded.ex_ref_price,
          right_cash_value = excluded.right_cash_value,
          right_or_dividend = excluded.right_or_dividend,
          limit_up_price = excluded.limit_up_price,
          limit_down_price = excluded.limit_down_price,
          opening_ref_price = excluded.opening_ref_price,
          dividend_deduction_ref = excluded.dividend_deduction_ref,
          detail = excluded.detail,
          last_fin_period = excluded.last_fin_period,
          last_nav_per_share = excluded.last_nav_per_share,
          last_eps = excluded.last_eps,
          updated_at = CURRENT_TIMESTAMP
        `,
        params
      );
    }
    await run('COMMIT', []);
    console.log('[TWT49U] 匯入完成，共處理筆數:', rows.length);
  } catch (e) {
    await run('ROLLBACK', []);
    console.error('[TWT49U] 匯入失敗，已回滾:', (e as Error).message);
    throw e;
  }
}

export async function runTwt49uJob() {
  try {
    console.log('=== TWT49U 自動更新開始 ===');

    const latest = await getLatestRecordDate();
    const today = new Date();
    const todayIso = formatDate(today);

    if (latest && latest >= todayIso) {
      console.log('[TWT49U] 已經是最新資料，不需更新');
      return;
    }

    let startDate: Date;
    if (!latest) {
      // 沒有任何資料時，從 2003-05-05 開始（TWSE 官方提供起始日）
      startDate = new Date(2003, 4, 5); // 月份從 0 開始
    } else {
      const d = new Date(latest);
      d.setDate(d.getDate() + 1);
      startDate = d;
    }

    const endDate = today;

    const csvText = await downloadTwt49uCsv(startDate, endDate);
    if (!csvText) {
      console.log('[TWT49U] 沒有取得任何 CSV 內容，結束');
      return;
    }

    const rows = parseTwt49uCsv(csvText);
    await saveRowsToDatabase(rows);

    console.log('=== TWT49U 自動更新結束 ===');
  } catch (e) {
    console.error('[TWT49U] 發生錯誤:', (e as Error).message);
  }
}

// 直接執行此檔案時才跑
if (require.main === module) {
  runTwt49uJob().catch((e) => {
    console.error('[TWT49U] 執行失敗:', (e as Error).message);
    process.exitCode = 1;
  });
}



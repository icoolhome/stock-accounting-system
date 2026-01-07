import express from 'express';
import { all, get, run } from '../database';
import { authenticate, AuthRequest } from '../middleware/auth';
import https from 'https';
import zlib from 'zlib';

const router = express.Router();

router.use(authenticate);

// 輔助函數：根據股票名稱和代碼分類行業（簡化版，返回 null 表示未分類）
const getIndustryCategory = (name: string, code: string): string | null => {
  // 這裡可以根據需要實現行業分類邏輯
  // 目前返回 null，表示未分類
  return null;
};

// 獲取系統設定
router.get('/', async (req: AuthRequest, res) => {
  try {
    const settings = await all<any>(
      'SELECT setting_key, setting_value FROM system_settings WHERE user_id = ?',
      [req.userId]
    );

    const settingsObj: any = {};
    settings.forEach((s: any) => {
      try {
        settingsObj[s.setting_key] = JSON.parse(s.setting_value);
      } catch {
        settingsObj[s.setting_key] = s.setting_value;
      }
    });

    res.json({
      success: true,
      data: settingsObj,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '獲取系統設定失敗',
    });
  }
});

// 更新系統設定
router.put('/', async (req: AuthRequest, res) => {
  try {
    const { settings } = req.body;

    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({
        success: false,
        message: '請提供有效的設定資料',
      });
    }

    for (const [key, value] of Object.entries(settings)) {
      const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
      
      await run(
        `INSERT OR REPLACE INTO system_settings (user_id, setting_key, setting_value, updated_at) 
         VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
        [req.userId, key, valueStr]
      );
    }

    res.json({
      success: true,
      message: '系統設定更新成功',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '更新系統設定失敗',
    });
  }
});

// 獲取幣別設定
router.get('/currencies', async (req: AuthRequest, res) => {
  try {
    const currencies = await all<any>(
      'SELECT * FROM currency_settings WHERE user_id = ? ORDER BY is_default DESC, currency_code ASC',
      [req.userId]
    );

    res.json({
      success: true,
      data: currencies,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '獲取幣別設定失敗',
    });
  }
});

// 新增或更新幣別設定
router.post('/currencies', async (req: AuthRequest, res) => {
  try {
    const { currency_code, currency_name, exchange_rate, is_default } = req.body;

    if (!currency_code || !currency_name) {
      return res.status(400).json({
        success: false,
        message: '請提供幣別代碼和名稱',
      });
    }

    // 如果設為預設，先取消其他幣別的預設狀態
    if (is_default) {
      await run(
        'UPDATE currency_settings SET is_default = 0 WHERE user_id = ?',
        [req.userId]
      );
    }

    // 檢查是否已存在
    const existing: any = await get<any>(
      'SELECT * FROM currency_settings WHERE user_id = ? AND currency_code = ?',
      [req.userId, currency_code]
    );

    if (existing) {
      await run(
        'UPDATE currency_settings SET currency_name = ?, exchange_rate = ?, is_default = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [currency_name, exchange_rate || 1.0, is_default ? 1 : 0, existing.id]
      );
    } else {
      await run(
        'INSERT INTO currency_settings (user_id, currency_code, currency_name, exchange_rate, is_default) VALUES (?, ?, ?, ?, ?)',
        [req.userId, currency_code, currency_name, exchange_rate || 1.0, is_default ? 1 : 0]
      );
    }

    res.json({
      success: true,
      message: '幣別設定更新成功',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '更新幣別設定失敗',
    });
  }
});

// 刪除幣別設定
router.delete('/currencies/:code', async (req: AuthRequest, res) => {
  try {
    const { code } = req.params;
    await run(
      'DELETE FROM currency_settings WHERE user_id = ? AND currency_code = ?',
      [req.userId, code]
    );

    res.json({
      success: true,
      message: '幣別設定刪除成功',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '刪除幣別設定失敗',
    });
  }
});

// 測試資料庫連接
router.get('/test-connection', async (req: AuthRequest, res) => {
  try {
    await get('SELECT 1');

    res.json({
      success: true,
      message: '資料庫連接正常',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: '未連接資料庫，請檢查',
    });
  }
});

// 更新股票資料（從台灣證券交易所 Open API 抓取）
router.post('/update-stock-data', async (req: AuthRequest, res) => {
  let listedCount = 0;
  let etfCount = 0;
  let otcCount = 0;
  let emergingCount = 0;
  const errors: string[] = [];

  try {
    // 使用台灣證券交易所 Open API 取得全部上市股票每日資料
    // 文件與實際欄位請參考 TWSE 官方說明，這裡僅使用 Code / Name 欄位做基本清單
    let response: Response;
    try {
      response = await fetch('https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL');
    } catch (fetchError: any) {
      return res.status(502).json({
        success: false,
        message: `無法連線到台灣證券交易所：${fetchError.message}`,
      });
    }

    if (!response.ok) {
      return res.status(502).json({
        success: false,
        message: `無法從台灣證券交易所取得資料（HTTP ${response.status}）`,
      });
    }

    let data: any[];
    try {
      data = (await response.json()) as any[];
    } catch (jsonError: any) {
      return res.status(500).json({
        success: false,
        message: `台灣證券交易所回傳資料解析失敗：${jsonError.message}`,
      });
    }

    if (!Array.isArray(data)) {
      return res.status(500).json({
        success: false,
        message: '台灣證券交易所回傳格式異常，預期為陣列',
      });
    }

    // 以交易所股票代碼作為唯一鍵，清空後重建（資料量不大）
    try {
      await run('DELETE FROM stock_data');
    } catch (deleteError: any) {
      return res.status(500).json({
        success: false,
        message: `清空股票資料表失敗：${deleteError.message}`,
      });
    }

    await run('BEGIN TRANSACTION');
    try {
      const insertSql = `
        INSERT INTO stock_data (stock_code, stock_name, market_type, etf_type, industry)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(stock_code) DO UPDATE SET
          stock_name = excluded.stock_name,
          market_type = excluded.market_type,
          etf_type = excluded.etf_type,
          industry = excluded.industry,
          updated_at = CURRENT_TIMESTAMP
      `;

      for (const item of data) {
        const code = item['Code'] || item['code'];
        const name: string | undefined = item['Name'] || item['name'];

        if (!code || !name) continue;

        // 由於此 API 為上市市場資料，先一律標註為「上市」
        const marketType = '上市';

        // 基本 ETF 判斷（名稱關鍵字），作為預設值
        let etfType: string | null = null;
        const upperName = name.toUpperCase();
        const isEtf =
          upperName.includes('ETF') ||
          upperName.includes('指數股票型基金') ||
          upperName.includes('交易型基金');

        if (isEtf) {
          if (name.includes('指數') || name.includes('指數型')) {
            etfType = '被動式ETF';
          } else {
            etfType = '主動式ETF';
          }
        }

        // 自動分類行業
        const industry = getIndustryCategory(name, code);

        await run(insertSql, [code, name, marketType, etfType, industry]);
        listedCount++;
      }

      await run('COMMIT');
      console.log(`成功匯入 ${listedCount} 筆上市股票資料`);
    } catch (e: any) {
      await run('ROLLBACK');
      return res.status(500).json({
        success: false,
        message: `匯入上市股票資料失敗：${e.message}`,
      });
    }

    // 透過 e添富 ETF JSON API 精準覆蓋 ETF 與主/被動類型
    try {
      const etfResponse = await fetch('https://www.twse.com.tw/zh/ETFortune/ajaxProductsResult');
      if (etfResponse.ok) {
        const etfJson: any = await etfResponse.json();
        if (etfJson && etfJson.status === 'success' && Array.isArray(etfJson.data)) {
          const etfData: any[] = etfJson.data;

          await run('BEGIN TRANSACTION');
          try {
            const insertEtfSql = `
              INSERT INTO stock_data (stock_code, stock_name, market_type, etf_type, industry)
              VALUES (?, ?, ?, ?, ?)
              ON CONFLICT(stock_code) DO UPDATE SET
                stock_name = excluded.stock_name,
                market_type = excluded.market_type,
                etf_type = excluded.etf_type,
                industry = excluded.industry,
                updated_at = CURRENT_TIMESTAMP
            `;

            for (const item of etfData) {
              const code: string | undefined = item.stockNo;
              const name: string | undefined = item.stockName;
              if (!code || !name) continue;

              const marketType = '上市';

              // 依名稱是否以「主動」開頭判斷主動 / 被動式 ETF
              let etfType: string | null = null;
              if (name.startsWith('主動')) {
                etfType = '主動式ETF';
              } else {
                etfType = '被動式ETF';
              }

              // 自動分類行業
              const industry = getIndustryCategory(name, code);

              await run(insertEtfSql, [code, name, marketType, etfType, industry]);
              etfCount++;
            }

            await run('COMMIT');
            console.log(`成功更新 ${etfCount} 筆 ETF 類型資料`);
          } catch (etfError: any) {
            await run('ROLLBACK');
            errors.push(`更新 ETF 類型失敗：${etfError.message}`);
            console.error('更新 ETF 類型失敗:', etfError);
          }
        } else {
          errors.push('e添富 ETF API 回傳格式異常');
        }
      } else {
        errors.push(`無法從 e添富 ETF API 取得資料（HTTP ${etfResponse.status}）`);
        console.error(
          `無法從 e添富 ETF API 取得資料（HTTP ${etfResponse.status}）`
        );
      }
    } catch (etfFetchError: any) {
      errors.push(`抓取 e添富 ETF JSON 失敗：${etfFetchError.message}`);
      console.error('抓取 e添富 ETF JSON 失敗:', etfFetchError);
    }

    // 嘗試從上櫃股票基本資料 CSV 匯入上櫃公司（market_type = '上櫃'）
    try {
      console.log('開始抓取上櫃股票 CSV...');
      
      // 使用 https 模組從 TWSE MOPS 開放資料抓取上櫃公司清單
      const csvText = await new Promise<string>((resolve, reject) => {
        const url = new URL('https://mopsfin.twse.com.tw/opendata/t187ap03_O.csv');
        const options = {
          hostname: url.hostname,
          path: url.pathname,
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/csv',
            'Accept-Encoding': 'gzip, deflate',
          },
        };

        const req = https.request(options, (res) => {
          console.log('上櫃 CSV HTTP 狀態:', res.statusCode, res.statusMessage);
          
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
            return;
          }

          let chunks: Buffer[] = [];
          let stream = res;

          // 處理 gzip 壓縮
          if (res.headers['content-encoding'] === 'gzip') {
            stream = res.pipe(zlib.createGunzip()) as any;
          } else if (res.headers['content-encoding'] === 'deflate') {
            stream = res.pipe(zlib.createInflate()) as any;
          }

          stream.on('data', (chunk: Buffer) => {
            chunks.push(chunk);
          });

          stream.on('end', () => {
            const buffer = Buffer.concat(chunks);
            // MOPS CSV 檔案使用 UTF-8 編碼（根據官方文件）
            const text = buffer.toString('utf-8');
            console.log('使用 UTF-8 編碼解碼上櫃 CSV');
            resolve(text);
          });

          stream.on('error', (err) => {
            reject(err);
          });
        });

        req.on('error', (err) => {
          reject(err);
        });

        req.end();
      });

      console.log('上櫃 CSV 前 500 字元:', csvText.substring(0, 500));
      
      if (csvText) {
        
        const lines = csvText
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => line.length > 0);

        console.log('上櫃 CSV 總行數:', lines.length);

        if (lines.length > 1) {
          // 改進 CSV 解析：處理引號包圍的欄位
          const parseCSVLine = (line: string): string[] => {
            const result: string[] = [];
            let current = '';
            let inQuotes = false;
            
            for (let i = 0; i < line.length; i++) {
              const char = line[i];
              if (char === '"') {
                inQuotes = !inQuotes;
              } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
              } else {
                current += char;
              }
            }
            result.push(current.trim());
            return result;
          };

          const headerLine = lines[0];
          const headers = parseCSVLine(headerLine).map((h) =>
            h.replace(/^"|"$/g, '').trim()
          );

          // 更寬鬆的欄位名稱匹配
          const codeIndex = headers.findIndex(
            (h) => h.includes('代號') || h.includes('Code') || h.includes('code') || h.includes('證券代號') || h.includes('公司代號')
          );
          const nameIndex = headers.findIndex(
            (h) => h.includes('名稱') || h.includes('Name') || h.includes('name') || h.includes('公司名稱') || h.includes('證券名稱')
          );

          console.log('上櫃 CSV 標題列:', headers);
          console.log('代號欄位索引:', codeIndex, '名稱欄位索引:', nameIndex);
          if (lines.length > 1) {
            console.log('上櫃 CSV 第一筆資料範例:', lines[1].substring(0, 200));
            // 測試解析第一筆資料
            const firstRowCols = parseCSVLine(lines[1]);
            console.log('第一筆資料解析後欄位數:', firstRowCols.length);
            if (codeIndex !== -1 && nameIndex !== -1) {
              console.log(`第一筆資料 - 代號欄位[${codeIndex}]:`, firstRowCols[codeIndex]);
              console.log(`第一筆資料 - 名稱欄位[${nameIndex}]:`, firstRowCols[nameIndex]);
            }
          }

          if (codeIndex !== -1 && nameIndex !== -1) {
            await run('BEGIN TRANSACTION');
            let insertedCount = 0;
            try {
              const insertOtcSql = `
                INSERT INTO stock_data (stock_code, stock_name, market_type, etf_type, industry)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(stock_code) DO UPDATE SET
                  stock_name = excluded.stock_name,
                  market_type = excluded.market_type,
                  etf_type = excluded.etf_type,
                  industry = excluded.industry,
                  updated_at = CURRENT_TIMESTAMP
              `;

              let skippedCount = 0;
              for (let i = 1; i < lines.length; i++) {
                const row = lines[i];
                if (!row) continue;

                const cols = parseCSVLine(row);
                if (cols.length <= Math.max(codeIndex, nameIndex)) {
                  skippedCount++;
                  continue;
                }
                const rawCode = cols[codeIndex];
                const rawName = cols[nameIndex];
                if (!rawCode || !rawName) {
                  skippedCount++;
                  continue;
                }

                // 去掉前綴 ="XXXX" 的格式與引號
                const code = rawCode.replace(/^="?|"?$/g, '').trim();
                const name = rawName.replace(/^="?|"?$/g, '').trim();

                // 驗證代號格式（上櫃通常是 3-6 位數字，放寬條件）
                if (!code || !name || code.length < 3 || code.length > 6 || !/^\d+$/.test(code)) {
                  if (i <= 5) {
                    console.log(`跳過第 ${i} 行: code="${code}", name="${name}", codeLen=${code?.length}`);
                  }
                  skippedCount++;
                  continue;
                }

                // 自動分類行業
                const industry = getIndustryCategory(name, code);
                await run(insertOtcSql, [code, name, '上櫃', null, industry]);
                otcCount++;
              }
              
              if (skippedCount > 0) {
                console.log(`跳過 ${skippedCount} 筆不符合條件的資料`);
              }

              await run('COMMIT');
              console.log(`成功匯入 ${otcCount} 筆上櫃股票資料`);
            } catch (otcError: any) {
              await run('ROLLBACK');
              errors.push(`匯入上櫃股票資料失敗：${otcError.message}`);
              console.error('匯入上櫃股票資料失敗:', otcError);
            }
          } else {
            const errorMsg = '上櫃股票 CSV 標題列中找不到代號或名稱欄位';
            errors.push(errorMsg);
            console.error(errorMsg);
            console.error('找到的欄位:', headers);
            console.error('CSV 第一行內容:', lines[0]);
          }
        } else {
          const errorMsg = `上櫃股票 CSV 內容不足（行數 < 2），實際行數: ${lines.length}`;
          errors.push(errorMsg);
          console.error(errorMsg);
          if (lines.length > 0) {
            console.error('CSV 第一行內容:', lines[0]);
          }
        }
      } else {
        const errorMsg = '上櫃股票 CSV 內容為空';
        errors.push(errorMsg);
        console.error(errorMsg);
      }
    } catch (otcFetchError: any) {
      const errorMsg = `抓取上櫃股票基本資料 CSV 失敗：${otcFetchError.message}`;
      errors.push(errorMsg);
      console.error('抓取上櫃股票基本資料 CSV 失敗:', otcFetchError);
      if (otcFetchError.stack) {
        console.error('錯誤堆疊:', otcFetchError.stack);
      }
    }

    // 嘗試從興櫃股票基本資料 CSV 匯入興櫃公司（market_type = '興櫃'）
    try {
      console.log('開始抓取興櫃股票 CSV...');
      
      // 使用 https 模組從 TWSE MOPS 開放資料抓取興櫃公司清單
      const csvText = await new Promise<string>((resolve, reject) => {
        const url = new URL('https://mopsfin.twse.com.tw/opendata/t187ap03_R.csv');
        const options = {
          hostname: url.hostname,
          path: url.pathname,
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/csv',
            'Accept-Encoding': 'gzip, deflate',
          },
        };

        const req = https.request(options, (res) => {
          console.log('興櫃 CSV HTTP 狀態:', res.statusCode, res.statusMessage);
          
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
            return;
          }

          let chunks: Buffer[] = [];
          let stream = res;

          // 處理 gzip 壓縮
          if (res.headers['content-encoding'] === 'gzip') {
            stream = res.pipe(zlib.createGunzip()) as any;
          } else if (res.headers['content-encoding'] === 'deflate') {
            stream = res.pipe(zlib.createInflate()) as any;
          }

          stream.on('data', (chunk: Buffer) => {
            chunks.push(chunk);
          });

          stream.on('end', () => {
            const buffer = Buffer.concat(chunks);
            // MOPS CSV 檔案使用 UTF-8 編碼（根據官方文件）
            const text = buffer.toString('utf-8');
            console.log('使用 UTF-8 編碼解碼興櫃 CSV');
            resolve(text);
          });

          stream.on('error', (err) => {
            reject(err);
          });
        });

        req.on('error', (err) => {
          reject(err);
        });

        req.end();
      });

      if (csvText) {
        const lines = csvText
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => line.length > 0);

        console.log('興櫃 CSV 總行數:', lines.length);

        if (lines.length > 1) {
          // 改進 CSV 解析：處理引號包圍的欄位
          const parseCSVLine = (line: string): string[] => {
            const result: string[] = [];
            let current = '';
            let inQuotes = false;
            
            for (let i = 0; i < line.length; i++) {
              const char = line[i];
              if (char === '"') {
                inQuotes = !inQuotes;
              } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
              } else {
                current += char;
              }
            }
            result.push(current.trim());
            return result;
          };

          const headerLine = lines[0];
          const headers = parseCSVLine(headerLine).map((h) =>
            h.replace(/^"|"$/g, '').trim()
          );

          // 更寬鬆的欄位名稱匹配
          const codeIndex = headers.findIndex(
            (h) => h.includes('代號') || h.includes('Code') || h.includes('code') || h.includes('證券代號') || h.includes('公司代號')
          );
          const nameIndex = headers.findIndex(
            (h) => h.includes('名稱') || h.includes('Name') || h.includes('name') || h.includes('公司名稱') || h.includes('證券名稱')
          );

          console.log('興櫃 CSV 標題列:', headers);
          console.log('代號欄位索引:', codeIndex, '名稱欄位索引:', nameIndex);

          if (codeIndex !== -1 && nameIndex !== -1) {
            await run('BEGIN TRANSACTION');
            try {
              const insertEmergingSql = `
                INSERT INTO stock_data (stock_code, stock_name, market_type, etf_type)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(stock_code) DO UPDATE SET
                  stock_name = excluded.stock_name,
                  market_type = excluded.market_type,
                  updated_at = CURRENT_TIMESTAMP
              `;

              let skippedCount = 0;
              for (let i = 1; i < lines.length; i++) {
                const row = lines[i];
                if (!row) continue;

                const cols = parseCSVLine(row);
                if (cols.length <= Math.max(codeIndex, nameIndex)) {
                  skippedCount++;
                  continue;
                }
                const rawCode = cols[codeIndex];
                const rawName = cols[nameIndex];
                if (!rawCode || !rawName) {
                  skippedCount++;
                  continue;
                }

                // 去掉前綴 ="XXXX" 的格式與引號
                const code = rawCode.replace(/^="?|"?$/g, '').trim();
                const name = rawName.replace(/^="?|"?$/g, '').trim();

                // 驗證代號格式（興櫃通常是 3-6 位數字，放寬條件）
                if (!code || !name || code.length < 3 || code.length > 6 || !/^\d+$/.test(code)) {
                  skippedCount++;
                  continue;
                }

                await run(insertEmergingSql, [code, name, '興櫃', null]);
                emergingCount++;
              }
              
              if (skippedCount > 0) {
                console.log(`跳過 ${skippedCount} 筆不符合條件的興櫃資料`);
              }

              await run('COMMIT');
              console.log(`成功匯入 ${emergingCount} 筆興櫃股票資料`);
            } catch (emergingError: any) {
              await run('ROLLBACK');
              errors.push(`匯入興櫃股票資料失敗：${emergingError.message}`);
              console.error('匯入興櫃股票資料失敗:', emergingError);
            }
          } else {
            const errorMsg = '興櫃股票 CSV 標題列中找不到代號或名稱欄位';
            errors.push(errorMsg);
            console.error(errorMsg);
            console.error('找到的欄位:', headers);
          }
        } else {
          const errorMsg = `興櫃股票 CSV 內容不足（行數 < 2），實際行數: ${lines.length}`;
          errors.push(errorMsg);
          console.error(errorMsg);
        }
      } else {
        const errorMsg = '興櫃股票 CSV 內容為空';
        errors.push(errorMsg);
        console.error(errorMsg);
      }
    } catch (emergingFetchError: any) {
      const errorMsg = `抓取興櫃股票基本資料 CSV 失敗：${emergingFetchError.message}`;
      errors.push(errorMsg);
      console.error('抓取興櫃股票基本資料 CSV 失敗:', emergingFetchError);
      if (emergingFetchError.stack) {
        console.error('錯誤堆疊:', emergingFetchError.stack);
      }
    }

    // 組合回應訊息
    let message = `已成功更新股票資料：上市 ${listedCount} 筆`;
    if (etfCount > 0) {
      message += `，ETF ${etfCount} 筆`;
    }
    if (otcCount > 0) {
      message += `，上櫃 ${otcCount} 筆`;
    }
    if (emergingCount > 0) {
      message += `，興櫃 ${emergingCount} 筆`;
    }
    if (errors.length > 0) {
      message += `。部分資料更新失敗：${errors.join('；')}`;
    }

    res.json({
      success: true,
      message,
    });
  } catch (error: any) {
    console.error('更新股票資料發生未預期錯誤:', error);
    res.status(500).json({
      success: false,
      message: error.message || '更新股票資料失敗',
    });
  }
});

// 股票資料統計
router.get('/stock-stats', async (req: AuthRequest, res) => {
  try {
    const listed = await get<any>('SELECT COUNT(*) as count FROM stock_data WHERE market_type = ?', ['上市']);
    const otc = await get<any>('SELECT COUNT(*) as count FROM stock_data WHERE market_type = ?', ['上櫃']);
    const emerging = await get<any>('SELECT COUNT(*) as count FROM stock_data WHERE market_type = ?', ['興櫃']);
    const etf = await get<any>('SELECT COUNT(*) as count FROM stock_data WHERE etf_type IS NOT NULL', []);
    const activeEtf = await get<any>('SELECT COUNT(*) as count FROM stock_data WHERE etf_type = ?', ['主動式ETF']);
    const passiveEtf = await get<any>('SELECT COUNT(*) as count FROM stock_data WHERE etf_type = ?', ['被動式ETF']);

    res.json({
      success: true,
      data: {
        listed: listed?.count || 0,
        otc: otc?.count || 0,
        emerging: emerging?.count || 0,
        etf: etf?.count || 0,
        activeEtf: activeEtf?.count || 0,
        passiveEtf: passiveEtf?.count || 0,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '獲取股票資料統計失敗',
    });
  }
});

// 更新用戶密碼
router.put('/password', async (req: AuthRequest, res) => {
  try {
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 8 || newPassword.length > 12) {
      return res.status(400).json({
        success: false,
        message: '密碼長度必須在 8-12 位之間',
      });
    }

    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await run(
      'UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [hashedPassword, req.userId]
    );

    res.json({
      success: true,
      message: '密碼更新成功',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '更新密碼失敗',
    });
  }
});

// 更新用戶郵箱
router.put('/email', async (req: AuthRequest, res) => {
  try {
    const { newEmail } = req.body;

    if (!newEmail) {
      return res.status(400).json({
        success: false,
        message: '請提供新郵箱',
      });
    }

    // 檢查郵箱是否已被使用
    const existing: any = await get<any>('SELECT * FROM users WHERE email = ? AND id != ?', [newEmail, req.userId]);
    if (existing) {
      return res.status(400).json({
        success: false,
        message: '該郵箱已被使用',
      });
    }

    await run(
      'UPDATE users SET email = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newEmail, req.userId]
    );

    res.json({
      success: true,
      message: '郵箱更新成功',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '更新郵箱失敗',
    });
  }
});

// 獲取管理員帳號資訊（僅管理員）
router.get('/admin-account', async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: '需要管理員權限',
      });
    }

    // 獲取所有管理員帳號
    const admins = await all<any>('SELECT id, email, username, role, created_at FROM users WHERE role = ?', ['admin']);

    res.json({
      success: true,
      data: admins,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '獲取管理員帳號失敗',
    });
  }
});

// 更新管理員帳號和密碼（僅管理員）
router.put('/admin-account', async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: '需要管理員權限',
      });
    }

    const { adminId, newEmail, newPassword, newUsername } = req.body;

    if (!adminId) {
      return res.status(400).json({
        success: false,
        message: '請提供管理員ID',
      });
    }

    // 驗證管理員是否存在
    const admin: any = await get<any>('SELECT * FROM users WHERE id = ? AND role = ?', [adminId, 'admin']);
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: '找不到該管理員帳號',
      });
    }

    const bcrypt = require('bcryptjs');
    const updates: string[] = [];
    const params: any[] = [];

    // 更新郵箱
    if (newEmail && newEmail !== admin.email) {
      // 檢查郵箱是否已被使用
      const existing: any = await get<any>('SELECT * FROM users WHERE email = ? AND id != ?', [newEmail, adminId]);
      if (existing) {
        return res.status(400).json({
          success: false,
          message: '該郵箱已被使用',
        });
      }
      updates.push('email = ?');
      params.push(newEmail);
    }

    // 更新密碼
    if (newPassword) {
      if (newPassword.length < 8 || newPassword.length > 12) {
        return res.status(400).json({
          success: false,
          message: '密碼長度必須在 8-12 位之間',
        });
      }
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      updates.push('password = ?');
      params.push(hashedPassword);
    }

    // 更新用戶名
    if (newUsername !== undefined) {
      updates.push('username = ?');
      params.push(newUsername || admin.email);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: '請提供要更新的資訊',
      });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(adminId);

    await run(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    res.json({
      success: true,
      message: '管理員帳號更新成功',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '更新管理員帳號失敗',
    });
  }
});

// 獲取即時匯率
router.get('/exchange-rates', async (req: AuthRequest, res) => {
  try {
    // 使用 exchangerate-api.com 的免費版本（以 TWD 為基準）
    // 注意：免費版本有請求限制，建議使用 API key 或改用其他服務
    const baseCurrency = 'TWD';
    const targetCurrencies = ['TWD', 'CNY', 'USD', 'JPY'];
    
    // 使用免費的匯率 API（exchangerate-api.com 免費版）
    // 如果沒有 API key，可以使用其他免費服務
    const response = await fetch(`https://api.exchangerate-api.com/v4/latest/${baseCurrency}`);
    
    if (!response.ok) {
      throw new Error(`匯率 API 請求失敗：${response.status}`);
    }

    const data: any = await response.json();
    const rates = data.rates || {};

    // 計算各幣別對台幣的匯率（1 TWD = ? 其他幣別）
    const exchangeRates: Record<string, number> = {};
    
    // TWD 對 TWD = 1
    exchangeRates['TWD'] = 1;
    
    // 其他幣別：從 API 獲取的匯率是 1 TWD = X 其他幣別
    // 但我們需要顯示 1 其他幣別 = ? TWD，所以需要取倒數
    if (rates['CNY']) {
      exchangeRates['CNY'] = 1 / rates['CNY']; // 1 CNY = ? TWD
    }
    if (rates['USD']) {
      exchangeRates['USD'] = 1 / rates['USD']; // 1 USD = ? TWD
    }
    if (rates['JPY']) {
      exchangeRates['JPY'] = 1 / rates['JPY']; // 1 JPY = ? TWD
    }

    res.json({
      success: true,
      data: {
        TWD: exchangeRates['TWD'] || 1,
        CNY: exchangeRates['CNY'] || null,
        USD: exchangeRates['USD'] || null,
        JPY: exchangeRates['JPY'] || null,
        lastUpdated: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('獲取匯率失敗:', error);
    // 如果 API 失敗，返回預設值或錯誤訊息
    res.status(500).json({
      success: false,
      message: error.message || '獲取匯率失敗',
      data: {
        TWD: 1,
        CNY: null,
        USD: null,
        JPY: null,
        lastUpdated: null,
      },
    });
  }
});

export default router;



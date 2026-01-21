import express from 'express';
import { getDatabase } from '../database';
import { authenticate, AuthRequest } from '../middleware/auth';
import { promisify } from 'util';

const router = express.Router();

router.use(authenticate);

// 獲取所有交割記錄
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { bankAccountId, startDate, endDate, status } = req.query;
    const db = getDatabase();
    const all = promisify(db.all.bind(db)) as (sql: string, params: any[]) => Promise<any[]>;

    let query = `SELECT s.*, ba.bank_name, ba.account_number, sa.account_name as securities_account_name, sa.account_number as securities_account_number, t.stock_code, t.stock_name 
                 FROM settlements s 
                 LEFT JOIN bank_accounts ba ON s.bank_account_id = ba.id 
                 LEFT JOIN securities_accounts sa ON ba.securities_account_id = sa.id 
                 LEFT JOIN transactions t ON s.transaction_id = t.id 
                 WHERE s.user_id = ?`;
    const params: any[] = [req.userId];

    if (bankAccountId) {
      query += ' AND s.bank_account_id = ?';
      params.push(bankAccountId);
    }
    if (startDate) {
      query += ' AND s.settlement_date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND s.settlement_date <= ?';
      params.push(endDate);
    }
    if (status) {
      query += ' AND s.status = ?';
      params.push(status);
    }

    query += ' ORDER BY s.settlement_date DESC, s.created_at DESC';

    const settlements: any[] = await all(query, params);

    // 計算統計
    const pendingAmount = settlements
      .filter((s: any) => s.status === '未交割')
      .reduce((sum: number, s: any) => sum + (s.settlement_amount || 0), 0);

    const completedAmount = settlements
      .filter((s: any) => s.status === '已交割')
      .reduce((sum: number, s: any) => sum + (s.settlement_amount || 0), 0);

    res.json({
      success: true,
      data: settlements,
      stats: {
        pendingAmount,
        completedAmount,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '獲取交割記錄失敗',
    });
  }
});

// 新增交割記錄
router.post('/', async (req: AuthRequest, res) => {
  try {
    const {
      transaction_ids,
      bank_account_id,
      settlement_date,
      trade_date,
      settlement_amount,
      twd_amount,
      status = '未交割',
      notes,
      skipAutoBankTransaction,
    } = req.body;

    if (!bank_account_id || !settlement_date || !settlement_amount) {
      return res.status(400).json({
        success: false,
        message: '請填寫銀行帳戶、交割日期和交割金額',
      });
    }

    const db = getDatabase();
    const insertSettlement = (sql: string, params: any[]) =>
      new Promise<number>((resolve, reject) => {
        db.run(sql, params, function (err) {
          if (err) {
            reject(err);
          } else {
            resolve(this.lastID);
          }
        });
      });

    // 將 transaction_ids 數組轉換為 JSON 字符串
    const transactionIdsJson = transaction_ids && Array.isArray(transaction_ids) && transaction_ids.length > 0
      ? JSON.stringify(transaction_ids)
      : null;

    const newSettlementId = await insertSettlement(
      'INSERT INTO settlements (user_id, transaction_id, transaction_ids, bank_account_id, settlement_date, trade_date, settlement_amount, twd_amount, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [req.userId, null, transactionIdsJson, bank_account_id, settlement_date, trade_date || null, settlement_amount, twd_amount || null, status, notes || null]
    );

    // 已移除自動創建銀行明細功能

    res.status(201).json({
      success: true,
      message: '交割記錄新增成功',
      data: {
        id: newSettlementId,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '新增交割記錄失敗',
    });
  }
});

// 更新交割記錄
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { transaction_ids, bank_account_id, settlement_date, trade_date, settlement_amount, twd_amount, status, notes } = req.body;

    const db = getDatabase();
    const get = promisify(db.get.bind(db)) as (sql: string, params: any[]) => Promise<any>;
    const run = promisify(db.run.bind(db)) as (sql: string, params?: any[]) => Promise<void>;

    const settlement: any = await get(
      'SELECT * FROM settlements WHERE id = ? AND user_id = ?',
      [id, req.userId]
    );

    if (!settlement) {
      return res.status(404).json({
        success: false,
        message: '交割記錄不存在',
      });
    }

    // 將 transaction_ids 數組轉換為 JSON 字符串
    const transactionIdsJson = transaction_ids && Array.isArray(transaction_ids) && transaction_ids.length > 0
      ? JSON.stringify(transaction_ids)
      : null;

    await run(
      'UPDATE settlements SET transaction_id = ?, transaction_ids = ?, bank_account_id = ?, settlement_date = ?, trade_date = ?, settlement_amount = ?, twd_amount = ?, status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
      [null, transactionIdsJson, bank_account_id, settlement_date, trade_date || null, settlement_amount, twd_amount || null, status, notes || null, id, req.userId]
    );

    // 已移除自動創建銀行明細功能

    res.json({
      success: true,
      message: '交割記錄更新成功',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '更新交割記錄失敗',
    });
  }
});

// 刪除交割記錄
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    const get = promisify(db.get.bind(db)) as (sql: string, params: any[]) => Promise<any>;
    const run = promisify(db.run.bind(db)) as (sql: string, params: any[]) => Promise<void>;

    const settlement: any = await get(
      'SELECT * FROM settlements WHERE id = ? AND user_id = ?',
      [id, req.userId]
    );

    if (!settlement) {
      return res.status(404).json({
        success: false,
        message: '交割記錄不存在',
      });
    }

    // 如果有對應的自動銀行明細，先還原餘額並刪除
    const all = promisify(db.all.bind(db)) as (sql: string, params: any[]) => Promise<any[]>;
    
    // 先查找舊的單筆合併明細
    const autoDescription = `交割自動入帳-${id}`;
    const existingBankTx: any = await get(
      'SELECT * FROM bank_transactions WHERE user_id = ? AND bank_account_id = ? AND transaction_date = ? AND description = ?',
      [req.userId, settlement.bank_account_id, settlement.settlement_date, autoDescription]
    );

    if (existingBankTx) {
      const account: any = await get(
        'SELECT balance FROM bank_accounts WHERE id = ? AND user_id = ?',
        [settlement.bank_account_id, req.userId]
      );

      if (account) {
        const deposit = existingBankTx.deposit_amount || 0;
        const withdrawal = existingBankTx.withdrawal_amount || 0;
        const newBalance = (account.balance || 0) - deposit + withdrawal;
        await run(
          'UPDATE bank_accounts SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
          [newBalance, settlement.bank_account_id, req.userId]
        );
      }

      await run(
        'DELETE FROM bank_transactions WHERE id = ? AND user_id = ?',
        [existingBankTx.id, req.userId]
      );
    } else {
      // 如果沒有找到單筆合併明細，可能是有多筆明細，需要根據 transaction_ids 查找
      let transactionIds: number[] = [];
      if (settlement.transaction_ids) {
        try {
          transactionIds = JSON.parse(settlement.transaction_ids);
        } catch (e) {
          console.error('解析 transaction_ids 失敗:', e);
        }
      }

      if (transactionIds.length > 0) {
        // 查找所有相關的銀行明細（通過匹配交易類型和股票代碼）
        const transactions = await all(
          `SELECT id, stock_code, stock_name, transaction_type FROM transactions 
           WHERE id IN (${transactionIds.map(() => '?').join(',')}) AND user_id = ?`,
          [...transactionIds, req.userId]
        );

        let totalDeposit = 0;
        let totalWithdrawal = 0;

        for (const trans of transactions) {
          const description = trans.stock_name || '';
          const relatedBankTx: any = await get(
            'SELECT * FROM bank_transactions WHERE user_id = ? AND bank_account_id = ? AND transaction_date = ? AND description = ?',
            [req.userId, settlement.bank_account_id, settlement.settlement_date, description]
          );

          if (relatedBankTx) {
            totalDeposit += relatedBankTx.deposit_amount || 0;
            totalWithdrawal += relatedBankTx.withdrawal_amount || 0;
            await run(
              'DELETE FROM bank_transactions WHERE id = ? AND user_id = ?',
              [relatedBankTx.id, req.userId]
            );
          }
        }

        // 還原帳戶餘額
        if (totalDeposit > 0 || totalWithdrawal > 0) {
          const account: any = await get(
            'SELECT balance FROM bank_accounts WHERE id = ? AND user_id = ?',
            [settlement.bank_account_id, req.userId]
          );
          if (account) {
            const newBalance = (account.balance || 0) - totalDeposit + totalWithdrawal;
            await run(
              'UPDATE bank_accounts SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
              [newBalance, settlement.bank_account_id, req.userId]
            );
          }
        }
      }
    }

    await run('DELETE FROM settlements WHERE id = ? AND user_id = ?', [id, req.userId]);

    res.json({
      success: true,
      message: '交割記錄刪除成功',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '刪除交割記錄失敗',
    });
  }
});

export default router;



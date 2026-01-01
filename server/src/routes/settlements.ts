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

    let query = `SELECT s.*, ba.bank_name, ba.account_number, t.stock_code, t.stock_name 
                 FROM settlements s 
                 LEFT JOIN bank_accounts ba ON s.bank_account_id = ba.id 
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

    // 如果狀態為「已交割」，自動產生對應的銀行明細並更新銀行餘額
    if (status === '已交割') {
      const run = promisify(db.run.bind(db)) as (sql: string, params?: any[]) => Promise<void>;
      const get = promisify(db.get.bind(db)) as (sql: string, params: any[]) => Promise<any>;

      const deposit =
        typeof settlement_amount === 'number' && settlement_amount < 0
          ? Math.abs(settlement_amount)
          : 0;
      const withdrawal =
        typeof settlement_amount === 'number' && settlement_amount > 0
          ? settlement_amount
          : 0;

      const description = `交割自動入帳-${newSettlementId}`;

      await run(
        `INSERT INTO bank_transactions (user_id, bank_account_id, transaction_date, description, deposit_amount, withdrawal_amount)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          req.userId,
          bank_account_id,
          settlement_date,
          description,
          deposit,
          withdrawal,
        ]
      );

      const account: any = await get(
        'SELECT balance FROM bank_accounts WHERE id = ? AND user_id = ?',
        [bank_account_id, req.userId]
      );

      if (account) {
        const newBalance = (account.balance || 0) + deposit - withdrawal;
        await run(
          'UPDATE bank_accounts SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
          [newBalance, bank_account_id, req.userId]
        );
      }
    }

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

    // 自動同步銀行明細與餘額
    // 1. 還原舊的自動銀行明細（如果存在）
    const autoDescription = `交割自動入帳-${id}`;
    const existingBankTx: any = await get(
      'SELECT * FROM bank_transactions WHERE user_id = ? AND bank_account_id = ? AND transaction_date = ? AND description = ?',
      [req.userId, settlement.bank_account_id, settlement.settlement_date, autoDescription]
    );

    if (existingBankTx) {
      // 還原舊帳戶餘額
      const oldAccount: any = await get(
        'SELECT balance FROM bank_accounts WHERE id = ? AND user_id = ?',
        [settlement.bank_account_id, req.userId]
      );
      if (oldAccount) {
        const oldDeposit = existingBankTx.deposit_amount || 0;
        const oldWithdrawal = existingBankTx.withdrawal_amount || 0;
        const restoredBalance = (oldAccount.balance || 0) - oldDeposit + oldWithdrawal;
        await run(
          'UPDATE bank_accounts SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
          [restoredBalance, settlement.bank_account_id, req.userId]
        );
      }

      // 刪除舊的自動銀行明細
      await run(
        'DELETE FROM bank_transactions WHERE id = ? AND user_id = ?',
        [existingBankTx.id, req.userId]
      );
    }

    // 2. 若新狀態為「已交割」，建立新的自動銀行明細
    if (status === '已交割') {
      const deposit =
        typeof settlement_amount === 'number' && settlement_amount < 0
          ? Math.abs(settlement_amount)
          : 0;
      const withdrawal =
        typeof settlement_amount === 'number' && settlement_amount > 0
          ? settlement_amount
          : 0;

      await run(
        `INSERT INTO bank_transactions (user_id, bank_account_id, transaction_date, description, deposit_amount, withdrawal_amount)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          req.userId,
          bank_account_id,
          settlement_date,
          autoDescription,
          deposit,
          withdrawal,
        ]
      );

      const newAccount: any = await get(
        'SELECT balance FROM bank_accounts WHERE id = ? AND user_id = ?',
        [bank_account_id, req.userId]
      );
      if (newAccount) {
        const newBalance = (newAccount.balance || 0) + deposit - withdrawal;
        await run(
          'UPDATE bank_accounts SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
          [newBalance, bank_account_id, req.userId]
        );
      }
    }

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



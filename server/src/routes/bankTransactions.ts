import express from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { all, get, run } from '../database';

const router = express.Router();

// 所有路由都需要認證
router.use(authenticate);

// 獲取所有銀行明細
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { bankAccountId, startDate, endDate } = req.query;
    let query = `SELECT bt.*, ba.bank_name, ba.account_number, ba.account_type
                 FROM bank_transactions bt 
                 LEFT JOIN bank_accounts ba ON bt.bank_account_id = ba.id 
                 WHERE bt.user_id = ?`;
    const params: any[] = [req.userId];

    if (bankAccountId) {
      query += ' AND bt.bank_account_id = ?';
      params.push(bankAccountId);
    }
    if (startDate) {
      query += ' AND bt.transaction_date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND bt.transaction_date <= ?';
      params.push(endDate);
    }

    query += ' ORDER BY bt.transaction_date DESC, bt.created_at DESC';

    const transactions = await all<any>(query, params);

    res.json({
      success: true,
      data: transactions,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '獲取銀行明細失敗',
    });
  }
});

// 獲取單個銀行明細
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const transaction: any = await get<any>(
      'SELECT bt.*, ba.bank_name, ba.account_number FROM bank_transactions bt LEFT JOIN bank_accounts ba ON bt.bank_account_id = ba.id WHERE bt.id = ? AND bt.user_id = ?',
      [id, req.userId]
    );

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: '銀行明細不存在',
      });
    }

    res.json({
      success: true,
      data: transaction,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '獲取銀行明細失敗',
    });
  }
});

// 新增銀行明細
router.post('/', async (req: AuthRequest, res) => {
  try {
    const { bank_account_id, transaction_date, description, transaction_category, deposit_amount, withdrawal_amount } = req.body;

    if (!bank_account_id || !transaction_date) {
      return res.status(400).json({
        success: false,
        message: '銀行帳戶和帳務日期為必填項',
      });
    }


    const deposit = deposit_amount || 0;
    const withdrawal = withdrawal_amount || 0;

    // 插入銀行明細
    await run(
      `INSERT INTO bank_transactions (user_id, bank_account_id, transaction_date, description, transaction_category, deposit_amount, withdrawal_amount)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        req.userId,
        bank_account_id,
        transaction_date,
        description || null,
        transaction_category || null,
        deposit,
        withdrawal,
      ]
    );

    // 更新銀行帳戶餘額
    const account: any = await get<any>(
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

    res.json({
      success: true,
      message: '新增銀行明細成功',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '新增銀行明細失敗',
    });
  }
});

// 更新銀行明細
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { bank_account_id, transaction_date, description, transaction_category, deposit_amount, withdrawal_amount } = req.body;

    // 獲取舊記錄
    const existing: any = await get<any>(
      'SELECT id, bank_account_id, deposit_amount, withdrawal_amount FROM bank_transactions WHERE id = ? AND user_id = ?',
      [id, req.userId]
    );

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: '銀行明細不存在',
      });
    }

    const oldDeposit = existing.deposit_amount || 0;
    const oldWithdrawal = existing.withdrawal_amount || 0;
    const newDeposit = deposit_amount || 0;
    const newWithdrawal = withdrawal_amount || 0;

    // 計算餘額變更（如果銀行帳戶變更了，需要處理兩個帳戶）
    const balanceChange = (newDeposit - oldDeposit) - (newWithdrawal - oldWithdrawal);

    // 如果銀行帳戶變更了，需要還原舊帳戶的餘額並更新新帳戶的餘額
    if (existing.bank_account_id !== bank_account_id) {
      // 還原舊帳戶餘額
      const oldAccount: any = await get<any>(
        'SELECT balance FROM bank_accounts WHERE id = ? AND user_id = ?',
        [existing.bank_account_id, req.userId]
      );
      if (oldAccount) {
        const oldBalance = (oldAccount.balance || 0) - oldDeposit + oldWithdrawal;
        await run(
          'UPDATE bank_accounts SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
          [oldBalance, existing.bank_account_id, req.userId]
        );
      }

      // 更新新帳戶餘額
      const newAccount: any = await get<any>(
        'SELECT balance FROM bank_accounts WHERE id = ? AND user_id = ?',
        [bank_account_id, req.userId]
      );
      if (newAccount) {
        const newBalance = (newAccount.balance || 0) + newDeposit - newWithdrawal;
        await run(
          'UPDATE bank_accounts SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
          [newBalance, bank_account_id, req.userId]
        );
      }
    } else {
      // 銀行帳戶未變更，直接更新餘額
      const account: any = await get<any>(
        'SELECT balance FROM bank_accounts WHERE id = ? AND user_id = ?',
        [bank_account_id, req.userId]
      );
      if (account) {
        const newBalance = (account.balance || 0) + balanceChange;
        await run(
          'UPDATE bank_accounts SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
          [newBalance, bank_account_id, req.userId]
        );
      }
    }

    // 更新銀行明細
    await run(
      `UPDATE bank_transactions 
       SET bank_account_id = ?, transaction_date = ?, description = ?, transaction_category = ?, deposit_amount = ?, withdrawal_amount = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?`,
      [
        bank_account_id,
        transaction_date,
        description || null,
        transaction_category || null,
        newDeposit,
        newWithdrawal,
        id,
        req.userId,
      ]
    );

    res.json({
      success: true,
      message: '更新銀行明細成功',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '更新銀行明細失敗',
    });
  }
});

// 刪除銀行明細
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    // 獲取要刪除的記錄
    const existing: any = await get<any>(
      'SELECT id, bank_account_id, deposit_amount, withdrawal_amount FROM bank_transactions WHERE id = ? AND user_id = ?',
      [id, req.userId]
    );

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: '銀行明細不存在',
      });
    }

    // 還原銀行帳戶餘額
    const account: any = await get<any>(
      'SELECT balance FROM bank_accounts WHERE id = ? AND user_id = ?',
      [existing.bank_account_id, req.userId]
    );

    if (account) {
      const deposit = existing.deposit_amount || 0;
      const withdrawal = existing.withdrawal_amount || 0;
      const newBalance = (account.balance || 0) - deposit + withdrawal;
      await run(
        'UPDATE bank_accounts SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
        [newBalance, existing.bank_account_id, req.userId]
      );
    }

    // 刪除銀行明細
    await run('DELETE FROM bank_transactions WHERE id = ? AND user_id = ?', [id, req.userId]);

    res.json({
      success: true,
      message: '刪除銀行明細成功',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '刪除銀行明細失敗',
    });
  }
});

export default router;


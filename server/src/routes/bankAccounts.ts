import express from 'express';
import { all, get, run } from '../database';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = express.Router();

router.use(authenticate);

// 獲取所有銀行帳戶
router.get('/', async (req: AuthRequest, res) => {
  try {
    const accounts = await all<any>(
      `SELECT ba.*, sa.account_name as securities_account_name, sa.broker_name 
       FROM bank_accounts ba 
       LEFT JOIN securities_accounts sa ON ba.securities_account_id = sa.id 
       WHERE ba.user_id = ? 
       ORDER BY ba.created_at DESC`,
      [req.userId]
    );

    // 計算每個帳戶的可用餘額
    const accountsWithAvailableBalance = await Promise.all(
      accounts.map(async (account: any) => {
        // 現金餘額
        const cashBalance = account.balance || 0;

        // 獲取該帳戶下所有未交割的交割記錄
        const pendingSettlements = await all<any>(
          `SELECT s.settlement_amount 
           FROM settlements s 
           WHERE s.user_id = ? AND s.bank_account_id = ? AND s.status = '未交割'`,
          [req.userId, account.id]
        );

        // settlement_amount 的符號與畫面顯示一致：
        // - 正數：表示金額會增加（例如會收到款項）
        // - 負數：表示金額會減少（例如要支付款項）
        // 因此邏輯應該是「直接與銀行餘額相加」：
        //   可用餘額 ≈ 銀行餘額 + 所有未交割的交割金額（正數加、負數減）
        const totalPendingAmount = pendingSettlements.reduce((sum: number, s: any) => sum + (s.settlement_amount || 0), 0);

        // 目前系統中沒有委買凍結的概念，暫時設為 0
        const orderFreezeAmount = 0; // 委買凍結（暫為 0）

        // 可用餘額 = 現金餘額 + 未交割金額總和 - 委買凍結
        // 這樣：
        // - 交割金額為正數時：加上去，可用餘額變大
        // - 交割金額為負數時：減掉該金額，可用餘額變小
        const availableBalance = cashBalance + totalPendingAmount - orderFreezeAmount;

        return {
          ...account,
          available_balance: availableBalance,
        };
      })
    );

    res.json({
      success: true,
      data: accountsWithAvailableBalance,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '獲取銀行帳戶失敗',
    });
  }
});

// 新增銀行帳戶
router.post('/', async (req: AuthRequest, res) => {
  try {
    const {
      securities_account_id,
      bank_name,
      account_number,
      account_type = '儲蓄帳戶',
      balance = 0,
      available_balance = 0,
      currency = 'TWD',
    } = req.body;

    if (!bank_name || !account_number) {
      return res.status(400).json({
        success: false,
        message: '請填寫銀行名稱和帳號',
      });
    }

    const result = await run(
      'INSERT INTO bank_accounts (user_id, securities_account_id, bank_name, account_number, account_type, balance, available_balance, currency) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [req.userId, securities_account_id || null, bank_name, account_number, account_type, balance, available_balance, currency]
    );
    const newBankAccountId = result.lastID;

    res.status(201).json({
      success: true,
      message: '銀行帳戶新增成功',
      data: {
        id: newBankAccountId,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '新增銀行帳戶失敗',
    });
  }
});

// 更新銀行帳戶
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { securities_account_id, bank_name, account_number, account_type, balance, available_balance, currency } = req.body;

    const account: any = await get<any>(
      'SELECT * FROM bank_accounts WHERE id = ? AND user_id = ?',
      [id, req.userId]
    );

    if (!account) {
      return res.status(404).json({
        success: false,
        message: '銀行帳戶不存在',
      });
    }

    await run(
      'UPDATE bank_accounts SET securities_account_id = ?, bank_name = ?, account_number = ?, account_type = ?, balance = ?, available_balance = ?, currency = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
      [securities_account_id || null, bank_name, account_number, account_type, balance, available_balance || 0, currency, id, req.userId]
    );

    res.json({
      success: true,
      message: '銀行帳戶更新成功',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '更新銀行帳戶失敗',
    });
  }
});

// 刪除銀行帳戶
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const account: any = await get<any>(
      'SELECT * FROM bank_accounts WHERE id = ? AND user_id = ?',
      [id, req.userId]
    );

    if (!account) {
      return res.status(404).json({
        success: false,
        message: '銀行帳戶不存在',
      });
    }

    await run('DELETE FROM bank_accounts WHERE id = ? AND user_id = ?', [id, req.userId]);

    res.json({
      success: true,
      message: '銀行帳戶刪除成功',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '刪除銀行帳戶失敗',
    });
  }
});


export default router;



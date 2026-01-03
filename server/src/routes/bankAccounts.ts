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

    res.json({
      success: true,
      data: accounts,
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
      currency = 'TWD',
    } = req.body;

    if (!bank_name || !account_number) {
      return res.status(400).json({
        success: false,
        message: '請填寫銀行名稱和帳號',
      });
    }

    const result = await run(
      'INSERT INTO bank_accounts (user_id, securities_account_id, bank_name, account_number, account_type, balance, currency) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.userId, securities_account_id || null, bank_name, account_number, account_type, balance, currency]
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
    const { securities_account_id, bank_name, account_number, account_type, balance, currency } = req.body;

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
      'UPDATE bank_accounts SET securities_account_id = ?, bank_name = ?, account_number = ?, account_type = ?, balance = ?, currency = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
      [securities_account_id || null, bank_name, account_number, account_type, balance, currency, id, req.userId]
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



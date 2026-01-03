import express from 'express';
import { all, get, run } from '../database';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = express.Router();

// 所有路由都需要認證
router.use(authenticate);

// 獲取所有證券帳戶
router.get('/', async (req: AuthRequest, res) => {
  try {
    const accounts = await all<any>(
      'SELECT * FROM securities_accounts WHERE user_id = ? ORDER BY created_at DESC',
      [req.userId]
    );

    res.json({
      success: true,
      data: accounts,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '獲取證券帳戶失敗',
    });
  }
});

// 獲取單個證券帳戶
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const account: any = await get<any>(
      'SELECT * FROM securities_accounts WHERE id = ? AND user_id = ?',
      [id, req.userId]
    );

    if (!account) {
      return res.status(404).json({
        success: false,
        message: '證券帳戶不存在',
      });
    }

    res.json({
      success: true,
      data: account,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '獲取證券帳戶失敗',
    });
  }
});

// 新增證券帳戶
router.post('/', async (req: AuthRequest, res) => {
  try {
    const { account_name, broker_name, account_number } = req.body;

    if (!account_name || !broker_name || !account_number) {
      return res.status(400).json({
        success: false,
        message: '請填寫所有必填欄位（帳戶名稱、券商名稱、帳戶號碼）',
      });
    }

    const result = await run(
      'INSERT INTO securities_accounts (user_id, account_name, broker_name, account_number) VALUES (?, ?, ?, ?)',
      [req.userId, account_name, broker_name, account_number]
    );
    const newAccountId = result.lastID;

    res.status(201).json({
      success: true,
      message: '證券帳戶新增成功',
      data: {
        id: newAccountId,
        user_id: req.userId,
        account_name,
        broker_name,
        account_number,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '新增證券帳戶失敗',
    });
  }
});

// 更新證券帳戶
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { account_name, broker_name, account_number } = req.body;

    if (!account_name || !broker_name || !account_number) {
      return res.status(400).json({
        success: false,
        message: '請填寫所有必填欄位',
      });
    }

    // 檢查帳戶是否存在且屬於當前用戶
    const account: any = await get<any>(
      'SELECT * FROM securities_accounts WHERE id = ? AND user_id = ?',
      [id, req.userId]
    );

    if (!account) {
      return res.status(404).json({
        success: false,
        message: '證券帳戶不存在',
      });
    }

    await run(
      'UPDATE securities_accounts SET account_name = ?, broker_name = ?, account_number = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
      [account_name, broker_name, account_number, id, req.userId]
    );

    res.json({
      success: true,
      message: '證券帳戶更新成功',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '更新證券帳戶失敗',
    });
  }
});

// 刪除證券帳戶
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    // 檢查帳戶是否存在且屬於當前用戶
    const account: any = await get<any>(
      'SELECT * FROM securities_accounts WHERE id = ? AND user_id = ?',
      [id, req.userId]
    );

    if (!account) {
      return res.status(404).json({
        success: false,
        message: '證券帳戶不存在',
      });
    }

    await run(
      'DELETE FROM securities_accounts WHERE id = ? AND user_id = ?',
      [id, req.userId]
    );

    res.json({
      success: true,
      message: '證券帳戶刪除成功',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '刪除證券帳戶失敗',
    });
  }
});

export default router;



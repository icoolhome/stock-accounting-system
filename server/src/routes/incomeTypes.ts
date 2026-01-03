import express from 'express';
import { all, get, run } from '../database';
import { authenticate, AuthRequest } from '../middleware/auth';
import { initIncomeTypesForUser } from '../utils/initIncomeTypes';

const router = express.Router();

router.use(authenticate);

// 獲取所有收益類型
router.get('/', async (req: AuthRequest, res) => {
  try {
    // 確保用戶有默認收益類型
    if (req.userId) {
      await initIncomeTypesForUser(req.userId);
    }

    const incomeTypes = await all<any>(
      'SELECT * FROM income_types WHERE user_id = ? ORDER BY display_order ASC, type_name ASC',
      [req.userId!]
    );

    res.json({
      success: true,
      data: incomeTypes,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '獲取收益類型失敗',
    });
  }
});

// 新增收益類型
router.post('/', async (req: AuthRequest, res) => {
  try {
    const { type_name, is_dividend, display_order } = req.body;

    if (!type_name || type_name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: '收益類型名稱不能為空',
      });
    }

    // 檢查是否已存在
    const existing = await get<any>(
      'SELECT * FROM income_types WHERE user_id = ? AND type_name = ?',
      [req.userId, type_name.trim()]
    );

    if (existing) {
      return res.status(400).json({
        success: false,
        message: '該收益類型已存在',
      });
    }

    // 獲取當前最大的 display_order
    const maxOrder = await get<{ max_order: number }>(
      'SELECT COALESCE(MAX(display_order), 0) as max_order FROM income_types WHERE user_id = ?',
      [req.userId]
    );

    const result = await run(
      'INSERT INTO income_types (user_id, type_name, is_dividend, display_order) VALUES (?, ?, ?, ?)',
      [req.userId, type_name.trim(), is_dividend ? 1 : 0, display_order ?? (maxOrder?.max_order || 0) + 1]
    );

    res.status(201).json({
      success: true,
      message: '收益類型新增成功',
      data: {
        id: result.lastID,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '新增收益類型失敗',
    });
  }
});

// 更新收益類型
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { type_name, is_dividend, display_order } = req.body;

    // 檢查記錄是否存在且屬於當前用戶
    const incomeType = await get<any>(
      'SELECT * FROM income_types WHERE id = ? AND user_id = ?',
      [id, req.userId]
    );

    if (!incomeType) {
      return res.status(404).json({
        success: false,
        message: '收益類型不存在',
      });
    }

    // 如果要更新類型名稱，檢查是否與其他記錄衝突
    if (type_name && type_name.trim() !== incomeType.type_name) {
      const existing = await get<any>(
        'SELECT * FROM income_types WHERE user_id = ? AND type_name = ? AND id != ?',
        [req.userId, type_name.trim(), id]
      );

      if (existing) {
        return res.status(400).json({
          success: false,
          message: '該收益類型名稱已存在',
        });
      }
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (type_name !== undefined) {
      if (type_name.trim() === '') {
        return res.status(400).json({
          success: false,
          message: '收益類型名稱不能為空',
        });
      }
      updates.push('type_name = ?');
      params.push(type_name.trim());
    }

    if (is_dividend !== undefined) {
      updates.push('is_dividend = ?');
      params.push(is_dividend ? 1 : 0);
    }

    if (display_order !== undefined) {
      updates.push('display_order = ?');
      params.push(display_order);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: '沒有要更新的內容',
      });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id, req.userId);

    await run(
      `UPDATE income_types SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`,
      params
    );

    res.json({
      success: true,
      message: '收益類型更新成功',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '更新收益類型失敗',
    });
  }
});

// 刪除收益類型
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    // 檢查記錄是否存在且屬於當前用戶
    const incomeType = await get<any>(
      'SELECT * FROM income_types WHERE id = ? AND user_id = ?',
      [id, req.userId]
    );

    if (!incomeType) {
      return res.status(404).json({
        success: false,
        message: '收益類型不存在',
      });
    }

    // 檢查是否有收益記錄使用此類型
    const usageCount = await get<{ count: number }>(
      'SELECT COUNT(*) as count FROM dividends WHERE user_id = ? AND income_type = ?',
      [req.userId, incomeType.type_name]
    );

    if (usageCount && usageCount.count > 0) {
      return res.status(400).json({
        success: false,
        message: `無法刪除，因為有 ${usageCount.count} 筆收益記錄正在使用此類型`,
      });
    }

    await run('DELETE FROM income_types WHERE id = ? AND user_id = ?', [id, req.userId]);

    res.json({
      success: true,
      message: '收益類型刪除成功',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '刪除收益類型失敗',
    });
  }
});

export default router;


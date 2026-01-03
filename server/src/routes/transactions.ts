import express from 'express';
import { all, get, run } from '../database';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = express.Router();

// 所有路由都需要認證
router.use(authenticate);

// 獲取交易記錄
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { startDate, endDate, stockCode, accountId } = req.query;
    let query = 'SELECT t.*, sa.account_name, sa.broker_name FROM transactions t LEFT JOIN securities_accounts sa ON t.securities_account_id = sa.id WHERE t.user_id = ?';
    const params: any[] = [req.userId];

    if (startDate) {
      query += ' AND t.trade_date >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND t.trade_date <= ?';
      params.push(endDate);
    }

    if (stockCode) {
      query += ' AND t.stock_code LIKE ?';
      params.push(`%${stockCode}%`);
    }

    if (accountId) {
      query += ' AND t.securities_account_id = ?';
      params.push(accountId);
    }

    query += ' ORDER BY t.trade_date DESC, t.created_at DESC';

    const transactions = await all<any>(query, params);

    res.json({
      success: true,
      data: transactions,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '獲取交易記錄失敗',
    });
  }
});

// 獲取單個交易記錄
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const transaction: any = await get<any>(
      'SELECT t.*, sa.account_name, sa.broker_name FROM transactions t LEFT JOIN securities_accounts sa ON t.securities_account_id = sa.id WHERE t.id = ? AND t.user_id = ?',
      [id, req.userId]
    );

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: '交易記錄不存在',
      });
    }

    res.json({
      success: true,
      data: transaction,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '獲取交易記錄失敗',
    });
  }
});

// 新增交易記錄
router.post('/', async (req: AuthRequest, res) => {
  try {
    const {
      securities_account_id,
      trade_date,
      settlement_date: settlement_date_input,
      transaction_type,
      stock_code,
      stock_name,
      quantity,
      price,
      fee = 0,
      transaction_amount,
      tax = 0,
      securities_tax = 0,
      financing_amount = 0,
      margin = 0,
      interest = 0,
      borrowing_fee = 0,
      net_amount,
      profit_loss = 0,
      return_rate = 0,
      holding_cost = 0,
      health_insurance = 0,
      currency = 'TWD',
      buy_reason,
    } = req.body;

    // 計算交割日期（如果前端沒有提供，則使用成交日期 + 2 天）
    let settlement_date = settlement_date_input;
    if (!settlement_date) {
      const tradeDate = new Date(trade_date);
      tradeDate.setDate(tradeDate.getDate() + 2);
      settlement_date = tradeDate.toISOString().split('T')[0];
    }

    const result = await run(
      `INSERT INTO transactions (
        user_id, securities_account_id, trade_date, settlement_date,
        transaction_type, stock_code, stock_name, quantity, price,
        fee, transaction_amount, tax, securities_tax, financing_amount,
        margin, interest, borrowing_fee, net_amount, profit_loss,
        return_rate, holding_cost, health_insurance, currency, buy_reason
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.userId,
        securities_account_id,
        trade_date,
        settlement_date,
        transaction_type,
        stock_code,
        stock_name,
        quantity,
        price,
        fee,
        transaction_amount,
        tax,
        securities_tax,
        financing_amount,
        margin,
        interest,
        borrowing_fee,
        net_amount,
        profit_loss,
        return_rate,
        holding_cost,
        health_insurance,
        currency,
        buy_reason,
      ]
    );
    const newTransactionId = result.lastID;

    res.status(201).json({
      success: true,
      message: '交易記錄新增成功',
      data: {
        id: newTransactionId,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '新增交易記錄失敗',
    });
  }
});

// 更新交易記錄
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const {
      securities_account_id,
      trade_date,
      settlement_date: settlement_date_input,
      transaction_type,
      stock_code,
      stock_name,
      quantity,
      price,
      fee,
      transaction_amount,
      tax,
      securities_tax,
      financing_amount,
      margin,
      interest,
      borrowing_fee,
      net_amount,
      profit_loss,
      return_rate,
      holding_cost,
      health_insurance,
      currency,
      buy_reason,
    } = req.body;

    // 檢查記錄是否存在且屬於當前用戶
    const transaction: any = await get<any>(
      'SELECT * FROM transactions WHERE id = ? AND user_id = ?',
      [id, req.userId]
    );

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: '交易記錄不存在',
      });
    }

    // 計算交割日期（如果前端沒有提供，則使用成交日期 + 2 天）
    let settlement_date = settlement_date_input;
    if (!settlement_date) {
      const tradeDate = new Date(trade_date);
      tradeDate.setDate(tradeDate.getDate() + 2);
      settlement_date = tradeDate.toISOString().split('T')[0];
    }

    await run(
      `UPDATE transactions SET
        securities_account_id = ?, trade_date = ?, settlement_date = ?,
        transaction_type = ?, stock_code = ?, stock_name = ?, quantity = ?, price = ?,
        fee = ?, transaction_amount = ?, tax = ?, securities_tax = ?, financing_amount = ?,
        margin = ?, interest = ?, borrowing_fee = ?, net_amount = ?, profit_loss = ?,
        return_rate = ?, holding_cost = ?, health_insurance = ?, currency = ?, buy_reason = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?`,
      [
        securities_account_id,
        trade_date,
        settlement_date,
        transaction_type,
        stock_code,
        stock_name,
        quantity,
        price,
        fee,
        transaction_amount,
        tax,
        securities_tax,
        financing_amount,
        margin,
        interest,
        borrowing_fee,
        net_amount,
        profit_loss,
        return_rate,
        holding_cost,
        health_insurance,
        currency,
        buy_reason,
        id,
        req.userId,
      ]
    );

    res.json({
      success: true,
      message: '交易記錄更新成功',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '更新交易記錄失敗',
    });
  }
});

// 刪除交易記錄
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    // 檢查記錄是否存在且屬於當前用戶
    const transaction: any = await get<any>(
      'SELECT * FROM transactions WHERE id = ? AND user_id = ?',
      [id, req.userId]
    );

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: '交易記錄不存在',
      });
    }

    await run('DELETE FROM transactions WHERE id = ? AND user_id = ?', [id, req.userId]);

    res.json({
      success: true,
      message: '交易記錄刪除成功',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '刪除交易記錄失敗',
    });
  }
});

export default router;


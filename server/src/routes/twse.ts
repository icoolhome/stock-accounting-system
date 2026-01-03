import express from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = express.Router();

router.use(authenticate);

// 代理呼叫 TWSE 除權除息計算結果表（TWT49U）JSON API，避免瀏覽器 CORS 問題
router.get('/exrights', async (req: AuthRequest, res) => {
  try {
    const { startDate, endDate } = req.query as {
      startDate?: string;
      endDate?: string;
    };

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: '請提供開始日期與結束日期',
      });
    }

    // 前端傳來的是 yyyy-MM-dd，轉成 TWSE 需要的 yyyyMMdd
    const normalize = (d: string) => d.replace(/-/g, '');
    const s = normalize(startDate);
    const e = normalize(endDate);

    const url = `https://www.twse.com.tw/rwd/zh/exRight/TWT49U?startDate=${s}&endDate=${e}&response=json`;

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json,text/plain,*/*',
      },
    });

    if (!response.ok) {
      return res.status(502).json({
        success: false,
        message: `TWSE 服務回應錯誤: ${response.status} ${response.statusText}`,
      });
    }

    const data = (await response.json()) as any;

    res.json({
      success: true,
      query: { startDate, endDate },
      fields: data.fields || [],
      records: data.data || [],
      raw: data,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '呼叫 TWSE 除權除息 API 失敗',
    });
  }
});

export default router;



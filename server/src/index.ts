import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cron from 'node-cron';
import { initDatabase } from './database';
import authRoutes from './routes/auth';
import securitiesAccountRoutes from './routes/securitiesAccount';
import transactionRoutes from './routes/transactions';
import bankAccountRoutes from './routes/bankAccounts';
import bankTransactionRoutes from './routes/bankTransactions';
import settlementRoutes from './routes/settlements';
import dividendRoutes from './routes/dividends';
import holdingRoutes from './routes/holdings';
import settingsRoutes from './routes/settings';
import stockDataRoutes from './routes/stockData';
import adminRoutes from './routes/admin';
import twseRoutes from './routes/twse';
import { runTwt49uJob } from './jobs/fetchTwt49u';
import { errorHandler } from './middleware/errorHandler';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// 中間件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 路由
app.use('/api/auth', authRoutes);
app.use('/api/securities-accounts', securitiesAccountRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/bank-accounts', bankAccountRoutes);
app.use('/api/bank-transactions', bankTransactionRoutes);
app.use('/api/settlements', settlementRoutes);
app.use('/api/dividends', dividendRoutes);
app.use('/api/holdings', holdingRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/stocks', stockDataRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/twse', twseRoutes);

// 健康檢查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '股票記帳系統 API 運行中' });
});

// 錯誤處理
app.use(errorHandler);

// 初始化資料庫並啟動伺服器
initDatabase()
  .then(() => {
    // 啟動 HTTP 伺服器
    app.listen(PORT, () => {
      console.log(`伺服器運行在 http://localhost:${PORT}`);
    });

    // 啟動排程：每天 18:00 自動抓取並更新除權除息資料
    cron.schedule(
      '0 18 * * *',
      () => {
        console.log('[CRON] 觸發 TWT49U 自動更新任務');
        runTwt49uJob().catch((error) => {
          console.error('[CRON] TWT49U 更新任務失敗:', error);
        });
      },
      {
        timezone: 'Asia/Taipei',
      }
    );

    console.log('已設定每日 18:00 自動執行 TWT49U 更新任務（時區：Asia/Taipei）');
  })
  .catch((error) => {
    console.error('資料庫初始化失敗:', error);
    process.exit(1);
  });


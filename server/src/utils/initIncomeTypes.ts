import { all, get, run } from '../database';

// 初始化用戶的默認收益類型
export async function initIncomeTypesForUser(userId: number): Promise<void> {
  try {
    // 檢查用戶是否已有收益類型
    const existing = await all('SELECT * FROM income_types WHERE user_id = ?', [userId]);
    
    if (existing.length > 0) {
      // 用戶已有收益類型，不需要初始化
      return;
    }

    // 默認收益類型
    const defaultTypes = [
      { type_name: '股息', is_dividend: 1, display_order: 1 },
      { type_name: 'ETF股息', is_dividend: 1, display_order: 2 },
      { type_name: '資本利得', is_dividend: 0, display_order: 3 },
      { type_name: '除權', is_dividend: 1, display_order: 4 },
      { type_name: '除息', is_dividend: 1, display_order: 5 },
      { type_name: '除權除息', is_dividend: 1, display_order: 6 },
      { type_name: '其他收益', is_dividend: 0, display_order: 7 },
    ];

    // 插入默認收益類型
    for (const type of defaultTypes) {
      try {
        await run(
          'INSERT INTO income_types (user_id, type_name, is_dividend, display_order) VALUES (?, ?, ?, ?)',
          [userId, type.type_name, type.is_dividend, type.display_order]
        );
      } catch (error: any) {
        // 忽略重複鍵錯誤
        if (!error.message.includes('UNIQUE constraint failed')) {
          console.error(`初始化收益類型失敗: ${type.type_name}`, error);
        }
      }
    }
  } catch (error) {
    console.error('初始化收益類型失敗:', error);
  }
}


import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const { t } = useLanguage();

  const menuItems = [
    { path: '/', label: t('menu.dashboard', '儀表版') },
    { path: '/welcome-guide', label: t('menu.welcomeGuide', '使用指南') },
    { path: '/stock-announcements', label: t('menu.stockAnnouncements', '個股查詢') },
    { path: '/transactions', label: t('menu.transactions', '交易記錄') },
    { path: '/settlements', label: t('menu.settlements', '交割管理') },
    { path: '/bank-accounts', label: t('menu.bankAccounts', '銀行帳戶') },
    { path: '/holdings', label: t('menu.holdings', '庫存管理') },
    { path: '/portfolio', label: t('menu.portfolio', '投資組合') },
    { path: '/dividends', label: t('menu.dividends', '歷史收益') },
    { path: '/settings', label: t('menu.settings', '系統設定') },
    ...(user?.role === 'admin' ? [{ path: '/admin', label: t('menu.admin', '後台管理') }] : []),
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* 左側直欄導覽列 */}
      <aside className="w-40 bg-white border-r shadow-sm flex flex-col">
        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1" style={{ marginTop: '5cm' }}>
            {menuItems.map((item) => {
              const active = location.pathname === item.path;
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={`flex items-center pl-16 pr-3 py-2 text-sm font-medium rounded-r-full whitespace-nowrap ${
                      active
                        ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-500'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>

      {/* 右側主內容區 */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* 頂部欄 */}
        <header className="bg-white border-b shadow-sm h-16 px-4 sm:px-6 lg:px-8 flex items-center justify-between w-full min-w-0">
          <h1 className="text-lg font-bold text-gray-900 whitespace-nowrap">{t('app.title', '股票記帳系統')}</h1>
          <div className="flex items-center gap-4 flex-shrink-0">
            <div className="flex flex-col items-end whitespace-nowrap">
              <span className="text-xs text-gray-500">{t('app.loggedInAs', '已登入帳號')}</span>
              <span className="text-sm text-gray-800 font-medium truncate max-w-[200px]">
                {user?.email}
              </span>
            </div>
            <button
              onClick={logout}
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0"
            >
              {t('app.logout', '登出')}
            </button>
          </div>
        </header>
        
        {/* 主內容 */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="w-full py-6 px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Layout;


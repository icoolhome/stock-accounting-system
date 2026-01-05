import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';

interface LanguageContextType {
  language: string;
  translations: Record<string, string>;
  setLanguage: (lang: string) => Promise<void>;
  t: (key: string, defaultValue?: string) => string;
  loading: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
};

interface LanguageProviderProps {
  children: ReactNode;
}

export const LanguageProvider = ({ children }: LanguageProviderProps) => {
  const [language, setLanguageState] = useState<string>('zh-TW');
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  // 從數據庫或語言包文件加載翻譯
  const loadTranslations = async (langCode: string) => {
    try {
      setLoading(true);
      
      // 首先嘗試從數據庫獲取語言包
      try {
        const response = await axios.get(`/api/settings/language-packs/${langCode}`);
        if (response.data.success && response.data.data) {
          const pack = response.data.data;
          if (pack.translations && typeof pack.translations === 'object') {
            setTranslations(pack.translations);
            setLanguageState(langCode);
            setLoading(false);
            return;
          }
        }
      } catch (err) {
        // 如果數據庫沒有，嘗試從文件加載
      }

      // 如果數據庫沒有，嘗試從 public 目錄加載預設語言包
      try {
        const response = await fetch(`/language_pack_${langCode}.json`);
        if (response.ok) {
          const pack = await response.json();
          if (pack.translations && typeof pack.translations === 'object') {
            setTranslations(pack.translations);
            setLanguageState(langCode);
            setLoading(false);
            return;
          }
        }
      } catch (err) {
        // 如果文件也沒有，使用預設翻譯
      }

      // 如果都沒有，使用預設的繁體中文
      if (langCode !== 'zh-TW') {
        await loadTranslations('zh-TW');
      } else {
        // 最後的備選方案：空翻譯（組件會顯示預設值）
        setTranslations({});
        setLanguageState(langCode);
        setLoading(false);
      }
    } catch (err) {
      console.error('加載翻譯失敗:', err);
      setTranslations({});
      setLoading(false);
    }
  };

  // 初始化：從設定中獲取當前語言
  useEffect(() => {
    const initLanguage = async () => {
      try {
        // 獲取用戶設定
        const settingsResponse = await axios.get('/api/settings');
        const settings = settingsResponse.data.data;
        
        let langCode = 'zh-TW';
        
        if (settings?.uiSettings?.language) {
          langCode = settings.uiSettings.language;
        } else {
          // 嘗試獲取預設語言包
          try {
            const packsResponse = await axios.get('/api/settings/language-packs');
            if (packsResponse.data.success) {
              const defaultPack = packsResponse.data.data?.find((p: any) => p.is_default === 1);
              if (defaultPack) {
                langCode = defaultPack.language_code;
              }
            }
          } catch (err) {
            // 忽略錯誤，使用預設值
          }
        }
        
        await loadTranslations(langCode);
      } catch (err) {
        console.error('初始化語言失敗:', err);
        // 使用預設語言
        await loadTranslations('zh-TW');
      }
    };

    initLanguage();

    // 監聽語言設定變化（每5秒檢查一次）
    const interval = setInterval(async () => {
      try {
        const settingsResponse = await axios.get('/api/settings');
        const settings = settingsResponse.data.data;
        const newLangCode = settings?.uiSettings?.language || 'zh-TW';
        
        if (newLangCode !== language) {
          await loadTranslations(newLangCode);
        }
      } catch (err) {
        // 忽略錯誤
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [language]);

  // 設置語言
  const setLanguage = async (langCode: string) => {
    await loadTranslations(langCode);
  };

  // 翻譯函數
  const t = (key: string, defaultValue?: string): string => {
    return translations[key] || defaultValue || key;
  };

  return (
    <LanguageContext.Provider value={{ language, translations, setLanguage, t, loading }}>
      {children}
    </LanguageContext.Provider>
  );
};


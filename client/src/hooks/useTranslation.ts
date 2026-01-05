import { useLanguage } from '../contexts/LanguageContext';

/**
 * Hook to get translation function
 * @param key - Translation key (e.g., 'menu.dashboard')
 * @param defaultValue - Default value if translation not found
 * @returns Translation function or translated string
 */
export const useTranslation = () => {
  const { t } = useLanguage();
  return t;
};

/**
 * Hook to get current language
 */
export const useLanguageCode = () => {
  const { language } = useLanguage();
  return language;
};



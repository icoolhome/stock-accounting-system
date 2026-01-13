import { createContext, useContext, ReactNode } from 'react';

interface LanguageContextType {
  t: (key: string, fallback?: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  t: (key: string, fallback?: string) => fallback || key,
});

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const t = (key: string, fallback?: string) => fallback || key;
  
  return (
    <LanguageContext.Provider value={{ t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    return { t: (key: string, fallback?: string) => fallback || key };
  }
  return context;
};







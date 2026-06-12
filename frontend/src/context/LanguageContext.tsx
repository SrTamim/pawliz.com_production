import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import i18n from "../lib/i18n";

const LANG_KEY = "pawliz_lang";
const VALID_LANGS = ["en", "bn"];

/**
 * Language context provider + hook
 * Manages i18n language (en/bn), localStorage persistence
 * Defaults to English; user switches via header toggle (client-only)
 */

interface LanguageContextValue {
  lang: string;
  setLang: (l: string) => void;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

/**
 * Apply language: update i18n + document lang attribute
 */
function applyLang(lang: string): void {
  i18n.changeLanguage(lang);
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("lang", lang);
    document.documentElement.setAttribute("data-lang", lang);
  }
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState("en");

  // On mount: read localStorage preference, default English
  useEffect(() => {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved && VALID_LANGS.includes(saved)) {
      applyLang(saved);
      setLangState(saved);
    }
  }, []);

  const setLang = useCallback((l: string) => {
    if (!VALID_LANGS.includes(l)) return;
    applyLang(l);
    setLangState(l);
    localStorage.setItem(LANG_KEY, l);
  }, []);

  return (
    <LanguageContext.Provider value={{ lang, setLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

/**
 * Use language context
 */
export function useLang(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLang must be used within LanguageProvider");
  return ctx;
}

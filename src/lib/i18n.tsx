import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import type { Language } from "./finance";
import { message } from "./messages";
import type { MessageKey } from "./messages";

export const translate = message;
const LanguageContext = createContext<Language>("ru");
export function LanguageProvider({
  language,
  children,
}: {
  language: Language;
  children: ReactNode;
}) {
  return (
    <LanguageContext.Provider value={language}>
      {children}
    </LanguageContext.Provider>
  );
}
export function useI18n() {
  const language = useContext(LanguageContext);
  return { language, tr: (key: MessageKey) => message(language, key) };
}

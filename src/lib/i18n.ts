import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import en from "@/locales/en.json";
import fr from "@/locales/fr.json";
import ar from "@/locales/ar.json";
import de from "@/locales/de.json";
import nl from "@/locales/nl.json";
import zh from "@/locales/zh.json";

if (!i18n.isInitialized) {
  i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: {
        en: { translation: en },
        fr: { translation: fr },
        ar: { translation: ar },
        de: { translation: de },
        nl: { translation: nl },
        zh: { translation: zh },
      },
      fallbackLng: "en",
      supportedLngs: ["en", "fr", "ar", "de", "nl", "zh"],
      interpolation: { escapeValue: false },
      detection: { order: ["localStorage", "navigator"], caches: ["localStorage"] },
    });
}

export function applyLangDir(lang: string) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
}

export default i18n;

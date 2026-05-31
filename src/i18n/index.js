import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Localization from "expo-localization";
import i18n from "i18next";
import { AppState, I18nManager } from "react-native";
import { initReactI18next } from "react-i18next";

import ar from "./locales/ar.json";
import en from "./locales/en.json";

export const LANGUAGE_STORAGE_KEY = "appManualLanguage";

const VALID_LANGUAGES = ["ar", "en"];

// مهم جداً: لا تخلي Android يقلب التطبيق كله
I18nManager.allowRTL(false);
I18nManager.forceRTL(false);

const getSystemLanguage = () => {
    const locales = Localization.getLocales();
    const deviceLanguage = locales?.[0]?.languageCode;

    return deviceLanguage === "ar" ? "ar" : "en";
};

const getInitialLanguage = async () => {
    try {
        const savedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);

        if (VALID_LANGUAGES.includes(savedLanguage)) {
            return savedLanguage;
        }

        return getSystemLanguage();
    } catch (error) {
        console.log("Failed to load app language:", error);
        return getSystemLanguage();
    }
};

export const changeAppLanguage = async (nextLanguage) => {
    if (!VALID_LANGUAGES.includes(nextLanguage)) return;

    try {
        await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
        await i18n.changeLanguage(nextLanguage);
    } catch (error) {
        console.log("Failed to change app language:", error);
    }
};

export const toggleAppLanguage = async () => {
    const currentLanguage = i18n.language === "ar" ? "ar" : "en";
    const nextLanguage = currentLanguage === "ar" ? "en" : "ar";

    await changeAppLanguage(nextLanguage);
};

export const resetToSystemLanguage = async () => {
    try {
        await AsyncStorage.removeItem(LANGUAGE_STORAGE_KEY);

        const systemLanguage = getSystemLanguage();
        await i18n.changeLanguage(systemLanguage);
    } catch (error) {
        console.log("Failed to reset app language:", error);
    }
};

const syncLanguageWithSystemIfNeeded = async () => {
    try {
        const savedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);

        if (VALID_LANGUAGES.includes(savedLanguage)) return;

        const systemLanguage = getSystemLanguage();

        if (i18n.language !== systemLanguage) {
            await i18n.changeLanguage(systemLanguage);
        }
    } catch (error) {
        console.log("Failed to sync system language:", error);
    }
};

const initI18n = async () => {
    const initialLanguage = await getInitialLanguage();

    await i18n.use(initReactI18next).init({
        compatibilityJSON: "v3",
        resources: {
            en: {
                translation: en,
            },
            ar: {
                translation: ar,
            },
        },
        lng: initialLanguage,
        fallbackLng: "en",
        interpolation: {
            escapeValue: false,
        },
    });

    AppState.addEventListener("change", (nextAppState) => {
        if (nextAppState === "active") {
            syncLanguageWithSystemIfNeeded();
        }
    });
};

initI18n();

export default i18n;
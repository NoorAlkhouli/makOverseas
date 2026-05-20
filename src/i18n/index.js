import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Localization from "expo-localization";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import ar from "./locales/ar.json";
import en from "./locales/en.json";

export const LANGUAGE_STORAGE_KEY = "appLanguage";

const getDeviceLanguage = () => {
    const locales = Localization.getLocales();
    const deviceLanguage = locales?.[0]?.languageCode;

    return deviceLanguage === "ar" ? "ar" : "en";
};

const initI18n = async () => {
    const savedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    const initialLanguage = savedLanguage || getDeviceLanguage();

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
};

initI18n();

export default i18n;
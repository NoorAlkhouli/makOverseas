import AsyncStorage from "@react-native-async-storage/async-storage";
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";
import { Appearance } from "react-native";

import { darkColors, lightColors } from "@/src/theme/colors";

const THEME_STORAGE_KEY = "appManualTheme";

const VALID_THEME_MODES = ["light", "dark"];

const ThemeContext = createContext(null);

function getSystemTheme() {
    return Appearance.getColorScheme() === "dark" ? "dark" : "light";
}

export function ThemeProvider({ children }) {
    const [systemTheme, setSystemTheme] = useState(getSystemTheme());
    const [manualTheme, setManualTheme] = useState(null);
    const [isThemeReady, setIsThemeReady] = useState(false);

    useEffect(() => {
        let isMounted = true;

        const loadSavedTheme = async () => {
            try {
                const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);

                if (!isMounted) return;

                if (VALID_THEME_MODES.includes(savedTheme)) {
                    setManualTheme(savedTheme);
                } else {
                    setManualTheme(null);
                }
            } catch (error) {
                console.log("Failed to load theme mode:", error);

                if (isMounted) {
                    setManualTheme(null);
                }
            } finally {
                if (isMounted) {
                    setSystemTheme(getSystemTheme());
                    setIsThemeReady(true);
                }
            }
        };

        loadSavedTheme();

        const subscription = Appearance.addChangeListener(({ colorScheme }) => {
            const nextSystemTheme = colorScheme === "dark" ? "dark" : "light";
            setSystemTheme(nextSystemTheme);
        });

        return () => {
            isMounted = false;
            subscription.remove();
        };
    }, []);

    const activeTheme = useMemo(() => {
        return manualTheme ?? systemTheme;
    }, [manualTheme, systemTheme]);

    const colors = useMemo(() => {
        return activeTheme === "dark" ? darkColors : lightColors;
    }, [activeTheme]);

    const changeThemeMode = useCallback((nextMode) => {
        if (!VALID_THEME_MODES.includes(nextMode)) return;

        setManualTheme(nextMode);

        AsyncStorage.setItem(THEME_STORAGE_KEY, nextMode).catch((error) => {
            console.log("Failed to save manual theme:", error);
        });
    }, []);

    const toggleTheme = useCallback(() => {
        setManualTheme((currentManualTheme) => {
            const currentActiveTheme = currentManualTheme ?? getSystemTheme();
            const nextMode = currentActiveTheme === "dark" ? "light" : "dark";

            AsyncStorage.setItem(THEME_STORAGE_KEY, nextMode).catch((error) => {
                console.log("Failed to save manual theme:", error);
            });

            return nextMode;
        });
    }, []);

    const resetToSystemTheme = useCallback(() => {
        setManualTheme(null);
        setSystemTheme(getSystemTheme());

        AsyncStorage.removeItem(THEME_STORAGE_KEY).catch((error) => {
            console.log("Failed to remove manual theme:", error);
        });
    }, []);

    const value = useMemo(
        () => ({
            colors,

            // ثيم الموبايل الحقيقي
            systemTheme,

            // الثيم اليدوي إذا المستخدم اختاره، وإذا null يعني التطبيق ماشي مع الموبايل
            manualTheme,

            // الثيم الفعال حالياً داخل التطبيق
            activeTheme,

            isDark: activeTheme === "dark",
            isLight: activeTheme === "light",
            isUsingSystemTheme: manualTheme === null,

            isThemeReady,

            changeThemeMode,
            toggleTheme,
            resetToSystemTheme,
        }),
        [
            colors,
            systemTheme,
            manualTheme,
            activeTheme,
            isThemeReady,
            changeThemeMode,
            toggleTheme,
            resetToSystemTheme,
        ]
    );

    if (!isThemeReady) {
        return null;
    }

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useAppTheme() {
    const context = useContext(ThemeContext);

    if (!context) {
        throw new Error("useAppTheme must be used inside ThemeProvider");
    }

    return context;
}
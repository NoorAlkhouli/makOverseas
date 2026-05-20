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

const THEME_STORAGE_KEY = "appThemeMode";

const VALID_THEME_MODES = ["light", "dark", "system"];

const ThemeContext = createContext(null);

function getSystemTheme() {
    return Appearance.getColorScheme() === "dark" ? "dark" : "light";
}

export function ThemeProvider({ children }) {
    const [themeMode, setThemeMode] = useState("system");
    const [systemTheme, setSystemTheme] = useState(getSystemTheme);
    const [isThemeReady, setIsThemeReady] = useState(false);

    useEffect(() => {
        let isMounted = true;

        const loadSavedTheme = async () => {
            try {
                const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);

                if (!isMounted) return;

                if (VALID_THEME_MODES.includes(savedTheme)) {
                    setThemeMode(savedTheme);
                }
            } catch (error) {
                console.log("Failed to load theme mode:", error);
            } finally {
                if (isMounted) {
                    setIsThemeReady(true);
                }
            }
        };

        loadSavedTheme();

        const subscription = Appearance.addChangeListener(({ colorScheme }) => {
            setSystemTheme(colorScheme === "dark" ? "dark" : "light");
        });

        return () => {
            isMounted = false;
            subscription.remove();
        };
    }, []);

    const activeTheme = useMemo(() => {
        return themeMode === "system" ? systemTheme : themeMode;
    }, [themeMode, systemTheme]);

    const colors = useMemo(() => {
        return activeTheme === "dark" ? darkColors : lightColors;
    }, [activeTheme]);

    const changeThemeMode = useCallback((nextMode) => {
        if (!VALID_THEME_MODES.includes(nextMode)) return;

        setThemeMode((currentMode) => {
            if (currentMode === nextMode) return currentMode;
            return nextMode;
        });

        AsyncStorage.setItem(THEME_STORAGE_KEY, nextMode).catch((error) => {
            console.log("Failed to save theme mode:", error);
        });
    }, []);

    const toggleTheme = useCallback(() => {
        setThemeMode((currentMode) => {
            const currentActiveTheme =
                currentMode === "system" ? getSystemTheme() : currentMode;

            const nextMode = currentActiveTheme === "dark" ? "light" : "dark";

            AsyncStorage.setItem(THEME_STORAGE_KEY, nextMode).catch((error) => {
                console.log("Failed to save theme mode:", error);
            });

            return nextMode;
        });
    }, []);

    const resetToSystemTheme = useCallback(() => {
        changeThemeMode("system");
    }, [changeThemeMode]);

    const value = useMemo(
        () => ({
            colors,
            themeMode,
            activeTheme,
            isDark: activeTheme === "dark",
            isLight: activeTheme === "light",
            isThemeReady,
            changeThemeMode,
            toggleTheme,
            resetToSystemTheme,
        }),
        [
            colors,
            themeMode,
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
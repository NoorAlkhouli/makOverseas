import { Feather } from "@expo/vector-icons";
import { StyleSheet, TouchableOpacity } from "react-native";

import { useAppTheme } from "@/src/theme/ThemeProvider";

export default function ThemeToggleButton({
    disabled = false,
    style,
    size = 46,
}) {
    const { colors, isDark, toggleTheme } = useAppTheme();

    return (
        <TouchableOpacity
            activeOpacity={0.85}
            style={[
                styles.button,
                {
                    width: size,
                    height: size,
                    borderRadius: 18,
                    backgroundColor: colors.cardSoft,
                    borderColor: colors.border,
                },
                style,
            ]}
            onPress={toggleTheme}
            disabled={disabled}
        >
            <Feather
                name={isDark ? "sun" : "moon"}
                size={21}
                color={colors.textPrimary}
            />
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    button: {
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
    },
});
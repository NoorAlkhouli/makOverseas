import LanguageButton from "@/src/components/LanguageButton";
import ThemeToggleButton from "@/src/components/ThemeToggleButton";
import { useAppTheme } from "@/src/theme/ThemeProvider";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { useMemo } from "react";


export default function AppTopBar({
    showBack = true,
    showLanguage = true,
    showTheme = true,
    disabled = false,
    onBackPress,
}) {
    const navigation = useNavigation();

    const { i18n } = useTranslation();
    const { colors } = useAppTheme();

    const styles = useMemo(() => createStyles(colors), [colors]);

    const isArabic = i18n.language === "ar";

    const handleBackPress = () => {
        if (onBackPress) {
            onBackPress();
            return;
        }

        if (navigation.canGoBack()) {
            navigation.goBack();
        } else {
            navigation.navigate("Login");
        }
    };

    return (
        <View style={[styles.topBar, isArabic && styles.topBarArabic]}>
            {showBack ? (
                <TouchableOpacity
                    activeOpacity={0.85}
                    style={styles.backButton}
                    onPress={handleBackPress}
                    disabled={disabled}
                >
                    <Feather
                        name={isArabic ? "chevron-right" : "chevron-left"}
                        size={28}
                        color={colors.textPrimary}
                    />
                </TouchableOpacity>
            ) : (
                <View style={styles.backPlaceholder} />
            )}

            <View style={[styles.actionsBox, isArabic && styles.actionsBoxArabic]}>
                {showLanguage && (
                    <LanguageButton
                        disabled={disabled}
                        withPosition={false}
                        size={44}
                    />
                )}

                {showTheme && (
                    <ThemeToggleButton
                        disabled={disabled}
                        size={44}
                    />
                )}
            </View>
        </View>
    );
}

const createStyles = (colors) =>
    StyleSheet.create({
        topBar: {
            width: "100%",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
        },

        topBarArabic: {
            flexDirection: "row-reverse",
        },

        backButton: {
            width: 46,
            height: 46,
            borderRadius: 23,
            backgroundColor: colors.cardSoft,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: "center",
            justifyContent: "center",
        },

        backPlaceholder: {
            width: 46,
            height: 46,
        },

        actionsBox: {
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
        },

        actionsBoxArabic: {
            flexDirection: "row-reverse",
        },
    });
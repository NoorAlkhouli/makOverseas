import { Feather, Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

import { getRowDirectionStyle } from "@/src/styles/globalStyles";
import { useAppTheme } from "@/src/theme/ThemeProvider";

export default function BottomTabBar({ state, navigation }) {
    const { t, i18n } = useTranslation();

    const isArabic = i18n.language === "ar";

    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const currentRouteName = state.routes[state.index]?.name;

    /**
     * هدول بس الصفحات يلي بدنا يبينوا تحت بالـ Bottom Tab Bar.
     * Notifications ما منحطها هون لأنها صفحة بتفتح من زر الجرس بالـ MainNavBar.
     */
    const tabs = [
        {
            name: "Home",
            label: t("bottomTabs.home"),
            icon: "home",
            iconType: "Feather",
        },
        {
            name: "Chat",
            label: t("bottomTabs.chat"),
            icon: "chatbubble-ellipses-outline",
            iconType: "Ionicons",
        },
        {
            name: "Channels",
            label: t("bottomTabs.channels"),
            icon: "radio",
            iconType: "Feather",
        },
        {
            name: "Calls",
            label: t("bottomTabs.calls"),
            icon: "phone-call",
            iconType: "Feather",
        },
        {
            name: "Profile",
            label: t("bottomTabs.profile"),
            icon: "user",
            iconType: "Feather",
        },
    ];

    const handleNavigate = (screenName) => {
        if (currentRouteName === screenName) return;

        navigation.navigate(screenName);
    };

    const renderIcon = (tab, isActive) => {
        const iconColor = isActive ? colors.primary : colors.textSecondary;
        const iconSize = 22;

        if (tab.iconType === "Ionicons") {
            return (
                <Ionicons
                    name={tab.icon}
                    size={iconSize}
                    color={iconColor}
                />
            );
        }

        return (
            <Feather
                name={tab.icon}
                size={iconSize}
                color={iconColor}
            />
        );
    };

    return (
        <View style={styles.wrapper} pointerEvents="box-none">
            <View style={[styles.container, getRowDirectionStyle(isArabic)]}>
                {tabs.map((tab) => {
                    const isActive = currentRouteName === tab.name;

                    return (
                        <TouchableOpacity
                            key={tab.name}
                            activeOpacity={0.85}
                            style={styles.tabButton}
                            onPress={() => handleNavigate(tab.name)}
                        >
                            <View
                                style={[
                                    styles.iconBox,
                                    isActive && styles.activeIconBox,
                                ]}
                            >
                                {renderIcon(tab, isActive)}
                            </View>

                            <Text
                                style={[
                                    styles.tabText,
                                    isActive && styles.activeTabText,
                                ]}
                                numberOfLines={1}
                                adjustsFontSizeToFit
                            >
                                {tab.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
}

const createStyles = (colors) =>
    StyleSheet.create({
        wrapper: {
            position: "absolute",
            left: 18,
            right: 18,
            bottom: Platform.OS === "android" ? 18 : 28,
            zIndex: 100,
            elevation: 100,
        },

        container: {
            height: 72,
            borderRadius: 26,
            backgroundColor: colors.cardStrong,
            borderWidth: 1,
            borderColor: colors.borderSoft,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-around",
            paddingHorizontal: 8,
            shadowColor: colors.mode === "dark" ? "#000000" : "#64748b",
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: colors.mode === "dark" ? 0.25 : 0.15,
            shadowRadius: 14,
        },

        tabButton: {
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
        },

        iconBox: {
            width: 34,
            height: 30,
            borderRadius: 15,
            alignItems: "center",
            justifyContent: "center",
        },

        activeIconBox: {
            backgroundColor: colors.primarySoft,
        },

        tabText: {
            color: colors.textSecondary,
            fontSize: 10.5,
            fontWeight: "700",
            textAlign: "center",
            includeFontPadding: false,
        },

        activeTabText: {
            color: colors.primary,
        },
    });
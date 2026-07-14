import { Feather, MaterialIcons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    Image,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

import {
    getRowDirectionStyle,
    getTextDirectionStyle,
} from "@/src/styles/globalStyles";
import { useNotificationCount } from "@/src/context/NotificationCountProvider";
import { useAppTheme } from "@/src/theme/ThemeProvider";

export default function MainNavBar({
    navigation,
    title,
    showTitle = false,
    onToggleLanguage,
    onCreateGroupPress = null,
    menuItems = [],
    showMenu = true,
}) {
    const { t, i18n } = useTranslation();
    const isArabic = i18n.language === "ar";

    const [menuOpen, setMenuOpen] = useState(false);

    const { colors, isDark, toggleTheme } = useAppTheme();
    const { notificationCount } = useNotificationCount();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const closeMenu = () => {
        setMenuOpen(false);
    };

    /**
     * لما ننتقل بين التابات أو تتغير حالة الـ navigation
     * المنيو إذا كان مفتوح بينسكر لحالو.
     */
    useEffect(() => {
        if (!navigation?.addListener) {
            return undefined;
        }

        const unsubscribeBlur = navigation.addListener("blur", () => {
            setMenuOpen(false);
        });

        const unsubscribeState = navigation.addListener("state", () => {
            setMenuOpen(false);
        });

        return () => {
            unsubscribeBlur?.();
            unsubscribeState?.();
        };
    }, [navigation]);

    /**
     * إذا صفحة معينة مثل Profile بعتت showMenu={false}
     * منسكر المنيو فوراً وما منخليه عالق.
     */
    useEffect(() => {
        if (!showMenu && menuOpen) {
            setMenuOpen(false);
        }
    }, [showMenu, menuOpen]);

    const handleToggleTheme = async () => {
        await toggleTheme();
        closeMenu();
    };

    const handleToggleLanguage = async () => {
        if (onToggleLanguage) {
            await onToggleLanguage();
        }

        closeMenu();
    };

    const defaultMenuItems = [
        {
            key: "language",
            label: t("home.menuLanguage"),
            iconType: "material",
            iconName: "language",
            onPress: handleToggleLanguage,
        },
        {
            key: "theme",
            label: isDark ? t("theme.light") : t("theme.dark"),
            iconType: "feather",
            iconName: isDark ? "sun" : "moon",
            onPress: handleToggleTheme,
        },
    ];

    const finalMenuItems = [...defaultMenuItems, ...menuItems];

    const renderIcon = (item) => {
        if (item.iconType === "material") {
            return (
                <MaterialIcons
                    name={item.iconName}
                    size={20}
                    color={colors.primary}
                />
            );
        }

        return (
            <Feather
                name={item.iconName}
                size={19}
                color={colors.primary}
            />
        );
    };

    const handleMenuItemPress = async (item) => {
        if (item.onPress) {
            await item.onPress();
        }

        closeMenu();
    };

    return (
        <>
            {showMenu && menuOpen && (
                <Pressable
                    style={styles.menuBackdrop}
                    onPress={closeMenu}
                />
            )}

            <View
                style={[
                    styles.navWrapper,
                    showTitle ? styles.navWrapperScrolled : styles.navWrapperTransparent,
                ]}
            >
                <View style={[styles.navBar, getRowDirectionStyle(isArabic)]}>
                    <View style={styles.logoBox}>
                        <Image
                            source={require("@/src/assets/MAK/logo-light.png")}
                            style={styles.logo}
                            resizeMode="contain"
                        />
                    </View>

                    <View style={styles.titleBox}>
                        <Text
                            style={[
                                styles.navTitle,
                                !showTitle && styles.navTitleHidden,
                            ]}
                            numberOfLines={1}
                        >
                            {title}
                        </Text>
                    </View>

                    <TouchableOpacity
                        activeOpacity={0.85}
                        style={styles.notificationButton}
                        onPress={() => {
                            closeMenu();
                            navigation.navigate("Notifications");
                        }}
                    >
                        <Feather
                            name="bell"
                            size={22}
                            color={colors.textPrimary}
                        />

                        {notificationCount > 0 && (
                            <View style={styles.notificationBadge}>
                                <Text style={styles.notificationBadgeText}>
                                    {notificationCount}
                                </Text>
                            </View>
                        )}
                    </TouchableOpacity>

                    {!!onCreateGroupPress && (
                        <TouchableOpacity
                            activeOpacity={0.85}
                            style={styles.createGroupButton}
                            onPress={() => {
                                closeMenu();
                                onCreateGroupPress();
                            }}
                            accessibilityRole="button"
                            accessibilityLabel={
                                isArabic ? "إنشاء مجموعة" : "Create group"
                            }
                        >
                            <Feather
                                name="users"
                                size={22}
                                color={colors.textPrimary}
                            />
                        </TouchableOpacity>
                    )}

                    {showMenu && (
                        <View style={styles.menuWrapper}>
                            <TouchableOpacity
                                activeOpacity={0.85}
                                style={styles.menuButton}
                                onPress={() => setMenuOpen((prev) => !prev)}
                            >
                                <Feather
                                    name="menu"
                                    size={24}
                                    color={colors.textPrimary}
                                />
                            </TouchableOpacity>

                            {menuOpen && (
                                <View
                                    style={[
                                        styles.menuDropdown,
                                        isArabic
                                            ? styles.menuDropdownArabic
                                            : styles.menuDropdownEnglish,
                                    ]}
                                >
                                    {finalMenuItems.map((item) => (
                                        <Pressable
                                            key={item.key}
                                            style={[
                                                styles.menuItem,
                                                getRowDirectionStyle(isArabic),
                                            ]}
                                            onPress={() => handleMenuItemPress(item)}
                                        >
                                            {renderIcon(item)}

                                            <Text
                                                style={[
                                                    styles.menuText,
                                                    getTextDirectionStyle(isArabic),
                                                ]}
                                                numberOfLines={1}
                                            >
                                                {item.label}
                                            </Text>
                                        </Pressable>
                                    ))}
                                </View>
                            )}
                        </View>
                    )}
                </View>
            </View>
        </>
    );
}

const createStyles = (colors) =>
    StyleSheet.create({
        navWrapper: {
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            paddingHorizontal: 20,
            paddingTop: Platform.OS === "android" ? 46 : 58,
            paddingBottom: 10,
            zIndex: 100,
            elevation: 0,
            backgroundColor: "transparent",
        },

        navWrapperTransparent: {
            backgroundColor: "transparent",
            borderBottomWidth: 0,
            borderBottomColor: "transparent",
        },

        navWrapperScrolled: {
            backgroundColor: colors.navScrolled,
            borderBottomWidth: 1,
            borderBottomColor: colors.borderSoft,
        },

        navBar: {
            backgroundColor: "transparent",
            width: "100%",
            height: 58,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
        },

        logoBox: {
            width: 90,
            height: 54,
            justifyContent: "center",
        },

        logo: {
            width: 90,
            height: 50,
        },

        titleBox: {
            flex: 1,
            height: 54,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "transparent",
        },

        navTitle: {
            color: colors.textPrimary,
            fontSize: 18,
            fontWeight: "900",
            textAlign: "center",
        },

        navTitleHidden: {
            opacity: 0,
        },

        notificationButton: {
            width: 46,
            height: 46,
            borderRadius: 18,
            backgroundColor: colors.cardSoft,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
        },

        notificationBadge: {
            position: "absolute",
            top: 5,
            right: 5,
            minWidth: 16,
            height: 16,
            borderRadius: 8,
            backgroundColor: colors.primary,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 3,
        },

        notificationBadgeText: {
            color: colors.darkText || colors.background,
            fontSize: 9,
            fontWeight: "900",
        },

        createGroupButton: {
            width: 46,
            height: 46,
            borderRadius: 18,
            backgroundColor: colors.cardSoft,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: "center",
            justifyContent: "center",
        },

        menuWrapper: {
            position: "relative",
        },

        menuButton: {
            width: 46,
            height: 46,
            borderRadius: 18,
            backgroundColor: colors.cardSoft,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: "center",
            justifyContent: "center",
        },

        menuBackdrop: {
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 50,
            elevation: 50,
        },

        menuDropdown: {
            position: "absolute",
            top: 54,
            width: 180,
            borderRadius: 18,
            backgroundColor: colors.cardStrong,
            borderWidth: 1,
            borderColor: colors.borderSoft,
            paddingVertical: 8,
            zIndex: 200,
            elevation: 200,
        },

        menuDropdownEnglish: {
            right: 0,
        },

        menuDropdownArabic: {
            left: 0,
        },

        menuItem: {
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            paddingHorizontal: 14,
            paddingVertical: 12,
        },

        menuText: {
            flex: 1,
            color: colors.textPrimary,
            fontSize: 15,
            fontWeight: "700",
        },
    });
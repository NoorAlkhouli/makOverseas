import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

import MainNavBar from "@/src/components/MainNavBar";
import { LANGUAGE_STORAGE_KEY } from "@/src/i18n";
import {
    getRowDirectionStyle,
    getTextDirectionStyle,
} from "@/src/styles/globalStyles";
import { useAppTheme } from "@/src/theme/ThemeProvider";

const FALLBACK_NOTIFICATIONS = [
    {
        id: "1",
        group: "today",
        type: "message",
        titleKey: "notifications.items.newMessage.title",
        bodyKey: "notifications.items.newMessage.body",
        timeKey: "notifications.times.twoHoursAgo",
        unread: true,
        icon: "message-circle",
        iconType: "feather",
        colorKey: "notificationMessage",
    },
    {
        id: "2",
        group: "today",
        type: "channel",
        titleKey: "notifications.items.companyNews.title",
        bodyKey: "notifications.items.companyNews.body",
        timeKey: "notifications.times.fourHoursAgo",
        unread: true,
        icon: "newspaper-variant-outline",
        iconType: "material",
        colorKey: "notificationCompanyNews",
        // badgeKey: "notifications.followedChannel",
    },
    {
        id: "3",
        group: "today",
        type: "exchange",
        titleKey: "notifications.items.exchangeRates.title",
        bodyKey: "notifications.items.exchangeRates.body",
        timeKey: "notifications.times.sixHoursAgo",
        unread: false,
        icon: "chart-line",
        iconType: "material",
        colorKey: "notificationExchangeRates",
        // badgeKey: "notifications.followedChannel",
    },
    {
        id: "4",
        group: "yesterday",
        type: "approval",
        titleKey: "notifications.items.accountActivated.title",
        bodyKey: "notifications.items.accountActivated.body",
        timeKey: "notifications.times.yesterday",
        unread: false,
        icon: "check-circle",
        iconType: "feather",
        colorKey: "notificationApproval",
    },
    {
        id: "5",
        group: "yesterday",
        type: "message",
        titleKey: "notifications.items.chatGroup.title",
        bodyKey: "notifications.items.chatGroup.body",
        timeKey: "notifications.times.yesterday",
        unread: true,
        icon: "users",
        iconType: "feather",
        colorKey: "notificationMessage",
    },
    {
        id: "6",
        group: "earlier",
        type: "channel",
        titleKey: "notifications.items.shippingRates.title",
        bodyKey: "notifications.items.shippingRates.body",
        timeKey: "notifications.times.twoDaysAgo",
        unread: false,
        icon: "radio",
        iconType: "feather",
        colorKey: "notificationShippingRates",
        // badgeKey: "notifications.followedChannel",
    },
];


async function fetchNotificationsFromApi() {
    // هون بعدين بتحطي طلب الـ API الحقيقي.
    // مثال لاحقاً:
    // const response = await api.get("/notifications");
    // return response.data;

    return null;
}

export default function Notifications({ navigation }) {
    const { t, i18n } = useTranslation();
    const isArabic = i18n.language === "ar";

    const [showNavTitle, setShowNavTitle] = useState(false);
    const [notifications, setNotifications] = useState(FALLBACK_NOTIFICATIONS);
    const [isLoading, setIsLoading] = useState(false);

    const mainScrollRef = useRef(null);

    const { colors, isDark } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const unreadCount = notifications.filter((item) => item.unread).length;

    useEffect(() => {
        let isMounted = true;

        const loadNotifications = async () => {
            try {
                setIsLoading(true);

                const apiNotifications = await fetchNotificationsFromApi();

                if (isMounted && Array.isArray(apiNotifications) && apiNotifications.length > 0) {
                    setNotifications(apiNotifications);
                }
            } catch (error) {
                console.log("Failed to load notifications:", error);
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        loadNotifications();

        return () => {
            isMounted = false;
        };
    }, []);

    const groupedNotifications = useMemo(
        () => ({
            today: notifications.filter((item) => item.group === "today"),
            yesterday: notifications.filter((item) => item.group === "yesterday"),
            earlier: notifications.filter((item) => item.group === "earlier"),
        }),
        [notifications]
    );

    const toggleLanguage = async () => {
        const nextLanguage = isArabic ? "en" : "ar";

        setShowNavTitle(false);

        await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
        await i18n.changeLanguage(nextLanguage);

        setTimeout(() => {
            mainScrollRef.current?.scrollTo({
                y: 0,
                animated: false,
            });
        }, 80);
    };

    const handleScroll = (event) => {
        const y = event.nativeEvent.contentOffset.y;

        if (y > 45 && !showNavTitle) {
            setShowNavTitle(true);
        }

        if (y <= 45 && showNavTitle) {
            setShowNavTitle(false);
        }
    };

    const handleMarkAllAsRead = () => {
        setNotifications((currentNotifications) =>
            currentNotifications.map((item) => ({
                ...item,
                unread: false,
            }))
        );
    };

    const handleNotificationPress = (notification) => {
        setNotifications((currentNotifications) =>
            currentNotifications.map((item) =>
                item.id === notification.id ? { ...item, unread: false } : item
            )
        );

        if (notification.type === "message") {
            navigation.navigate("Chat");
            return;
        }

        if (notification.type === "channel" || notification.type === "exchange") {
            navigation.navigate("Channels");
        }
    };

    const handleNotificationSettingsPress = () => {
        navigation.navigate("NotificationSettings");
    };
    return (
        <View style={styles.root}>
            <StatusBar
                style={isDark ? "light" : "dark"}
                translucent
                backgroundColor="transparent"
            />

            <MainNavBar
                navigation={navigation}
                title={t("notifications.navTitle")}
                showTitle={showNavTitle}
                notificationCount={unreadCount}
                onToggleLanguage={toggleLanguage}
                menuItems={[
                    {
                        key: "profile",
                        label: t("bottomTabs.profile"),
                        iconType: "feather",
                        iconName: "user",
                        onPress: () => navigation.navigate("Profile"),
                    },
                ]}
            />

            <ScrollView
                ref={mainScrollRef}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                onScroll={handleScroll}
                scrollEventThrottle={16}
            >
                <View style={[styles.headerBox, getRowDirectionStyle(isArabic)]}>
                    <TouchableOpacity
                        activeOpacity={0.85}
                        style={styles.backButton}
                        onPress={() => navigation.goBack()}
                    >
                        <Feather
                            name={isArabic ? "chevron-right" : "chevron-left"}
                            size={22}
                            color={colors.textPrimary}
                        />
                    </TouchableOpacity>

                    <View style={styles.headerTextBox}>
                        <Text style={[styles.title, getTextDirectionStyle(isArabic)]}>
                            {t("notifications.title")}
                        </Text>

                        <Text style={[styles.subtitle, getTextDirectionStyle(isArabic)]}>
                            {t("notifications.subtitle")}
                        </Text>
                    </View>
                </View>

                <View style={[styles.actionsRow, getRowDirectionStyle(isArabic)]}>
                    <TouchableOpacity
                        activeOpacity={0.85}
                        style={[styles.actionButton, getRowDirectionStyle(isArabic)]}
                        onPress={handleMarkAllAsRead}
                    >
                        <View style={styles.actionIconCircle}>
                            <Feather name="check" size={17} color={colors.textPrimary} />
                        </View>

                        <Text
                            numberOfLines={1}
                            style={[
                                styles.actionButtonText,
                                getTextDirectionStyle(isArabic),
                            ]}
                        >
                            {t("notifications.markAllAsRead")}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        activeOpacity={0.85}
                        style={[styles.actionButton, getRowDirectionStyle(isArabic)]}
                        // onPress={handleNotificationSettingsPress}
                        onPress={() => console.log("Open notification settings")}
                    >
                        <View style={styles.actionIconCircle}>
                            <Feather
                                name="settings"
                                size={17}
                                color={colors.textPrimary}
                            />
                        </View>

                        <Text
                            numberOfLines={1}
                            style={[
                                styles.actionButtonText,
                                getTextDirectionStyle(isArabic),
                            ]}
                        >
                            {t("notifications.notificationSettings")}
                        </Text>

                        <Feather
                            name={isArabic ? "chevron-left" : "chevron-right"}
                            size={18}
                            color={colors.textSecondary}
                        />
                    </TouchableOpacity>
                </View>

                <NotificationGroup
                    title={t("notifications.groups.today")}
                    data={groupedNotifications.today}
                    styles={styles}
                    colors={colors}
                    isArabic={isArabic}
                    t={t}
                    onPress={handleNotificationPress}
                />

                <NotificationGroup
                    title={t("notifications.groups.yesterday")}
                    data={groupedNotifications.yesterday}
                    styles={styles}
                    colors={colors}
                    isArabic={isArabic}
                    t={t}
                    onPress={handleNotificationPress}
                />

                <NotificationGroup
                    title={t("notifications.groups.earlier")}
                    data={groupedNotifications.earlier}
                    styles={styles}
                    colors={colors}
                    isArabic={isArabic}
                    t={t}
                    onPress={handleNotificationPress}
                />

                <View style={[styles.noteBox, getRowDirectionStyle(isArabic)]}>
                    <Feather
                        name="lock"
                        size={15}
                        color={colors.textMuted}
                        style={styles.noteIcon}
                    />

                    <Text
                        style={[
                            styles.noteText,
                            getTextDirectionStyle(isArabic),
                        ]}
                    >
                        {t("notifications.followNote")}
                    </Text>
                </View>
            </ScrollView>
        </View>
    );
}

function NotificationGroup({
    title,
    data,
    styles,
    colors,
    isArabic,
    t,
    onPress,
}) {
    if (!data.length) {
        return null;
    }

    return (
        <View style={styles.groupBox}>
            <Text style={[styles.groupTitle, getTextDirectionStyle(isArabic)]}>
                {title}
            </Text>

            {data.map((item) => (
                <NotificationCard
                    key={item.id}
                    item={item}
                    styles={styles}
                    colors={colors}
                    isArabic={isArabic}
                    t={t}
                    onPress={() => onPress(item)}
                />
            ))}
        </View>
    );
}

function NotificationCard({ item, styles, colors, isArabic, t, onPress }) {
    const notificationColor = colors[item.colorKey] || colors.primary;
    return (
        <TouchableOpacity
            activeOpacity={0.88}
            style={[
                styles.notificationCard,
                item.unread && styles.notificationCardUnread,
                getRowDirectionStyle(isArabic),
            ]}
            onPress={onPress}
        >
            {item.unread && (
                <View style={styles.unreadDotBox}>
                    <View style={styles.unreadDot} />
                </View>
            )}

            <View
                style={[
                    styles.notificationIconBox,
                    {
                        backgroundColor: `${notificationColor}20`,
                        borderColor: `${notificationColor}55`,
                    },
                ]}
            >
                <NotificationIcon item={item} color={notificationColor} />
            </View>

            <View style={styles.notificationContent}>
                <View style={[styles.notificationTop, getRowDirectionStyle(isArabic)]}>
                    <View style={styles.notificationTitleBox}>
                        <View style={[styles.titleRow, getRowDirectionStyle(isArabic)]}>
                            <Text
                                numberOfLines={1}
                                style={[
                                    styles.notificationTitle,
                                    getTextDirectionStyle(isArabic),
                                ]}
                            >
                                {t(item.titleKey)}
                            </Text>

                            {/* {!!item.badgeKey && (
                                <View style={styles.badge}>
                                    <Text numberOfLines={1} style={styles.badgeText}>
                                        {t(item.badgeKey)}
                                    </Text>
                                </View>
                            )} */}
                        </View>

                        <Text
                            numberOfLines={2}
                            style={[
                                styles.notificationBody,
                                getTextDirectionStyle(isArabic),
                            ]}
                        >
                            {t(item.bodyKey)}
                        </Text>
                    </View>

                    <View
                        style={[
                            styles.timeBox,
                            isArabic && styles.timeBoxArabic,
                        ]}
                    >
                        <Text
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.82}
                            style={[
                                styles.notificationTime,
                                isArabic && styles.notificationTimeArabic,
                            ]}
                        >
                            {t(item.timeKey)}
                        </Text>

                        <Feather
                            name={isArabic ? "chevron-left" : "chevron-right"}
                            size={18}
                            color={colors.textSecondary}
                        />
                    </View>
                </View>
            </View>
        </TouchableOpacity>
    );
}

function NotificationIcon({ item, color }) {
    if (item.iconType === "material") {
        return <MaterialCommunityIcons name={item.icon} size={27} color={color} />;
    }

    return <Feather name={item.icon} size={25} color={color} />;
}

const createStyles = (colors) =>
    StyleSheet.create({
        root: {
            flex: 1,
            backgroundColor: colors.background,
        },

        scrollContent: {
            flexGrow: 1,
            paddingHorizontal: 20,
            paddingTop: Platform.OS === "android" ? 140 : 150,
            paddingBottom: Platform.OS === "android" ? 130 : 150,
        },

        headerBox: {
            flexDirection: "row",
            alignItems: "flex-start",
            gap: 12,
            marginBottom: 18,
        },

        backButton: {
            width: 50,
            height: 50,
            borderRadius: 50,
            backgroundColor: colors.cardSoft,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: "center",
            justifyContent: "center",
        },

        headerTextBox: {
            flex: 1,
        },

        title: {
            color: colors.textPrimary,
            fontSize: 25,
            fontWeight: "900",
            marginBottom: 6,
        },

        subtitle: {
            color: colors.textSecondary,
            fontSize: 15,
            lineHeight: 22,
            fontWeight: "600",
        },

        actionsRow: {
            flexDirection: "row",
            gap: 12,
            marginBottom: 22,
        },

        actionButton: {
            flex: 1,
            minHeight: 58,
            borderRadius: 16,
            backgroundColor: colors.cardStrong,
            borderWidth: 1,
            borderColor: colors.borderSoft,
            paddingHorizontal: 10,
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
        },

        actionIconCircle: {
            width: 31,
            height: 31,
            borderRadius: 15.5,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.cardSoft,
        },

        actionButtonText: {
            flex: 1,
            color: colors.textPrimary,
            fontSize: 13,
            fontWeight: "600",
        },

        groupBox: {
            marginBottom: 18,
        },

        groupTitle: {
            color: colors.textPrimary,
            fontSize: 21,
            fontWeight: "900",
            marginBottom: 10,
        },

        notificationCard: {
            flexDirection: "row",
            alignItems: "center",
            minHeight: 88,
            borderRadius: 16,
            backgroundColor: colors.cardStrong,
            borderWidth: 1,
            borderColor: colors.borderSoft,
            marginBottom: 10,
            paddingVertical: 10,
            paddingHorizontal: 10,
        },

        notificationCardUnread: {
            borderColor: colors.primary,
        },

        unreadDotBox: {
            width: 14,
            alignItems: "center",
            justifyContent: "center",
        },

        unreadDot: {
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: colors.primary,
        },

        notificationIconBox: {
            width: 58,
            height: 58,
            borderRadius: 14,
            borderWidth: 1,
            alignItems: "center",
            justifyContent: "center",
            marginHorizontal: 10,
        },

        notificationContent: {
            flex: 1,
            justifyContent: "center",
        },

        notificationTop: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
        },

        notificationTitleBox: {
            flex: 1,
            minWidth: 0,
        },
        titleRow: {
            flexDirection: "row",
            alignItems: "center",
            gap: 7,
            marginBottom: 4,
        },

        notificationTitle: {
            flexShrink: 1,
            color: colors.textPrimary,
            fontSize: 14,
            fontWeight: "900",
        },

        badge: {
            maxWidth: 110,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colors.primary,
            paddingHorizontal: 7,
            paddingVertical: 2,
            backgroundColor: colors.cardSoft,
        },

        badgeText: {
            color: colors.primary,
            fontSize: 10,
            fontWeight: "800",
        },

        notificationBody: {
            color: colors.textSecondary,
            fontSize: 12,
            lineHeight: 20,
            fontWeight: "600",
        },

        timeBox: {
            width: 64,
            alignItems: "flex-end",
            justifyContent: "center",
            gap: 30,
        },

        timeBoxArabic: {
            width: 86,
            alignItems: "flex-start",
        },

        notificationTime: {
            color: colors.textMuted,
            fontSize: 11,
            fontWeight: "700",
            textAlign: "right",
        },

        notificationTimeArabic: {
            textAlign: "left",
        },

        noteBox: {
            marginTop: 2,
            marginBottom: 16,
            flexDirection: "row",
            alignItems: "flex-start",
            alignSelf: "stretch",
            paddingHorizontal: 0,
            gap: 8,
        },

        noteIcon: {
            marginTop: 2,
        },

        noteText: {
            flex: 1,
            color: colors.textMuted,
            fontSize: 13,
            lineHeight: 20,
            fontWeight: "600",
            textAlign: "center",
        },
    });
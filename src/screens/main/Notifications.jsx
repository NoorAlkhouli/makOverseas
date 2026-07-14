import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    ActivityIndicator,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

import MainNavBar from "@/src/components/MainNavBar";
import { useAppRealtime } from "@/src/context/AppRealtimeProvider";
import { useNotificationCount } from "@/src/context/NotificationCountProvider";
import { LANGUAGE_STORAGE_KEY } from "@/src/i18n";
import apiClient from "@/src/services/api/apiClient";
import notificationService from "@/src/services/api/notificationService";
import {
    getRowDirectionStyle,
    getTextDirectionStyle,
} from "@/src/styles/globalStyles";
import { useAppTheme } from "@/src/theme/ThemeProvider";

const NOTIFICATION_VISUALS = {
    2: {
        icon: "message-circle",
        iconType: "feather",
        colorKey: "notificationMessage",
    },
    3: {
        icon: "phone-incoming",
        iconType: "feather",
        colorKey: "notificationMessage",
    },
    4: {
        icon: "phone-missed",
        iconType: "feather",
        colorKey: "notificationMessage",
    },
    5: {
        icon: "newspaper-variant-outline",
        iconType: "material",
        colorKey: "notificationCompanyNews",
    },
    6: {
        icon: "check-circle",
        iconType: "feather",
        colorKey: "notificationApproval",
    },
};

const DEFAULT_NOTIFICATION_VISUAL = {
    icon: "bell",
    iconType: "feather",
    colorKey: "primary",
};

const getCalendarDayNumber = (value) => {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
};

const getNotificationGroup = (createdAt) => {
    const today = getCalendarDayNumber(new Date());
    const createdDay = getCalendarDayNumber(createdAt);

    if (createdDay === null) {
        return "earlier";
    }

    const dayDifference = Math.round((today - createdDay) / 86400000);

    if (dayDifference <= 0) {
        return "today";
    }

    if (dayDifference === 1) {
        return "yesterday";
    }

    return "earlier";
};

const formatNotificationTime = (createdAt, isArabic) => {
    const date = new Date(createdAt);

    if (Number.isNaN(date.getTime())) {
        return "";
    }

    const locale = isArabic ? "ar" : "en";
    const group = getNotificationGroup(createdAt);

    if (group === "today" || group === "yesterday") {
        return new Intl.DateTimeFormat(locale, {
            hour: "numeric",
            minute: "2-digit",
        }).format(date);
    }

    return new Intl.DateTimeFormat(locale, {
        day: "numeric",
        month: "short",
    }).format(date);
};

const normalizeNotification = (notification, isArabic) => {
    const visual =
        NOTIFICATION_VISUALS[notification?.type] ?? DEFAULT_NOTIFICATION_VISUAL;

    return {
        ...notification,
        id: String(notification.id),
        title: notification.title || "",
        body: notification.body || "",
        unread: !notification.read_at,
        group: getNotificationGroup(notification.created_at),
        timeText: formatNotificationTime(notification.created_at, isArabic),
        ...visual,
    };
};

const getRealtimeNotification = (payload) => {
    if (!payload || typeof payload !== "object") {
        return null;
    }

    if (payload.notification?.id) {
        return payload.notification;
    }

    if (payload.data?.notification?.id) {
        return payload.data.notification;
    }

    if (payload.id && (payload.title || payload.type)) {
        return payload;
    }

    if (payload.data?.id && (payload.data?.title || payload.data?.type)) {
        return payload.data;
    }

    return null;
};

const getRealtimeReadState = (payload) => {
    if (!payload || typeof payload !== "object") {
        return null;
    }

    if (
        payload.all !== undefined ||
        Array.isArray(payload.ids) ||
        payload.unread_count !== undefined
    ) {
        return payload;
    }

    if (
        payload.data?.all !== undefined ||
        Array.isArray(payload.data?.ids) ||
        payload.data?.unread_count !== undefined
    ) {
        return payload.data;
    }

    return null;
};

export default function Notifications({ navigation }) {
    const { t, i18n } = useTranslation();
    const isArabic = i18n.language === "ar";
    const {
        latestNotificationEvent,
        latestNotificationReadStateEvent,
    } = useAppRealtime();
    const {
        notificationCount,
        setNotificationCount,
        decrementNotificationCount,
        markAllNotificationsReadLocally,
    } = useNotificationCount();

    const [showNavTitle, setShowNavTitle] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isMarkingAll, setIsMarkingAll] = useState(false);
    const [openingNotificationId, setOpeningNotificationId] = useState(null);
    const [errorMessage, setErrorMessage] = useState("");

    const mainScrollRef = useRef(null);
    const notificationIdsRef = useRef(new Set());
    const handledNotificationEventRef = useRef(null);
    const handledReadStateEventRef = useRef(null);

    const { colors, isDark } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const loadNotifications = useCallback(
        async ({ refreshing = false } = {}) => {
            try {
                setErrorMessage("");

                if (refreshing) {
                    setIsRefreshing(true);
                } else {
                    setIsLoading(true);
                }

                const result = await notificationService.getNotifications({
                    page: 1,
                    perPage: 100,
                });

                const nextNotifications = result.items.map((item) =>
                    normalizeNotification(item, isArabic),
                );

                notificationIdsRef.current = new Set(
                    nextNotifications.map((item) => String(item.id)),
                );

                setNotifications(nextNotifications);
                setNotificationCount(result.unreadCount);
            } catch (error) {
                console.log("Failed to load notifications:", error);
                setErrorMessage(
                    error?.userMessage ||
                    (isArabic
                        ? "تعذّر تحميل الإشعارات. حاولي مرة ثانية."
                        : "Couldn't load notifications. Please try again."),
                );
            } finally {
                setIsLoading(false);
                setIsRefreshing(false);
            }
        },
        [isArabic, setNotificationCount],
    );

    useFocusEffect(
        useCallback(() => {
            loadNotifications();
        }, [loadNotifications]),
    );

    useEffect(() => {
        if (
            !latestNotificationEvent ||
            handledNotificationEventRef.current === latestNotificationEvent
        ) {
            return;
        }

        handledNotificationEventRef.current = latestNotificationEvent;

        const realtimeNotification = getRealtimeNotification(
            latestNotificationEvent,
        );

        if (!realtimeNotification?.id) {
            return;
        }

        const normalizedNotification = normalizeNotification(
            realtimeNotification,
            isArabic,
        );
        const notificationId = String(normalizedNotification.id);

        notificationIdsRef.current.add(notificationId);

        setNotifications((currentNotifications) => {
            const withoutDuplicate = currentNotifications.filter(
                (item) => String(item.id) !== notificationId,
            );

            return [normalizedNotification, ...withoutDuplicate];
        });

        // العداد المشترك يتحدث من NotificationCountProvider.
    }, [isArabic, latestNotificationEvent]);

    useEffect(() => {
        if (
            !latestNotificationReadStateEvent ||
            handledReadStateEventRef.current === latestNotificationReadStateEvent
        ) {
            return;
        }

        handledReadStateEventRef.current = latestNotificationReadStateEvent;

        const readState = getRealtimeReadState(
            latestNotificationReadStateEvent,
        );

        if (!readState) {
            return;
        }

        const markAllAsRead =
            readState.all === true ||
            readState.all === 1 ||
            readState.all === "1";
        const readIds = new Set(
            (Array.isArray(readState.ids) ? readState.ids : []).map(String),
        );
        const readAt = readState.read_at || new Date().toISOString();

        setNotifications((currentNotifications) =>
            currentNotifications.map((item) => {
                if (!markAllAsRead && !readIds.has(String(item.id))) {
                    return item;
                }

                return {
                    ...item,
                    unread: false,
                    read_at: item.read_at || readAt,
                };
            }),
        );

        const realtimeUnreadCount = Number(readState.unread_count);

        if (Number.isFinite(realtimeUnreadCount)) {
            setNotificationCount(realtimeUnreadCount);
        }
    }, [latestNotificationReadStateEvent, setNotificationCount]);

    const groupedNotifications = useMemo(
        () => ({
            today: notifications.filter((item) => item.group === "today"),
            yesterday: notifications.filter((item) => item.group === "yesterday"),
            earlier: notifications.filter((item) => item.group === "earlier"),
        }),
        [notifications],
    );

    const toggleLanguage = async () => {
        const nextLanguage = isArabic ? "en" : "ar";

        setShowNavTitle(false);

        await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
        await apiClient.setLanguage(nextLanguage);
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

    const handleMarkAllAsRead = async () => {
        if (isMarkingAll || notificationCount === 0) {
            return;
        }

        try {
            setIsMarkingAll(true);
            setErrorMessage("");

            const result = await notificationService.markAllAsRead();
            const readAt = new Date().toISOString();

            setNotifications((currentNotifications) =>
                currentNotifications.map((item) => ({
                    ...item,
                    unread: false,
                    read_at: item.read_at || readAt,
                })),
            );
            markAllNotificationsReadLocally(result.unreadCount);
        } catch (error) {
            console.log("Failed to mark all notifications as read:", error);
            setErrorMessage(
                error?.userMessage ||
                (isArabic
                    ? "تعذّر تعليم الإشعارات كمقروءة."
                    : "Couldn't mark notifications as read."),
            );
        } finally {
            setIsMarkingAll(false);
        }
    };

    const navigateFromNotification = (notification) => {
        const action = notification?.action || {};
        const notificationData = notification?.data || {};
        const actionKey = action.key;

        const params = {
            notificationId: notification.id,
            notificationAction: action,
            conversationId:
                action.conversation_id ?? notificationData.conversation_id ?? null,
            messageId: action.message_id ?? notificationData.message_id ?? null,
            quoteId: action.quote_id ?? notificationData.quote_id ?? null,
            callId: action.call_id ?? notificationData.call_id ?? null,
            channelId: action.channel_id ?? notificationData.channel_id ?? null,
            postId: action.post_id ?? notificationData.post_id ?? null,
        };

        if (
            actionKey === "open_conversation" ||
            actionKey === "open_message" ||
            actionKey === "open_quote"
        ) {
            if (!params.conversationId) {
                navigation.navigate("Chat", params);
                return;
            }

            const authenticatedAppNavigation = navigation.getParent?.();

            if (!authenticatedAppNavigation) {
                console.log(
                    "Authenticated app navigator is unavailable for notification:",
                    params,
                );
                return;
            }

            authenticatedAppNavigation.navigate("IndividualChat", {
                ...params,
                conversation_id: params.conversationId,
                message_id: params.messageId,
                quote_id: params.quoteId,
            });
            return;
        }

        if (actionKey === "open_call") {
            navigation.navigate("Calls", params);
            return;
        }

        if (actionKey === "open_channel" || actionKey === "open_channel_post") {
            navigation.navigate("Channels", {
                ...params,
                channel_id: params.channelId,
                post_id: params.postId,
            });
            return;
        }

        if (actionKey === "open_home") {
            navigation.navigate("Home", params);
            return;
        }

        if (actionKey === "open_profile") {
            navigation.navigate("Profile", params);
        }
    };

    const handleNotificationPress = async (notification) => {
        if (openingNotificationId) {
            return;
        }

        const wasUnread = notification.unread;

        try {
            setOpeningNotificationId(notification.id);
            setErrorMessage("");

            const clickedNotification = await notificationService.click(
                notification.id,
            );
            const normalizedNotification = normalizeNotification(
                clickedNotification || notification,
                isArabic,
            );

            setNotifications((currentNotifications) =>
                currentNotifications.map((item) =>
                    item.id === notification.id ? normalizedNotification : item,
                ),
            );

            if (wasUnread) {
                decrementNotificationCount(notification.id);
            }

            navigateFromNotification(normalizedNotification);
        } catch (error) {
            console.log("Failed to open notification:", error);
            setErrorMessage(
                error?.userMessage ||
                (isArabic
                    ? "تعذّر فتح الإشعار. حاولي مرة ثانية."
                    : "Couldn't open the notification. Please try again."),
            );
        } finally {
            setOpeningNotificationId(null);
        }
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
                refreshControl={
                    <RefreshControl
                        refreshing={isRefreshing}
                        onRefresh={() => loadNotifications({ refreshing: true })}
                        tintColor={colors.primary}
                        colors={[colors.primary]}
                    />
                }
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
                        disabled={isMarkingAll || notificationCount === 0}
                        style={[
                            styles.actionButton,
                            (isMarkingAll || notificationCount === 0) &&
                            styles.actionButtonDisabled,
                            getRowDirectionStyle(isArabic),
                        ]}
                        onPress={handleMarkAllAsRead}
                    >
                        <View style={styles.actionIconCircle}>
                            {isMarkingAll ? (
                                <ActivityIndicator size="small" color={colors.textPrimary} />
                            ) : (
                                <Feather name="check" size={17} color={colors.textPrimary} />
                            )}
                        </View>

                        <Text
                            numberOfLines={1}
                            style={[styles.actionButtonText, getTextDirectionStyle(isArabic)]}
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
                            <Feather name="settings" size={17} color={colors.textPrimary} />
                        </View>

                        <Text
                            numberOfLines={1}
                            style={[styles.actionButtonText, getTextDirectionStyle(isArabic)]}
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

                {!!errorMessage && (
                    <View style={styles.errorBox}>
                        <Text style={[styles.errorText, getTextDirectionStyle(isArabic)]}>
                            {errorMessage}
                        </Text>

                        <TouchableOpacity
                            activeOpacity={0.85}
                            style={styles.retryButton}
                            onPress={() => loadNotifications()}
                        >
                            <Text style={styles.retryButtonText}>
                                {isArabic ? "إعادة المحاولة" : "Try again"}
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}

                {isLoading && notifications.length === 0 ? (
                    <View style={styles.loadingBox}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={styles.loadingText}>
                            {isArabic
                                ? "جارٍ تحميل الإشعارات..."
                                : "Loading notifications..."}
                        </Text>
                    </View>
                ) : notifications.length === 0 && !errorMessage ? (
                    <View style={styles.emptyBox}>
                        <Feather name="bell-off" size={34} color={colors.textMuted} />
                        <Text style={styles.emptyTitle}>
                            {isArabic ? "لا توجد إشعارات" : "No notifications"}
                        </Text>
                        <Text style={styles.emptyText}>
                            {isArabic
                                ? "ستظهر إشعاراتك الجديدة هنا."
                                : "Your new notifications will appear here."}
                        </Text>
                    </View>
                ) : (
                    <>
                        <NotificationGroup
                            title={t("notifications.groups.today")}
                            data={groupedNotifications.today}
                            styles={styles}
                            colors={colors}
                            isArabic={isArabic}
                            openingNotificationId={openingNotificationId}
                            onPress={handleNotificationPress}
                        />

                        <NotificationGroup
                            title={t("notifications.groups.yesterday")}
                            data={groupedNotifications.yesterday}
                            styles={styles}
                            colors={colors}
                            isArabic={isArabic}
                            openingNotificationId={openingNotificationId}
                            onPress={handleNotificationPress}
                        />

                        <NotificationGroup
                            title={t("notifications.groups.earlier")}
                            data={groupedNotifications.earlier}
                            styles={styles}
                            colors={colors}
                            isArabic={isArabic}
                            openingNotificationId={openingNotificationId}
                            onPress={handleNotificationPress}
                        />
                    </>
                )}

                <View style={[styles.noteBox, getRowDirectionStyle(isArabic)]}>
                    <Feather
                        name="lock"
                        size={15}
                        color={colors.textMuted}
                        style={styles.noteIcon}
                    />

                    <Text style={[styles.noteText, getTextDirectionStyle(isArabic)]}>
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
    openingNotificationId,
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
                    isOpening={openingNotificationId === item.id}
                    onPress={() => onPress(item)}
                />
            ))}
        </View>
    );
}

function NotificationCard({
    item,
    styles,
    colors,
    isArabic,
    isOpening,
    onPress,
}) {
    const notificationColor = colors[item.colorKey] || colors.primary;

    return (
        <TouchableOpacity
            activeOpacity={0.88}
            disabled={isOpening}
            style={[
                styles.notificationCard,
                item.unread && styles.notificationCardUnread,
                isOpening && styles.notificationCardOpening,
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
                                {item.title}
                            </Text>
                        </View>

                        <Text
                            numberOfLines={2}
                            style={[styles.notificationBody, getTextDirectionStyle(isArabic)]}
                        >
                            {item.body}
                        </Text>
                    </View>

                    <View style={[styles.timeBox, isArabic && styles.timeBoxArabic]}>
                        <Text
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.82}
                            style={[
                                styles.notificationTime,
                                isArabic && styles.notificationTimeArabic,
                            ]}
                        >
                            {item.timeText}
                        </Text>

                        {isOpening ? (
                            <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                            <Feather
                                name={isArabic ? "chevron-left" : "chevron-right"}
                                size={18}
                                color={colors.textSecondary}
                            />
                        )}
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

        actionButtonDisabled: {
            opacity: 0.55,
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

        notificationCardOpening: {
            opacity: 0.7,
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

        loadingBox: {
            minHeight: 220,
            alignItems: "center",
            justifyContent: "center",
            gap: 14,
        },

        loadingText: {
            color: colors.textSecondary,
            fontSize: 14,
            fontWeight: "700",
        },

        emptyBox: {
            minHeight: 220,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: colors.borderSoft,
            backgroundColor: colors.cardStrong,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 24,
            gap: 9,
            marginBottom: 18,
        },

        emptyTitle: {
            color: colors.textPrimary,
            fontSize: 17,
            fontWeight: "900",
            textAlign: "center",
        },

        emptyText: {
            color: colors.textSecondary,
            fontSize: 13,
            lineHeight: 20,
            fontWeight: "600",
            textAlign: "center",
        },

        errorBox: {
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.notificationApproval || colors.primary,
            backgroundColor: colors.cardStrong,
            padding: 14,
            gap: 10,
            marginBottom: 16,
        },

        errorText: {
            color: colors.textPrimary,
            fontSize: 13,
            lineHeight: 20,
            fontWeight: "700",
        },

        retryButton: {
            minHeight: 38,
            borderRadius: 11,
            backgroundColor: colors.primary,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 16,
            alignSelf: "flex-start",
        },

        retryButtonText: {
            color: colors.background,
            fontSize: 13,
            fontWeight: "900",
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
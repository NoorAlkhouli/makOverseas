import { Feather, Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import {
    DeviceEventEmitter,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useTranslation } from "react-i18next";

import { useAppRealtime } from "@/src/context/AppRealtimeProvider";
import chatService from "@/src/services/api/chatService";
import { getRowDirectionStyle } from "@/src/styles/globalStyles";
import { useAppTheme } from "@/src/theme/ThemeProvider";

export const BOTTOM_TAB_BADGE_EVENTS = {
    CLEAR_CHAT_CONVERSATION: "bottom-tab-clear-chat-conversation",
    CLEAR_ALL_CHAT: "bottom-tab-clear-all-chat",
    CLEAR_CHANNELS: "bottom-tab-clear-channels",
};

const getNestedValue = (object, paths, fallback = null) => {
    for (const path of paths) {
        const value = String(path)
            .split(".")
            .reduce((current, key) => current?.[key], object);

        if (value !== undefined && value !== null && value !== "") {
            return value;
        }
    }

    return fallback;
};

const normalizeId = (value) => {
    if (value === undefined || value === null || value === "") {
        return null;
    }

    if (typeof value === "object") {
        return null;
    }

    return String(value);
};

const getConversationItems = (response) => {
    if (Array.isArray(response)) return response;
    if (Array.isArray(response?.items)) return response.items;
    if (Array.isArray(response?.data)) return response.data;
    if (Array.isArray(response?.data?.items)) return response.data.items;
    if (Array.isArray(response?.conversations)) return response.conversations;
    if (Array.isArray(response?.data?.conversations)) return response.data.conversations;

    return [];
};

const getConversationIdFromItem = (conversation) => {
    return normalizeId(
        getNestedValue(conversation, [
            "id",
            "conversation_id",
            "conversationId",
        ])
    );
};

const getConversationUnreadFromItem = (conversation) => {
    const value = getNestedValue(conversation, [
        "unread_count",
        "unread",
        "unread_messages_count",
    ], 0);

    const numberValue = Number(value || 0);

    return Number.isFinite(numberValue) ? numberValue : 0;
};

const getConversationIdFromPayload = (payload) => {
    return normalizeId(
        getNestedValue(payload, [
            "conversation_id",
            "conversationId",
            "conversation.id",
            "conversation.conversation_id",
            "data.conversation_id",
            "data.conversationId",
            "data.conversation.id",
            "message.conversation_id",
            "message.conversationId",
            "data.message.conversation_id",
            "data.message.conversationId",
        ])
    );
};

const getUnreadCountFromPayload = (payload) => {
    const value = getNestedValue(payload, [
        "unread_count",
        "unread",
        "unread_messages_count",
        "data.unread_count",
        "data.unread",
        "data.unread_messages_count",
        "conversation.unread_count",
        "conversation.unread",
        "data.conversation.unread_count",
        "data.conversation.unread",
    ]);

    if (value === undefined || value === null || value === "") {
        return null;
    }

    const numberValue = Number(value);

    return Number.isFinite(numberValue) ? numberValue : null;
};

const isChannelNotificationPayload = (payload) => {
    const typeText = String(
        getNestedValue(payload, [
            "type",
            "notification_type",
            "notificationType",
            "event",
            "data.type",
            "data.notification_type",
            "data.notificationType",
            "data.event",
            "category",
            "data.category",
        ], "")
    ).toLowerCase();

    if (
        typeText.includes("channel") ||
        typeText.includes("post") ||
        typeText.includes("news")
    ) {
        return true;
    }

    return !!getNestedValue(payload, [
        "channel_id",
        "channelId",
        "channel.id",
        "post_id",
        "postId",
        "post.id",
        "data.channel_id",
        "data.channelId",
        "data.channel.id",
        "data.post_id",
        "data.postId",
        "data.post.id",
    ]);
};

const getNotificationUnreadCountFromPayload = (payload) => {
    const value = getNestedValue(payload, [
        "unread_count",
        "unreadCount",
        "notifications_unread_count",
        "notification_unread_count",
        "data.unread_count",
        "data.unreadCount",
        "data.notifications_unread_count",
        "data.notification_unread_count",
    ]);

    if (value === undefined || value === null || value === "") {
        return null;
    }

    const numberValue = Number(value);

    return Number.isFinite(numberValue) ? numberValue : null;
};

const formatBadgeCount = (count) => {
    const numberCount = Number(count || 0);

    if (!Number.isFinite(numberCount) || numberCount <= 0) {
        return "";
    }

    if (numberCount > 99) {
        return "99+";
    }

    return String(numberCount);
};

const getTotalUnreadFromMap = (map) => {
    return Object.values(map).reduce(
        (total, value) => total + Number(value || 0),
        0
    );
};

export default function BottomTabBar({ state, navigation }) {
    const { t, i18n } = useTranslation();
    const isArabic = i18n.language === "ar";

    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const {
        latestConversationEvent,
        conversationVersion,
        latestNotificationEvent,
        notificationVersion,
    } = useAppRealtime();

    const currentRouteName = state.routes[state.index]?.name;

    const conversationUnreadMapRef = useRef({});
    const lastHandledConversationVersionRef = useRef(null);
    const lastHandledNotificationVersionRef = useRef(null);

    const [chatBadgeCount, setChatBadgeCount] = useState(0);
    const [channelsBadgeCount, setChannelsBadgeCount] = useState(0);

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
            badgeCount: chatBadgeCount,
        },
        {
            name: "Channels",
            label: t("bottomTabs.channels"),
            icon: "radio",
            iconType: "Feather",
            badgeCount: channelsBadgeCount,
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

    useEffect(() => {
        let isMounted = true;

        const loadInitialChatBadge = async () => {
            try {
                const response = await chatService.listConversations({
                    page: 1,
                    perPage: 100,
                });

                if (!isMounted) {
                    return;
                }

                const nextMap = {};

                getConversationItems(response).forEach((conversation) => {
                    const conversationId = getConversationIdFromItem(conversation);
                    const unreadCount = getConversationUnreadFromItem(conversation);

                    if (conversationId && unreadCount > 0) {
                        nextMap[conversationId] = unreadCount;
                    }
                });

                conversationUnreadMapRef.current = nextMap;
                setChatBadgeCount(getTotalUnreadFromMap(nextMap));

                console.log("[BottomTabBar Badge] Initial chat badge loaded:", {
                    nextMap,
                    total: getTotalUnreadFromMap(nextMap),
                });
            } catch (error) {
                console.log("[BottomTabBar Badge] Initial chat badge error:", error?.raw || error);
            }
        };

        loadInitialChatBadge();

        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        const clearConversationSubscription = DeviceEventEmitter.addListener(
            BOTTOM_TAB_BADGE_EVENTS.CLEAR_CHAT_CONVERSATION,
            (payload) => {
                const conversationId = normalizeId(
                    payload?.conversationId ||
                    payload?.conversation_id ||
                    payload?.id
                );

                if (!conversationId) {
                    return;
                }

                const nextMap = {
                    ...conversationUnreadMapRef.current,
                };

                delete nextMap[conversationId];

                conversationUnreadMapRef.current = nextMap;
                setChatBadgeCount(getTotalUnreadFromMap(nextMap));

                console.log("[BottomTabBar Badge] Cleared chat conversation:", conversationId);
            }
        );

        const clearAllChatSubscription = DeviceEventEmitter.addListener(
            BOTTOM_TAB_BADGE_EVENTS.CLEAR_ALL_CHAT,
            () => {
                conversationUnreadMapRef.current = {};
                setChatBadgeCount(0);

                console.log("[BottomTabBar Badge] Cleared all chat badges.");
            }
        );

        const clearChannelsSubscription = DeviceEventEmitter.addListener(
            BOTTOM_TAB_BADGE_EVENTS.CLEAR_CHANNELS,
            () => {
                setChannelsBadgeCount(0);

                console.log("[BottomTabBar Badge] Cleared channels badge.");
            }
        );

        return () => {
            clearConversationSubscription.remove();
            clearAllChatSubscription.remove();
            clearChannelsSubscription.remove();
        };
    }, []);

    useEffect(() => {
        if (!latestConversationEvent) {
            return;
        }

        if (lastHandledConversationVersionRef.current === conversationVersion) {
            return;
        }

        lastHandledConversationVersionRef.current = conversationVersion;

        const conversationId = getConversationIdFromPayload(latestConversationEvent);
        const unreadCount = getUnreadCountFromPayload(latestConversationEvent);

        console.log("[BottomTabBar Badge] Conversation event:", {
            conversationId,
            unreadCount,
            currentRouteName,
            payload: latestConversationEvent,
        });

        if (!conversationId) {
            return;
        }

        const nextMap = {
            ...conversationUnreadMapRef.current,
        };

        if (unreadCount !== null) {
            if (unreadCount > 0) {
                nextMap[conversationId] = unreadCount;
            } else {
                delete nextMap[conversationId];
            }
        } else {
            const previousValue = Number(nextMap[conversationId] || 0);
            nextMap[conversationId] = previousValue + 1;
        }

        conversationUnreadMapRef.current = nextMap;

        const nextTotal = getTotalUnreadFromMap(nextMap);

        console.log("[BottomTabBar Badge] Next chat badge count:", {
            nextMap,
            nextTotal,
        });

        setChatBadgeCount(nextTotal);
    }, [conversationVersion, currentRouteName, latestConversationEvent]);

    useEffect(() => {
        if (!latestNotificationEvent) {
            return;
        }

        if (lastHandledNotificationVersionRef.current === notificationVersion) {
            return;
        }

        lastHandledNotificationVersionRef.current = notificationVersion;

        if (!isChannelNotificationPayload(latestNotificationEvent)) {
            return;
        }

        const unreadCount = getNotificationUnreadCountFromPayload(latestNotificationEvent);

        console.log("[BottomTabBar Badge] Channel notification event:", {
            unreadCount,
            currentRouteName,
            payload: latestNotificationEvent,
        });

        if (unreadCount !== null) {
            setChannelsBadgeCount(unreadCount);
            return;
        }

        setChannelsBadgeCount((currentCount) => currentCount + 1);
    }, [currentRouteName, latestNotificationEvent, notificationVersion]);

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

    const renderBadge = (count) => {
        const badgeText = formatBadgeCount(count);

        if (!badgeText) {
            return null;
        }

        return (
            <View style={styles.badge}>
                <Text style={styles.badgeText} numberOfLines={1}>
                    {badgeText}
                </Text>
            </View>
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
                            <View style={styles.iconWrapper}>
                                <View
                                    style={[
                                        styles.iconBox,
                                        isActive && styles.activeIconBox,
                                    ]}
                                >
                                    {renderIcon(tab, isActive)}
                                </View>

                                {renderBadge(tab.badgeCount)}
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

        iconWrapper: {
            minWidth: 42,
            height: 32,
            alignItems: "center",
            justifyContent: "center",
            overflow: "visible",
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

        badge: {
            position: "absolute",
            top: -7,
            right: -5,
            minWidth: 20,
            height: 20,
            borderRadius: 10,
            paddingHorizontal: 5,
            backgroundColor: colors.danger || "#ef4444",
            borderWidth: 1.5,
            borderColor: colors.cardStrong,
            alignItems: "center",
            justifyContent: "center",
            zIndex: 20,
            elevation: 20,
        },

        badgeText: {
            color: "#ffffff",
            fontSize: 10,
            fontWeight: "900",
            includeFontPadding: false,
            textAlign: "center",
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
import { Feather } from "@expo/vector-icons";
import React from "react";
import {
    Image,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

export default function EmployeeDirectoryList({
    chats = [],
    styles,
    colors,
    isArabic = false,
    chatLabels = {},
    selectedConversationIds = [],
    selectMode = false,
    onlineUserIds = [],
    isUserOnline,
    normalizeId,
    formatLastSeenText,
    getRowDirectionStyle,
    getTextDirectionStyle,
    getAutoTextDirectionStyle,
    onPressEmployee,
    t,
}) {
    return (
        <>
            {chats.map((chat) => {
                const normalizedTargetUserId = normalizeId(chat.targetUserId);
                const selectableConversationId = normalizeId(chat.conversationId);

                const isSelectedConversation = !!(
                    selectableConversationId &&
                    selectedConversationIds.some(
                        (id) => String(id) === String(selectableConversationId)
                    )
                );

                const liveIsOnline = !!(
                    !chat.isGroup &&
                    normalizedTargetUserId &&
                    typeof isUserOnline === "function" &&
                    isUserOnline(normalizedTargetUserId)
                );

                const chatIsBlocked = chat.isBlocked === true || chat.canSendMessage === false;

                const chatIsOnline = !chatIsBlocked && !chat.isGroup && (
                    liveIsOnline ||
                    (!normalizedTargetUserId && chat.isOnline === true)
                );

                const statusText = chatIsBlocked
                    ? chatLabels.blocked
                    : chatIsOnline
                        ? chatLabels.onlineNow
                        : formatLastSeenText(chat.lastSeenAt, isArabic, chatLabels);

                const statusColor = chatIsBlocked
                    ? colors.danger
                    : chatIsOnline
                        ? colors.primary
                        : colors.textMuted;



                return (
                    <TouchableOpacity
                        key={chat.id}
                        activeOpacity={0.88}
                        style={[styles.chatCard, getRowDirectionStyle(isArabic)]}
                        onPress={() => onPressEmployee?.(chat)}
                    >
                        {selectMode && (
                            <View
                                style={[
                                    styles.selectCircle,
                                    isSelectedConversation && styles.selectCircleSelected,
                                ]}
                            >
                                <Feather
                                    name={isSelectedConversation ? "check" : "circle"}
                                    size={isSelectedConversation ? 17 : 20}
                                    color={
                                        isSelectedConversation
                                            ? colors.darkText
                                            : colors.textSecondary
                                    }
                                />
                            </View>
                        )}

                        <View style={styles.avatarBox}>
                            <View style={styles.avatarCircle}>
                                {chat.avatar ? (
                                    <Image
                                        source={{ uri: chat.avatar }}
                                        style={styles.avatarImage}
                                    />
                                ) : (
                                    <Feather
                                        name="user"
                                        size={28}
                                        color={colors.textPrimary}
                                    />
                                )}
                            </View>

                            <View
                                style={[
                                    styles.statusDot,
                                    !chatIsOnline && !chatIsBlocked && styles.statusDotOffline,
                                    chatIsBlocked && {
                                        backgroundColor: colors.danger,
                                        opacity: 1,
                                    },
                                ]}
                            />
                        </View>

                        <View style={styles.chatInfo}>
                            <View
                                style={[
                                    styles.chatTopRow,
                                    getRowDirectionStyle(isArabic),
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.staffName,
                                        getTextDirectionStyle(isArabic),
                                    ]}
                                    numberOfLines={1}
                                >
                                    {chat.name}
                                </Text>

                                <Text style={styles.chatTime}>{chat.time}</Text>
                            </View>

                            {!!chat.department && (
                                <View
                                    style={[
                                        styles.departmentRow,
                                        getRowDirectionStyle(isArabic),
                                    ]}
                                >
                                    <Text style={styles.departmentText} numberOfLines={1}>
                                        {chat.department}
                                    </Text>
                                </View>
                            )}

                            <Text
                                style={[
                                    styles.presenceText,
                                    { color: statusColor },
                                    getTextDirectionStyle(isArabic),
                                ]}
                                numberOfLines={1}
                            >
                                {statusText}
                            </Text>

                            <Text
                                style={[
                                    styles.messageText,
                                    getAutoTextDirectionStyle(chat.message, isArabic),
                                ]}
                                numberOfLines={2}
                            >
                                {chat.message ||
                                    t?.("chat.noMessagesYet", {
                                        defaultValue: "No messages yet",
                                    }) ||
                                    "No messages yet"}
                            </Text>
                        </View>

                        {chat.unread > 0 && (
                            <View style={styles.unreadBadge}>
                                <Text style={styles.unreadText}>{chat.unread}</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                );
            })}
        </>
    );
}

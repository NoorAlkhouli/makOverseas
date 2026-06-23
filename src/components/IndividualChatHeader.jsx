import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";

const getFirstName = (value = "") => {
    const cleanValue = String(value || "").trim();

    if (!cleanValue) {
        return "";
    }

    return cleanValue.split(/\s+/).filter(Boolean)[0] || "";
};

const getActivityPresenceText = ({
    presenceText,
    activityName,
    isRecordingVoice,
    isTyping,
    tr,
}) => {
    const cleanPresenceText = String(presenceText || "").trim();
    const cleanActivityName = String(activityName || "").trim();
    const firstName = getFirstName(cleanActivityName);

    if (cleanPresenceText && cleanActivityName && firstName) {
        return cleanPresenceText.replace(cleanActivityName, firstName);
    }

    if (cleanPresenceText) {
        return cleanPresenceText;
    }

    if (firstName && isRecordingVoice) {
        return `${firstName} ${tr("recordingNow", "Recording...")}`;
    }

    if (firstName && isTyping) {
        return `${firstName} ${tr("typingNow", "Typing...")}`;
    }

    return "";
};

const getStatusLabel = ({
    isGroup,
    groupSubtitle,
    isBlocked,
    isTyping,
    isRecordingVoice,
    isOnline,
    presenceText,
    activityName,
    tr,
}) => {
    if (isBlocked) {
        return tr("blocked", "Blocked");
    }

    const activityPresenceText = getActivityPresenceText({
        presenceText,
        activityName,
        isRecordingVoice,
        isTyping,
        tr,
    });

    if (isRecordingVoice && activityPresenceText) {
        return activityPresenceText;
    }

    if (isRecordingVoice) {
        return tr("recordingNow", "Recording...");
    }

    if (isTyping && activityPresenceText) {
        return activityPresenceText;
    }

    if (isTyping) {
        return tr("typingNow", "Typing...");
    }

    if (isGroup) {
        return groupSubtitle || tr("groupChat", "Group chat");
    }

    if (presenceText) {
        return presenceText;
    }

    if (isOnline) {
        return tr("onlineNow", "Online now");
    }

    return tr("offline", "Offline");
};

const getStatusColor = ({
    colors,
    isGroup,
    isBlocked,
    isTyping,
    isRecordingVoice,
    isOnline,
}) => {
    if (isBlocked) {
        return colors.danger || colors.text;
    }

    if (isTyping || isRecordingVoice || isOnline) {
        return colors.primary;
    }

    if (isGroup) {
        return colors.blue || colors.primary || colors.text;
    }

    return colors.textMuted || colors.muted || colors.text;
};

const getStatusDotColor = ({
    colors,
    isGroup,
    isBlocked,
    isTyping,
    isRecordingVoice,
    isOnline,
}) => {
    if (isBlocked) {
        return colors.danger || colors.text;
    }

    if (isTyping || isRecordingVoice || isOnline) {
        return colors.primary;
    }

    if (isGroup) {
        return colors.blue || colors.primary || colors.text;
    }

    return colors.textMuted || colors.muted || colors.border;
};

const getResponsiveHeaderMetrics = ({
    isCompactScreen,
    isVeryCompactScreen,
    isShortScreen,
}) => {
    if (isVeryCompactScreen) {
        return {
            headerMinHeight: isShortScreen ? 72 : 76,
            headerPaddingHorizontal: 8,
            headerPaddingTop: isShortScreen ? 4 : 5,
            headerPaddingBottom: isShortScreen ? 6 : 8,
            backButtonSize: 32,
            backIconSize: 22,
            avatarSize: 38,
            avatarRadius: 19,
            avatarIconSize: 20,
            avatarTextSize: 13,
            avatarMarginHorizontal: 6,
            nameSize: 14,
            departmentSize: 10,
            statusTextSize: 11,
            statusDotSize: 7,
            statusGap: 5,
            callButtonSize: 33,
            callButtonRadius: 11,
            callButtonMarginLeft: 4,
            callIconSize: 18,
            menuIconSize: 18,
            showDepartment: true,
        };
    }

    if (isCompactScreen) {
        return {
            headerMinHeight: isShortScreen ? 76 : 82,
            headerPaddingHorizontal: 10,
            headerPaddingTop: isShortScreen ? 5 : 6,
            headerPaddingBottom: isShortScreen ? 7 : 9,
            backButtonSize: 34,
            backIconSize: 23,
            avatarSize: 44,
            avatarRadius: 22,
            avatarIconSize: 22,
            avatarTextSize: 15,
            avatarMarginHorizontal: 7,
            nameSize: 16,
            departmentSize: 12,
            statusTextSize: 12,
            statusDotSize: 8,
            statusGap: 5,
            callButtonSize: 38,
            callButtonRadius: 13,
            callButtonMarginLeft: 6,
            callIconSize: 21,
            menuIconSize: 20,
            showDepartment: true,
        };
    }

    return {
        headerMinHeight: isShortScreen ? 82 : 90,
        headerPaddingHorizontal: 16,
        headerPaddingTop: isShortScreen ? 6 : 8,
        headerPaddingBottom: isShortScreen ? 8 : 12,
        backButtonSize: 36,
        backIconSize: 24,
        avatarSize: 52,
        avatarRadius: 26,
        avatarIconSize: 26,
        avatarTextSize: 17,
        avatarMarginHorizontal: 8,
        nameSize: 18,
        departmentSize: 13,
        statusTextSize: 13,
        statusDotSize: 9,
        statusGap: 6,
        callButtonSize: 42,
        callButtonRadius: 14,
        callButtonMarginLeft: 8,
        callIconSize: 23,
        menuIconSize: 22,
        showDepartment: true,
    };
};

export default function IndividualChatHeader({
    navigation,
    colors,
    employeeInitials,
    employeeName,
    employeeDepartment,
    employeeAvatar,
    isGroup = false,
    groupParticipantsCount = 0,
    groupSubtitle = "",
    isBlocked,
    isOnline = false,
    isTyping = false,
    isRecordingVoice = false,
    activityName = "",
    lastSeenAt,
    presenceText,
    tr,
    isCompactScreen,
    isVeryCompactScreen,
    isShortScreen,
    onOpenMenu,
    conversationId,
    targetUserId,
    employeePhone,
    employeeUsername,
    employeeEmail,
    employeeLocation,
}) {
    const metrics = useMemo(
        () =>
            getResponsiveHeaderMetrics({
                isCompactScreen,
                isVeryCompactScreen,
                isShortScreen,
            }),
        [isCompactScreen, isVeryCompactScreen, isShortScreen]
    );

    const normalizedIsGroup = isGroup === true;
    const normalizedIsOnline = !normalizedIsGroup && isOnline === true;
    const normalizedIsRecordingVoice = isRecordingVoice === true && !isBlocked;
    const normalizedIsTyping = isTyping === true && !isBlocked && !normalizedIsRecordingVoice;
    const normalizedGroupSubtitle = normalizedIsGroup
        ? groupSubtitle || tr("groupChat", "Group chat")
        : "";
    const displayDepartment = normalizedIsGroup
        ? tr("groupChat", "Group chat")
        : employeeDepartment || tr("department", "Sales Department");

    useEffect(() => {
        console.log("[HEADER ONLINE DEBUG] Presence props received:", {
            conversationId,
            targetUserId,
            employeeName,
            isGroup: normalizedIsGroup,
            groupParticipantsCount,
            groupSubtitle: normalizedGroupSubtitle,
            isBlocked,
            isOnline,
            normalizedIsOnline,
            isTyping,
            normalizedIsTyping,
            isRecordingVoice,
            normalizedIsRecordingVoice,
            activityName,
            lastSeenAt,
            presenceText,
        });
    }, [
        conversationId,
        targetUserId,
        employeeName,
        normalizedIsGroup,
        groupParticipantsCount,
        normalizedGroupSubtitle,
        isBlocked,
        isOnline,
        normalizedIsOnline,
        isTyping,
        normalizedIsTyping,
        isRecordingVoice,
        normalizedIsRecordingVoice,
        activityName,
        lastSeenAt,
        presenceText,
    ]);

    const statusLabel = getStatusLabel({
        isGroup: normalizedIsGroup,
        groupSubtitle: normalizedGroupSubtitle,
        isBlocked,
        isTyping: normalizedIsTyping,
        isRecordingVoice: normalizedIsRecordingVoice,
        isOnline: normalizedIsOnline,
        presenceText,
        activityName,
        tr,
    });

    const statusColor = getStatusColor({
        colors,
        isGroup: normalizedIsGroup,
        isBlocked,
        isTyping: normalizedIsTyping,
        isRecordingVoice: normalizedIsRecordingVoice,
        isOnline: normalizedIsOnline,
    });

    const statusDotColor = getStatusDotColor({
        colors,
        isGroup: normalizedIsGroup,
        isBlocked,
        isTyping: normalizedIsTyping,
        isRecordingVoice: normalizedIsRecordingVoice,
        isOnline: normalizedIsOnline,
    });

    useEffect(() => {
        console.log("[HEADER ONLINE DEBUG] Status rendered:", {
            conversationId,
            targetUserId,
            employeeName,
            isGroup: normalizedIsGroup,
            groupParticipantsCount,
            statusLabel,
            statusColor,
            statusDotColor,
            normalizedIsOnline,
            normalizedIsTyping,
            normalizedIsRecordingVoice,
            activityName,
        });
    }, [
        conversationId,
        targetUserId,
        employeeName,
        normalizedIsGroup,
        groupParticipantsCount,
        statusLabel,
        statusColor,
        statusDotColor,
        normalizedIsOnline,
        normalizedIsTyping,
        normalizedIsRecordingVoice,
        activityName,
    ]);

    const openChatProfile = () => {
        navigation.navigate("IndividualChatProfile", {
            conversationId,
            targetUserId,
            profile: {
                initials: employeeInitials,
                name: employeeName,
                department: displayDepartment,
                avatar: employeeAvatar || null,
                isGroup: normalizedIsGroup,
                participantCount: groupParticipantsCount,
                isBlocked,
                isOnline: normalizedIsOnline,
                isTyping: normalizedIsTyping,
                isRecordingVoice: normalizedIsRecordingVoice,
                activityName,
                lastSeenAt,
                presenceText: statusLabel,
                phone: normalizedIsGroup ? "" : employeePhone || "+963 947 156 953",
                username: normalizedIsGroup ? "" : employeeUsername || "@makoverseas_sales",
                email: normalizedIsGroup ? "" : employeeEmail || "sales@mak-overseas.com",
                location: normalizedIsGroup ? "" : employeeLocation || "Damascus, Syria",
            },
        });
    };

    return (
        <View
            style={[
                styles.header,
                {
                    minHeight: metrics.headerMinHeight,
                    paddingHorizontal: metrics.headerPaddingHorizontal,
                    paddingTop: metrics.headerPaddingTop,
                    paddingBottom: metrics.headerPaddingBottom,
                    backgroundColor: colors.header,
                    borderBottomColor: colors.border,
                },
            ]}
        >
            <TouchableOpacity
                style={[
                    styles.iconButton,
                    {
                        width: metrics.backButtonSize,
                        height: metrics.backButtonSize,
                    },
                ]}
                activeOpacity={0.8}
                onPress={() => navigation.goBack()}
            >
                <Ionicons
                    name="arrow-back"
                    size={metrics.backIconSize}
                    color={colors.text}
                />
            </TouchableOpacity>

            <TouchableOpacity
                style={styles.profilePressArea}
                activeOpacity={0.82}
                onPress={openChatProfile}
            >
                <View
                    style={[
                        styles.avatarWrapper,
                        { marginHorizontal: metrics.avatarMarginHorizontal },
                    ]}
                >
                    <View
                        style={[
                            styles.avatar,
                            {
                                width: metrics.avatarSize,
                                height: metrics.avatarSize,
                                borderRadius: metrics.avatarRadius,
                                backgroundColor: colors.avatarBackground,
                                borderColor: colors.avatarBorder,
                            },
                        ]}
                    >
                        {employeeAvatar ? (
                            <Image
                                source={{ uri: employeeAvatar }}
                                style={[
                                    styles.avatarImage,
                                    {
                                        borderRadius: metrics.avatarRadius,
                                    },
                                ]}
                            />
                        ) : normalizedIsGroup ? (
                            <Ionicons
                                name="people"
                                size={metrics.avatarIconSize}
                                color={colors.text}
                            />
                        ) : (
                            <Text
                                style={[
                                    styles.avatarText,
                                    {
                                        fontSize: metrics.avatarTextSize,
                                        color: colors.text,
                                    },
                                ]}
                                numberOfLines={1}
                                adjustsFontSizeToFit
                            >
                                {employeeInitials}
                            </Text>
                        )}
                    </View>
                </View>

                <View style={styles.headerInfo}>
                    <Text
                        style={[
                            styles.employeeName,
                            {
                                fontSize: metrics.nameSize,
                                color: colors.text,
                            },
                        ]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                    >
                        {employeeName}
                    </Text>

                    {metrics.showDepartment && (
                        <Text
                            style={[
                                styles.department,
                                {
                                    fontSize: metrics.departmentSize,
                                    color: colors.blue,
                                },
                            ]}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                        >
                            {displayDepartment}
                        </Text>
                    )}

                    <View
                        style={[
                            styles.statusRow,
                            {
                                gap: metrics.statusGap,
                            },
                        ]}
                    >
                        <View
                            style={[
                                styles.onlineDot,
                                {
                                    width: metrics.statusDotSize,
                                    height: metrics.statusDotSize,
                                    borderRadius: metrics.statusDotSize / 2,
                                    backgroundColor: statusDotColor,
                                    borderColor:
                                        normalizedIsGroup ||
                                            normalizedIsOnline ||
                                            normalizedIsTyping ||
                                            normalizedIsRecordingVoice ||
                                            isBlocked
                                            ? statusDotColor
                                            : colors.border,
                                },
                            ]}
                        />

                        <Text
                            style={[
                                styles.onlineText,
                                {
                                    fontSize: metrics.statusTextSize,
                                    color: statusColor,
                                },
                            ]}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                        >
                            {statusLabel}
                        </Text>
                    </View>
                </View>
            </TouchableOpacity>

            <TouchableOpacity
                style={[
                    styles.callButton,
                    {
                        width: metrics.callButtonSize,
                        height: metrics.callButtonSize,
                        borderRadius: metrics.callButtonRadius,
                        marginLeft: metrics.callButtonMarginLeft,
                        borderColor: colors.border,
                    },
                ]}
                activeOpacity={0.8}
            >
                <Ionicons
                    name="call-outline"
                    size={metrics.callIconSize}
                    color={colors.text}
                />
            </TouchableOpacity>

            <TouchableOpacity
                style={[
                    styles.callButton,
                    {
                        width: metrics.callButtonSize,
                        height: metrics.callButtonSize,
                        borderRadius: metrics.callButtonRadius,
                        marginLeft: metrics.callButtonMarginLeft,
                        borderColor: colors.border,
                    },
                ]}
                activeOpacity={0.8}
                onPress={onOpenMenu}
            >
                <Ionicons
                    name="ellipsis-vertical"
                    size={metrics.menuIconSize}
                    color={colors.text}
                />
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: "row",
        alignItems: "center",
        borderBottomWidth: 1,
    },

    iconButton: {
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
    },

    profilePressArea: {
        flex: 1,
        minWidth: 0,
        flexDirection: "row",
        alignItems: "center",
        overflow: "hidden",
    },

    avatarWrapper: {
        flexShrink: 0,
    },

    avatar: {
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
    },

    avatarImage: {
        width: "100%",
        height: "100%",
    },

    avatarText: {
        fontWeight: "800",
        includeFontPadding: false,
        maxWidth: "92%",
        textAlign: "center",
    },

    headerInfo: {
        flex: 1,
        minWidth: 0,
        paddingRight: 2,
        overflow: "hidden",
    },

    employeeName: {
        fontWeight: "800",
        includeFontPadding: false,
    },

    department: {
        marginTop: 3,
        fontWeight: "600",
        includeFontPadding: false,
    },

    statusRow: {
        marginTop: 4,
        flexDirection: "row",
        alignItems: "center",
        minWidth: 0,
    },

    onlineDot: {
        borderWidth: 1,
        flexShrink: 0,
    },

    onlineText: {
        flex: 1,
        minWidth: 0,
        fontWeight: "700",
        includeFontPadding: false,
    },

    callButton: {
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
    },
});

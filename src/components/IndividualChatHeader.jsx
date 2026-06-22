import { Ionicons } from "@expo/vector-icons";
import React, { useEffect } from "react";
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
                isCompactScreen && styles.headerCompact,
                isShortScreen && styles.headerShort,
                {
                    backgroundColor: colors.header,
                    borderBottomColor: colors.border,
                },
            ]}
        >
            <TouchableOpacity
                style={styles.iconButton}
                activeOpacity={0.8}
                onPress={() => navigation.goBack()}
            >
                <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>

            <TouchableOpacity
                style={styles.profilePressArea}
                activeOpacity={0.82}
                onPress={openChatProfile}
            >
                <View style={styles.avatarWrapper}>
                    <View
                        style={[
                            styles.avatar,
                            isCompactScreen && styles.avatarCompact,
                            {
                                backgroundColor: colors.avatarBackground,
                                borderColor: colors.avatarBorder,
                            },
                        ]}
                    >
                        {employeeAvatar ? (
                            <Image
                                source={{ uri: employeeAvatar }}
                                style={styles.avatarImage}
                            />
                        ) : normalizedIsGroup ? (
                            <Ionicons
                                name="people"
                                size={isCompactScreen ? 22 : 26}
                                color={colors.text}
                            />
                        ) : (
                            <Text
                                style={[
                                    styles.avatarText,
                                    isCompactScreen && styles.avatarTextCompact,
                                    { color: colors.text },
                                ]}
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
                            isCompactScreen && styles.employeeNameCompact,
                            isVeryCompactScreen && styles.employeeNameVeryCompact,
                            { color: colors.text },
                        ]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                    >
                        {employeeName}
                    </Text>

                    <Text
                        style={[
                            styles.department,
                            isCompactScreen && styles.departmentCompact,
                            isVeryCompactScreen && styles.departmentVeryCompact,
                            { color: colors.blue },
                        ]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                    >
                        {displayDepartment}
                    </Text>

                    <View style={styles.statusRow}>
                        <View
                            style={[
                                styles.onlineDot,
                                {
                                    backgroundColor: statusDotColor,
                                    borderColor:
                                        normalizedIsGroup || normalizedIsOnline || normalizedIsTyping || normalizedIsRecordingVoice || isBlocked
                                            ? statusDotColor
                                            : colors.border,
                                },
                            ]}
                        />

                        <Text
                            style={[
                                styles.onlineText,
                                isVeryCompactScreen && styles.onlineTextVeryCompact,
                                { color: statusColor },
                            ]}
                            numberOfLines={1}
                        >
                            {statusLabel}
                        </Text>
                    </View>
                </View>
            </TouchableOpacity>

            <TouchableOpacity
                style={[
                    styles.callButton,
                    isCompactScreen && styles.callButtonCompact,
                    isVeryCompactScreen && styles.callButtonVeryCompact,
                    { borderColor: colors.border },
                ]}
                activeOpacity={0.8}
            >
                <Ionicons
                    name="call-outline"
                    size={isVeryCompactScreen ? 19 : isCompactScreen ? 21 : 23}
                    color={colors.text}
                />
            </TouchableOpacity>

            <TouchableOpacity
                style={[
                    styles.callButton,
                    isCompactScreen && styles.callButtonCompact,
                    isVeryCompactScreen && styles.callButtonVeryCompact,
                    { borderColor: colors.border },
                ]}
                activeOpacity={0.8}
                onPress={onOpenMenu}
            >
                <Ionicons
                    name="ellipsis-vertical"
                    size={isVeryCompactScreen ? 19 : isCompactScreen ? 20 : 22}
                    color={colors.text}
                />
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    header: {
        minHeight: 90,
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 12,
        flexDirection: "row",
        alignItems: "center",
        borderBottomWidth: 1,
    },

    headerCompact: {
        minHeight: 84,
        paddingHorizontal: 12,
        paddingTop: 6,
        paddingBottom: 10,
    },

    headerShort: {
        minHeight: 80,
        paddingTop: 6,
        paddingBottom: 8,
    },

    iconButton: {
        width: 36,
        height: 36,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
    },

    profilePressArea: {
        flex: 1,
        minWidth: 0,
        flexDirection: "row",
        alignItems: "center",
    },

    avatarWrapper: {
        marginHorizontal: 8,
        flexShrink: 0,
    },

    avatar: {
        width: 52,
        height: 52,
        borderRadius: 26,
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
    },

    avatarCompact: {
        width: 44,
        height: 44,
        borderRadius: 22,
    },

    avatarImage: {
        width: "100%",
        height: "100%",
        borderRadius: 26,
    },

    avatarText: {
        fontSize: 17,
        fontWeight: "800",
    },

    avatarTextCompact: {
        fontSize: 15,
    },

    headerInfo: {
        flex: 1,
        minWidth: 0,
        paddingRight: 4,
    },

    employeeName: {
        fontSize: 18,
        fontWeight: "800",
        includeFontPadding: false,
    },

    employeeNameCompact: {
        fontSize: 16,
    },

    employeeNameVeryCompact: {
        fontSize: 15,
    },

    department: {
        marginTop: 4,
        fontSize: 13,
        fontWeight: "600",
        includeFontPadding: false,
    },

    departmentCompact: {
        fontSize: 12,
    },

    departmentVeryCompact: {
        fontSize: 11,
    },

    statusRow: {
        marginTop: 5,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },

    onlineDot: {
        width: 9,
        height: 9,
        borderRadius: 5,
        borderWidth: 1,
    },

    onlineText: {
        fontSize: 13,
        fontWeight: "700",
        includeFontPadding: false,
    },

    onlineTextVeryCompact: {
        fontSize: 12,
    },

    callButton: {
        width: 42,
        height: 42,
        borderRadius: 14,
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
        marginLeft: 8,
        flexShrink: 0,
    },

    callButtonCompact: {
        width: 38,
        height: 38,
        borderRadius: 13,
        marginLeft: 6,
    },

    callButtonVeryCompact: {
        width: 36,
        height: 36,
        borderRadius: 12,
        marginLeft: 4,
    },
});

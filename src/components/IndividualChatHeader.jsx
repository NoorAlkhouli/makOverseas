import { Ionicons } from "@expo/vector-icons";
import React, { useEffect } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

const getStatusLabel = ({
    isBlocked,
    isTyping,
    isOnline,
    presenceText,
    tr,
}) => {
    if (isBlocked) {
        return tr("blocked", "Blocked");
    }

    if (isTyping) {
        return tr("typingNow", "Typing...");
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
    isBlocked,
    isTyping,
    isOnline,
}) => {
    if (isBlocked) {
        return colors.danger || colors.text;
    }

    if (isTyping || isOnline) {
        return colors.primary;
    }

    return colors.textMuted || colors.muted || colors.text;
};

const getStatusDotColor = ({
    colors,
    isBlocked,
    isTyping,
    isOnline,
}) => {
    if (isBlocked) {
        return colors.danger || colors.text;
    }

    if (isTyping || isOnline) {
        return colors.primary;
    }

    return colors.textMuted || colors.muted || colors.border;
};

export default function IndividualChatHeader({
    navigation,
    colors,
    employeeInitials,
    employeeName,
    employeeDepartment,
    isBlocked,
    isOnline = false,
    isTyping = false,
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
    const normalizedIsOnline = isOnline === true;
    const normalizedIsTyping = isTyping === true && !isBlocked;

    useEffect(() => {
        console.log("[HEADER ONLINE DEBUG] Presence props received:", {
            conversationId,
            targetUserId,
            employeeName,
            isBlocked,
            isOnline,
            normalizedIsOnline,
            isTyping,
            normalizedIsTyping,
            lastSeenAt,
            presenceText,
        });
    }, [
        conversationId,
        targetUserId,
        employeeName,
        isBlocked,
        isOnline,
        normalizedIsOnline,
        isTyping,
        normalizedIsTyping,
        lastSeenAt,
        presenceText,
    ]);

    const statusLabel = getStatusLabel({
        isBlocked,
        isTyping: normalizedIsTyping,
        isOnline: normalizedIsOnline,
        presenceText,
        tr,
    });

    const statusColor = getStatusColor({
        colors,
        isBlocked,
        isTyping: normalizedIsTyping,
        isOnline: normalizedIsOnline,
    });

    const statusDotColor = getStatusDotColor({
        colors,
        isBlocked,
        isTyping: normalizedIsTyping,
        isOnline: normalizedIsOnline,
    });

    useEffect(() => {
        console.log("[HEADER ONLINE DEBUG] Status rendered:", {
            conversationId,
            targetUserId,
            employeeName,
            statusLabel,
            statusColor,
            statusDotColor,
            normalizedIsOnline,
            normalizedIsTyping,
        });
    }, [
        conversationId,
        targetUserId,
        employeeName,
        statusLabel,
        statusColor,
        statusDotColor,
        normalizedIsOnline,
        normalizedIsTyping,
    ]);

    const openChatProfile = () => {
        navigation.navigate("IndividualChatProfile", {
            conversationId,
            targetUserId,
            profile: {
                initials: employeeInitials,
                name: employeeName,
                department: employeeDepartment || tr("department", "Sales Department"),
                isBlocked,
                isOnline: normalizedIsOnline,
                isTyping: normalizedIsTyping,
                lastSeenAt,
                presenceText: statusLabel,
                phone: employeePhone || "+963 947 156 953",
                username: employeeUsername || "@makoverseas_sales",
                email: employeeEmail || "sales@mak-overseas.com",
                location: employeeLocation || "Damascus, Syria",
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
                        <Text
                            style={[
                                styles.avatarText,
                                isCompactScreen && styles.avatarTextCompact,
                                { color: colors.text },
                            ]}
                        >
                            {employeeInitials}
                        </Text>
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
                        {employeeDepartment || tr("department", "Sales Department")}
                    </Text>

                    <View style={styles.statusRow}>
                        <View
                            style={[
                                styles.onlineDot,
                                {
                                    backgroundColor: statusDotColor,
                                    borderColor:
                                        normalizedIsOnline || normalizedIsTyping || isBlocked
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

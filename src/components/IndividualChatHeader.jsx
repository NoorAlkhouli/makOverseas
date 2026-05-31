import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function IndividualChatHeader({
    navigation,
    colors,
    employeeInitials,
    employeeName,
    employeeDepartment,
    isBlocked,
    tr,
    isCompactScreen,
    isVeryCompactScreen,
    isShortScreen,
    onOpenMenu,
}) {
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
                            { backgroundColor: colors.primary },
                        ]}
                    />

                    <Text
                        style={[
                            styles.onlineText,
                            isVeryCompactScreen && styles.onlineTextVeryCompact,
                            { color: colors.primary },
                        ]}
                        numberOfLines={1}
                    >
                        {isBlocked
                            ? tr("blocked", "Blocked")
                            : tr("online", "Online")}
                    </Text>
                </View>
            </View>

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

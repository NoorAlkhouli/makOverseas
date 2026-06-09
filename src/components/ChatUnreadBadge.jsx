import { StyleSheet, Text, View } from "react-native";

export default function ChatUnreadBadge({ count, colors }) {
    const unreadCount = Number(count || 0);

    if (!Number.isFinite(unreadCount) || unreadCount <= 0) {
        return null;
    }

    const styles = createStyles(colors);

    return (
        <View style={styles.unreadBadge}>
            <Text style={styles.unreadText}>{unreadCount}</Text>
        </View>
    );
}

const createStyles = (colors) =>
    StyleSheet.create({
        unreadBadge: {
            minWidth: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: colors.primary,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 8,
        },

        unreadText: {
            color: colors.darkText,
            fontSize: 13,
            fontWeight: "900",
        },
    });

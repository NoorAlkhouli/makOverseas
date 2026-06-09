import { Feather } from "@expo/vector-icons";
import { StyleSheet, TextInput, TouchableOpacity, View } from "react-native";

import {
    getRowDirectionStyle,
    getTextInputDirectionFromValue,
} from "@/src/styles/globalStyles";

export default function ChatSearchBox({
    canSearchCustomers,
    search,
    setSearch,
    isArabic,
    colors,
    keyboardHeight,
    setIsSearchFocused,
}) {
    if (!canSearchCustomers) {
        return null;
    }

    const styles = createStyles(colors);

    return (
        <View style={[styles.searchBox, getRowDirectionStyle(isArabic)]}>
            <Feather name="search" size={21} color={colors.textMuted} />

            <TextInput
                value={search}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => {
                    if (!keyboardHeight) {
                        setIsSearchFocused(false);
                    }
                }}
                onChangeText={setSearch}
                placeholder={
                    isArabic
                        ? "ابحثي عن عميل برقم الهاتف..."
                        : "Search customers by phone..."
                }
                placeholderTextColor={colors.textMuted}
                style={[
                    styles.searchInput,
                    getTextInputDirectionFromValue(search, isArabic),
                ]}
                autoCorrect={false}
                autoCapitalize="none"
                keyboardType="phone-pad"
            />

            {!!search && (
                <TouchableOpacity
                    activeOpacity={0.85}
                    style={styles.filterButton}
                    onPress={() => setSearch("")}
                >
                    <Feather name="x" size={20} color={colors.textPrimary} />
                </TouchableOpacity>
            )}

            {!search && (
                <View style={styles.filterButton}>
                    <Feather name="sliders" size={20} color={colors.textPrimary} />
                </View>
            )}
        </View>
    );
}

const createStyles = (colors) =>
    StyleSheet.create({
        searchBox: {
            height: 58,
            borderRadius: 20,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
            gap: 10,
            marginBottom: 18,
        },

        searchInput: {
            flex: 1,
            color: colors.textPrimary,
            fontSize: 16,
            fontWeight: "600",
            paddingVertical: 0,
        },

        filterButton: {
            width: 42,
            height: 42,
            borderRadius: 16,
            backgroundColor: colors.buttonSoft,
            alignItems: "center",
            justifyContent: "center",
        },
    });

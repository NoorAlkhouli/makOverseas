import MainNavBar from "@/src/components/MainNavBar";
import { appImages } from "@/src/constants/images";
import {
    getRowDirectionStyle,
    getTextDirectionStyle,
} from "@/src/styles/globalStyles";
import { useAppTheme } from "@/src/theme/ThemeProvider";
import { Feather } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    ImageBackground,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

const INITIAL_CHAT_LIST = [
    {
        id: "1",
        name: "Ahmed Hassan",
        department: "Sales Department",
        message: "Thanks for your inquiry. Let me know how I can assist you further.",
        time: "10:30 AM",
        unread: 2,
        status: "online",
    },
    {
        id: "2",
        name: "Fatima Al Zaabi",
        department: "Shipping Operations",
        message: "Your shipment is now in transit and on schedule.",
        time: "9:15 AM",
        unread: 1,
        status: "online",
    },
    {
        id: "3",
        name: "Khalid Rahman",
        department: "Customs Clearance",
        message: "We’ve received your documents and processing is underway.",
        time: "Yesterday",
        unread: 3,
        status: "away",
    },
    {
        id: "4",
        name: "Noura El Masri",
        department: "Accounting",
        message: "The invoice for your shipment has been generated.",
        time: "Yesterday",
        unread: 0,
        status: "online",
    },
    {
        id: "5",
        name: "Omar Siddiqui",
        department: "Customer Support",
        message: "How can I help you with your shipment today?",
        time: "Mon",
        unread: 1,
        status: "online",
    },
];

const filters = [
    "all",
    "groups",
    "sales",
    "airFreightSales",
    "seaFreightSales",
    "landFreightSales",
    "accounting",
];

export default function Chat({ navigation }) {
    const { t, i18n } = useTranslation();
    const isArabic = i18n.language === "ar";

    const { colors, isDark } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const [chats, setChats] = useState(INITIAL_CHAT_LIST);
    const [search, setSearch] = useState("");
    const [activeFilter, setActiveFilter] = useState("all");
    const [showNavTitle, setShowNavTitle] = useState(false);
    const [selectMode, setSelectMode] = useState(false);

    const imageSource = isDark ? appImages.splashDark : appImages.splashLight;
    const filtersScrollRef = useRef(null);

    const unreadTotal = useMemo(() => {
        return chats.reduce((total, chat) => total + chat.unread, 0);
    }, [chats]);

    const visibleChats = useMemo(() => {
        const searchText = search.trim().toLowerCase();

        return chats.filter((chat) => {
            const matchesSearch =
                !searchText ||
                chat.name.toLowerCase().includes(searchText) ||
                chat.department.toLowerCase().includes(searchText) ||
                chat.message.toLowerCase().includes(searchText);

            const departmentKey = chat.department.toLowerCase();

            const matchesFilter =
                activeFilter === "all" ||
                activeFilter === "groups" ||
                (activeFilter === "sales" && departmentKey.includes("sales")) ||
                (activeFilter === "airFreightSales" && departmentKey.includes("air")) ||
                (activeFilter === "seaFreightSales" && departmentKey.includes("sea")) ||
                (activeFilter === "landFreightSales" && departmentKey.includes("land")) ||
                (activeFilter === "accounting" && departmentKey.includes("accounting"));

            return matchesSearch && matchesFilter;
        });
    }, [activeFilter, chats, search]);

    useEffect(() => {
        setTimeout(() => {
            if (isArabic) {
                filtersScrollRef.current?.scrollToEnd({ animated: false });
            } else {
                filtersScrollRef.current?.scrollTo({ x: 0, animated: false });
            }
        }, 100);
    }, [isArabic]);

    const toggleLanguage = () => {
        const nextLanguage = isArabic ? "en" : "ar";
        i18n.changeLanguage(nextLanguage);
    };

    const handleSelectChats = () => {
        setSelectMode((prev) => !prev);
    };

    const handleReadAll = () => {
        setChats((currentChats) =>
            currentChats.map((chat) => ({
                ...chat,
                unread: 0,
            }))
        );
    };

    const handleChatPress = (selectedChat) => {
        if (selectMode) {
            return;
        }

        setChats((currentChats) =>
            currentChats.map((chat) =>
                chat.id === selectedChat.id
                    ? {
                        ...chat,
                        unread: 0,
                    }
                    : chat
            )
        );

        navigation.navigate("IndividualChat", {
            employee: {
                id: selectedChat.id,
                name: selectedChat.name,
                department: selectedChat.department,
                status: selectedChat.status,
            },
        });
    };

    const handleScroll = (event) => {
        const y = event.nativeEvent.contentOffset.y;
        setShowNavTitle(y > 45);
    };

    const chatMenuItems = [
        {
            key: "selectChats",
            label: selectMode
                ? t("chat.menuCancelSelect")
                : t("chat.menuSelectChats"),
            iconType: "feather",
            iconName: selectMode ? "x-square" : "check-square",
            onPress: handleSelectChats,
        },
        {
            key: "readAll",
            label: t("chat.menuReadAll"),
            iconType: "feather",
            iconName: "check-circle",
            onPress: handleReadAll,
        },
    ];

    return (
        <View style={styles.root}>
            <StatusBar
                style={isDark ? "light" : "dark"}
                translucent
                backgroundColor="transparent"
            />

            <ImageBackground
                source={imageSource}
                style={styles.background}
                resizeMode="cover"
            >
                <View style={styles.overlay}>
                    <MainNavBar
                        navigation={navigation}
                        title={t("chat.title")}
                        showTitle={showNavTitle}
                        notificationCount={unreadTotal}
                        onToggleLanguage={toggleLanguage}
                        menuItems={chatMenuItems}
                    />

                    <ScrollView
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        onScroll={handleScroll}
                        scrollEventThrottle={16}
                    >
                        <View style={styles.headerBox}>
                            <Text style={[styles.title, getTextDirectionStyle(isArabic)]}>
                                {t("chat.title")}
                            </Text>

                            <Text style={[styles.subtitle, getTextDirectionStyle(isArabic)]}>
                                {t("chat.subtitle")}
                            </Text>
                        </View>

                        <View style={[styles.searchBox, getRowDirectionStyle(isArabic)]}>
                            <Feather name="search" size={21} color={colors.textMuted} />

                            <TextInput
                                value={search}
                                onChangeText={setSearch}
                                placeholder={t("chat.searchPlaceholder")}
                                placeholderTextColor={colors.textMuted}
                                style={[styles.searchInput, getTextDirectionStyle(isArabic)]}
                                textAlign={isArabic ? "right" : "left"}
                            />

                            <TouchableOpacity activeOpacity={0.85} style={styles.filterButton}>
                                <Feather name="sliders" size={20} color={colors.textPrimary} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            ref={filtersScrollRef}
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            style={styles.filtersScroll}
                            contentContainerStyle={[
                                styles.filtersRow,
                                isArabic && styles.filtersRowArabic,
                            ]}
                            onContentSizeChange={() => {
                                if (isArabic) {
                                    filtersScrollRef.current?.scrollToEnd({ animated: false });
                                }
                            }}
                        >
                            {filters.map((filter) => {
                                const isActive = activeFilter === filter;

                                return (
                                    <TouchableOpacity
                                        key={filter}
                                        activeOpacity={0.85}
                                        style={[
                                            styles.filterChip,
                                            isActive && styles.filterChipActive,
                                        ]}
                                        onPress={() => setActiveFilter(filter)}
                                    >
                                        <Text
                                            style={[
                                                styles.filterChipText,
                                                isActive && styles.filterChipTextActive,
                                            ]}
                                        >
                                            {t(`chat.filters.${filter}`)}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>

                        <View style={styles.chatCardsWrapper}>
                            {visibleChats.map((chat) => (
                                <TouchableOpacity
                                    key={chat.id}
                                    activeOpacity={0.88}
                                    style={[styles.chatCard, getRowDirectionStyle(isArabic)]}
                                    onPress={() => handleChatPress(chat)}
                                >
                                    {selectMode && (
                                        <View style={styles.selectCircle}>
                                            <Feather
                                                name="circle"
                                                size={20}
                                                color={colors.textSecondary}
                                            />
                                        </View>
                                    )}

                                    <View style={styles.avatarBox}>
                                        <View style={styles.avatarCircle}>
                                            <Feather
                                                name="user"
                                                size={28}
                                                color={colors.textPrimary}
                                            />
                                        </View>

                                        <View
                                            style={[
                                                styles.statusDot,
                                                chat.status === "away" && styles.statusDotAway,
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

                                        <Text
                                            style={[
                                                styles.messageText,
                                                getTextDirectionStyle(isArabic),
                                            ]}
                                            numberOfLines={2}
                                        >
                                            {chat.message}
                                        </Text>
                                    </View>

                                    {chat.unread > 0 && (
                                        <View style={styles.unreadBadge}>
                                            <Text style={styles.unreadText}>{chat.unread}</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            ))}
                        </View>
                    </ScrollView>
                </View>
            </ImageBackground>
        </View>
    );
}

const SCREEN_PADDING = 20;

const createStyles = (colors) =>
    StyleSheet.create({
        root: {
            flex: 1,
            backgroundColor: colors.background,
        },

        background: {
            flex: 1,
            width: "100%",
            height: "100%",
        },

        overlay: {
            flex: 1,
            backgroundColor: colors.overlay,
        },

        selectCircle: {
            width: 28,
            height: 28,
            borderRadius: 14,
            alignItems: "center",
            justifyContent: "center",
        },

        scrollContent: {
            flexGrow: 1,
            paddingHorizontal: 20,
            paddingTop: Platform.OS === "android" ? 130 : 150,
            paddingBottom: Platform.OS === "android" ? 120 : 135,
        },

        headerBox: {
            marginBottom: 26,
        },

        title: {
            color: colors.textPrimary,
            fontSize: 35,
            fontWeight: "900",
            marginBottom: 8,
        },

        subtitle: {
            color: colors.textSecondary,
            fontSize: 17,
            lineHeight: 25,
            fontWeight: "500",
        },

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

        filtersScroll: {
            marginHorizontal: -SCREEN_PADDING,
        },

        filtersRow: {
            paddingHorizontal: SCREEN_PADDING,
            paddingBottom: 18,
            gap: 12,
            alignItems: "center",
        },

        filtersRowArabic: {
            flexDirection: "row-reverse",
        },

        filterChip: {
            height: 44,
            paddingHorizontal: 22,
            borderRadius: 16,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: "center",
            justifyContent: "center",
        },

        filterChipActive: {
            borderColor: colors.primary,
            backgroundColor: colors.primarySoft,
        },

        filterChipText: {
            color: colors.textPrimary,
            fontSize: 14,
            fontWeight: "700",
        },

        filterChipTextActive: {
            color: colors.textPrimary,
        },

        chatCardsWrapper: {
            gap: 12,
        },

        chatCard: {
            minHeight: 112,
            borderRadius: 20,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.borderSoft,
            flexDirection: "row",
            alignItems: "center",
            padding: 14,
            gap: 12,
        },

        avatarBox: {
            width: 58,
            height: 58,
        },

        avatarCircle: {
            width: 58,
            height: 58,
            borderRadius: 29,
            backgroundColor: colors.avatarBackground,
            borderWidth: 1,
            borderColor: colors.avatarBorder,
            alignItems: "center",
            justifyContent: "center",
        },

        statusDot: {
            position: "absolute",
            right: 1,
            bottom: 2,
            width: 14,
            height: 14,
            borderRadius: 7,
            backgroundColor: colors.primary,
            borderWidth: 2,
            borderColor: colors.statusBorder,
        },

        statusDotAway: {
            backgroundColor: colors.warning,
        },

        chatInfo: {
            flex: 1,
        },

        chatTopRow: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            marginBottom: 6,
        },

        staffName: {
            flex: 1,
            color: colors.textPrimary,
            fontSize: 17,
            fontWeight: "900",
        },

        chatTime: {
            color: colors.textMuted,
            fontSize: 12,
            fontWeight: "600",
        },

        departmentRow: {
            alignSelf: "flex-start",
            marginBottom: 7,
        },

        departmentText: {
            color: colors.blue,
            fontSize: 11,
            fontWeight: "700",
            paddingHorizontal: 9,
            paddingVertical: 4,
            borderRadius: 10,
            backgroundColor: colors.blueSoft,
            borderWidth: 1,
            borderColor: colors.blueBorder,
        },

        messageText: {
            color: colors.textSecondary,
            fontSize: 14,
            lineHeight: 21,
            fontWeight: "500",
        },

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
import { Feather, Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    Animated,
    Image,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

import { appImages } from "@/src/constants/images";
import { LANGUAGE_STORAGE_KEY } from "@/src/i18n";
import {
    getRowDirectionStyle,
    getTextDirectionStyle,
} from "@/src/styles/globalStyles";
import { useAppTheme } from "@/src/theme/ThemeProvider";

export default function IndividualChatProfile({ navigation, route }) {
    const { t, i18n } = useTranslation();
    const {
        colors: appColors,
        isDark,
        toggleTheme,
        setThemeMode,
        changeTheme,
    } = useAppTheme();

    const isArabic = i18n.language === "ar" || i18n.language?.startsWith("ar");
    const searchInputRef = useRef(null);
    const scrollRef = useRef(null);
    const scrollY = useRef(new Animated.Value(0)).current;

    const [activeTab, setActiveTab] = useState("media");
    const [menuOpen, setMenuOpen] = useState(false);
    const [searchVisible, setSearchVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    const profile = route?.params?.profile || {};

    const data = {
        conversationId: route?.params?.conversationId || profile.conversationId || null,
        targetUserId:
            route?.params?.targetUserId ||
            route?.params?.target_user_id ||
            profile.targetUserId ||
            profile.target_user_id ||
            null,
        initials: profile.initials || "MO",
        avatar: profile.avatar || null,
        name: profile.name || "MAK Overseas Sales Employee",
        department: profile.department || "Sales",
        isBlocked: !!profile.isBlocked,
        isOnline: profile.isOnline === true,
        isTyping: profile.isTyping === true,
        presenceText: profile.presenceText || "",
        lastSeenAt: profile.lastSeenAt || null,
        phone: profile.phone || "+963 947 156 953",
        username: profile.username || "@makoverseas_sales",
        email: profile.email || "sales@mak-overseas.com",
        location: profile.location || "Damascus, Syria",
    };

    useEffect(() => {
        console.log("[PROFILE ONLINE DEBUG] Profile presence received:", {
            conversationId: data.conversationId,
            targetUserId: data.targetUserId,
            name: data.name,
            isBlocked: data.isBlocked,
            isOnline: data.isOnline,
            isTyping: data.isTyping,
            presenceText: data.presenceText,
            lastSeenAt: data.lastSeenAt,
            routeParams: route?.params,
        });
    }, [
        data.conversationId,
        data.targetUserId,
        data.name,
        data.isBlocked,
        data.isOnline,
        data.isTyping,
        data.presenceText,
        data.lastSeenAt,
        route?.params,
    ]);

    const colors = useMemo(
        () => ({
            background: appColors.background,
            card: appColors.card,
            cardSoft: appColors.cardSoft,
            cardStrong: appColors.cardStrong,
            inputBackground: appColors.inputBackground,
            inputBorder: appColors.inputBorder,
            text: appColors.textPrimary,
            textSecondary: appColors.textSecondary,
            textMuted: appColors.textMuted,
            darkText: appColors.darkText,
            border: appColors.border,
            borderSoft: appColors.borderSoft,
            borderLight: appColors.borderLight,
            primary: appColors.primary,
            primarySoft: appColors.primarySoft,
            blue: appColors.blue,
            blueSoft: appColors.blueSoft,
            blueBorder: appColors.blueBorder,
            buttonSoft: appColors.buttonSoft,
            avatarBackground: appColors.avatarBackground,
            avatarBorder: appColors.avatarBorder,
            success: appColors.success,
            warning: appColors.warning,
            danger: appColors.danger,
            overlay: appColors.overlay,
        }),
        [appColors]
    );

    const styles = useMemo(() => createStyles(colors), [colors]);

    const statusText = data.isBlocked
        ? t("blocked", "Blocked")
        : data.isTyping
            ? t("typingNow", "Typing...")
            : data.presenceText || (data.isOnline
                ? t("onlineNow", "Online now")
                : t("offline", "Offline"));

    const statusColor = data.isBlocked
        ? colors.danger
        : data.isOnline || data.isTyping
            ? colors.primary
            : colors.textMuted;

    useEffect(() => {
        console.log("[PROFILE ONLINE DEBUG] Profile status rendered:", {
            conversationId: data.conversationId,
            targetUserId: data.targetUserId,
            statusText,
            statusColor,
            isOnline: data.isOnline,
            isTyping: data.isTyping,
            isBlocked: data.isBlocked,
        });
    }, [
        data.conversationId,
        data.targetUserId,
        statusText,
        statusColor,
        data.isOnline,
        data.isTyping,
        data.isBlocked,
    ]);

    const headerTitleOpacity = scrollY.interpolate({
        inputRange: [80, 145],
        outputRange: [0, 1],
        extrapolate: "clamp",
    });

    const headerTitleTranslateY = scrollY.interpolate({
        inputRange: [80, 145],
        outputRange: [10, 0],
        extrapolate: "clamp",
    });

    const tabs = [
        { key: "media", label: t("chatProfile.media", "Media") },
        { key: "files", label: t("chatProfile.files", "Files") },
        { key: "links", label: t("chatProfile.links", "Links") },
        { key: "voice", label: t("chatProfile.voice", "Voice") },
    ];

    const mediaItems = [
        {
            key: "ship",
            type: "image",
            image: appImages.homeShipSea,
        },
        {
            key: "document",
            type: "file",
            image: appImages.homeCargoMini || appImages.homeContainers,
        },
        {
            key: "chat",
            type: "chat",
        },
        {
            key: "truck",
            type: "video",
            image: appImages.homeAirTruck || appImages.homeContainers,
        },
    ];

    const files = [
        {
            key: "file-1",
            icon: "file-text",
            title: "Shipping Document",
            subtitle: "MAK-2025-0614.pdf",
        },
        {
            key: "file-2",
            icon: "file",
            title: "Invoice File",
            subtitle: "invoice_0614.pdf",
        },
    ];

    const links = [
        {
            key: "link-1",
            icon: "link",
            title: "mak-overseas.com",
            subtitle: "Company website",
        },
        {
            key: "link-2",
            icon: "external-link",
            title: "Shipment tracking",
            subtitle: "Tracking link",
        },
    ];

    const voice = [
        {
            key: "voice-1",
            icon: "mic",
            title: "Voice message",
            subtitle: "0:18",
        },
        {
            key: "voice-2",
            icon: "mic",
            title: "Voice message",
            subtitle: "0:34",
        },
    ];

    const searchableMessages = [
        {
            key: "message-1",
            icon: "image",
            title: data.name,
            subtitle: "IMG_6232.png",
        },
        {
            key: "message-2",
            icon: "message-circle",
            title: "MAK Overseas Admin",
            subtitle: "No messages yet",
        },
    ];

    const filteredSearchResults = searchableMessages.filter((item) => {
        const query = searchQuery.trim().toLowerCase();

        if (!query) {
            return true;
        }

        return `${item.title} ${item.subtitle}`.toLowerCase().includes(query);
    });

    const handleSearchPress = () => {
        setMenuOpen(false);
        setSearchVisible(true);

        setTimeout(() => {
            searchInputRef.current?.focus?.();
            scrollRef.current?.scrollTo({
                y: 0,
                animated: true,
            });
        }, 80);
    };

    const handleMorePress = () => {
        setMenuOpen((value) => !value);
    };

    const handleChangeLanguage = async () => {
        const nextLanguage = isArabic ? "en" : "ar";

        setMenuOpen(false);

        await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
        await i18n.changeLanguage(nextLanguage);

        setTimeout(() => {
            scrollRef.current?.scrollTo({
                y: 0,
                animated: false,
            });
        }, 80);
    };

    const handleToggleTheme = () => {
        const nextTheme = isDark ? "light" : "dark";

        setMenuOpen(false);

        requestAnimationFrame(() => {
            if (typeof setThemeMode === "function") {
                setThemeMode(nextTheme);
                return;
            }

            if (typeof changeTheme === "function") {
                changeTheme(nextTheme);
                return;
            }

            if (typeof toggleTheme === "function") {
                toggleTheme();
            }
        });
    };

    return (
        <View style={styles.root}>
            <StatusBar
                style={isDark ? "light" : "dark"}
                translucent
                backgroundColor="transparent"
            />

            <View style={styles.fixedHeader}>
                <TouchableOpacity
                    activeOpacity={0.85}
                    style={styles.roundButton}
                    onPress={() => navigation.goBack()}
                >
                    <Ionicons name="arrow-back" size={28} color={colors.text} />
                </TouchableOpacity>

                <Animated.View
                    pointerEvents="none"
                    style={[
                        styles.headerTitleWrapper,
                        {
                            opacity: headerTitleOpacity,
                            transform: [{ translateY: headerTitleTranslateY }],
                        },
                    ]}
                >
                    <Text style={styles.headerTitle} numberOfLines={1}>
                        {data.name}
                    </Text>

                    <Text style={styles.headerSubtitle} numberOfLines={1}>
                        {data.department}
                    </Text>
                </Animated.View>

                <View style={styles.topSpacer} />

                <TouchableOpacity activeOpacity={0.85} style={styles.editButton}>
                    <Text style={styles.editText}>
                        {t("chatProfile.edit", "Edit")}
                    </Text>
                </TouchableOpacity>
            </View>

            <Animated.ScrollView
                ref={scrollRef}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                scrollEventThrottle={16}
                onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                    { useNativeDriver: true }
                )}
            >
                <View style={styles.profileHeader}>
                    <View style={styles.avatar}>
                        {data.avatar ? (
                            <Image
                                source={{ uri: data.avatar }}
                                style={styles.avatarImage}
                            />
                        ) : (
                            <Text style={styles.avatarText}>{data.initials}</Text>
                        )}
                    </View>

                    <View style={styles.nameWrapper}>
                        <Text style={styles.name} numberOfLines={2}>
                            {data.name}
                        </Text>
                    </View>

                    <View style={styles.departmentPill}>
                        <Text style={styles.departmentPillText}>
                            {data.department}
                        </Text>
                    </View>

                    <View style={[styles.statusRow, getRowDirectionStyle(isArabic)]}>
                        <View
                            style={[
                                styles.onlineDot,
                                { backgroundColor: statusColor },
                            ]}
                        />

                        <Text
                            style={[
                                styles.statusText,
                                { color: statusColor },
                            ]}
                        >
                            {statusText}
                        </Text>
                    </View>
                </View>

                <View style={[styles.actionsRow, getRowDirectionStyle(isArabic)]}>
                    <ActionButton
                        icon="call"
                        label={t("chatProfile.call", "Call")}
                        colors={colors}
                        styles={styles}
                    />

                    <ActionButton
                        icon="chatbubble-ellipses-outline"
                        label={t("chatProfile.message", "Message")}
                        colors={colors}
                        styles={styles}
                        onPress={() => navigation.goBack()}
                    />

                    <ActionButton
                        icon="search-outline"
                        label={t("chatProfile.search", "Search")}
                        colors={colors}
                        styles={styles}
                        onPress={handleSearchPress}
                    />

                    <View style={styles.moreActionWrapper}>
                        <ActionButton
                            icon="ellipsis-horizontal"
                            label={t("chatProfile.more", "More")}
                            colors={colors}
                            styles={styles}
                            onPress={handleMorePress}
                        />

                        {menuOpen && (
                            <View
                                style={[
                                    styles.menuBoxUnderMore,
                                    isArabic
                                        ? styles.menuBoxUnderMoreArabic
                                        : styles.menuBoxUnderMoreEnglish,
                                ]}
                            >
                                <TouchableOpacity
                                    activeOpacity={0.85}
                                    style={[
                                        styles.menuItem,
                                        getRowDirectionStyle(isArabic),
                                    ]}
                                    onPress={handleChangeLanguage}
                                >
                                    <Feather
                                        name="globe"
                                        size={18}
                                        color={colors.blue}
                                    />

                                    <Text
                                        style={[
                                            styles.menuItemText,
                                            getTextDirectionStyle(isArabic),
                                        ]}
                                    >
                                        {isArabic ? "English" : "العربية"}
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    activeOpacity={0.85}
                                    style={[
                                        styles.menuItem,
                                        getRowDirectionStyle(isArabic),
                                    ]}
                                    onPress={handleToggleTheme}
                                >
                                    <Feather
                                        name={isDark ? "sun" : "moon"}
                                        size={18}
                                        color={colors.blue}
                                    />

                                    <Text
                                        style={[
                                            styles.menuItemText,
                                            getTextDirectionStyle(isArabic),
                                        ]}
                                    >
                                        {isDark
                                            ? t("chatProfile.lightMode", "Light mode")
                                            : t("chatProfile.darkMode", "Dark mode")}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>

                {searchVisible && (
                    <View style={[styles.searchBox, getRowDirectionStyle(isArabic)]}>
                        <Ionicons
                            name="search-outline"
                            size={21}
                            color={colors.blue}
                        />

                        <TextInput
                            ref={searchInputRef}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            placeholder={t(
                                "chatProfile.searchMessages",
                                "Search messages..."
                            )}
                            placeholderTextColor={colors.textMuted}
                            style={[
                                styles.searchInput,
                                getTextDirectionStyle(isArabic),
                            ]}
                            selectionColor={colors.blue}
                        />

                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => {
                                setSearchQuery("");
                                setSearchVisible(false);
                            }}
                        >
                            <Ionicons
                                name="close-circle"
                                size={22}
                                color={colors.textMuted}
                            />
                        </TouchableOpacity>
                    </View>
                )}

                {searchVisible && (
                    <View style={styles.searchResultsCard}>
                        {filteredSearchResults.length > 0 ? (
                            filteredSearchResults.map((item) => (
                                <SearchResultRow
                                    key={item.key}
                                    item={item}
                                    colors={colors}
                                    styles={styles}
                                    isArabic={isArabic}
                                />
                            ))
                        ) : (
                            <Text
                                style={[
                                    styles.emptySearchText,
                                    getTextDirectionStyle(isArabic),
                                ]}
                            >
                                {t("chatProfile.noSearchResults", "No results found")}
                            </Text>
                        )}
                    </View>
                )}

                <View style={styles.infoCard}>
                    <InfoRow
                        icon="phone-portrait-outline"
                        label={t("chatProfile.mobile", "Mobile")}
                        value={data.phone}
                        colors={colors}
                        styles={styles}
                        isArabic={isArabic}
                    />

                    <InfoRow
                        icon="at"
                        label={t("chatProfile.username", "Username")}
                        value={data.username}
                        colors={colors}
                        styles={styles}
                        isArabic={isArabic}
                    />

                    <InfoRow
                        icon="mail-outline"
                        label={t("chatProfile.email", "Email")}
                        value={data.email}
                        colors={colors}
                        styles={styles}
                        isArabic={isArabic}
                    />

                    <InfoRow
                        icon="briefcase-outline"
                        label={t("chatProfile.department", "Department")}
                        value={
                            data.department === "Sales"
                                ? "Sales Department"
                                : data.department
                        }
                        colors={colors}
                        styles={styles}
                        isArabic={isArabic}
                    />

                    <InfoRow
                        icon="location-outline"
                        label={t("chatProfile.location", "Location")}
                        value={data.location}
                        colors={colors}
                        styles={styles}
                        isArabic={isArabic}
                        isLast
                    />
                </View>

                <View style={styles.sharedCard}>
                    <View style={[styles.tabsRow, getRowDirectionStyle(isArabic)]}>
                        {tabs.map((item) => {
                            const selected = activeTab === item.key;

                            return (
                                <TouchableOpacity
                                    key={item.key}
                                    activeOpacity={0.85}
                                    style={[
                                        styles.tabButton,
                                        selected && styles.tabButtonActive,
                                    ]}
                                    onPress={() => setActiveTab(item.key)}
                                >
                                    <Text
                                        style={[
                                            styles.tabText,
                                            selected && styles.tabTextActive,
                                        ]}
                                    >
                                        {item.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {activeTab === "media" && (
                        <View style={styles.mediaGrid}>
                            {mediaItems.map((item) => (
                                <MediaTile
                                    key={item.key}
                                    item={item}
                                    data={data}
                                    colors={colors}
                                    styles={styles}
                                />
                            ))}
                        </View>
                    )}

                    {activeTab === "files" && (
                        <ListContent
                            data={files}
                            colors={colors}
                            styles={styles}
                            isArabic={isArabic}
                        />
                    )}

                    {activeTab === "links" && (
                        <ListContent
                            data={links}
                            colors={colors}
                            styles={styles}
                            isArabic={isArabic}
                        />
                    )}

                    {activeTab === "voice" && (
                        <ListContent
                            data={voice}
                            colors={colors}
                            styles={styles}
                            isArabic={isArabic}
                        />
                    )}
                </View>
            </Animated.ScrollView>
        </View>
    );
}

function ActionButton({ icon, label, colors, styles, onPress }) {
    return (
        <TouchableOpacity
            activeOpacity={0.85}
            style={styles.actionButton}
            onPress={onPress}
        >
            <Ionicons name={icon} size={34} color={colors.blue} />
            <Text style={styles.actionText}>{label}</Text>
        </TouchableOpacity>
    );
}

function InfoRow({ icon, label, value, colors, styles, isArabic, isLast }) {
    return (
        <View
            style={[
                styles.infoRow,
                getRowDirectionStyle(isArabic),
                isLast && styles.infoRowLast,
            ]}
        >
            <View style={styles.infoIconBox}>
                <Ionicons name={icon} size={32} color={colors.blue} />
            </View>

            <View style={styles.infoTextBox}>
                <Text
                    style={[styles.infoLabel, getTextDirectionStyle(isArabic)]}
                    numberOfLines={1}
                >
                    {label}
                </Text>

                <Text
                    style={[styles.infoValue, getTextDirectionStyle(isArabic)]}
                    numberOfLines={2}
                >
                    {value}
                </Text>
            </View>
        </View>
    );
}

function SearchResultRow({ item, colors, styles, isArabic }) {
    return (
        <View style={[styles.searchResultRow, getRowDirectionStyle(isArabic)]}>
            <View style={styles.searchResultIcon}>
                <Feather name={item.icon} size={20} color={colors.blue} />
            </View>

            <View style={styles.searchResultTextBox}>
                <Text
                    style={[
                        styles.searchResultTitle,
                        getTextDirectionStyle(isArabic),
                    ]}
                    numberOfLines={1}
                >
                    {item.title}
                </Text>

                <Text
                    style={[
                        styles.searchResultSubtitle,
                        getTextDirectionStyle(isArabic),
                    ]}
                    numberOfLines={1}
                >
                    {item.subtitle}
                </Text>
            </View>
        </View>
    );
}

function MediaTile({ item, data, colors, styles }) {
    const chatDotColor = data.isBlocked
        ? colors.danger
        : data.isOnline || data.isTyping
            ? colors.primary
            : colors.textMuted;
    if (item.type === "chat") {
        return (
            <View style={styles.chatTile}>
                <View style={styles.chatRow}>
                    <View style={styles.chatAvatar}>
                        {data.avatar ? (
                            <Image
                                source={{ uri: data.avatar }}
                                style={styles.chatAvatarImage}
                            />
                        ) : (
                            <Ionicons name="person-outline" size={26} color={colors.text} />
                        )}
                        <View style={[styles.chatDot, { backgroundColor: chatDotColor }]} />
                    </View>

                    <View style={styles.chatTextBox}>
                        <View style={styles.chatTopRow}>
                            <Text style={styles.chatName} numberOfLines={1}>
                                {data.name}
                            </Text>
                            <Text style={styles.chatTime}>7:59 PM</Text>
                        </View>

                        <View style={styles.chatPill}>
                            <Text style={styles.chatPillText}>{data.department}</Text>
                        </View>

                        <Text style={styles.chatMessage} numberOfLines={1}>
                            IMG_6232.png
                        </Text>
                    </View>
                </View>

                <View style={styles.chatRow}>
                    <View style={styles.chatAvatar}>
                        <Ionicons name="person-outline" size={26} color={colors.text} />
                        <View style={[styles.chatDot, { backgroundColor: chatDotColor }]} />
                    </View>

                    <View style={styles.chatTextBox}>
                        <View style={styles.chatTopRow}>
                            <Text style={styles.chatName} numberOfLines={1}>
                                MAK Overseas Admin
                            </Text>
                            <Text style={styles.chatTime}>Jun 4</Text>
                        </View>

                        <Text style={styles.chatMessage} numberOfLines={1}>
                            No messages yet
                        </Text>
                    </View>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.mediaTile}>
            <Image source={item.image} style={styles.mediaImage} resizeMode="cover" />

            <View style={styles.mediaBadge}>
                <Ionicons
                    name={
                        item.type === "video"
                            ? "play-outline"
                            : item.type === "file"
                                ? "document-text-outline"
                                : "image-outline"
                    }
                    size={21}
                    color="#FFFFFF"
                />
            </View>
        </View>
    );
}

function ListContent({ data, colors, styles, isArabic }) {
    return (
        <View style={styles.listContent}>
            {data.map((item) => (
                <View
                    key={item.key}
                    style={[styles.listItem, getRowDirectionStyle(isArabic)]}
                >
                    <View style={styles.listIcon}>
                        <Feather name={item.icon} size={22} color={colors.blue} />
                    </View>

                    <View style={styles.listTextBox}>
                        <Text
                            style={[styles.listTitle, getTextDirectionStyle(isArabic)]}
                            numberOfLines={1}
                        >
                            {item.title}
                        </Text>

                        <Text
                            style={[
                                styles.listSubtitle,
                                getTextDirectionStyle(isArabic),
                            ]}
                            numberOfLines={1}
                        >
                            {item.subtitle}
                        </Text>
                    </View>
                </View>
            ))}
        </View>
    );
}

const createStyles = (colors) =>
    StyleSheet.create({
        root: {
            flex: 1,
            backgroundColor: colors.background,
        },

        fixedHeader: {
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 1000,
            elevation: 1000,
            minHeight: Platform.OS === "ios" ? 120 : 96,
            paddingTop: Platform.OS === "ios" ? 66 : 44,
            paddingHorizontal: 16,
            paddingBottom: 10,
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: colors.background,
            borderBottomWidth: 1,
            borderBottomColor: colors.borderSoft,
        },

        headerTitleWrapper: {
            position: "absolute",
            left: 116,
            right: 116,
            bottom: 18,
            alignItems: "center",
            justifyContent: "center",
        },

        headerTitle: {
            width: "100%",
            color: colors.text,
            fontSize: 17,
            lineHeight: 21,
            fontWeight: "900",
            textAlign: "center",
            writingDirection: "ltr",
        },

        headerSubtitle: {
            width: "100%",
            color: colors.textSecondary,
            fontSize: 12,
            lineHeight: 15,
            fontWeight: "700",
            textAlign: "center",
            marginTop: 1,
            writingDirection: "ltr",
        },

        scrollContent: {
            flexGrow: 1,
            paddingHorizontal: 16,
            paddingTop: Platform.OS === "ios" ? 136 : 112,
            paddingBottom: 34,
        },

        roundButton: {
            width: 54,
            height: 54,
            borderRadius: 27,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.buttonSoft,
            alignItems: "center",
            justifyContent: "center",
        },

        topSpacer: {
            flex: 1,
        },

        editButton: {
            minWidth: 86,
            height: 54,
            borderRadius: 27,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.buttonSoft,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 18,
        },

        editText: {
            color: colors.text,
            fontSize: 18,
            fontWeight: "800",
        },

        profileHeader: {
            alignItems: "center",
            justifyContent: "center",
            marginTop: 4,
            marginBottom: 26,
            width: "100%",
        },

        avatar: {
            width: 148,
            height: 148,
            borderRadius: 74,
            borderWidth: 1,
            borderColor: colors.avatarBorder,
            backgroundColor: colors.avatarBackground,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 12,
            overflow: "hidden",
        },

        avatarImage: {
            width: "100%",
            height: "100%",
            borderRadius: 74,
        },

        avatarText: {
            color: colors.text,
            fontSize: 54,
            fontWeight: "900",
            textAlign: "center",
        },

        nameWrapper: {
            width: "100%",
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 8,
        },

        name: {
            width: "100%",
            color: colors.text,
            fontSize: 28,
            lineHeight: 35,
            fontWeight: "900",
            textAlign: "center",
            writingDirection: "ltr",
        },

        departmentPill: {
            marginTop: 10,
            minHeight: 34,
            borderRadius: 17,
            borderWidth: 1,
            borderColor: colors.blue,
            backgroundColor: colors.blueSoft,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 18,
        },

        departmentPillText: {
            color: colors.blue,
            fontSize: 19,
            fontWeight: "700",
            textAlign: "center",
        },

        statusRow: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 9,
            marginTop: 10,
        },

        onlineDot: {
            width: 15,
            height: 15,
            borderRadius: 8,
        },

        statusText: {
            fontSize: 22,
            fontWeight: "700",
        },

        actionsRow: {
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            marginBottom: 14,
            zIndex: 25,
            overflow: "visible",
        },

        moreActionWrapper: {
            flex: 1,
            position: "relative",
            zIndex: 100,
            overflow: "visible",
        },

        actionButton: {
            flex: 1,
            height: 92,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.buttonSoft,
            alignItems: "center",
            justifyContent: "center",
        },

        actionText: {
            color: colors.text,
            fontSize: 18,
            fontWeight: "800",
            marginTop: 8,
            textAlign: "center",
        },

        menuBoxUnderMore: {
            position: "absolute",
            top: 102,
            width: 188,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: colors.borderSoft,
            backgroundColor: colors.cardStrong,
            paddingVertical: 8,
            zIndex: 999,
            elevation: 999,
        },

        menuBoxUnderMoreEnglish: {
            right: 0,
        },

        menuBoxUnderMoreArabic: {
            left: 0,
        },

        menuItem: {
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            paddingHorizontal: 14,
            paddingVertical: 13,
            minHeight: 48,
        },

        menuItemText: {
            flex: 1,
            color: colors.text,
            fontSize: 15,
            fontWeight: "800",
        },

        searchBox: {
            minHeight: 52,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: colors.inputBorder,
            backgroundColor: colors.inputBackground,
            paddingHorizontal: 14,
            marginBottom: 14,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
        },

        searchInput: {
            flex: 1,
            minHeight: 50,
            color: colors.text,
            fontSize: 16,
            fontWeight: "700",
            paddingVertical: 0,
        },

        searchResultsCard: {
            borderRadius: 20,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            padding: 10,
            marginBottom: 14,
        },

        searchResultRow: {
            flexDirection: "row",
            alignItems: "center",
            minHeight: 58,
            gap: 10,
        },

        searchResultIcon: {
            width: 40,
            height: 40,
            borderRadius: 14,
            backgroundColor: colors.buttonSoft,
            alignItems: "center",
            justifyContent: "center",
        },

        searchResultTextBox: {
            flex: 1,
            minWidth: 0,
        },

        searchResultTitle: {
            color: colors.text,
            fontSize: 15,
            fontWeight: "900",
        },

        searchResultSubtitle: {
            color: colors.textSecondary,
            fontSize: 13,
            fontWeight: "700",
            marginTop: 3,
        },

        emptySearchText: {
            color: colors.textSecondary,
            fontSize: 15,
            fontWeight: "800",
            padding: 10,
            textAlign: "center",
        },

        infoCard: {
            borderRadius: 24,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            paddingHorizontal: 16,
            paddingVertical: 8,
            marginBottom: 14,
        },

        infoRow: {
            flexDirection: "row",
            alignItems: "center",
            minHeight: 76,
            borderBottomWidth: 1,
            borderBottomColor: colors.borderSoft,
        },

        infoRowLast: {
            borderBottomWidth: 0,
        },

        infoIconBox: {
            width: 48,
            alignItems: "center",
            justifyContent: "center",
        },

        infoTextBox: {
            flex: 1,
            paddingHorizontal: 12,
        },

        infoLabel: {
            color: colors.textSecondary,
            fontSize: 16,
            fontWeight: "700",
            marginBottom: 3,
        },

        infoValue: {
            color: colors.text,
            fontSize: 20,
            lineHeight: 25,
            fontWeight: "600",
        },

        sharedCard: {
            borderRadius: 24,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            padding: 12,
        },

        tabsRow: {
            flexDirection: "row",
            alignItems: "center",
            borderBottomWidth: 1,
            borderBottomColor: colors.borderSoft,
            paddingBottom: 8,
            marginBottom: 10,
        },

        tabButton: {
            flex: 1,
            height: 38,
            borderRadius: 19,
            alignItems: "center",
            justifyContent: "center",
        },

        tabButtonActive: {
            borderWidth: 1,
            borderColor: colors.primary,
            backgroundColor: colors.primarySoft,
        },

        tabText: {
            color: colors.text,
            fontSize: 17,
            fontWeight: "800",
            textAlign: "center",
        },

        tabTextActive: {
            color: colors.primary,
        },

        mediaGrid: {
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 12,
        },

        mediaTile: {
            width: "48%",
            height: 128,
            borderRadius: 16,
            overflow: "hidden",
            backgroundColor: colors.cardSoft,
            borderWidth: 1,
            borderColor: colors.borderSoft,
        },

        mediaImage: {
            width: "100%",
            height: "100%",
        },

        mediaBadge: {
            position: "absolute",
            left: 10,
            bottom: 10,
            width: 34,
            height: 34,
            borderRadius: 8,
            backgroundColor: "rgba(0,0,0,0.72)",
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.22)",
        },

        chatTile: {
            width: "48%",
            height: 128,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.borderSoft,
            backgroundColor: colors.cardStrong,
            padding: 8,
            justifyContent: "center",
        },

        chatRow: {
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
        },

        chatAvatar: {
            width: 45,
            height: 45,
            borderRadius: 23,
            backgroundColor: colors.avatarBackground,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 8,
            position: "relative",
            overflow: "hidden",
        },

        chatAvatarImage: {
            width: "100%",
            height: "100%",
            borderRadius: 23,
        },

        chatDot: {
            position: "absolute",
            right: 2,
            bottom: 5,
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: colors.textMuted,
            borderWidth: 1,
            borderColor: colors.cardStrong,
        },

        chatTextBox: {
            flex: 1,
            minWidth: 0,
        },

        chatTopRow: {
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
        },

        chatName: {
            flex: 1,
            color: colors.text,
            fontSize: 12.5,
            fontWeight: "900",
        },

        chatTime: {
            color: colors.textSecondary,
            fontSize: 10,
            fontWeight: "700",
        },

        chatPill: {
            alignSelf: "flex-start",
            marginTop: 3,
            marginBottom: 2,
            borderRadius: 8,
            backgroundColor: colors.blueSoft,
            paddingHorizontal: 7,
            paddingVertical: 2,
        },

        chatPillText: {
            color: colors.blue,
            fontSize: 10,
            fontWeight: "800",
        },

        chatMessage: {
            color: colors.text,
            fontSize: 11,
            fontWeight: "700",
        },

        listContent: {
            paddingVertical: 4,
        },

        listItem: {
            minHeight: 68,
            borderRadius: 16,
            backgroundColor: colors.cardStrong,
            borderWidth: 1,
            borderColor: colors.borderSoft,
            paddingHorizontal: 12,
            marginBottom: 10,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
        },

        listIcon: {
            width: 44,
            height: 44,
            borderRadius: 14,
            backgroundColor: colors.buttonSoft,
            alignItems: "center",
            justifyContent: "center",
        },

        listTextBox: {
            flex: 1,
            minWidth: 0,
        },

        listTitle: {
            color: colors.text,
            fontSize: 16,
            fontWeight: "900",
        },

        listSubtitle: {
            color: colors.textSecondary,
            fontSize: 13,
            fontWeight: "700",
            marginTop: 3,
        },
    });
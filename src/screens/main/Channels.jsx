// src/screens/Channels.jsx

import { Feather, MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    ActivityIndicator,
    Alert,
    Image,
    LayoutAnimation,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    UIManager,
    useWindowDimensions,
    View,
} from "react-native";

import MainNavBar from "@/src/components/MainNavBar";
import { appImages } from "@/src/constants/images";
import { LANGUAGE_STORAGE_KEY } from "@/src/i18n";
import channelService from "@/src/services/api/channelService";
import {
    getRowDirectionStyle,
    getTextDirectionStyle,
    getTextInputDirectionFromValue,
} from "@/src/styles/globalStyles";
import { useAppTheme } from "@/src/theme/ThemeProvider";
import channelEvents from "@/src/services/api/channelEvents";

/**
 * تفعيل حركة انتقال العناصر على Android
 * iOS يدعم LayoutAnimation تلقائياً
 */
if (
    Platform.OS === "android" &&
    UIManager.setLayoutAnimationEnabledExperimental &&
    !global.nativeFabricUIManager
) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

/**
 * حركة ناعمة لما القناة تنتقل من Following إلى Not Following أو العكس
 */
const animateChannelMove = () => {
    LayoutAnimation.configureNext({
        duration: 260,
        create: {
            type: LayoutAnimation.Types.easeInEaseOut,
            property: LayoutAnimation.Properties.opacity,
        },
        update: {
            type: LayoutAnimation.Types.easeInEaseOut,
        },
        delete: {
            type: LayoutAnimation.Types.easeInEaseOut,
            property: LayoutAnimation.Properties.opacity,
        },
    });
};

export default function Channels({ navigation }) {
    const { t, i18n } = useTranslation();
    const { width } = useWindowDimensions();

    const isArabic = i18n.language === "ar";
    const isSmallScreen = width < 380;

    const [showNavTitle, setShowNavTitle] = useState(false);
    const [searchText, setSearchText] = useState("");

    // القنوات القادمة من الـ API
    const [channels, setChannels] = useState([]);

    // Loading لأول تحميل للشاشة
    const [isLoading, setIsLoading] = useState(true);

    // Loading للسحب لتحديث البيانات فقط
    const [isRefreshing, setIsRefreshing] = useState(false);

    // رسالة الخطأ إذا فشل تحميل القنوات
    const [errorMessage, setErrorMessage] = useState("");

    // لمعرفة أي قناة زرها حالياً عم يعمل follow أو unfollow
    const [loadingChannelSlug, setLoadingChannelSlug] = useState(null);

    const mainScrollRef = useRef(null);

    const { colors, isDark } = useAppTheme();

    const styles = useMemo(
        () => createStyles(colors, isSmallScreen),
        [colors, isSmallScreen]
    );

    /**
     * تجهيز بيانات القناة القادمة من الـ API لتناسب الواجهة
     * API بيرجع: name, slug, image, is_following, followers_count
     * الواجهة تستخدم: title, isFollowing, followersCount
     */
    const normalizeChannel = useCallback((channel) => {
        return {
            id: channel?.id,
            key: channel?.slug || String(channel?.id),
            slug: channel?.slug,
            title: channel?.name || "",
            description: channel?.description || "",
            image: channel?.image || null,
            type: channel?.type,
            isFollowing: Boolean(channel?.is_following),
            followersCount: Number(channel?.followers_count || 0),
        };
    }, []);

    /**
     * جلب القنوات من الـ API
     * هذا فقط عند فتح الشاشة أو عند Pull To Refresh
     * لا نستدعيه بعد follow/unfollow حتى لا يصير reload
     */
    const fetchChannels = useCallback(
        async ({ fullLoading = false, refreshLoading = false } = {}) => {
            try {
                if (fullLoading) {
                    setIsLoading(true);
                }

                if (refreshLoading) {
                    setIsRefreshing(true);
                }

                setErrorMessage("");

                const result = await channelService.listChannels();

                const preparedChannels = Array.isArray(result)
                    ? result.map(normalizeChannel)
                    : [];

                animateChannelMove();
                setChannels(preparedChannels);
            } catch (error) {
                console.log("List channels error:", error?.raw || error);

                setErrorMessage(
                    error?.userMessage ||
                    (isArabic
                        ? "صار خطأ أثناء تحميل القنوات. تأكدي من الاتصال وحاولي مرة ثانية."
                        : "Something went wrong while loading channels. Please try again.")
                );
            } finally {
                setIsLoading(false);
                setIsRefreshing(false);
            }
        },
        [isArabic, normalizeChannel]
    );

    useEffect(() => {
        const unsubscribe = channelEvents.subscribe((payload) => {
            const { slug, isFollowing, followersCount } = payload || {};

            if (!slug) {
                return;
            }

            animateChannelMove();

            setChannels((currentChannels) =>
                currentChannels.map((channel) => {
                    if (channel.slug !== slug) {
                        return channel;
                    }

                    return {
                        ...channel,
                        isFollowing: Boolean(isFollowing),
                        followersCount: Math.max(0, Number(followersCount || 0)),
                    };
                })
            );
        });

        return unsubscribe;
    }, []);

    /**
     * أول ما تفتح الشاشة، جيبي القنوات من السيرفر
     */
    useEffect(() => {
        fetchChannels({ fullLoading: true });
    }, [fetchChannels]);

    /**
     * البحث محلياً داخل القنوات المحملة
     * ما منستدعي API مع كل حرف
     */
    const filteredChannels = useMemo(() => {
        const keyword = searchText.trim().toLowerCase();

        if (!keyword) {
            return channels;
        }

        return channels.filter((channel) => {
            const title = channel.title.toLowerCase();
            const description = channel.description.toLowerCase();

            return title.includes(keyword) || description.includes(keyword);
        });
    }, [channels, searchText]);

    /**
     * فصل القنوات إلى:
     * 1. قنوات يتابعها المستخدم
     * 2. قنوات لا يتابعها المستخدم
     *
     * لما isFollowing تتغير محلياً، القناة تنتقل فوراً بين القسمين
     */
    const filteredFollowingChannels = useMemo(() => {
        return filteredChannels.filter((channel) => channel.isFollowing);
    }, [filteredChannels]);

    const filteredNotFollowingChannels = useMemo(() => {
        return filteredChannels.filter((channel) => !channel.isFollowing);
    }, [filteredChannels]);

    const resetMainScrollPosition = () => {
        mainScrollRef.current?.scrollTo({
            y: 0,
            animated: false,
        });
    };

    const handleScroll = (event) => {
        const y = event.nativeEvent.contentOffset.y;

        if (y > 45 && !showNavTitle) {
            setShowNavTitle(true);
        }

        if (y <= 45 && showNavTitle) {
            setShowNavTitle(false);
        }
    };

    const toggleLanguage = async () => {
        const nextLanguage = isArabic ? "en" : "ar";

        setShowNavTitle(false);
        resetMainScrollPosition();

        await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
        await i18n.changeLanguage(nextLanguage);

        setTimeout(() => {
            resetMainScrollPosition();
        }, 80);
    };

    /**
     * فتح صفحة القناة
     */
    const openChannelChat = (channel) => {
        const params = {
            channelId: channel.id,
            channelKey: channel.key,
            channelSlug: channel.slug,
            channelTitle: channel.title,
            channelImage: channel.image,
            channelType: channel.type,
            followersCount: channel.followersCount,
            initialFollowing: channel.isFollowing,
        };

        const parentNavigation = navigation.getParent();

        if (parentNavigation) {
            parentNavigation.navigate("ChannelChat", params);
            return;
        }

        navigation.navigate("ChannelChat", params);
    };

    /**
     * تحويل أخطاء الـ API لرسالة مفهومة
     * apiClient عندك بيرجع ApiError، لذلك نقرأ error.code و error.userMessage
     */
    const getFollowErrorMessage = (error) => {
        const code = error?.code;
        const message = error?.userMessage || error?.message;

        if (code === "ALREADY_FOLLOWING") {
            return isArabic
                ? "أنتِ تتابعين هذه القناة مسبقاً."
                : "You are already following this channel.";
        }

        if (code === "NOT_FOLLOWING") {
            return isArabic
                ? "أنتِ لا تتابعين هذه القناة حالياً."
                : "You are not following this channel.";
        }

        if (code === "CHANNEL_ADMIN_FOLLOW") {
            return isArabic
                ? "أدمن القناة لا يمكنه متابعة قناته."
                : "Channel admins cannot follow their own channel.";
        }

        if (code === "UNAUTHENTICATED") {
            return isArabic
                ? "انتهت الجلسة. سجلي الدخول مرة ثانية."
                : "Session expired. Please login again.";
        }

        if (code === "DEVICE_NOT_AUTHORIZED") {
            return isArabic
                ? "هذا الجهاز غير مصرح له باستخدام الحساب."
                : "This device is not authorized for this account.";
        }

        return (
            message ||
            (isArabic
                ? "صار خطأ أثناء تحديث المتابعة. حاولي مرة ثانية."
                : "Something went wrong while updating follow status.")
        );
    };

    /**
     * تحديث قناة واحدة محلياً
     * هذه أهم function لأنها تنقل القناة فوراً بين القسمين بدون refresh
     */
    const updateChannelFollowStateLocally = useCallback(
        ({ slug, isFollowing, followersChange }) => {
            animateChannelMove();

            setChannels((currentChannels) =>
                currentChannels.map((item) => {
                    if (item.slug !== slug) {
                        return item;
                    }

                    return {
                        ...item,
                        isFollowing,
                        followersCount: Math.max(
                            0,
                            Number(item.followersCount || 0) + followersChange
                        ),
                    };
                })
            );
        },
        []
    );

    /**
     * Follow / Unfollow
     *
     * المطلوب:
     * - القناة تنتقل فوراً بين Following و Not Following
     * - لا نعمل reload
     * - لا نعمل refresh
     * - إذا فشل الـ API نرجع القناة لمكانها القديم
     */
    const handleToggleFollow = async (channel) => {
        if (!channel?.slug || loadingChannelSlug) {
            return;
        }

        const oldIsFollowing = channel.isFollowing;
        const nextIsFollowing = !oldIsFollowing;

        const optimisticFollowersChange = nextIsFollowing ? 1 : -1;
        const rollbackFollowersChange = nextIsFollowing ? -1 : 1;

        try {
            setLoadingChannelSlug(channel.slug);

            /**
             * أولاً: تحديث فوري للواجهة
             * القناة تنتقل فوراً للقسم الثاني مع animation
             */
            updateChannelFollowStateLocally({
                slug: channel.slug,
                isFollowing: nextIsFollowing,
                followersChange: optimisticFollowersChange,
            });

            /**
             * ثانياً: إرسال الطلب للـ API
             * لا نعمل fetchChannels بعد النجاح
             */
            if (oldIsFollowing) {
                await channelService.unfollowChannel(channel.slug);
            } else {
                await channelService.followChannel(channel.slug);
            }
        } catch (error) {
            console.log("Follow/unfollow error:", error?.raw || error);

            /**
             * بعض الأخطاء تعني أن حالة السيرفر أصلاً مثل الحالة الجديدة
             * مثلاً:
             * ALREADY_FOLLOWING بعد follow: نخليها Following
             * NOT_FOLLOWING بعد unfollow: نخليها Not Following
             * لذلك لا نعمل rollback بهذه الحالات
             */
            const shouldKeepOptimisticState =
                error?.code === "ALREADY_FOLLOWING" ||
                error?.code === "NOT_FOLLOWING";

            if (!shouldKeepOptimisticState) {
                /**
                 * إذا فشل الطلب فعلاً، نرجع القناة لمكانها القديم مع animation
                 */
                updateChannelFollowStateLocally({
                    slug: channel.slug,
                    isFollowing: oldIsFollowing,
                    followersChange: rollbackFollowersChange,
                });

                Alert.alert(
                    isArabic ? "تنبيه" : "Notice",
                    getFollowErrorMessage(error)
                );
            }
        } finally {
            setLoadingChannelSlug(null);
        }
    };

    const renderLoading = () => {
        return (
            <View style={styles.centerBox}>
                <ActivityIndicator size="large" color={colors.primary} />

                <Text style={[styles.centerText, getTextDirectionStyle(isArabic)]}>
                    {isArabic ? "جاري تحميل القنوات..." : "Loading channels..."}
                </Text>
            </View>
        );
    };

    const renderError = () => {
        return (
            <View style={styles.errorBox}>
                <Feather
                    name="alert-circle"
                    size={34}
                    color={colors.danger}
                />

                <Text style={[styles.errorTitle, getTextDirectionStyle(isArabic)]}>
                    {isArabic ? "تعذر تحميل القنوات" : "Unable to load channels"}
                </Text>

                <Text style={[styles.errorText, getTextDirectionStyle(isArabic)]}>
                    {errorMessage}
                </Text>

                <TouchableOpacity
                    activeOpacity={0.85}
                    style={styles.retryButton}
                    onPress={() => fetchChannels({ fullLoading: true })}
                >
                    <Text style={styles.retryButtonText}>
                        {isArabic ? "إعادة المحاولة" : "Try again"}
                    </Text>
                </TouchableOpacity>
            </View>
        );
    };

    const renderEmpty = () => {
        return (
            <View style={styles.emptyBox}>
                <Feather name="radio" size={32} color={colors.textMuted} />

                <Text style={[styles.emptyTitle, getTextDirectionStyle(isArabic)]}>
                    {t("channels.emptyTitle")}
                </Text>

                <Text style={[styles.emptyText, getTextDirectionStyle(isArabic)]}>
                    {t("channels.emptyText")}
                </Text>
            </View>
        );
    };

    const renderChannelsContent = () => {
        if (isLoading) {
            return renderLoading();
        }

        if (errorMessage && channels.length === 0) {
            return renderError();
        }

        const isEmpty =
            filteredFollowingChannels.length === 0 &&
            filteredNotFollowingChannels.length === 0;

        return (
            <>
                <ChannelSectionHeader
                    title={t("channels.followingTitle")}
                    icon="bookmark"
                    color={colors.primary}
                    isArabic={isArabic}
                    styles={styles}
                />

                <View style={styles.channelsList}>
                    {filteredFollowingChannels.map((channel) => (
                        <ChannelCard
                            key={channel.key}
                            channel={channel}
                            colors={colors}
                            styles={styles}
                            isArabic={isArabic}
                            t={t}
                            isLoading={loadingChannelSlug === channel.slug}
                            onPress={() => openChannelChat(channel)}
                            onToggleFollow={() => handleToggleFollow(channel)}
                        />
                    ))}
                </View>

                <ChannelSectionHeader
                    title={t("channels.notFollowingTitle")}
                    icon="users"
                    color={colors.blue}
                    isArabic={isArabic}
                    styles={styles}
                />

                <View style={styles.channelsList}>
                    {filteredNotFollowingChannels.map((channel) => (
                        <ChannelCard
                            key={channel.key}
                            channel={channel}
                            colors={colors}
                            styles={styles}
                            isArabic={isArabic}
                            t={t}
                            isLoading={loadingChannelSlug === channel.slug}
                            onPress={() => openChannelChat(channel)}
                            onToggleFollow={() => handleToggleFollow(channel)}
                        />
                    ))}
                </View>

                {isEmpty && renderEmpty()}
            </>
        );
    };

    return (
        <View style={styles.root}>
            <StatusBar
                style={isDark ? "light" : "dark"}
                translucent
                backgroundColor="transparent"
            />

            <MainNavBar
                navigation={navigation}
                title={t("channels.navTitle")}
                showTitle={showNavTitle}
                notificationCount={3}
                onToggleLanguage={toggleLanguage}
                menuItems={[
                    {
                        key: "settings",
                        label: t("home.menuSettings"),
                        iconType: "feather",
                        iconName: "settings",
                        onPress: () => navigation.navigate("Settings"),
                    },
                    {
                        key: "profile",
                        label: t("bottomTabs.profile"),
                        iconType: "feather",
                        iconName: "user",
                        onPress: () => navigation.navigate("Profile"),
                    },
                ]}
            />

            <ScrollView
                ref={mainScrollRef}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                onScroll={handleScroll}
                scrollEventThrottle={16}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefreshing}
                        onRefresh={() => fetchChannels({ refreshLoading: true })}
                        tintColor={colors.primary}
                        colors={[colors.primary]}
                    />
                }
            >
                <View style={styles.headerBox}>
                    <Text style={[styles.title, getTextDirectionStyle(isArabic)]}>
                        {t("channels.title")}
                    </Text>

                    <Text style={[styles.subtitle, getTextDirectionStyle(isArabic)]}>
                        {t("channels.subtitle")}
                    </Text>
                </View>

                <View style={[styles.searchBox, getRowDirectionStyle(isArabic)]}>
                    <Feather name="search" size={20} color={colors.textMuted} />

                    <TextInput
                        value={searchText}
                        onChangeText={setSearchText}
                        placeholder={t("channels.searchPlaceholder")}
                        placeholderTextColor={colors.textMuted}
                        style={[
                            styles.searchInput,
                            getTextInputDirectionFromValue(searchText, isArabic),
                        ]}
                        autoCorrect={false}
                        autoCapitalize="none"
                    />

                    {!!searchText && (
                        <TouchableOpacity
                            activeOpacity={0.75}
                            onPress={() => setSearchText("")}
                        >
                            <Feather name="x" size={18} color={colors.textSecondary} />
                        </TouchableOpacity>
                    )}
                </View>

                {renderChannelsContent()}
            </ScrollView>
        </View>
    );
}

function ChannelSectionHeader({ title, icon, color, isArabic, styles }) {
    return (
        <View style={[styles.sectionHeader, getRowDirectionStyle(isArabic)]}>
            <View style={[styles.sectionTitleBox, getRowDirectionStyle(isArabic)]}>
                <Feather name={icon} size={20} color={color} />

                <Text
                    style={[
                        styles.sectionTitle,
                        { color },
                        getTextDirectionStyle(isArabic),
                    ]}
                >
                    {title}
                </Text>
            </View>

            <View style={styles.sectionLine} />
        </View>
    );
}

function ChannelCard({
    channel,
    colors,
    styles,
    isArabic,
    t,
    onPress,
    onToggleFollow,
    isLoading,
}) {
    const actionColor = channel.isFollowing ? colors.primary : colors.blue;

    const followersText = isArabic
        ? `${channel.followersCount} متابع`
        : `${channel.followersCount} followers`;

    /**
     * إذا الـ API رجع image منستخدمها
     * إذا ما رجع image منستخدم صورة default من assets
     */
    const imageSource = channel.image
        ? { uri: channel.image }
        : appImages.homeContainers;

    return (
        <TouchableOpacity
            activeOpacity={0.88}
            style={[styles.channelCard, getRowDirectionStyle(isArabic)]}
            onPress={onPress}
            disabled={isLoading}
        >
            <View style={styles.channelImageBox}>
                <Image
                    source={imageSource}
                    style={styles.channelImage}
                    resizeMode="cover"
                />

                {!channel.image && (
                    <View style={styles.defaultImageOverlay}>
                        {channel.type === 2 ? (
                            <Feather name="activity" size={22} color={colors.textPrimary} />
                        ) : (
                            <MaterialIcons
                                name="campaign"
                                size={24}
                                color={colors.textPrimary}
                            />
                        )}
                    </View>
                )}
            </View>

            <View style={styles.channelContent}>
                <Text
                    numberOfLines={1}
                    style={[styles.channelTitle, getTextDirectionStyle(isArabic)]}
                >
                    {channel.title}
                </Text>

                <Text
                    numberOfLines={2}
                    style={[
                        styles.channelDescription,
                        getTextDirectionStyle(isArabic),
                    ]}
                >
                    {channel.description}
                </Text>

                <View style={[styles.followersRow, getRowDirectionStyle(isArabic)]}>
                    <Feather name="users" size={13} color={colors.textMuted} />

                    <Text
                        style={[
                            styles.followersText,
                            getTextDirectionStyle(isArabic),
                        ]}
                    >
                        {followersText}
                    </Text>
                </View>
            </View>

            <TouchableOpacity
                activeOpacity={0.85}
                style={[
                    styles.followButton,
                    {
                        borderColor: actionColor,
                        opacity: isLoading ? 0.65 : 1,
                    },
                ]}
                onPress={(event) => {
                    event.stopPropagation();
                    onToggleFollow();
                }}
                disabled={isLoading}
            >
                {isLoading ? (
                    <ActivityIndicator size="small" color={actionColor} />
                ) : (
                    <Text
                        style={[
                            styles.followButtonText,
                            {
                                color: actionColor,
                            },
                        ]}
                    >
                        {channel.isFollowing
                            ? t("channels.followingButton")
                            : t("channels.followButton")}
                    </Text>
                )}
            </TouchableOpacity>
        </TouchableOpacity>
    );
}

const createStyles = (colors, isSmallScreen) =>
    StyleSheet.create({
        root: {
            flex: 1,
            backgroundColor: colors.background,
        },

        scrollContent: {
            flexGrow: 1,
            paddingHorizontal: isSmallScreen ? 14 : 20,
            paddingTop: Platform.OS === "android" ? 130 : 145,
            paddingBottom: Platform.OS === "android" ? 120 : 130,
        },

        headerBox: {
            marginTop: 10,
            marginBottom: 18,
        },

        title: {
            color: colors.textPrimary,
            fontSize: isSmallScreen ? 32 : 36,
            fontWeight: "900",
            marginBottom: 8,
        },

        subtitle: {
            color: colors.textSecondary,
            fontSize: isSmallScreen ? 14.5 : 16,
            lineHeight: isSmallScreen ? 22 : 24,
            fontWeight: "700",
        },

        searchBox: {
            minHeight: 54,
            borderRadius: 17,
            paddingHorizontal: 14,
            backgroundColor: colors.cardSoft,
            borderWidth: 1,
            borderColor: colors.border,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            marginBottom: 18,
        },

        searchInput: {
            flex: 1,
            color: colors.textPrimary,
            fontSize: 15,
            fontWeight: "700",
            paddingVertical: 0,
        },

        sectionHeader: {
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            marginTop: 8,
            marginBottom: 10,
        },

        sectionTitleBox: {
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
        },

        sectionTitle: {
            fontSize: 20,
            fontWeight: "900",
        },

        sectionLine: {
            flex: 1,
            height: 1,
            backgroundColor: colors.borderSoft,
        },

        channelsList: {
            gap: 10,
            marginBottom: 16,
        },

        channelCard: {
            minHeight: isSmallScreen ? 104 : 112,
            borderRadius: 18,
            padding: isSmallScreen ? 8 : 10,
            backgroundColor: colors.cardStrong,
            borderWidth: 1,
            borderColor: colors.borderSoft,
            flexDirection: "row",
            alignItems: "center",
            gap: isSmallScreen ? 8 : 12,
        },

        channelImageBox: {
            width: isSmallScreen ? 68 : 82,
            height: isSmallScreen ? 68 : 82,
            borderRadius: 14,
            overflow: "hidden",
            backgroundColor: colors.cardSoft,
            borderWidth: 1,
            borderColor: colors.borderSoft,
            position: "relative",
        },

        channelImage: {
            width: "100%",
            height: "100%",
        },

        defaultImageOverlay: {
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.overlay,
        },

        channelContent: {
            flex: 1,
            minHeight: isSmallScreen ? 68 : 82,
            justifyContent: "center",
        },

        channelTitle: {
            color: colors.textPrimary,
            fontSize: isSmallScreen ? 14.5 : 16,
            fontWeight: "900",
            marginBottom: 5,
        },

        channelDescription: {
            color: colors.textSecondary,
            fontSize: isSmallScreen ? 12 : 13,
            lineHeight: isSmallScreen ? 17 : 18,
            fontWeight: "600",
            marginBottom: 5,
        },

        followersRow: {
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
        },

        followersText: {
            color: colors.textMuted,
            fontSize: isSmallScreen ? 11.5 : 12,
            fontWeight: "700",
        },

        followButton: {
            minWidth: isSmallScreen ? 74 : 86,
            height: isSmallScreen ? 36 : 39,
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: isSmallScreen ? 9 : 12,
            borderWidth: 1,
            backgroundColor: "transparent",
        },

        followButtonText: {
            fontSize: isSmallScreen ? 12 : 13,
            fontWeight: "900",
        },

        emptyBox: {
            marginTop: 26,
            borderRadius: 22,
            padding: 22,
            alignItems: "center",
            backgroundColor: colors.cardStrong,
            borderWidth: 1,
            borderColor: colors.borderSoft,
        },

        emptyTitle: {
            color: colors.textPrimary,
            fontSize: 18,
            fontWeight: "900",
            marginTop: 10,
            marginBottom: 6,
            textAlign: "center",
        },

        emptyText: {
            color: colors.textSecondary,
            fontSize: 14,
            lineHeight: 21,
            fontWeight: "600",
            textAlign: "center",
        },

        centerBox: {
            marginTop: 40,
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
        },

        centerText: {
            color: colors.textSecondary,
            fontSize: 15,
            fontWeight: "700",
            marginTop: 12,
            textAlign: "center",
        },

        errorBox: {
            marginTop: 28,
            borderRadius: 22,
            padding: 22,
            alignItems: "center",
            backgroundColor: colors.cardStrong,
            borderWidth: 1,
            borderColor: colors.borderSoft,
        },

        errorTitle: {
            color: colors.textPrimary,
            fontSize: 18,
            fontWeight: "900",
            marginTop: 10,
            marginBottom: 6,
            textAlign: "center",
        },

        errorText: {
            color: colors.textSecondary,
            fontSize: 14,
            lineHeight: 21,
            fontWeight: "600",
            textAlign: "center",
            marginBottom: 16,
        },

        retryButton: {
            minHeight: 42,
            borderRadius: 13,
            paddingHorizontal: 18,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.primary,
        },

        retryButtonText: {
            color: colors.textPrimary,
            fontSize: 14,
            fontWeight: "900",
        },
    });
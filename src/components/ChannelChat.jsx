import { Feather, MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    ActivityIndicator,
    Alert,
    Image,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from "react-native";

import ChatPatternBackground from "@/src/components/ChatPatternBackground";
import { appImages } from "@/src/constants/images";
import { LANGUAGE_STORAGE_KEY } from "@/src/i18n";
import channelEvents from "@/src/services/api/channelEvents";
import channelService from "@/src/services/api/channelService";
import {
    getAutoTextDirectionStyle,
    getRowDirectionStyle,
    getTextDirectionStyle,
} from "@/src/styles/globalStyles";
import { useAppTheme } from "@/src/theme/ThemeProvider";

const POSTS_PER_PAGE = 20;

export default function ChannelChat({ navigation, route }) {
    const { t, i18n } = useTranslation();
    const { width } = useWindowDimensions();

    const isArabic = i18n.language === "ar";
    const isSmallScreen = width < 380;

    const { colors, isDark, toggleTheme } = useAppTheme();

    const styles = useMemo(
        () => createStyles(colors, isSmallScreen, isDark),
        [colors, isSmallScreen, isDark]
    );
    /**
     * البيانات جاية من شاشة Channels
     * أهم شي channelSlug لأنه هو المطلوب بالـ API
     */
    const channelSlug = route?.params?.channelSlug || route?.params?.channelKey;
    const channelTitle = route?.params?.channelTitle || "";
    const channelImage = route?.params?.channelImage || null;
    const channelType = route?.params?.channelType || 1;
    const initialFollowersCount = Number(route?.params?.followersCount || 0);
    const initialFollowing = route?.params?.initialFollowing ?? false;

    const [isFollowing, setIsFollowing] = useState(Boolean(initialFollowing));
    const [followersCount, setFollowersCount] = useState(initialFollowersCount);

    const [menuOpen, setMenuOpen] = useState(false);

    // posts القادمة من API
    const [posts, setPosts] = useState([]);

    // meta الخاصة بالـ pagination
    const [postsMeta, setPostsMeta] = useState(null);

    // الصفحة الحالية
    const [currentPage, setCurrentPage] = useState(1);

    // loading أول مرة
    const [isLoading, setIsLoading] = useState(true);

    // loading للسحب للتحديث
    const [isRefreshing, setIsRefreshing] = useState(false);

    // loading لجلب المزيد
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    // loading لزر follow/unfollow
    const [isFollowLoading, setIsFollowLoading] = useState(false);

    // رسالة الخطأ
    const [errorMessage, setErrorMessage] = useState("");

    const channel = useMemo(
        () => ({
            slug: channelSlug,
            title: channelTitle || (isArabic ? "القناة" : "Channel"),
            image: channelImage,
            type: channelType,
            followersCount,
        }),
        [channelSlug, channelTitle, channelImage, channelType, followersCount, isArabic]
    );

    const actionColor = isFollowing ? colors.primary : colors.blue;

    /**
     * تجهيز post من الـ API لشكل واضح للواجهة
     * API يرجع: id, title, body, image, published_at
     */
    const normalizePost = useCallback((post) => {
        return {
            id: post?.id,
            title: post?.title || "",
            body: post?.body || "",
            image: post?.image || null,
            publishedAt: post?.published_at || null,
        };
    }, []);

    /**
     * تنسيق التاريخ بدون مكتبات إضافية
     */
    const formatPostDate = useCallback(
        (dateString) => {
            if (!dateString) {
                return "";
            }

            const date = new Date(dateString);

            if (Number.isNaN(date.getTime())) {
                return "";
            }

            return date.toLocaleString(isArabic ? "ar" : "en", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
            });
        },
        [isArabic]
    );

    /**
     * جلب posts القناة
     */
    const fetchPosts = useCallback(
        async ({
            page = 1,
            refresh = false,
            fullLoading = false,
            loadMore = false,
        } = {}) => {
            if (!channelSlug) {
                setIsLoading(false);
                setErrorMessage(
                    isArabic
                        ? "لا يمكن تحميل المنشورات لأن رابط القناة غير موجود."
                        : "Unable to load posts because channel slug is missing."
                );
                return;
            }

            try {
                if (fullLoading) {
                    setIsLoading(true);
                }

                if (refresh) {
                    setIsRefreshing(true);
                }

                if (loadMore) {
                    setIsLoadingMore(true);
                }

                setErrorMessage("");

                const result = await channelService.listChannelPosts(channelSlug, {
                    page,
                    perPage: POSTS_PER_PAGE,
                });

                const preparedPosts = Array.isArray(result.items)
                    ? result.items.map(normalizePost)
                    : [];

                setPosts((oldPosts) => {
                    if (page === 1) {
                        return preparedPosts;
                    }

                    return [...oldPosts, ...preparedPosts];
                });

                setPostsMeta(result.meta);
                setCurrentPage(page);
            } catch (error) {
                console.log("List channel posts error:", error);

                setErrorMessage(
                    error?.userMessage ||
                    (isArabic
                        ? "صار خطأ أثناء تحميل منشورات القناة. حاولي مرة ثانية."
                        : "Something went wrong while loading channel posts.")
                );
            } finally {
                setIsLoading(false);
                setIsRefreshing(false);
                setIsLoadingMore(false);
            }
        },
        [channelSlug, isArabic, normalizePost]
    );

    /**
     * أول ما تفتح الشاشة، حمّلي posts القناة
     */
    useEffect(() => {
        fetchPosts({ page: 1, fullLoading: true });
    }, [fetchPosts]);

    /**
     * هل في صفحات إضافية؟
     */
    const canLoadMore = useMemo(() => {
        if (!postsMeta) {
            return false;
        }

        return Number(postsMeta.current_page || 1) < Number(postsMeta.last_page || 1);
    }, [postsMeta]);

    const handleLoadMore = () => {
        if (isLoadingMore || isLoading || !canLoadMore) {
            return;
        }

        fetchPosts({
            page: currentPage + 1,
            loadMore: true,
        });
    };

    /**
     * متابعة / إلغاء متابعة القناة من داخل شاشة posts
     */
    const toggleFollow = async () => {
        if (!channelSlug || isFollowLoading) {
            return;
        }

        const oldIsFollowing = isFollowing;
        const oldFollowersCount = followersCount;

        const nextIsFollowing = !oldIsFollowing;
        const followersChange = nextIsFollowing ? 1 : -1;
        const nextFollowersCount = Math.max(
            0,
            Number(oldFollowersCount || 0) + followersChange
        );

        try {
            setIsFollowLoading(true);

            /**
             * 1. تحديث صفحة الشات فوراً
             */
            setIsFollowing(nextIsFollowing);
            setFollowersCount(nextFollowersCount);

            /**
             * 2. تحديث صفحة Channels فوراً حتى لو الداتا مكيشة هناك
             */
            channelEvents.emitFollowChanged({
                slug: channelSlug,
                isFollowing: nextIsFollowing,
                followersCount: nextFollowersCount,
            });

            /**
             * 3. إرسال الطلب للـ API
             */
            if (oldIsFollowing) {
                await channelService.unfollowChannel(channelSlug);
            } else {
                await channelService.followChannel(channelSlug);
            }

            setMenuOpen(false);
        } catch (error) {
            console.log("Channel follow error:", error);

            /**
             * إذا فشل الطلب، نرجّع صفحة الشات للحالة القديمة
             */
            setIsFollowing(oldIsFollowing);
            setFollowersCount(oldFollowersCount);

            /**
             * ونرجّع صفحة Channels كمان للحالة القديمة
             */
            channelEvents.emitFollowChanged({
                slug: channelSlug,
                isFollowing: oldIsFollowing,
                followersCount: oldFollowersCount,
            });

            Alert.alert(
                isArabic ? "تنبيه" : "Notice",
                error?.userMessage ||
                (isArabic
                    ? "صار خطأ أثناء تحديث المتابعة."
                    : "Something went wrong while updating follow status.")
            );
        } finally {
            setIsFollowLoading(false);
        }
    };

    const toggleLanguage = async () => {
        const nextLanguage = isArabic ? "en" : "ar";

        setMenuOpen(false);

        await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
        await i18n.changeLanguage(nextLanguage);
    };

    const handleToggleTheme = () => {
        setMenuOpen(false);
        toggleTheme();
    };

    const renderContent = () => {
        if (isLoading) {
            return (
                <View style={styles.centerBox}>
                    <ActivityIndicator size="large" color={colors.primary} />

                    <Text style={[styles.centerText, getTextDirectionStyle(isArabic)]}>
                        {isArabic
                            ? "جاري تحميل منشورات القناة..."
                            : "Loading channel posts..."}
                    </Text>
                </View>
            );
        }

        if (errorMessage && posts.length === 0) {
            return (
                <View style={styles.errorBox}>
                    <Feather
                        name="alert-circle"
                        size={34}
                        color={colors.danger || "#EF4444"}
                    />

                    <Text style={[styles.errorTitle, getTextDirectionStyle(isArabic)]}>
                        {isArabic ? "تعذر تحميل المنشورات" : "Unable to load posts"}
                    </Text>

                    <Text style={[styles.errorText, getTextDirectionStyle(isArabic)]}>
                        {errorMessage}
                    </Text>

                    <TouchableOpacity
                        activeOpacity={0.85}
                        style={styles.retryButton}
                        onPress={() => fetchPosts({ page: 1, fullLoading: true })}
                    >
                        <Text style={styles.retryButtonText}>
                            {isArabic ? "إعادة المحاولة" : "Try again"}
                        </Text>
                    </TouchableOpacity>
                </View>
            );
        }

        if (posts.length === 0) {
            return (
                <View style={styles.emptyBox}>
                    <Feather name="radio" size={32} color={colors.textMuted} />

                    <Text style={[styles.emptyTitle, getTextDirectionStyle(isArabic)]}>
                        {isArabic ? "لا توجد منشورات بعد" : "No posts yet"}
                    </Text>

                    <Text style={[styles.emptyText, getTextDirectionStyle(isArabic)]}>
                        {isArabic
                            ? "عند نشر تحديثات جديدة في هذه القناة ستظهر هنا."
                            : "New updates published in this channel will appear here."}
                    </Text>
                </View>
            );
        }

        return (
            <>
                {posts.map((post) => (
                    <ChannelPostCard
                        key={String(post.id)}
                        post={post}
                        channel={channel}
                        colors={colors}
                        styles={styles}
                        isArabic={isArabic}
                        formattedDate={formatPostDate(post.publishedAt)}
                    />
                ))}

                {canLoadMore && (
                    <TouchableOpacity
                        activeOpacity={0.85}
                        style={styles.loadMoreButton}
                        onPress={handleLoadMore}
                        disabled={isLoadingMore}
                    >
                        {isLoadingMore ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                            <Text style={styles.loadMoreText}>
                                {isArabic ? "تحميل المزيد" : "Load more"}
                            </Text>
                        )}
                    </TouchableOpacity>
                )}
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

            {menuOpen && (
                <TouchableOpacity
                    activeOpacity={1}
                    style={styles.menuBackdrop}
                    onPress={() => setMenuOpen(false)}
                />
            )}

            <ChannelChatHeader
                channel={channel}
                colors={colors}
                styles={styles}
                isArabic={isArabic}
                isDark={isDark}
                isFollowing={isFollowing}
                actionColor={actionColor}
                isFollowLoading={isFollowLoading}
                onBack={() => navigation.goBack()}
                onToggleFollow={toggleFollow}
                onToggleMenu={() => setMenuOpen((current) => !current)}
                menuOpen={menuOpen}
                onToggleLanguage={toggleLanguage}
                onToggleTheme={handleToggleTheme}
                onOpenSettings={() => {
                    setMenuOpen(false);
                    navigation.navigate("Settings");
                }}
                onOpenProfile={() => {
                    setMenuOpen(false);
                    navigation.navigate("Profile");
                }}
                t={t}
            />

            <ChatPatternBackground topOffset={Platform.OS === "android" ? 113 : 127} />

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefreshing}
                        onRefresh={() => fetchPosts({ page: 1, refresh: true })}
                        tintColor={colors.primary}
                        colors={[colors.primary]}
                    />
                }
            >
                <View style={styles.todayWrapper}>
                    <Text style={styles.todayText}>
                        {isArabic ? "منشورات القناة" : "Channel Posts"}
                    </Text>
                </View>

                {renderContent()}
            </ScrollView>

            <View style={styles.fixedReadOnlyWrapper}>
                <View style={[styles.readOnlyBox, getRowDirectionStyle(isArabic)]}>
                    <Feather name="shield" size={18} color={colors.textMuted} />

                    <Text
                        style={[
                            styles.readOnlyText,
                            getTextDirectionStyle(isArabic),
                        ]}
                    >
                        {t("channelChat.readOnly")}
                    </Text>
                </View>
            </View>
        </View>
    );
}

function ChannelChatHeader({
    channel,
    colors,
    styles,
    isArabic,
    isDark,
    isFollowing,
    actionColor,
    isFollowLoading,
    onBack,
    onToggleFollow,
    onToggleMenu,
    menuOpen,
    onToggleLanguage,
    onToggleTheme,
    onOpenSettings,
    onOpenProfile,
    t,
}) {
    const followersText = isArabic
        ? `${channel.followersCount} متابع`
        : `${channel.followersCount} followers`;

    return (
        <View style={styles.headerWrapper}>
            <View style={styles.headerRow}>
                <TouchableOpacity
                    activeOpacity={0.82}
                    style={styles.backButton}
                    onPress={onBack}
                >
                    <Feather
                        name="arrow-left"
                        size={22}
                        color={colors.textPrimary}
                    />
                </TouchableOpacity>

                <View style={styles.avatarBox}>
                    <ChannelImage
                        image={channel.image}
                        type={channel.type}
                        styles={styles}
                        actionColor={actionColor}
                    />
                </View>

                <View style={styles.headerTextBox}>
                    <Text
                        numberOfLines={1}
                        style={[
                            styles.headerTitle,
                            getTextDirectionStyle(isArabic),
                        ]}
                    >
                        {channel.title}
                    </Text>

                    <Text
                        numberOfLines={1}
                        style={[
                            styles.headerFollowers,
                            getTextDirectionStyle(isArabic),
                        ]}
                    >
                        {followersText}
                    </Text>
                </View>

                <TouchableOpacity
                    activeOpacity={0.85}
                    style={[
                        styles.headerFollowButton,
                        {
                            borderColor: actionColor,
                            opacity: isFollowLoading ? 0.65 : 1,
                        },
                    ]}
                    onPress={onToggleFollow}
                    disabled={isFollowLoading}
                >
                    {isFollowLoading ? (
                        <ActivityIndicator size="small" color={actionColor} />
                    ) : (
                        <Text
                            style={[
                                styles.headerFollowText,
                                {
                                    color: actionColor,
                                },
                            ]}
                        >
                            {isFollowing
                                ? t("channels.followingButton")
                                : t("channels.followButton")}
                        </Text>
                    )}
                </TouchableOpacity>

                <View style={styles.menuWrapper}>
                    <TouchableOpacity
                        activeOpacity={0.82}
                        style={styles.dotsButton}
                        onPress={onToggleMenu}
                    >
                        <Feather
                            name="more-vertical"
                            size={22}
                            color={colors.textSecondary}
                        />
                    </TouchableOpacity>

                    {menuOpen && (
                        <View
                            style={[
                                styles.menuDropdown,
                                isArabic
                                    ? styles.menuDropdownArabic
                                    : styles.menuDropdownEnglish,
                            ]}
                        >
                            <MenuItem
                                icon={isFollowing ? "bell-off" : "bell"}
                                label={
                                    isFollowing
                                        ? t("channelChat.menuUnfollow")
                                        : t("channelChat.menuFollow")
                                }
                                colors={colors}
                                styles={styles}
                                isArabic={isArabic}
                                onPress={onToggleFollow}
                            />

                            <MenuItem
                                icon="globe"
                                label={t("home.menuLanguage")}
                                colors={colors}
                                styles={styles}
                                isArabic={isArabic}
                                onPress={onToggleLanguage}
                            />


                            <MenuItem
                                icon={isDark ? "sun" : "moon"}
                                label={
                                    isDark
                                        ? isArabic
                                            ? "الوضع الفاتح"
                                            : "Light Mode"
                                        : isArabic
                                            ? "الوضع الداكن"
                                            : "Dark Mode"
                                }
                                colors={colors}
                                styles={styles}
                                isArabic={isArabic}
                                onPress={onToggleTheme}
                            />

                            <MenuItem
                                icon="settings"
                                label={t("home.menuSettings")}
                                colors={colors}
                                styles={styles}
                                isArabic={isArabic}
                                onPress={onOpenSettings}
                            />

                            <MenuItem
                                icon="user"
                                label={t("bottomTabs.profile")}
                                colors={colors}
                                styles={styles}
                                isArabic={isArabic}
                                onPress={onOpenProfile}
                            />
                        </View>
                    )}
                </View>
            </View>
        </View>
    );
}

function ChannelImage({ image, type, styles, actionColor }) {
    const imageSource = image ? { uri: image } : appImages.homeContainers;

    return (
        <View style={styles.channelImageWrapper}>
            <Image source={imageSource} style={styles.avatarImage} resizeMode="cover" />

            {!image && (
                <View style={styles.defaultImageOverlay}>
                    {type === 2 ? (
                        <Feather name="activity" size={22} color="#FFFFFF" />
                    ) : (
                        <MaterialIcons name="campaign" size={24} color="#FFFFFF" />
                    )}
                </View>
            )}
        </View>
    );
}

function MenuItem({ icon, label, colors, styles, isArabic, onPress }) {
    return (
        <TouchableOpacity
            activeOpacity={0.82}
            style={[
                styles.menuItem,
                isArabic ? styles.menuItemArabic : styles.menuItemEnglish,
            ]}
            onPress={onPress}
        >
            <Feather name={icon} size={17} color={colors.textSecondary} />

            <Text
                style={[
                    styles.menuText,
                    isArabic ? styles.menuTextArabic : styles.menuTextEnglish,
                ]}
                numberOfLines={1}
            >
                {label}
            </Text>
        </TouchableOpacity>
    );
}
function ChannelPostCard({
    post,
    channel,
    colors,
    styles,
    isArabic,
    formattedDate,
}) {
    return (
        <View style={styles.postWrapper}>
            <View style={styles.messageCard}>
                <View style={[styles.messageTitleRow, getRowDirectionStyle(isArabic)]}>
                    <View style={styles.messageIcon}>
                        {channel.type === 2 ? (
                            <Feather name="activity" size={17} color={colors.blue} />
                        ) : (
                            <MaterialIcons
                                name="campaign"
                                size={18}
                                color={colors.blue}
                            />
                        )}
                    </View>

                    <Text
                        numberOfLines={1}
                        style={[
                            styles.messageChannelTitle,
                            getAutoTextDirectionStyle(channel.title, isArabic),
                        ]}
                    >
                        {channel.title}
                    </Text>
                </View>

                {!!post.title && (
                    <Text
                        style={[
                            styles.postTitle,
                            getAutoTextDirectionStyle(post.title, isArabic),
                        ]}
                    >
                        {post.title}
                    </Text>
                )}

                {!!post.image && (
                    <Image
                        source={{ uri: post.image }}
                        style={styles.postImage}
                        resizeMode="cover"
                    />
                )}

                {!!post.body && (
                    <Text
                        style={[
                            styles.messageText,
                            getAutoTextDirectionStyle(post.body, isArabic),
                        ]}
                    >
                        {post.body}
                    </Text>
                )}

                {!!formattedDate && (
                    <Text style={[styles.messageTime, getAutoTextDirectionStyle(formattedDate, isArabic)]}>{formattedDate}</Text>
                )}
            </View>
        </View>
    );
}

const createStyles = (colors, isSmallScreen, isDark) =>
    StyleSheet.create({
        root: {
            flex: 1,
            backgroundColor: isSmallScreen ? colors.background : colors.background,
            position: "relative",
            overflow: "hidden",
        },

        headerWrapper: {
            paddingTop: Platform.OS === "android" ? 42 : 56,
            paddingHorizontal: isSmallScreen ? 14 : 18,
            paddingBottom: 12,
            backgroundColor: colors.navScrolled,
            borderBottomWidth: 1,
            borderBottomColor: colors.borderSoft,
            zIndex: 50,
            elevation: 50,
        },

        headerRow: {
            height: 58,
            flexDirection: "row",
            alignItems: "center",
            gap: isSmallScreen ? 8 : 10,
        },

        backButton: {
            width: 42,
            height: 42,
            borderRadius: 14,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.cardSoft,
            borderWidth: 1,
            borderColor: colors.border,
        },

        avatarBox: {
            width: 44,
            height: 44,
            borderRadius: 14,
            overflow: "hidden",
            backgroundColor: colors.cardSoft,
            borderWidth: 1,
            borderColor: colors.borderSoft,
        },

        channelImageWrapper: {
            flex: 1,
            position: "relative",
        },

        avatarImage: {
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
            backgroundColor: "rgba(0, 0, 0, 0.28)",
        },

        headerTextBox: {
            flex: 1,
            justifyContent: "center",
        },

        headerTitle: {
            color: colors.textPrimary,
            fontSize: isSmallScreen ? 14.5 : 16,
            fontWeight: "900",
            marginBottom: 3,
        },

        headerFollowers: {
            color: colors.textSecondary,
            fontSize: isSmallScreen ? 12 : 13,
            fontWeight: "700",
        },

        headerFollowButton: {
            height: 40,
            minWidth: isSmallScreen ? 82 : 92,
            borderRadius: 12,
            borderWidth: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: isSmallScreen ? 10 : 12,
            backgroundColor: "transparent",
        },

        headerFollowText: {
            fontSize: isSmallScreen ? 12 : 13,
            fontWeight: "900",
        },

        menuWrapper: {
            position: "relative",
        },

        dotsButton: {
            width: 34,
            height: 42,
            alignItems: "center",
            justifyContent: "center",
        },

        menuBackdrop: {
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            zIndex: 40,
            elevation: 40,
        },

        menuDropdown: {
            position: "absolute",
            top: 44,
            width: 190,
            borderRadius: 18,
            paddingVertical: 8,
            backgroundColor: colors.cardStrong,
            borderWidth: 1,
            borderColor: colors.borderSoft,
            zIndex: 70,
            elevation: 70,
        },

        menuDropdownEnglish: {
            right: 0,
        },

        menuDropdownArabic: {
            right: 0,
        },

        menuItem: {
            alignItems: "center",
            paddingHorizontal: 14,
            paddingVertical: 12,
        },

        menuItemArabic: {
            flexDirection: "row-reverse",
            justifyContent: "flex-start",
            gap: 10,
        },

        menuItemEnglish: {
            flexDirection: "row",
            justifyContent: "flex-start",
            gap: 10,
        },

        menuText: {
            color: colors.textPrimary,
            fontSize: 14,
            fontWeight: "800",
            flexShrink: 1,
        },

        menuTextArabic: {
            textAlign: "right",
            writingDirection: "rtl",
        },

        menuTextEnglish: {
            textAlign: "left",
            writingDirection: "ltr",
        },

        scrollContent: {
            flexGrow: 1,
            paddingHorizontal: isSmallScreen ? 16 : 22,
            paddingTop: 12,
            paddingBottom: Platform.OS === "android" ? 128 : 146,
        },

        todayWrapper: {
            alignSelf: "center",
            minWidth: 78,
            height: 32,
            borderRadius: 18,
            paddingHorizontal: 16,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.cardSoft,
            borderWidth: 1,
            borderColor: colors.borderSoft,
            marginBottom: 16,
        },

        todayText: {
            color: colors.textSecondary,
            fontSize: 13,
            fontWeight: "900",
        },

        postWrapper: {
            marginBottom: 14,
        },

        messageCard: {
            borderRadius: 22,
            padding: isSmallScreen ? 16 : 18,
            borderWidth: 1,
            borderColor: isDark ? colors.border : colors.blueBorder,
            backgroundColor: isDark ? colors.cardStrong : colors.blueSoft,
            overflow: "hidden",
        },

        messageIcon: {
            width: 22,
            height: 22,
            alignItems: "center",
            justifyContent: "center",
        },

        messageTitleRow: {
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            marginBottom: 18,
        },


        messageChannelTitle: {
            flex: 1,
            color: colors.blue,
            fontSize: 16,
            fontWeight: "900",
        },

        postTitle: {
            color: colors.textPrimary,
            fontSize: isSmallScreen ? 17 : 18,
            lineHeight: isSmallScreen ? 24 : 26,
            fontWeight: "700",
            marginBottom: 10,

        },

        messageText: {
            color: colors.textSecondary,
            fontSize: isSmallScreen ? 15 : 16,
            lineHeight: isSmallScreen ? 23 : 25,
            fontWeight: "650",
        },

        messageTime: {
            alignSelf: "flex-end",
            color: colors.textMuted,
            fontSize: 13,
            fontWeight: "700",
            marginTop: 8,
        },

        fixedReadOnlyWrapper: {
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            paddingHorizontal: isSmallScreen ? 14 : 20,
            paddingTop: 10,
            paddingBottom: Platform.OS === "android" ? 18 : 30,
            backgroundColor: colors.background,
            borderTopWidth: 1,
            borderTopColor: colors.borderSoft,
            zIndex: 30,
            elevation: 30,
        },

        readOnlyBox: {
            minHeight: isSmallScreen ? 54 : 58,
            borderRadius: 18,
            paddingHorizontal: isSmallScreen ? 12 : 16,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.borderSoft,
        },

        readOnlyText: {
            flexShrink: 1,
            color: colors.textMuted,
            fontSize: isSmallScreen ? 12.5 : 14,
            lineHeight: isSmallScreen ? 18 : 20,
            fontWeight: "800",
            textAlign: "center",
        },

        centerBox: {
            marginTop: 44,
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
            color: "#FFFFFF",
            fontSize: 14,
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

        loadMoreButton: {
            alignSelf: "center",
            minHeight: 44,
            minWidth: 140,
            borderRadius: 14,
            paddingHorizontal: 18,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.primary,
            marginTop: 4,
            marginBottom: 16,
        },

        loadMoreText: {
            color: "#FFFFFF",
            fontSize: 14,
            fontWeight: "900",
        },
    });
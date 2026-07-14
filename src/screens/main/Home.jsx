import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    ActivityIndicator,
    Alert,
    Image,
    Linking,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
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
import MainNavBar from "@/src/components/MainNavBar";
import apiClient from "@/src/services/api/apiClient";
import homeService from "@/src/services/api/homeService";

const SERVICE_ACTIONS = {
    NONE: 1,
    OPEN_CHAT: 2,
    OPEN_CHANNEL: 3,
    EXTERNAL_LINK: 4,
    PHONE_CALL: 5,
    SCREEN: 6,
};

const CONTACT_TYPES = {
    PHONE: 1,
    WHATSAPP: 2,
    EMAIL: 3,
    ADDRESS: 4,
    FACEBOOK: 5,
    INSTAGRAM: 6,
    WEBSITE: 7,
};

const SERVICE_FALLBACKS = [
    {
        image: appImages.homeShipSea,
        icon: "anchor",
    },
    {
        image: appImages.homeAirTruck,
        icon: "truck",
    },
    {
        image: appImages.homeContainers,
        icon: "send",
    },
];

const HERO_FALLBACKS = [
    appImages.homeShipSea,
    appImages.homeShipSunset,
    appImages.homeAirTruck,
    appImages.homeContainers,
    appImages.homeCargoMini,
];

const CURRENCY_SYMBOLS = {
    USD: "$",
    EUR: "€",
    GBP: "£",
    JPY: "¥",
    CNY: "¥",
    SAR: "ر.س",
    AED: "د.إ",
};

export default function Home({ navigation }) {
    const { t, i18n } = useTranslation();

    const isArabic = i18n.language === "ar";

    const [showNavTitle, setShowNavTitle] = useState(false);
    const [homeData, setHomeData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");

    const mainScrollRef = useRef(null);
    const heroScrollRef = useRef(null);
    const branchScrollRef = useRef(null);
    const hasLoadedHomeRef = useRef(false);

    const { colors, isDark } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const companyInfo = homeData?.companyInfo || null;
    const channels = homeData?.channels || [];
    const contacts = homeData?.contacts || [];

    const heroSlides = useMemo(() => {
        const apiBanners = homeData?.banners || [];

        if (apiBanners.length === 0) {
            return HERO_FALLBACKS.map((image, index) => ({
                key: `fallback-hero-${index}`,
                title: t("home.heroTitle"),
                subtitle: t("home.heroText"),
                image,
                actionType: SERVICE_ACTIONS.NONE,
                actionValue: null,
            }));
        }

        return apiBanners.map((banner, index) => ({
            key: String(banner.id ?? index),
            title: banner.title || "",
            subtitle: banner.subtitle || "",
            image: banner.image
                ? { uri: banner.image }
                : HERO_FALLBACKS[index % HERO_FALLBACKS.length],
            actionType: Number(banner.action_type || SERVICE_ACTIONS.NONE),
            actionValue: banner.action_value ?? null,
        }));
    }, [homeData?.banners, t]);

    const services = useMemo(() => {
        const apiServices = homeData?.services || [];

        if (apiServices.length === 0) {
            return [
                {
                    key: "sea",
                    title: t("home.services.sea"),
                    description: "",
                    icon: "anchor",
                    image: appImages.homeShipSea,
                    actionType: SERVICE_ACTIONS.NONE,
                    actionValue: null,
                },
                {
                    key: "land",
                    title: t("home.services.land"),
                    description: "",
                    icon: "truck",
                    image: appImages.homeAirTruck,
                    actionType: SERVICE_ACTIONS.NONE,
                    actionValue: null,
                },
                {
                    key: "air",
                    title: t("home.services.air"),
                    description: "",
                    icon: "send",
                    image: appImages.homeContainers,
                    actionType: SERVICE_ACTIONS.NONE,
                    actionValue: null,
                },
            ];
        }

        return apiServices.slice(0, 3).map((service, index) => {
            const fallback = SERVICE_FALLBACKS[index % SERVICE_FALLBACKS.length];

            return {
                key: String(service.id ?? index),
                title: service.title || "",
                description: service.description || "",
                icon: fallback.icon,
                image: service.icon ? { uri: service.icon } : fallback.image,
                actionType: Number(service.action_type || SERVICE_ACTIONS.NONE),
                actionValue: service.action_value ?? null,
            };
        });
    }, [homeData?.services, t]);

    const branches = useMemo(() => {
        const apiBranches = homeData?.branches || [];

        if (apiBranches.length === 0) {
            return [
                {
                    key: "lebanon",
                    country: t("home.branches.lebanon"),
                    phone: "+961 81 271 762",
                    email: "info@makoverseas.ae",
                    address: t("home.branches.lebanonAddress"),
                    workingHours: "",
                },
                {
                    key: "uae",
                    country: t("home.branches.uae"),
                    phone: "+971 54 440 4978",
                    email: "info@makoverseas.ae",
                    address: t("home.branches.uaeAddress"),
                    workingHours: "",
                },
                {
                    key: "albania",
                    country: t("home.branches.albania"),
                    phone: "+355 69 298 1126",
                    email: "info@makoverseas.ae",
                    address: t("home.branches.albaniaAddress"),
                    workingHours: "",
                },
            ];
        }

        return apiBranches.map((branch, index) => ({
            key: String(branch.id ?? index),
            country:
                branch.name || [branch.city, branch.country].filter(Boolean).join(", "),
            phone: branch.phone || "",
            email: branch.email || "",
            address:
                branch.address ||
                [branch.city, branch.country].filter(Boolean).join(", "),
            workingHours: branch.working_hours || "",
        }));
    }, [homeData?.branches, t]);

    const exchangeRates = useMemo(() => {
        const apiExchangeRates = homeData?.exchangeRates || [];

        if (apiExchangeRates.length === 0) {
            return [
                {
                    key: "usd",
                    pair: "USD → SAR",
                    value: "3.7500",
                    change: "+0.35%",
                    isUp: true,
                    currencySymbol: "$",
                },
                {
                    key: "eur",
                    pair: "EUR → SAR",
                    value: "4.0500",
                    change: "-0.20%",
                    isUp: false,
                    currencySymbol: "€",
                },
            ];
        }

        return apiExchangeRates.slice(0, 2).map((rate, index) => {
            const base = rate.payload?.base || "";
            const quote = rate.payload?.quote || "";
            const numericChange = Number(
                rate.payload?.change_percent ?? rate.payload?.change,
            );
            const hasChange = Number.isFinite(numericChange);

            return {
                key: String(rate.id ?? index),
                pair: base && quote ? `${base} → ${quote}` : rate.title || "",
                value: String(rate.payload?.rate ?? rate.body ?? ""),
                change: hasChange
                    ? `${numericChange > 0 ? "+" : ""}${numericChange}%`
                    : "",
                isUp: hasChange ? numericChange >= 0 : true,
                currencySymbol: CURRENCY_SYMBOLS[base] || base?.slice(0, 1) || "¤",
                publishedAt: rate.published_at || null,
            };
        });
    }, [homeData?.exchangeRates]);

    const loadHome = useCallback(
        async ({ refreshing = false } = {}) => {
            try {
                setErrorMessage("");

                if (refreshing) {
                    setIsRefreshing(true);
                } else if (!hasLoadedHomeRef.current) {
                    setIsLoading(true);
                }

                const nextHomeData = await homeService.getHome();
                setHomeData(nextHomeData);
                hasLoadedHomeRef.current = true;
            } catch (error) {
                console.log("Load home error:", error?.raw || error);
                setErrorMessage(
                    error?.userMessage ||
                    (isArabic
                        ? "تعذّر تحميل الصفحة الرئيسية. حاولي مرة ثانية."
                        : "Unable to load the home page. Please try again."),
                );
            } finally {
                setIsLoading(false);
                setIsRefreshing(false);
            }
        },
        [isArabic],
    );

    useFocusEffect(
        useCallback(() => {
            loadHome();
        }, [loadHome]),
    );

    const openExternalUrl = useCallback(
        async (url) => {
            if (!url) return;

            try {
                const normalizedUrl = /^[a-z][a-z\d+.-]*:/i.test(url)
                    ? url
                    : `https://${url}`;
                const canOpen = await Linking.canOpenURL(normalizedUrl);

                if (!canOpen) {
                    throw new Error(`Unsupported URL: ${normalizedUrl}`);
                }

                await Linking.openURL(normalizedUrl);
            } catch (error) {
                console.log("Open home action error:", error);
                Alert.alert(
                    isArabic ? "تنبيه" : "Notice",
                    isArabic ? "تعذّر فتح هذا الرابط." : "Unable to open this link.",
                );
            }
        },
        [isArabic],
    );

    const handleContentAction = useCallback(
        ({ actionType, actionValue } = {}) => {
            const normalizedActionType = Number(actionType || SERVICE_ACTIONS.NONE);
            const value =
                actionValue === undefined || actionValue === null
                    ? ""
                    : String(actionValue).trim();

            if (normalizedActionType === SERVICE_ACTIONS.OPEN_CHAT) {
                navigation.navigate("Chat");
                return;
            }

            if (normalizedActionType === SERVICE_ACTIONS.OPEN_CHANNEL) {
                const targetChannel = channels.find(
                    (channel) => String(channel.id) === value || channel.slug === value,
                );

                navigation.navigate("Channels", {
                    channelId:
                        targetChannel?.id ?? (/^\d+$/.test(value) ? Number(value) : null),
                    channel_id:
                        targetChannel?.id ?? (/^\d+$/.test(value) ? Number(value) : null),
                    channelSlug:
                        targetChannel?.slug || (!/^\d+$/.test(value) ? value : null),
                });
                return;
            }

            if (normalizedActionType === SERVICE_ACTIONS.EXTERNAL_LINK) {
                openExternalUrl(value);
                return;
            }

            if (normalizedActionType === SERVICE_ACTIONS.PHONE_CALL) {
                const phoneUrl = value.startsWith("tel:") ? value : `tel:${value}`;
                openExternalUrl(phoneUrl);
                return;
            }

            if (normalizedActionType === SERVICE_ACTIONS.SCREEN) {
                const screenMap = {
                    home: "Home",
                    chat: "Chat",
                    chats: "Chat",
                    channels: "Channels",
                    search: "Search",
                    profile: "Profile",
                    calls: "Calls",
                    notifications: "Notifications",
                };
                const screenName = screenMap[value.toLowerCase()];

                if (screenName) {
                    navigation.navigate(screenName);
                }
            }
        },
        [channels, navigation, openExternalUrl],
    );

    const preferredContact = useMemo(() => {
        return (
            contacts.find(
                (contact) => Number(contact.type) === CONTACT_TYPES.WHATSAPP,
            ) ||
            contacts.find(
                (contact) => Number(contact.type) === CONTACT_TYPES.PHONE,
            ) ||
            contacts.find(
                (contact) => Number(contact.type) === CONTACT_TYPES.EMAIL,
            ) ||
            contacts.find(
                (contact) => Number(contact.type) === CONTACT_TYPES.WEBSITE,
            ) ||
            null
        );
    }, [contacts]);

    const handleContactPress = useCallback(() => {
        if (!preferredContact?.value) {
            navigation.navigate("Chat");
            return;
        }

        const contactType = Number(preferredContact.type);
        const value = String(preferredContact.value).trim();

        if (contactType === CONTACT_TYPES.WHATSAPP) {
            const phoneNumber = value.replace(/[^\d]/g, "");
            openExternalUrl(`https://wa.me/${phoneNumber}`);
            return;
        }

        if (contactType === CONTACT_TYPES.PHONE) {
            openExternalUrl(`tel:${value}`);
            return;
        }

        if (contactType === CONTACT_TYPES.EMAIL) {
            openExternalUrl(`mailto:${value}`);
            return;
        }

        openExternalUrl(value);
    }, [navigation, openExternalUrl, preferredContact]);

    const exchangeChannel = useMemo(() => {
        return (
            channels.find((channel) =>
                String(channel.slug || "")
                    .toLowerCase()
                    .includes("exchange"),
            ) ||
            channels.find((channel) => Number(channel.type) === 2) ||
            null
        );
    }, [channels]);

    const resetMainScrollPosition = () => {
        mainScrollRef.current?.scrollTo({
            y: 0,
            animated: false,
        });
    };

    const resetHorizontalScrollPosition = (
        scrollRef,
        language = i18n.language,
    ) => {
        const shouldStartFromRight = language === "ar";

        setTimeout(() => {
            if (shouldStartFromRight) {
                scrollRef.current?.scrollToEnd({
                    animated: false,
                });
                return;
            }

            scrollRef.current?.scrollTo({
                x: 0,
                animated: false,
            });
        }, 80);
    };

    const resetHeroScrollPosition = (language = i18n.language) => {
        resetHorizontalScrollPosition(heroScrollRef, language);
    };

    const resetBranchScrollPosition = (language = i18n.language) => {
        resetHorizontalScrollPosition(branchScrollRef, language);
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
        await apiClient.setLanguage(nextLanguage);
        await i18n.changeLanguage(nextLanguage);

        setTimeout(() => {
            resetMainScrollPosition();
            resetHeroScrollPosition(nextLanguage);
            resetBranchScrollPosition(nextLanguage);
        }, 80);
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
                title={t("home.navTitle")}
                showTitle={showNavTitle}
                onToggleLanguage={toggleLanguage}
                menuItems={[
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
                        onRefresh={() => loadHome({ refreshing: true })}
                        tintColor={colors.primary}
                        colors={[colors.primary]}
                    />
                }
            >
                <View style={styles.headerBox}>
                    <Text style={[styles.welcomeText, getTextDirectionStyle(isArabic)]}>
                        {t("home.welcomeText")}
                    </Text>

                    <Text style={[styles.title, getTextDirectionStyle(isArabic)]}>
                        {companyInfo?.name || t("home.title")}
                    </Text>

                    <Text style={[styles.subtitle, getTextDirectionStyle(isArabic)]}>
                        {companyInfo?.description || t("home.subtitle")}
                    </Text>
                </View>

                {!!errorMessage && (
                    <View style={styles.errorBox}>
                        <Feather
                            name="alert-circle"
                            size={24}
                            color={colors.danger || "#EF4444"}
                        />
                        <Text style={[styles.errorText, getTextDirectionStyle(isArabic)]}>
                            {errorMessage}
                        </Text>
                        <TouchableOpacity
                            activeOpacity={0.85}
                            style={styles.retryButton}
                            onPress={() => loadHome()}
                        >
                            <Text style={styles.retryButtonText}>
                                {isArabic ? "إعادة المحاولة" : "Try again"}
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}

                {isLoading && !homeData ? (
                    <View style={styles.loadingBox}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={styles.loadingText}>
                            {isArabic ? "جاري تحميل الصفحة الرئيسية..." : "Loading home..."}
                        </Text>
                    </View>
                ) : (
                    <>
                        {heroSlides.length > 0 && (
                            <ScrollView
                                ref={heroScrollRef}
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={[
                                    styles.heroScroll,
                                    getRowDirectionStyle(isArabic),
                                ]}
                                onContentSizeChange={() => {
                                    resetHeroScrollPosition();
                                }}
                            >
                                {heroSlides.map((slide) => (
                                    <TouchableOpacity
                                        key={slide.key}
                                        activeOpacity={0.9}
                                        style={styles.heroCard}
                                        disabled={slide.actionType === SERVICE_ACTIONS.NONE}
                                        onPress={() => handleContentAction(slide)}
                                    >
                                        <Image
                                            source={slide.image}
                                            style={styles.heroImage}
                                            resizeMode="cover"
                                        />

                                        <View style={styles.heroOverlay}>
                                            <Text
                                                style={[
                                                    styles.heroTitle,
                                                    getTextDirectionStyle(isArabic),
                                                ]}
                                            >
                                                {slide.title || t("home.heroTitle")}
                                            </Text>

                                            <Text
                                                style={[
                                                    styles.heroText,
                                                    getTextDirectionStyle(isArabic),
                                                ]}
                                            >
                                                {slide.subtitle || t("home.heroText")}
                                            </Text>
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        )}

                        {services.length > 0 && (
                            <>
                                <SectionHeader
                                    title={t("home.servicesTitle")}
                                    action={t("home.viewAll")}
                                    isArabic={isArabic}
                                    styles={styles}
                                />

                                <View style={styles.servicesGrid}>
                                    {services.map((service) => (
                                        <TouchableOpacity
                                            key={service.key}
                                            activeOpacity={0.88}
                                            style={styles.serviceCard}
                                            disabled={service.actionType === SERVICE_ACTIONS.NONE}
                                            onPress={() => handleContentAction(service)}
                                        >
                                            <Image
                                                source={service.image}
                                                style={styles.serviceImage}
                                                resizeMode="cover"
                                            />

                                            <View style={styles.serviceContent}>
                                                <View style={styles.serviceIconCircle}>
                                                    <Feather
                                                        name={service.icon}
                                                        size={22}
                                                        color={colors.primary}
                                                    />
                                                </View>

                                                <Text
                                                    style={[
                                                        styles.serviceTitle,
                                                        getTextDirectionStyle(isArabic),
                                                    ]}
                                                >
                                                    {service.title}
                                                </Text>
                                            </View>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </>
                        )}

                        <View style={[styles.infoCard, getRowDirectionStyle(isArabic)]}>
                            <View style={styles.infoIcon}>
                                <Feather name="globe" size={27} color={colors.primary} />
                            </View>

                            <View style={styles.infoTextBox}>
                                <Text
                                    style={[styles.cardTitle, getTextDirectionStyle(isArabic)]}
                                >
                                    {t("home.aboutTitle")}
                                </Text>

                                <Text
                                    style={[styles.cardText, getTextDirectionStyle(isArabic)]}
                                >
                                    {companyInfo?.about || t("home.aboutText")}
                                </Text>
                            </View>
                        </View>

                        {branches.length > 0 && (
                            <>
                                <SectionHeader
                                    title={t("home.branchesTitle")}
                                    isArabic={isArabic}
                                    styles={styles}
                                />

                                <ScrollView
                                    ref={branchScrollRef}
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={[
                                        styles.branchesScroll,
                                        getRowDirectionStyle(isArabic),
                                    ]}
                                    onContentSizeChange={() => {
                                        resetBranchScrollPosition();
                                    }}
                                >
                                    {branches.map((branch) => (
                                        <View key={branch.key} style={styles.branchCard}>
                                            <Text
                                                style={[
                                                    styles.branchCountry,
                                                    getTextDirectionStyle(isArabic),
                                                ]}
                                            >
                                                {branch.country}
                                            </Text>

                                            {!!branch.phone && (
                                                <InfoLine
                                                    icon="phone"
                                                    text={branch.phone}
                                                    colors={colors}
                                                    styles={styles}
                                                    isArabic={isArabic}
                                                />
                                            )}

                                            {!!branch.email && (
                                                <InfoLine
                                                    icon="mail"
                                                    text={branch.email}
                                                    colors={colors}
                                                    styles={styles}
                                                    isArabic={isArabic}
                                                />
                                            )}

                                            {!!branch.address && (
                                                <InfoLine
                                                    icon="map-pin"
                                                    text={branch.address}
                                                    colors={colors}
                                                    styles={styles}
                                                    isArabic={isArabic}
                                                />
                                            )}
                                        </View>
                                    ))}
                                </ScrollView>
                            </>
                        )}

                        {exchangeRates.length > 0 && (
                            <>
                                <SectionHeader
                                    title={t("home.exchangeTitle")}
                                    action={t("home.viewAll")}
                                    onActionPress={
                                        exchangeChannel
                                            ? () =>
                                                handleContentAction({
                                                    actionType: SERVICE_ACTIONS.OPEN_CHANNEL,
                                                    actionValue:
                                                        exchangeChannel.slug || exchangeChannel.id,
                                                })
                                            : null
                                    }
                                    isArabic={isArabic}
                                    styles={styles}
                                />

                                <View style={styles.exchangeGrid}>
                                    {exchangeRates.map((rate) => (
                                        <View key={rate.key} style={styles.exchangeCard}>
                                            <View
                                                style={[
                                                    styles.exchangeTop,
                                                    getRowDirectionStyle(isArabic),
                                                ]}
                                            >
                                                <Text style={styles.exchangePair}>{rate.pair}</Text>

                                                <View style={styles.currencyCircle}>
                                                    <Text style={styles.currencySymbol}>
                                                        {rate.currencySymbol}
                                                    </Text>
                                                </View>
                                            </View>

                                            <Text style={styles.exchangeValue}>{rate.value}</Text>

                                            <View
                                                style={[
                                                    styles.exchangeBottom,
                                                    getRowDirectionStyle(isArabic),
                                                ]}
                                            >
                                                <Text style={styles.updatedText}>
                                                    {t("home.updatedNow")}
                                                </Text>

                                                {!!rate.change && (
                                                    <Text
                                                        style={[
                                                            styles.changeText,
                                                            rate.isUp ? styles.upText : styles.downText,
                                                        ]}
                                                    >
                                                        {rate.change}
                                                    </Text>
                                                )}
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            </>
                        )}

                        <View style={[styles.contactCard, getRowDirectionStyle(isArabic)]}>
                            <View style={styles.contactIconCircle}>
                                <Feather name="headphones" size={28} color={colors.primary} />
                            </View>

                            <View style={styles.contactTextBox}>
                                <Text
                                    style={[styles.cardTitle, getTextDirectionStyle(isArabic)]}
                                >
                                    {t("home.contactTitle")}
                                </Text>

                                <Text
                                    style={[styles.cardText, getTextDirectionStyle(isArabic)]}
                                >
                                    {preferredContact
                                        ? `${preferredContact.label}: ${preferredContact.value}`
                                        : t("home.contactText")}
                                </Text>
                            </View>

                            <TouchableOpacity
                                activeOpacity={0.88}
                                style={[styles.chatButton, getRowDirectionStyle(isArabic)]}
                                onPress={handleContactPress}
                            >
                                <Feather
                                    name="message-circle"
                                    size={18}
                                    color={colors.background}
                                />
                                <Text style={styles.chatButtonText}>
                                    {t("home.chatButton")}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </>
                )}
            </ScrollView>
        </View>
    );
}

function SectionHeader({ title, action, onActionPress, isArabic, styles }) {
    return (
        <View style={[styles.sectionHeader, getRowDirectionStyle(isArabic)]}>
            <Text style={[styles.sectionTitle, getTextDirectionStyle(isArabic)]}>
                {title}
            </Text>

            {!!action &&
                (onActionPress ? (
                    <TouchableOpacity activeOpacity={0.8} onPress={onActionPress}>
                        <Text
                            style={[styles.sectionAction, getTextDirectionStyle(isArabic)]}
                        >
                            {action}
                        </Text>
                    </TouchableOpacity>
                ) : (
                    <Text style={[styles.sectionAction, getTextDirectionStyle(isArabic)]}>
                        {action}
                    </Text>
                ))}
        </View>
    );
}

function InfoLine({ icon, text, colors, styles, isArabic }) {
    return (
        <View style={[styles.infoLine, getRowDirectionStyle(isArabic)]}>
            <Feather name={icon} size={14} color={colors.textSecondary} />
            <Text style={[styles.infoLineText, getTextDirectionStyle(isArabic)]}>
                {text}
            </Text>
        </View>
    );
}

const createStyles = (colors) =>
    StyleSheet.create({
        root: {
            flex: 1,
            backgroundColor: colors.background,
        },
        navSpacer: {
            flex: 1,
        },

        navTitle: {
            flex: 1,
            color: colors.textPrimary,
            fontSize: 18,
            fontWeight: "900",
            textAlign: "center",
        },

        navWrapper: {
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            paddingHorizontal: 20,
            paddingTop: Platform.OS === "android" ? 46 : 58,
            paddingBottom: 10,
            zIndex: 100,
            elevation: 100,
        },

        navWrapperScrolled: {
            backgroundColor: colors.navScrolled,
            borderBottomWidth: 1,
            borderBottomColor: colors.borderSoft,
        },

        navBar: {
            width: "100%",
            height: 58,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
        },

        logoBox: {
            width: 90,
            height: 54,
            justifyContent: "center",
        },

        logo: {
            width: 90,
            height: 50,
        },

        navSpacer: {
            flex: 1,
        },

        notificationButton: {
            width: 46,
            height: 46,
            borderRadius: 18,
            backgroundColor: colors.cardSoft,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
        },

        notificationBadge: {
            position: "absolute",
            top: 5,
            right: 5,
            minWidth: 16,
            height: 16,
            borderRadius: 8,
            backgroundColor: colors.danger,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 3,
        },

        notificationBadgeText: {
            color: colors.background,
            fontSize: 9,
            fontWeight: "900",
        },

        menuWrapper: {
            position: "relative",
        },

        menuButton: {
            width: 46,
            height: 46,
            borderRadius: 18,
            backgroundColor: colors.cardSoft,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: "center",
            justifyContent: "center",
        },

        menuBackdrop: {
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 50,
            elevation: 50,
        },

        menuDropdown: {
            position: "absolute",
            top: 54,
            width: 165,
            borderRadius: 18,
            backgroundColor: colors.cardStrong,
            borderWidth: 1,
            borderColor: colors.borderSoft,
            paddingVertical: 8,
            zIndex: 200,
            elevation: 200,
        },

        menuDropdownEnglish: {
            right: 0,
        },

        menuDropdownArabic: {
            left: 0,
        },

        menuItem: {
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            paddingHorizontal: 14,
            paddingVertical: 12,
        },

        menuText: {
            flex: 1,
            color: colors.textPrimary,
            fontSize: 15,
            fontWeight: "700",
        },

        scrollContent: {
            flexGrow: 1,
            paddingHorizontal: 20,
            paddingTop: Platform.OS === "android" ? 130 : 145,
            paddingBottom: Platform.OS === "android" ? 120 : 130,
        },

        headerBox: {
            marginTop: 12,
            marginBottom: 18,
        },

        loadingBox: {
            minHeight: 220,
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
        },

        loadingText: {
            marginTop: 12,
            color: colors.textSecondary,
            fontSize: 15,
            fontWeight: "700",
            textAlign: "center",
        },

        errorBox: {
            borderRadius: 18,
            padding: 16,
            marginBottom: 18,
            alignItems: "center",
            backgroundColor: colors.cardStrong,
            borderWidth: 1,
            borderColor: colors.borderSoft,
        },

        errorText: {
            marginTop: 8,
            marginBottom: 12,
            color: colors.textSecondary,
            fontSize: 14,
            lineHeight: 21,
            fontWeight: "600",
            textAlign: "center",
        },

        retryButton: {
            minHeight: 40,
            borderRadius: 12,
            paddingHorizontal: 18,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.primary,
        },

        retryButtonText: {
            color: colors.background,
            fontSize: 14,
            fontWeight: "900",
        },

        welcomeText: {
            color: colors.textSecondary,
            fontSize: 17,
            fontWeight: "700",
            marginBottom: 6,
        },

        title: {
            color: colors.textPrimary,
            fontSize: 36,
            fontWeight: "900",
            marginBottom: 10,
        },

        subtitle: {
            color: colors.textSecondary,
            fontSize: 16,
            lineHeight: 25,
            fontWeight: "600",
        },

        heroScroll: {
            gap: 14,
            paddingBottom: 4,
        },

        heroCard: {
            width: 305,
            height: 190,
            borderRadius: 24,
            overflow: "hidden",
            backgroundColor: colors.cardStrong,
            borderWidth: 1,
            borderColor: colors.borderSoft,
        },

        heroImage: {
            width: "100%",
            height: "100%",
        },

        heroOverlay: {
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            padding: 16,
            backgroundColor: "rgba(0, 16, 45, 0.48)",
        },

        heroTitle: {
            color: "#FFFFFF",
            fontSize: 20,
            fontWeight: "900",
            marginBottom: 5,
        },

        heroText: {
            color: "rgba(255,255,255,0.88)",
            fontSize: 13,
            lineHeight: 19,
            fontWeight: "600",
        },

        sectionHeader: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 24,
            marginBottom: 12,
        },

        sectionTitle: {
            color: colors.textPrimary,
            fontSize: 21,
            fontWeight: "900",
        },

        sectionAction: {
            color: colors.primary,
            fontSize: 15,
            fontWeight: "800",
        },

        servicesGrid: {
            flexDirection: "row",
            gap: 12,
        },

        serviceCard: {
            flex: 1,
            height: 132,
            borderRadius: 18,
            overflow: "hidden",
            backgroundColor: colors.cardStrong,
            borderWidth: 1,
            borderColor: colors.borderSoft,
        },

        serviceImage: {
            width: "100%",
            height: "100%",
            opacity: 0.38,
        },

        serviceContent: {
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 8,
        },

        serviceIconCircle: {
            width: 42,
            height: 42,
            borderRadius: 21,
            backgroundColor: colors.cardSoft,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 10,
        },

        serviceTitle: {
            color: colors.textPrimary,
            fontSize: 14,
            fontWeight: "900",
            textAlign: "center",
        },

        infoCard: {
            marginTop: 18,
            borderRadius: 22,
            padding: 16,
            backgroundColor: colors.cardStrong,
            borderWidth: 1,
            borderColor: colors.borderSoft,
            flexDirection: "row",
            gap: 14,
        },

        infoIcon: {
            width: 58,
            height: 58,
            borderRadius: 29,
            backgroundColor: colors.cardSoft,
            alignItems: "center",
            justifyContent: "center",
        },

        infoTextBox: {
            flex: 1,
        },

        cardTitle: {
            color: colors.textPrimary,
            fontSize: 19,
            fontWeight: "900",
            marginBottom: 6,
        },

        cardText: {
            color: colors.textSecondary,
            fontSize: 14,
            lineHeight: 21,
            fontWeight: "600",
        },

        branchesScroll: {
            gap: 12,
        },

        branchCard: {
            width: 210,
            minHeight: 150,
            borderRadius: 18,
            padding: 14,
            backgroundColor: colors.cardStrong,
            borderWidth: 1,
            borderColor: colors.borderSoft,
        },

        branchCountry: {
            color: colors.textPrimary,
            fontSize: 16,
            fontWeight: "900",
            marginBottom: 10,
        },

        infoLine: {
            flexDirection: "row",
            alignItems: "flex-start",
            gap: 7,
            marginTop: 8,
        },

        infoLineText: {
            flex: 1,
            color: colors.textSecondary,
            fontSize: 12.5,
            lineHeight: 18,
            fontWeight: "600",
        },

        exchangeGrid: {
            flexDirection: "row",
            gap: 12,
        },

        exchangeCard: {
            flex: 1,
            borderRadius: 18,
            padding: 14,
            backgroundColor: colors.cardStrong,
            borderWidth: 1,
            borderColor: colors.borderSoft,
        },

        exchangeTop: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 6,
        },

        exchangePair: {
            color: colors.textPrimary,
            fontSize: 13,
            fontWeight: "800",
        },

        currencyCircle: {
            width: 42,
            height: 42,
            borderRadius: 21,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.cardSoft,
        },

        currencySymbol: {
            color: colors.primary,
            fontSize: 22,
            fontWeight: "900",
        },

        exchangeValue: {
            color: colors.textPrimary,
            fontSize: 22,
            fontWeight: "900",
            marginBottom: 6,
        },

        exchangeBottom: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
        },

        updatedText: {
            color: colors.textMuted,
            fontSize: 11,
            fontWeight: "600",
        },

        changeText: {
            fontSize: 12,
            fontWeight: "900",
        },

        upText: {
            color: colors.success,
        },

        downText: {
            color: colors.danger,
        },

        contactCard: {
            marginTop: 16,
            borderRadius: 22,
            padding: 14,
            backgroundColor: colors.cardStrong,
            borderWidth: 1,
            borderColor: colors.borderSoft,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
        },

        contactIconCircle: {
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: colors.cardSoft,
            alignItems: "center",
            justifyContent: "center",
        },

        contactTextBox: {
            flex: 1,
        },

        chatButton: {
            minHeight: 46,
            borderRadius: 15,
            paddingHorizontal: 15,
            backgroundColor: colors.primary,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 7,
        },

        chatButtonText: {
            color: colors.background,
            fontSize: 13,
            fontWeight: "900",
        },
    });
import { Feather, MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { StatusBar } from "expo-status-bar";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    Image,
    Platform,
    Pressable,
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

export default function Home({ navigation }) {
    const { t, i18n } = useTranslation();

    const isArabic = i18n.language === "ar";

    const [menuOpen, setMenuOpen] = useState(false);
    const [showNavTitle, setShowNavTitle] = useState(false);

    const mainScrollRef = useRef(null);
    const heroScrollRef = useRef(null);
    const branchScrollRef = useRef(null);

    const { colors, isDark, toggleTheme } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const heroSlides = [
        appImages.homeShipSea,
        appImages.homeShipSunset,
        appImages.homeAirTruck,
        appImages.homeContainers,
        appImages.homeCargoMini,
    ];

    const services = [
        {
            key: "sea",
            title: t("home.services.sea"),
            icon: "anchor",
            image: appImages.homeShipSea,
        },
        {
            key: "land",
            title: t("home.services.land"),
            icon: "truck",
            image: appImages.homeAirTruck,
        },
        {
            key: "air",
            title: t("home.services.air"),
            icon: "send",
            image: appImages.homeContainers,
        },
    ];

    const branches = [
        {
            key: "lebanon",
            country: t("home.branches.lebanon"),
            phone: "+961 81 271 762",
            email: "info@makoverseas.ae",
            address: t("home.branches.lebanonAddress"),
        },
        {
            key: "uae",
            country: t("home.branches.uae"),
            phone: "+971 54 440 4978",
            email: "info@makoverseas.ae",
            address: t("home.branches.uaeAddress"),
        },
        {
            key: "albania",
            country: t("home.branches.albania"),
            phone: "+355 69 298 1126",
            email: "info@makoverseas.ae",
            address: t("home.branches.albaniaAddress"),
        },
    ];

    const exchangeRates = [
        {
            key: "usd",
            pair: "USD → SAR",
            value: "3.7500",
            change: "+0.35%",
            isUp: true,
        },
        {
            key: "eur",
            pair: "EUR → SAR",
            value: "4.0500",
            change: "-0.20%",
            isUp: false,
        },
    ];

    const resetMainScrollPosition = () => {
        mainScrollRef.current?.scrollTo({
            y: 0,
            animated: false,
        });
    };

    const resetHorizontalScrollPosition = (scrollRef, language = i18n.language) => {
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

        setMenuOpen(false);
        setShowNavTitle(false);

        resetMainScrollPosition();

        await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
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
            >
                <View style={styles.headerBox}>
                    <Text style={[styles.welcomeText, getTextDirectionStyle(isArabic)]}>
                        {t("home.welcomeText")}
                    </Text>

                    <Text style={[styles.title, getTextDirectionStyle(isArabic)]}>
                        {t("home.title")}
                    </Text>

                    <Text style={[styles.subtitle, getTextDirectionStyle(isArabic)]}>
                        {t("home.subtitle")}
                    </Text>
                </View>

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
                    {heroSlides.map((image, index) => (
                        <View key={`hero-${index}`} style={styles.heroCard}>
                            <Image
                                source={image}
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
                                    {t("home.heroTitle")}
                                </Text>

                                <Text
                                    style={[
                                        styles.heroText,
                                        getTextDirectionStyle(isArabic),
                                    ]}
                                >
                                    {t("home.heroText")}
                                </Text>
                            </View>
                        </View>
                    ))}
                </ScrollView>

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

                <View style={[styles.infoCard, getRowDirectionStyle(isArabic)]}>
                    <View style={styles.infoIcon}>
                        <Feather name="globe" size={27} color={colors.primary} />
                    </View>

                    <View style={styles.infoTextBox}>
                        <Text style={[styles.cardTitle, getTextDirectionStyle(isArabic)]}>
                            {t("home.aboutTitle")}
                        </Text>

                        <Text style={[styles.cardText, getTextDirectionStyle(isArabic)]}>
                            {t("home.aboutText")}
                        </Text>
                    </View>
                </View>

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

                            <InfoLine
                                icon="phone"
                                text={branch.phone}
                                colors={colors}
                                styles={styles}
                                isArabic={isArabic}
                            />

                            <InfoLine
                                icon="mail"
                                text={branch.email}
                                colors={colors}
                                styles={styles}
                                isArabic={isArabic}
                            />

                            <InfoLine
                                icon="map-pin"
                                text={branch.address}
                                colors={colors}
                                styles={styles}
                                isArabic={isArabic}
                            />
                        </View>
                    ))}
                </ScrollView>

                <SectionHeader
                    title={t("home.exchangeTitle")}
                    action={t("home.viewAll")}
                    isArabic={isArabic}
                    styles={styles}
                />

                <View style={styles.exchangeGrid}>
                    {exchangeRates.map((rate) => (
                        <View key={rate.key} style={styles.exchangeCard}>
                            <View style={[styles.exchangeTop, getRowDirectionStyle(isArabic)]}>
                                <Text style={styles.exchangePair}>{rate.pair}</Text>

                                <View style={styles.currencyCircle}>
                                    <Text style={styles.currencySymbol}>
                                        {rate.key === "usd" ? "$" : "€"}
                                    </Text>
                                </View>
                            </View>

                            <Text style={styles.exchangeValue}>{rate.value}</Text>

                            <View style={[styles.exchangeBottom, getRowDirectionStyle(isArabic)]}>
                                <Text style={styles.updatedText}>
                                    {t("home.updatedNow")}
                                </Text>

                                <Text
                                    style={[
                                        styles.changeText,
                                        rate.isUp ? styles.upText : styles.downText,
                                    ]}
                                >
                                    {rate.change}
                                </Text>
                            </View>
                        </View>
                    ))}
                </View>

                <View style={[styles.contactCard, getRowDirectionStyle(isArabic)]}>
                    <View style={styles.contactIconCircle}>
                        <Feather name="headphones" size={28} color={colors.primary} />
                    </View>

                    <View style={styles.contactTextBox}>
                        <Text style={[styles.cardTitle, getTextDirectionStyle(isArabic)]}>
                            {t("home.contactTitle")}
                        </Text>

                        <Text style={[styles.cardText, getTextDirectionStyle(isArabic)]}>
                            {t("home.contactText")}
                        </Text>
                    </View>

                    <TouchableOpacity
                        activeOpacity={0.88}
                        style={[styles.chatButton, getRowDirectionStyle(isArabic)]}
                        onPress={() => navigation.navigate("Chats")}
                    >
                        <Feather name="message-circle" size={18} color={colors.background} />
                        <Text style={styles.chatButtonText}>
                            {t("home.chatButton")}
                        </Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </View>
    );
}

function SectionHeader({ title, action, isArabic, styles }) {
    return (
        <View style={[styles.sectionHeader, getRowDirectionStyle(isArabic)]}>
            <Text style={[styles.sectionTitle, getTextDirectionStyle(isArabic)]}>
                {title}
            </Text>

            {!!action && (
                <Text style={[styles.sectionAction, getTextDirectionStyle(isArabic)]}>
                    {action}
                </Text>
            )}
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
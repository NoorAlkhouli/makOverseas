import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { CommonActions, useNavigation } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { useTranslation } from "react-i18next";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    findNodeHandle,
    Image,
    KeyboardAvoidingView,
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
import { useSafeAreaInsets } from "react-native-safe-area-context";

import MainNavBar from "@/src/components/MainNavBar";
import { useAppTheme } from "@/src/theme/ThemeProvider";
import {
    getProfile,
    logoutSession,
    updateProfile,
    USER_STATUSES,
} from "@/src/services/api/profileService";
import { STORAGE_KEYS } from "@/src/services/api/apiClient";
import { toggleAppLanguage } from "@/src/i18n";
import { disconnectEcho } from "@/src/services/realtime/echoClient";

const getInitials = (name) => {
    if (!name || typeof name !== "string") return "MO";

    const words = name.trim().split(/\s+/).filter(Boolean);

    if (words.length === 0) return "MO";

    return words
        .slice(0, 2)
        .map((word) => word.charAt(0).toUpperCase())
        .join("");
};

const formatDate = (value, language) => {
    if (!value) return null;

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return null;

    return date.toLocaleDateString(language === "ar" ? "ar" : "en", {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
};

const getStatusColor = (status, colors) => {
    if (status === USER_STATUSES.APPROVED) return colors.success;
    if (status === USER_STATUSES.PENDING) return colors.warning;

    if (
        status === USER_STATUSES.BLOCKED ||
        status === USER_STATUSES.DELETED
    ) {
        return colors.danger;
    }

    return colors.textMuted;
};

const clearStoredSession = async () => {
    await AsyncStorage.multiRemove([
        STORAGE_KEYS.AUTH_TOKEN,
        STORAGE_KEYS.DEVICE_ID,
    ]);
};

const resetNavigationToLogin = (navigation) => {
    const resetToLoginAction = CommonActions.reset({
        index: 0,
        routes: [{ name: "Login" }],
    });

    const resetToSplashAction = CommonActions.reset({
        index: 0,
        routes: [{ name: "Splash" }],
    });

    const rootNavigation = navigation.getParent?.("RootStack");

    if (rootNavigation) {
        rootNavigation.dispatch(resetToLoginAction);
        return;
    }

    const parents = [];
    let currentNavigation = navigation;

    while (currentNavigation) {
        parents.push(currentNavigation);
        currentNavigation = currentNavigation.getParent?.();
    }

    for (let index = parents.length - 1; index >= 0; index -= 1) {
        try {
            parents[index].dispatch(resetToSplashAction);
            return;
        } catch (error) {
            console.log("Logout reset navigation failed:", error);
        }
    }

    navigation.dispatch(resetToSplashAction);
};

export default function Profile() {
    const navigation = useNavigation();
    const { t, i18n } = useTranslation();
    const { width, height } = useWindowDimensions();
    const insets = useSafeAreaInsets();

    const scrollViewRef = useRef(null);
    const fullNameInputRef = useRef(null);

    const {
        colors,
        isDark,
        activeTheme,
        toggleTheme,
    } = useAppTheme();

    const language = i18n.language === "ar" ? "ar" : "en";
    const isArabic = language === "ar";

    const screenMetrics = useMemo(() => {
        const shortestSide = Math.min(width, height);
        const isTinyScreen = height < 620 || shortestSide < 340;
        const isSmallScreen = height < 720 || shortestSide < 380;
        const isLargeScreen = height >= 850 && shortestSide >= 390;

        return {
            width,
            height,
            isTinyScreen,
            isSmallScreen,
            isLargeScreen,
            horizontalPadding: isTinyScreen ? 14 : isSmallScreen ? 16 : 18,
            topPadding: Platform.OS === "android" ? 130 : 145,
            bottomPadding: Math.max(
                insets.bottom + (isTinyScreen ? 70 : isSmallScreen ? 90 : 110),
                isTinyScreen ? 100 : 120
            ),
            focusedInputOffset: isTinyScreen ? 90 : isSmallScreen ? 110 : 130,
            avatarSize: isTinyScreen ? 88 : isSmallScreen ? 102 : isLargeScreen ? 124 : 118,
            pageTitleSize: isTinyScreen ? 24 : isSmallScreen ? 27 : 30,
            cardRadius: isTinyScreen ? 22 : 28,
            sectionRadius: isTinyScreen ? 20 : 24,
            sectionPadding: isTinyScreen ? 13 : isSmallScreen ? 14 : 16,
        };
    }, [height, insets.bottom, width]);

    const styles = useMemo(
        () => createStyles(colors, isArabic, screenMetrics),
        [colors, isArabic, screenMetrics]
    );

    const [profile, setProfile] = useState(null);
    const [fullName, setFullName] = useState("");
    const [selectedAvatar, setSelectedAvatar] = useState(null);

    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [isChangingLanguage, setIsChangingLanguage] = useState(false);
    const [showNavTitle, setShowNavTitle] = useState(false);

    const statusColor = useMemo(() => {
        return getStatusColor(profile?.status, colors);
    }, [profile?.status, colors]);

    const approvedDate = useMemo(() => {
        return formatDate(profile?.approvedAt, language);
    }, [profile?.approvedAt, language]);

    const avatarUri = selectedAvatar?.uri || profile?.avatar || null;

    const hasChanges = useMemo(() => {
        const currentName = profile?.fullName || "";
        const nextName = fullName || "";

        return (
            nextName.trim() !== currentName.trim() ||
            Boolean(selectedAvatar?.uri)
        );
    }, [fullName, profile?.fullName, selectedAvatar]);

    const labels = useMemo(() => {
        return {
            pageTitle: t("profile.pageTitle"),
            pageSubtitle: t("profile.pageSubtitle"),
            edit: t("profile.edit"),
            personalInfo: t("profile.personalInfo"),
            fullName: t("profile.fullName"),
            fullNamePlaceholder: t("profile.fullNamePlaceholder"),
            saveChanges: t("profile.saveChanges"),
            saving: t("profile.saving"),
            appearance: t("profile.appearance"),
            appTheme: t("profile.appTheme"),
            currentTheme: t("profile.currentTheme"),
            light: t("profile.light"),
            dark: t("profile.dark"),
            language: t("profile.language"),
            currentLanguage: t("profile.currentLanguage"),
            switchLanguage: t("profile.switchLanguage"),
            account: t("profile.account"),
            logout: t("profile.logout"),
            logoutConfirmTitle: t("profile.logoutConfirmTitle"),
            logoutConfirmMessage: t("profile.logoutConfirmMessage"),
            cancel: t("profile.cancel"),
            loadingProfile: t("profile.loadingProfile"),
            profile: t("profile.profile"),
            noChanges: t("profile.noChanges"),
            enterNameOrImage: t("profile.enterNameOrImage"),
            updated: t("profile.updated"),
            failedLoad: t("profile.failedLoad"),
            failedUpdate: t("profile.failedUpdate"),
            failedImage: t("profile.failedImage"),
            permissionTitle: t("profile.permissionTitle"),
            permissionMessage: t("profile.permissionMessage"),
            approvedAt: t("profile.approvedAt"),
        };
    }, [t]);

    const scrollToFocusedInput = useCallback((inputRef) => {
        const delay = Platform.OS === "android" ? 320 : 120;

        setTimeout(() => {
            const scrollNode = findNodeHandle(scrollViewRef.current);
            const inputNode = findNodeHandle(inputRef.current);

            if (!scrollNode || !inputNode || !scrollViewRef.current?.scrollTo) {
                return;
            }

            UIManager.measureLayout(
                inputNode,
                scrollNode,
                () => { },
                (_x, y) => {
                    const nextY = Math.max(
                        0,
                        y - screenMetrics.focusedInputOffset
                    );

                    scrollViewRef.current?.scrollTo({
                        y: nextY,
                        animated: true,
                    });
                }
            );
        }, delay);
    }, [screenMetrics.focusedInputOffset]);

    const handleScroll = useCallback((event) => {
        const y = event.nativeEvent.contentOffset.y;

        if (y > 45 && !showNavTitle) {
            setShowNavTitle(true);
        }

        if (y <= 45 && showNavTitle) {
            setShowNavTitle(false);
        }
    }, [showNavTitle]);

    useEffect(() => {
        console.log("[PROFILE DEBUG] state changed:", {
            fullName,
            selectedAvatar,
            hasChanges,
            profileAvatar: profile?.avatar,
        });
    }, [fullName, selectedAvatar, hasChanges, profile?.avatar]);

    const loadProfile = useCallback(async ({ refreshing = false } = {}) => {
        try {
            if (refreshing) {
                setIsRefreshing(true);
            } else {
                setIsLoading(true);
            }

            const nextProfile = await getProfile();

            setProfile(nextProfile);
            setFullName(nextProfile?.fullName || "");
            setSelectedAvatar(null);
        } catch (error) {
            Alert.alert(
                labels.profile,
                error?.userMessage || labels.failedLoad
            );
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [labels.failedLoad, labels.profile]);

    useEffect(() => {
        loadProfile();
    }, [loadProfile]);

    const pickAvatar = useCallback(async () => {
        try {
            console.log("[PROFILE DEBUG] pickAvatar started");

            const permission =
                await ImagePicker.requestMediaLibraryPermissionsAsync();

            console.log("[PROFILE DEBUG] image permission:", permission);

            if (!permission.granted) {
                Alert.alert(
                    labels.permissionTitle,
                    labels.permissionMessage
                );
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ["images"],
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.85,
            });

            console.log("[PROFILE DEBUG] image picker result:", JSON.stringify(result, null, 2));

            if (result.canceled) {
                console.log("[PROFILE DEBUG] image picker canceled");
                return;
            }

            const asset = result.assets?.[0];

            console.log("[PROFILE DEBUG] selected asset:", asset);

            if (!asset?.uri) {
                console.log("[PROFILE DEBUG] selected asset has no uri");
                return;
            }

            const nextAvatar = {
                uri: asset.uri,
                type: asset.mimeType || "image/jpeg",
                name: asset.fileName || `avatar-${Date.now()}.jpg`,
            };

            console.log("[PROFILE DEBUG] next selectedAvatar:", nextAvatar);

            setSelectedAvatar(nextAvatar);
        } catch (error) {
            console.log("[PROFILE DEBUG] pickAvatar error:", error);
            Alert.alert(labels.profile, labels.failedImage);
        }
    }, [
        labels.failedImage,
        labels.permissionMessage,
        labels.permissionTitle,
        labels.profile,
    ]);

    const handleSave = useCallback(async () => {
        console.log("[PROFILE DEBUG] handleSave pressed:", {
            isSaving,
            fullName,
            selectedAvatar,
            hasChanges,
        });

        if (isSaving) return;

        const normalizedName = fullName.trim();

        if (!normalizedName && !selectedAvatar?.uri) {
            console.log("[PROFILE DEBUG] save stopped: no name and no avatar");
            Alert.alert(labels.profile, labels.enterNameOrImage);
            return;
        }

        if (!hasChanges) {
            console.log("[PROFILE DEBUG] save stopped: no changes");
            Alert.alert(labels.profile, labels.noChanges);
            return;
        }

        try {
            setIsSaving(true);

            console.log("[PROFILE DEBUG] calling updateProfile:", {
                fullName: normalizedName,
                avatar: selectedAvatar,
            });

            const updatedProfile = await updateProfile({
                fullName: normalizedName,
                avatar: selectedAvatar,
            });

            console.log("[PROFILE DEBUG] updateProfile normalized result:", updatedProfile);

            const refreshedProfile = await getProfile();

            console.log("[PROFILE DEBUG] refreshed profile after update:", refreshedProfile);

            setProfile(refreshedProfile);
            setFullName(refreshedProfile?.fullName || "");
            setSelectedAvatar(null);

            Alert.alert(labels.profile, labels.updated);
        } catch (error) {
            console.log("[PROFILE DEBUG] handleSave error:", error?.raw || error);
            Alert.alert(
                labels.profile,
                error?.userMessage || labels.failedUpdate
            );
        } finally {
            setIsSaving(false);
        }
    }, [
        fullName,
        selectedAvatar,
        hasChanges,
        isSaving,
        labels.enterNameOrImage,
        labels.failedUpdate,
        labels.noChanges,
        labels.profile,
        labels.updated,
    ]);

    const handleToggleLanguage = useCallback(async () => {
        if (isChangingLanguage) return;

        try {
            setIsChangingLanguage(true);
            setShowNavTitle(false);
            await toggleAppLanguage();

            scrollViewRef.current?.scrollTo({
                y: 0,
                animated: false,
            });
        } finally {
            setIsChangingLanguage(false);
        }
    }, [isChangingLanguage]);

    const performForcedLogout = useCallback(async () => {
        if (isLoggingOut) return;

        setIsLoggingOut(true);

        try {
            try {
                await logoutSession();
            } catch (error) {
                console.log("Logout API failed:", error?.raw || error);
            }

            try {
                disconnectEcho();
            } catch (error) {
                console.log("Realtime disconnect failed:", error);
            }

            await clearStoredSession();

            resetNavigationToLogin(navigation);
        } catch (error) {
            console.log("Forced logout cleanup failed:", error);

            try {
                disconnectEcho();
            } catch (disconnectError) {
                console.log("Realtime disconnect fallback failed:", disconnectError);
            }

            try {
                await clearStoredSession();
            } catch (storageError) {
                console.log("Forced logout storage cleanup failed:", storageError);
            }

            resetNavigationToLogin(navigation);
        }
    }, [isLoggingOut, navigation]);

    const handleLogout = useCallback(() => {
        if (isLoggingOut) return;

        Alert.alert(
            labels.logoutConfirmTitle,
            labels.logoutConfirmMessage,
            [
                {
                    text: labels.cancel,
                    style: "cancel",
                },
                {
                    text: labels.logout,
                    style: "destructive",
                    onPress: performForcedLogout,
                },
            ]
        );
    }, [
        isLoggingOut,
        labels.cancel,
        labels.logout,
        labels.logoutConfirmMessage,
        labels.logoutConfirmTitle,
        performForcedLogout,
    ]);

    const renderContent = () => {
        if (isLoading) {
            return (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator color={colors.primary} size="large" />

                    <Text style={styles.loadingText}>
                        {labels.loadingProfile}
                    </Text>
                </View>
            );
        }

        return (
            <KeyboardAvoidingView
                style={styles.keyboardView}
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                keyboardVerticalOffset={0}
            >
                <ScrollView
                    ref={scrollViewRef}
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                    bounces
                    overScrollMode="always"
                    onScroll={handleScroll}
                    scrollEventThrottle={16}
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefreshing}
                            onRefresh={() => loadProfile({ refreshing: true })}
                            tintColor={colors.primary}
                            colors={[colors.primary]}
                        />
                    }
                >
                    <View style={styles.header}>
                        <Text style={styles.title}>{labels.pageTitle}</Text>
                        <Text style={styles.subtitle}>
                            {labels.pageSubtitle}
                        </Text>
                    </View>

                    <View style={styles.profileCard}>
                        <TouchableOpacity
                            activeOpacity={0.85}
                            style={styles.avatarWrapper}
                            onPress={pickAvatar}
                            disabled={isSaving}
                        >
                            {avatarUri ? (
                                <Image
                                    source={{ uri: avatarUri }}
                                    style={styles.avatarImage}
                                />
                            ) : (
                                <View style={styles.avatarFallback}>
                                    <Text style={styles.avatarInitials}>
                                        {getInitials(profile?.fullName)}
                                    </Text>
                                </View>
                            )}

                            <View style={styles.avatarEditBadge}>
                                <Text style={styles.avatarEditText}>
                                    {labels.edit}
                                </Text>
                            </View>
                        </TouchableOpacity>

                        <Text style={styles.profileName}>
                            {profile?.fullName || "MAK Overseas User"}
                        </Text>

                        {!!profile?.phoneE164 && (
                            <Text style={styles.profilePhone}>
                                {profile.phoneE164}
                            </Text>
                        )}

                        <View style={styles.badgesRow}>
                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>
                                    {profile?.roleLabel || "User"}
                                </Text>
                            </View>

                            <View
                                style={[
                                    styles.badge,
                                    {
                                        borderColor: statusColor,
                                        backgroundColor: `${statusColor}18`,
                                    },
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.badgeText,
                                        { color: statusColor },
                                    ]}
                                >
                                    {profile?.statusLabel || "Unknown"}
                                </Text>
                            </View>
                        </View>

                        {!!approvedDate && (
                            <Text style={styles.approvedText}>
                                {labels.approvedAt} {approvedDate}
                            </Text>
                        )}
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>
                            {labels.personalInfo}
                        </Text>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>
                                {labels.fullName}
                            </Text>

                            <TextInput
                                ref={fullNameInputRef}
                                value={fullName}
                                onChangeText={setFullName}
                                onFocus={() => scrollToFocusedInput(fullNameInputRef)}
                                placeholder={labels.fullNamePlaceholder}
                                placeholderTextColor={colors.textMuted}
                                style={styles.input}
                                editable={!isSaving}
                                autoCapitalize="words"
                                returnKeyType="done"
                                textAlign={isArabic ? "right" : "left"}
                                writingDirection={isArabic ? "rtl" : "ltr"}
                            />
                        </View>

                        <TouchableOpacity
                            activeOpacity={0.85}
                            style={[
                                styles.saveButton,
                                (!hasChanges || isSaving) && styles.disabledButton,
                            ]}
                            onPress={handleSave}
                            disabled={!hasChanges || isSaving}
                        >
                            {isSaving ? (
                                <ActivityIndicator color={colors.darkText} />
                            ) : (
                                <Text style={styles.saveButtonText}>
                                    {labels.saveChanges}
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>
                            {labels.appearance}
                        </Text>

                        <View style={styles.settingRow}>
                            <View style={styles.settingTextWrapper}>
                                <Text style={styles.settingTitle}>
                                    {labels.appTheme}
                                </Text>
                                <Text style={styles.settingDescription}>
                                    {labels.currentTheme}: {activeTheme}
                                </Text>
                            </View>

                            <TouchableOpacity
                                activeOpacity={0.85}
                                style={styles.settingButton}
                                onPress={toggleTheme}
                            >
                                <Text style={styles.settingButtonText}>
                                    {isDark ? labels.light : labels.dark}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.settingDivider} />

                        <View style={styles.settingRow}>
                            <View style={styles.settingTextWrapper}>
                                <Text style={styles.settingTitle}>
                                    {labels.language}
                                </Text>
                                <Text style={styles.settingDescription}>
                                    {labels.currentLanguage}
                                </Text>
                            </View>

                            <TouchableOpacity
                                activeOpacity={0.85}
                                style={styles.settingButton}
                                onPress={handleToggleLanguage}
                                disabled={isChangingLanguage}
                            >
                                {isChangingLanguage ? (
                                    <ActivityIndicator color={colors.textPrimary} />
                                ) : (
                                    <Text style={styles.settingButtonText}>
                                        {labels.switchLanguage}
                                    </Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>
                            {labels.account}
                        </Text>

                        <TouchableOpacity
                            activeOpacity={0.85}
                            style={styles.logoutButton}
                            onPress={handleLogout}
                            disabled={isLoggingOut}
                        >
                            {isLoggingOut ? (
                                <ActivityIndicator color={colors.danger} />
                            ) : (
                                <Text style={styles.logoutButtonText}>
                                    {labels.logout}
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
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
                title={labels.pageTitle}
                showTitle={showNavTitle}
                notificationCount={3}
                showMenu={false}
            />

            {renderContent()}
        </View>
    );
}

const createStyles = (colors, isArabic, metrics) => {
    const avatarSize = metrics.avatarSize;
    const avatarRadius = avatarSize / 2;

    return StyleSheet.create({
        root: {
            flex: 1,
            backgroundColor: colors.background,
        },

        keyboardView: {
            flex: 1,
        },

        scrollView: {
            flex: 1,
        },

        scrollContent: {
            flexGrow: 1,
            paddingHorizontal: metrics.horizontalPadding,
            paddingTop: metrics.topPadding,
            paddingBottom: metrics.bottomPadding,
        },

        loadingContainer: {
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 24,
            paddingTop: metrics.topPadding,
            backgroundColor: colors.background,
        },

        loadingText: {
            marginTop: 12,
            color: colors.textSecondary,
            fontSize: 14,
            fontWeight: "600",
            textAlign: "center",
        },

        header: {
            marginTop: 10,
            marginBottom: metrics.isTinyScreen ? 12 : 18,
            alignItems: isArabic ? "flex-end" : "flex-start",
        },

        title: {
            color: colors.textPrimary,
            fontSize: metrics.pageTitleSize,
            fontWeight: "800",
            letterSpacing: -0.5,
            textAlign: isArabic ? "right" : "left",
            writingDirection: isArabic ? "rtl" : "ltr",
        },

        subtitle: {
            marginTop: 6,
            color: colors.textSecondary,
            fontSize: metrics.isTinyScreen ? 13 : 14,
            fontWeight: "500",
            textAlign: isArabic ? "right" : "left",
            writingDirection: isArabic ? "rtl" : "ltr",
        },

        profileCard: {
            alignItems: "center",
            paddingVertical: metrics.isTinyScreen ? 18 : 24,
            paddingHorizontal: metrics.isTinyScreen ? 14 : 18,
            borderRadius: metrics.cardRadius,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            marginBottom: metrics.isTinyScreen ? 12 : 16,
        },

        avatarWrapper: {
            width: avatarSize,
            height: avatarSize,
            borderRadius: avatarRadius,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: metrics.isTinyScreen ? 12 : 16,
        },

        avatarImage: {
            width: avatarSize,
            height: avatarSize,
            borderRadius: avatarRadius,
            borderWidth: 2,
            borderColor: colors.avatarBorder,
            backgroundColor: colors.avatarBackground,
        },

        avatarFallback: {
            width: avatarSize,
            height: avatarSize,
            borderRadius: avatarRadius,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 2,
            borderColor: colors.avatarBorder,
            backgroundColor: colors.avatarBackground,
        },

        avatarInitials: {
            color: colors.textPrimary,
            fontSize: metrics.isTinyScreen ? 28 : 34,
            fontWeight: "900",
        },

        avatarEditBadge: {
            position: "absolute",
            right: -4,
            bottom: metrics.isTinyScreen ? 4 : 8,
            paddingHorizontal: metrics.isTinyScreen ? 8 : 10,
            paddingVertical: metrics.isTinyScreen ? 4 : 5,
            borderRadius: 999,
            backgroundColor: colors.primary,
            borderWidth: 2,
            borderColor: colors.statusBorder,
        },

        avatarEditText: {
            color: colors.darkText,
            fontSize: metrics.isTinyScreen ? 10 : 11,
            fontWeight: "900",
        },

        profileName: {
            color: colors.textPrimary,
            fontSize: metrics.isTinyScreen ? 19 : 22,
            fontWeight: "800",
            textAlign: "center",
            writingDirection: isArabic ? "rtl" : "ltr",
        },

        profilePhone: {
            marginTop: 6,
            color: colors.textSecondary,
            fontSize: metrics.isTinyScreen ? 13 : 14,
            fontWeight: "600",
            textAlign: "center",
        },

        badgesRow: {
            flexDirection: isArabic ? "row-reverse" : "row",
            alignItems: "center",
            justifyContent: "center",
            flexWrap: "wrap",
            gap: 8,
            marginTop: metrics.isTinyScreen ? 10 : 14,
        },

        badge: {
            paddingHorizontal: metrics.isTinyScreen ? 10 : 12,
            paddingVertical: metrics.isTinyScreen ? 6 : 7,
            borderRadius: 999,
            backgroundColor: colors.buttonSoft,
            borderWidth: 1,
            borderColor: colors.borderSoft,
        },

        badgeText: {
            color: colors.textSecondary,
            fontSize: metrics.isTinyScreen ? 11 : 12,
            fontWeight: "800",
        },

        approvedText: {
            marginTop: 12,
            color: colors.textMuted,
            fontSize: 12,
            fontWeight: "600",
            textAlign: "center",
            writingDirection: isArabic ? "rtl" : "ltr",
        },

        section: {
            padding: metrics.sectionPadding,
            borderRadius: metrics.sectionRadius,
            backgroundColor: colors.cardSoft,
            borderWidth: 1,
            borderColor: colors.borderSoft,
            marginBottom: metrics.isTinyScreen ? 12 : 16,
        },

        sectionTitle: {
            color: colors.textPrimary,
            fontSize: metrics.isTinyScreen ? 16 : 17,
            fontWeight: "800",
            marginBottom: metrics.isTinyScreen ? 12 : 14,
            textAlign: isArabic ? "right" : "left",
            writingDirection: isArabic ? "rtl" : "ltr",
        },

        inputGroup: {
            marginBottom: 14,
        },

        inputLabel: {
            color: colors.textSecondary,
            fontSize: 13,
            fontWeight: "800",
            marginBottom: 8,
            textAlign: isArabic ? "right" : "left",
            writingDirection: isArabic ? "rtl" : "ltr",
        },

        input: {
            minHeight: metrics.isTinyScreen ? 48 : 50,
            paddingHorizontal: 14,
            borderRadius: 16,
            color: colors.textPrimary,
            backgroundColor: colors.inputBackground,
            borderWidth: 1,
            borderColor: colors.inputBorder,
            fontSize: 15,
            fontWeight: "600",
        },

        saveButton: {
            height: metrics.isTinyScreen ? 48 : 50,
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.primary,
        },

        disabledButton: {
            opacity: 0.55,
        },

        saveButtonText: {
            color: colors.darkText,
            fontSize: 15,
            fontWeight: "900",
        },

        settingRow: {
            minHeight: metrics.isTinyScreen ? 54 : 58,
            flexDirection: isArabic ? "row-reverse" : "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
        },

        settingTextWrapper: {
            flex: 1,
            alignItems: isArabic ? "flex-end" : "flex-start",
        },

        settingTitle: {
            color: colors.textPrimary,
            fontSize: 15,
            fontWeight: "800",
            textAlign: isArabic ? "right" : "left",
            writingDirection: isArabic ? "rtl" : "ltr",
        },

        settingDescription: {
            marginTop: 4,
            color: colors.textMuted,
            fontSize: 12,
            fontWeight: "600",
            textTransform: "capitalize",
            textAlign: isArabic ? "right" : "left",
            writingDirection: isArabic ? "rtl" : "ltr",
        },

        settingButton: {
            minWidth: metrics.isTinyScreen ? 82 : 92,
            minHeight: 44,
            paddingHorizontal: 12,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 14,
            backgroundColor: colors.buttonSoft,
            borderWidth: 1,
            borderColor: colors.border,
        },

        settingButtonText: {
            color: colors.textPrimary,
            fontSize: 13,
            fontWeight: "900",
            textAlign: "center",
        },

        settingDivider: {
            height: 1,
            backgroundColor: colors.borderSoft,
            marginVertical: metrics.isTinyScreen ? 12 : 14,
        },

        logoutButton: {
            minHeight: metrics.isTinyScreen ? 48 : 50,
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.buttonSoft,
            borderWidth: 1,
            borderColor: colors.danger,
        },

        logoutButtonText: {
            color: colors.danger,
            fontSize: 15,
            fontWeight: "900",
        },
    });
};
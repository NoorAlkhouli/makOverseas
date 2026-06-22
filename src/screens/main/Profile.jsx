import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { CommonActions, useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

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
    const { i18n } = useTranslation();

    const {
        colors,
        isDark,
        activeTheme,
        toggleTheme,
    } = useAppTheme();

    const language = i18n.language === "ar" ? "ar" : "en";
    const isArabic = language === "ar";

    const styles = useMemo(
        () => createStyles(colors, isArabic),
        [colors, isArabic]
    );

    const [profile, setProfile] = useState(null);
    const [fullName, setFullName] = useState("");
    const [selectedAvatar, setSelectedAvatar] = useState(null);

    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [isChangingLanguage, setIsChangingLanguage] = useState(false);

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

    useEffect(() => {
        console.log("[PROFILE DEBUG] state changed:", {
            fullName,
            selectedAvatar,
            hasChanges,
            profileAvatar: profile?.avatar,
        });
    }, [fullName, selectedAvatar, hasChanges, profile?.avatar]);

    const labels = useMemo(() => {
        if (isArabic) {
            return {
                pageTitle: "الملف الشخصي",
                pageSubtitle: "إدارة معلومات حسابك",
                edit: "تعديل",
                personalInfo: "المعلومات الشخصية",
                fullName: "الاسم الكامل",
                fullNamePlaceholder: "اكتب الاسم الكامل",
                saveChanges: "حفظ التغييرات",
                saving: "جارِ الحفظ...",
                appearance: "المظهر",
                appTheme: "ثيم التطبيق",
                currentTheme: "الثيم الحالي",
                light: "فاتح",
                dark: "داكن",
                language: "اللغة",
                currentLanguage: "العربية",
                switchLanguage: "English",
                account: "الحساب",
                logout: "تسجيل الخروج",
                logoutConfirmTitle: "تسجيل الخروج",
                logoutConfirmMessage: "هل تريد تسجيل الخروج من هذا الجهاز؟",
                cancel: "إلغاء",
                loadingProfile: "جارِ تحميل الملف الشخصي...",
                profile: "الملف الشخصي",
                noChanges: "لا توجد تغييرات للحفظ.",
                enterNameOrImage: "يرجى إدخال الاسم أو اختيار صورة.",
                updated: "تم تحديث الملف الشخصي بنجاح.",
                failedLoad: "فشل تحميل الملف الشخصي.",
                failedUpdate: "فشل تحديث الملف الشخصي.",
                failedImage: "تعذر اختيار الصورة. حاول مرة أخرى.",
                permissionTitle: "الصلاحية مطلوبة",
                permissionMessage: "يرجى السماح بالوصول للصور لتحديث صورة الحساب.",
                approvedAt: "تمت الموافقة في",
            };
        }

        return {
            pageTitle: "Profile",
            pageSubtitle: "Manage your account information",
            edit: "Edit",
            personalInfo: "Personal info",
            fullName: "Full name",
            fullNamePlaceholder: "Enter your full name",
            saveChanges: "Save changes",
            saving: "Saving...",
            appearance: "Appearance",
            appTheme: "App theme",
            currentTheme: "Current theme",
            light: "Light",
            dark: "Dark",
            language: "Language",
            currentLanguage: "English",
            switchLanguage: "العربية",
            account: "Account",
            logout: "Logout",
            logoutConfirmTitle: "Logout",
            logoutConfirmMessage: "Do you want to logout from this device?",
            cancel: "Cancel",
            loadingProfile: "Loading profile...",
            profile: "Profile",
            noChanges: "No changes to save.",
            enterNameOrImage: "Please enter your name or choose a profile image.",
            updated: "Profile updated successfully.",
            failedLoad: "Failed to load profile.",
            failedUpdate: "Failed to update profile.",
            failedImage: "Could not select image. Please try again.",
            permissionTitle: "Permission required",
            permissionMessage: "Please allow access to your photos to update your profile picture.",
            approvedAt: "Approved at",
        };
    }, [isArabic]);

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
            await toggleAppLanguage();
        } finally {
            setIsChangingLanguage(false);
        }
    }, [isChangingLanguage]);

    const performForcedLogout = useCallback(async () => {
        if (isLoggingOut) return;

        try {
            setIsLoggingOut(true);

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
                await clearStoredSession();
            } catch (storageError) {
                console.log("Forced logout storage cleanup failed:", storageError);
            }

            resetNavigationToLogin(navigation);
        } finally {
            setIsLoggingOut(false);
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

    if (isLoading) {
        return (
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator color={colors.primary} size="large" />
                    <Text style={styles.loadingText}>
                        {labels.loadingProfile}
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.safeArea}>
            <KeyboardAvoidingView
                style={styles.keyboardView}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefreshing}
                            onRefresh={() => loadProfile({ refreshing: true })}
                            tintColor={colors.primary}
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
                                value={fullName}
                                onChangeText={setFullName}
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
        </SafeAreaView>
    );
}

const createStyles = (colors, isArabic) =>
    StyleSheet.create({
        safeArea: {
            flex: 1,
            backgroundColor: colors.background,
        },

        keyboardView: {
            flex: 1,
        },

        scrollContent: {
            flexGrow: 1,
            paddingHorizontal: 18,
            paddingTop: 18,
            paddingBottom: 160,
        },

        loadingContainer: {
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 24,
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
            marginBottom: 18,
            alignItems: isArabic ? "flex-end" : "flex-start",
        },

        title: {
            color: colors.textPrimary,
            fontSize: 30,
            fontWeight: "800",
            letterSpacing: -0.5,
            textAlign: isArabic ? "right" : "left",
            writingDirection: isArabic ? "rtl" : "ltr",
        },

        subtitle: {
            marginTop: 6,
            color: colors.textSecondary,
            fontSize: 14,
            fontWeight: "500",
            textAlign: isArabic ? "right" : "left",
            writingDirection: isArabic ? "rtl" : "ltr",
        },

        profileCard: {
            alignItems: "center",
            paddingVertical: 24,
            paddingHorizontal: 18,
            borderRadius: 28,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            marginBottom: 16,
        },

        avatarWrapper: {
            width: 118,
            height: 118,
            borderRadius: 59,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 16,
        },

        avatarImage: {
            width: 118,
            height: 118,
            borderRadius: 59,
            borderWidth: 2,
            borderColor: colors.avatarBorder,
            backgroundColor: colors.avatarBackground,
        },

        avatarFallback: {
            width: 118,
            height: 118,
            borderRadius: 59,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 2,
            borderColor: colors.avatarBorder,
            backgroundColor: colors.avatarBackground,
        },

        avatarInitials: {
            color: colors.textPrimary,
            fontSize: 34,
            fontWeight: "900",
        },

        avatarEditBadge: {
            position: "absolute",
            right: -4,
            bottom: 8,
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 999,
            backgroundColor: colors.primary,
            borderWidth: 2,
            borderColor: colors.statusBorder,
        },

        avatarEditText: {
            color: colors.darkText,
            fontSize: 11,
            fontWeight: "900",
        },

        profileName: {
            color: colors.textPrimary,
            fontSize: 22,
            fontWeight: "800",
            textAlign: "center",
            writingDirection: isArabic ? "rtl" : "ltr",
        },

        profilePhone: {
            marginTop: 6,
            color: colors.textSecondary,
            fontSize: 14,
            fontWeight: "600",
            textAlign: "center",
        },

        badgesRow: {
            flexDirection: isArabic ? "row-reverse" : "row",
            alignItems: "center",
            justifyContent: "center",
            flexWrap: "wrap",
            gap: 8,
            marginTop: 14,
        },

        badge: {
            paddingHorizontal: 12,
            paddingVertical: 7,
            borderRadius: 999,
            backgroundColor: colors.buttonSoft,
            borderWidth: 1,
            borderColor: colors.borderSoft,
        },

        badgeText: {
            color: colors.textSecondary,
            fontSize: 12,
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
            padding: 16,
            borderRadius: 24,
            backgroundColor: colors.cardSoft,
            borderWidth: 1,
            borderColor: colors.borderSoft,
            marginBottom: 16,
        },

        sectionTitle: {
            color: colors.textPrimary,
            fontSize: 17,
            fontWeight: "800",
            marginBottom: 14,
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
            minHeight: 50,
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
            height: 50,
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
            minHeight: 58,
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
            minWidth: 92,
            height: 44,
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
            marginVertical: 14,
        },

        logoutButton: {
            minHeight: 50,
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
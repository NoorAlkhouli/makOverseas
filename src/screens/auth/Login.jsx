import LanguageButton from "@/src/components/LanguageButton";
import ThemeToggleButton from "@/src/components/ThemeToggleButton";
import { appImages } from "@/src/constants/images";
import {
    getInputLanguageStyle,
    getRowDirectionStyle,
    getTextDirectionStyle,
} from "@/src/styles/globalStyles";
import { useAppTheme } from "@/src/theme/ThemeProvider";

import CountryPhoneInput, {
    COUNTRIES,
} from "@/src/components/CountryPhoneInput";

import { authService } from "@/src/services/api/authService";
import { getOrCreateDeviceInfo } from "@/src/services/device/deviceService";

import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    ActivityIndicator,
    Alert,
    Animated,
    Image,
    ImageBackground,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    useWindowDimensions,
    View,
} from "react-native";

export default function Login({ navigation }) {
    const [fullName, setFullName] = useState("");
    const [phone, setPhone] = useState("");
    const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]);
    const [loading, setLoading] = useState(false);
    const [keyboardOpen, setKeyboardOpen] = useState(false);

    const scrollRef = useRef(null);
    const keyboardAnim = useRef(new Animated.Value(0)).current;
    const keyboardVisibleRef = useRef(false);
    const focusScrollTimeoutRef = useRef(null);
    const keyboardScrollTimeoutRef = useRef(null);
    const resetScrollTimeoutRef = useRef(null);

    const { height } = useWindowDimensions();

    const { t, i18n } = useTranslation();
    const isArabic = i18n.language === "ar";

    const { colors, isDark } = useAppTheme();

    const styles = useMemo(
        () => createStyles(colors, height, keyboardOpen),
        [colors, height, keyboardOpen]
    );

    const imageSource = isDark ? appImages.splashDark : appImages.splashLight;

    const scrollLoginFormForKeyboard = (animated = Platform.OS === "ios") => {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                scrollRef.current?.scrollTo({
                    y: Platform.OS === "android" ? 86 : 76,
                    animated,
                });
            });
        });
    };

    const handleInputFocus = () => {
        // أول فتحة للكيبورد على Android بتكون المقاسات لسا عم تنحسب،
        // لذلك ما منعمل scroll من الفوكس إلا إذا الكيبورد مفتوح فعلاً.
        if (!keyboardVisibleRef.current) {
            return;
        }

        if (focusScrollTimeoutRef.current) {
            clearTimeout(focusScrollTimeoutRef.current);
        }

        focusScrollTimeoutRef.current = setTimeout(() => {
            scrollLoginFormForKeyboard(false);
        }, Platform.OS === "android" ? 80 : 60);
    };

    useEffect(() => {
        const showEvent =
            Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
        const hideEvent =
            Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

        const showSubscription = Keyboard.addListener(showEvent, (event) => {
            keyboardVisibleRef.current = true;

            if (resetScrollTimeoutRef.current) {
                clearTimeout(resetScrollTimeoutRef.current);
                resetScrollTimeoutRef.current = null;
            }

            setKeyboardOpen(true);

            Animated.timing(keyboardAnim, {
                toValue: 1,
                duration: Platform.OS === "ios" ? event?.duration || 260 : 160,
                useNativeDriver: true,
            }).start();

            if (keyboardScrollTimeoutRef.current) {
                clearTimeout(keyboardScrollTimeoutRef.current);
            }

            keyboardScrollTimeoutRef.current = setTimeout(() => {
                scrollLoginFormForKeyboard(false);
            }, Platform.OS === "android" ? 280 : 120);
        });

        const hideSubscription = Keyboard.addListener(hideEvent, (event) => {
            keyboardVisibleRef.current = false;

            if (focusScrollTimeoutRef.current) {
                clearTimeout(focusScrollTimeoutRef.current);
                focusScrollTimeoutRef.current = null;
            }

            if (keyboardScrollTimeoutRef.current) {
                clearTimeout(keyboardScrollTimeoutRef.current);
                keyboardScrollTimeoutRef.current = null;
            }

            Animated.timing(keyboardAnim, {
                toValue: 0,
                duration: Platform.OS === "ios" ? event?.duration || 260 : 140,
                useNativeDriver: true,
            }).start();

            setKeyboardOpen(false);

            if (resetScrollTimeoutRef.current) {
                clearTimeout(resetScrollTimeoutRef.current);
            }

            resetScrollTimeoutRef.current = setTimeout(() => {
                scrollRef.current?.scrollTo({
                    y: 0,
                    animated: false,
                });
            }, Platform.OS === "android" ? 180 : 80);
        });

        return () => {
            if (focusScrollTimeoutRef.current) {
                clearTimeout(focusScrollTimeoutRef.current);
            }

            if (keyboardScrollTimeoutRef.current) {
                clearTimeout(keyboardScrollTimeoutRef.current);
            }

            if (resetScrollTimeoutRef.current) {
                clearTimeout(resetScrollTimeoutRef.current);
            }

            showSubscription.remove();
            hideSubscription.remove();
        };
    }, [keyboardAnim]);

    const logoScale = keyboardAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 0.62],
    });

    const logoTranslateY = keyboardAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, Platform.OS === "android" ? -54 : -62],
    });


    const handleContinue = async () => {
        const cleanFullName = fullName.trim();
        const cleanPhone = phone.trim();

        if (!cleanFullName) {
            Alert.alert(
                t("login.missingFullNameTitle", {
                    defaultValue: "Full name required",
                }),
                t("login.missingFullNameMessage", {
                    defaultValue: "Please enter the client's full name.",
                })
            );
            return;
        }

        if (!cleanPhone) {
            Alert.alert(
                t("login.missingphoneTitle", {
                    defaultValue: "Phone number required",
                }),
                t("login.missingphoneMessage", {
                    defaultValue: "Please enter the client's phone number.",
                })
            );
            return;
        }

        try {
            setLoading(true);

            const deviceInfo = await getOrCreateDeviceInfo();

            const payload = {
                phone_country_code: selectedCountry.code,
                phone_number: cleanPhone,
                full_name: cleanFullName,

                device_id: deviceInfo.device_id,
                platform: deviceInfo.platform,
                device_name: deviceInfo.device_name,
                os_version: deviceInfo.os_version,
                app_version: deviceInfo.app_version,

                push_token: null,
                voip_push_token: null,
            };

            const response = await authService.initiate(payload);

            console.log("Initiate Auth Response:", response);

            const action = response?.data?.action;

            if (action === "pending_approval") {
                Alert.alert(
                    t("login.pendingApprovalTitle", {
                        defaultValue: "Waiting for approval",
                    }),
                    response?.message ||
                    t("login.pendingApprovalMessage", {
                        defaultValue:
                            "Your account request has been sent. Please wait for admin approval.",
                    })
                );

                return;
            }

            if (action === "verify_code") {
                navigation.navigate("AccessCode", {
                    fullName: cleanFullName,
                    countryCode: selectedCountry.code,
                    phone: cleanPhone,
                    fullPhoneNumber: `${selectedCountry.code}${cleanPhone}`,

                    deviceInfo: {
                        device_id: deviceInfo.device_id,
                        platform: deviceInfo.platform,
                        device_name: deviceInfo.device_name,
                        os_version: deviceInfo.os_version,
                        app_version: deviceInfo.app_version,
                    },
                });

                return;
            }

            Alert.alert(
                t("login.loginFailedTitle", {
                    defaultValue: "Login failed",
                }),
                response?.message ||
                t("login.loginFailedMessage", {
                    defaultValue: "Unexpected response from server.",
                })
            );
        } catch (error) {
            console.log("Initiate Auth Error:", error);

            Alert.alert(
                t("login.errorTitle", {
                    defaultValue: "Error",
                }),
                error?.userMessage ||
                error?.message ||
                t("login.errorMessage", {
                    defaultValue: "Something went wrong. Please try again.",
                })
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
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
                        <View style={styles.fixedHeader}>
                            <View style={[styles.topActions, getRowDirectionStyle(isArabic)]}>
                                <ThemeToggleButton disabled={loading} size={44} />
                                <LanguageButton disabled={loading} />
                            </View>

                            <Animated.View
                                pointerEvents="none"
                                style={[
                                    styles.logoBox,
                                    {
                                        transform: [
                                            { translateY: logoTranslateY },
                                            { scale: logoScale },
                                        ],
                                    },
                                ]}
                            >
                                <Image
                                    source={require("@/src/assets/MAK/logo-light.png")}
                                    style={styles.logo}
                                    resizeMode="contain"
                                />
                            </Animated.View>
                        </View>

                        <KeyboardAvoidingView
                            style={styles.contentSection}
                            behavior={Platform.OS === "ios" ? "padding" : "height"}
                            keyboardVerticalOffset={0}
                        >
                            <ScrollView
                                ref={scrollRef}
                                style={styles.scrollView}
                                contentContainerStyle={styles.scrollContent}
                                keyboardShouldPersistTaps="handled"
                                keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
                                showsVerticalScrollIndicator={false}
                                bounces={false}
                                overScrollMode="never"
                                scrollEnabled
                            >
                                <View style={styles.formBox}>
                                    <Text style={[styles.title, getTextDirectionStyle(isArabic)]}>
                                        {t("login.titleWelcome")}{" "}
                                        <Text style={styles.green}>
                                            {t("login.titleBack")}
                                        </Text>
                                    </Text>

                                    <Text style={[styles.subtitle, getTextDirectionStyle(isArabic)]}>
                                        {t("login.subtitle")}
                                    </Text>

                                    <View style={[styles.inputBox, getRowDirectionStyle(isArabic)]}>
                                        <Feather name="user" size={24} color={colors.primary} />

                                        <TextInput
                                            value={fullName}
                                            onChangeText={setFullName}
                                            placeholder={t("login.fullNamePlaceholder", {
                                                defaultValue: "Full Name",
                                            })}
                                            placeholderTextColor={colors.textMuted}
                                            style={[styles.input, getInputLanguageStyle(isArabic)]}
                                            autoCapitalize="words"
                                            editable={!loading}
                                            textAlign={isArabic ? "right" : "left"}
                                            returnKeyType="next"
                                            blurOnSubmit={false}
                                            onFocus={handleInputFocus}
                                        />
                                    </View>

                                    <CountryPhoneInput
                                        value={phone}
                                        onChangeText={setPhone}
                                        selectedCountry={selectedCountry}
                                        onChangeCountry={setSelectedCountry}
                                        placeholder={t("login.phonePlaceholder", {
                                            defaultValue: "Client phone number",
                                        })}
                                        disabled={loading}
                                        isArabic={isArabic}
                                        onFocus={handleInputFocus}
                                    />

                                    <TouchableOpacity
                                        activeOpacity={0.85}
                                        style={[
                                            styles.buttonWrapper,
                                            loading && styles.buttonDisabled,
                                        ]}
                                        onPress={handleContinue}
                                        disabled={loading}
                                    >
                                        <LinearGradient
                                            colors={["#087BFF", "#39BDFF", "#51a234"]}
                                            start={{ x: 0, y: 0.5 }}
                                            end={{ x: 1, y: 0.5 }}
                                            style={styles.gradientButton}
                                        >
                                            {loading ? (
                                                <ActivityIndicator
                                                    size="small"
                                                    color={colors.textPrimary}
                                                />
                                            ) : (
                                                <Text style={styles.buttonText}>
                                                    {t("login.continue")}
                                                </Text>
                                            )}
                                        </LinearGradient>
                                    </TouchableOpacity>

                                    {!keyboardOpen && (
                                        <View
                                            style={[
                                                styles.privateBox,
                                                getRowDirectionStyle(isArabic),
                                            ]}
                                        >
                                            <Feather
                                                name="shield"
                                                size={22}
                                                color={colors.textMuted}
                                            />

                                            <Text
                                                style={[
                                                    styles.privateText,
                                                    getTextDirectionStyle(isArabic),
                                                ]}
                                            >
                                                {t("login.privatePartOne")} {" "}
                                                <Text style={styles.privateGreen}>
                                                    {t("login.privatePartTwo")}
                                                </Text>
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            </ScrollView>
                        </KeyboardAvoidingView>
                    </View>
                </ImageBackground>
            </View>
        </TouchableWithoutFeedback>
    );
}

const createStyles = (colors, height, keyboardOpen) => {
    const isTinyScreen = height < 660;
    const isSmallScreen = height < 720;
    const logoTop = Platform.OS === "android" ? 105 : 118;
    const logoHeight = 120;

    // Keep the header height stable. The logo can still animate with transform,
    // but changing real layout height while the Android keyboard resizes the screen
    // causes the visible jitter / stuck scroll.
    const headerGap = isSmallScreen ? 14 : 20;
    const dynamicHeaderHeight = Math.ceil(logoTop + logoHeight + headerGap);

    return StyleSheet.create({
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
            backgroundColor: colors.authOverlay,
        },

        fixedHeader: {
            height: dynamicHeaderHeight,
            width: "100%",
            paddingTop: Platform.OS === "android" ? 48 : 55,
            paddingHorizontal: 24,
            zIndex: 20,
            elevation: 20,
        },

        topActions: {
            width: "100%",
            height: 56,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            zIndex: 30,
            elevation: 30,
        },

        logoBox: {
            position: "absolute",
            top: logoTop,
            left: 0,
            right: 0,
            alignItems: "center",
            zIndex: 10,
            elevation: 10,
        },

        logo: {
            width: isTinyScreen ? 210 : 230,
            height: 120,
        },

        contentSection: {
            flex: 1,
        },

        scrollView: {
            flex: 1,
        },

        scrollContent: {
            flexGrow: 1,
            paddingHorizontal: isTinyScreen ? 24 : 34,
            paddingTop: isSmallScreen ? 4 : 8,
            paddingBottom: Platform.OS === "android" ? 28 : 44,
            justifyContent: "flex-end",
        },

        formBox: {
            width: "100%",
        },

        title: {
            color: colors.textPrimary,
            fontSize: isSmallScreen ? 34 : 38,
            fontWeight: "900",
            marginBottom: 8,
        },

        green: {
            color: colors.primary,
        },

        subtitle: {
            color: colors.textPrimary,
            fontSize: isSmallScreen ? 17 : 19,
            lineHeight: isSmallScreen ? 25 : 28,
            fontWeight: "600",
            marginBottom: isSmallScreen ? 18 : 22,
        },

        inputBox: {
            height: 66,
            borderWidth: 1.3,
            borderColor: colors.inputBorder,
            borderRadius: 20,
            backgroundColor: colors.inputBackground,
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 24,
            marginBottom: 16,
        },

        input: {
            flex: 1,
            color: colors.textPrimary,
            fontSize: 18,
            fontWeight: "700",
            paddingVertical: 0,
        },

        buttonWrapper: {
            height: 66,
            borderRadius: 21,
            marginTop: 12,
            shadowColor: colors.primary,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.85,
            shadowRadius: 13,
            elevation: 10,
        },

        buttonDisabled: {
            opacity: 0.8,
        },

        gradientButton: {
            flex: 1,
            borderRadius: 21,
            alignItems: "center",
            justifyContent: "center",
        },

        buttonText: {
            color: colors.textPrimary,
            fontSize: 18,
            fontWeight: "900",
        },

        privateBox: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            marginTop: 18,
            marginBottom: 0,
            gap: 10,
        },

        privateText: {
            color: colors.textPrimary,
            fontSize: 15,
            fontWeight: "600",
        },

        privateGreen: {
            color: colors.primary,
        },
    });
};

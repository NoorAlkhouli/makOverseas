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
    const [keyboardHeight, setKeyboardHeight] = useState(0);

    const scrollRef = useRef(null);

    const { height } = useWindowDimensions();

    const { t, i18n } = useTranslation();
    const isArabic = i18n.language === "ar";

    const { colors, isDark } = useAppTheme();

    const styles = useMemo(
        () => createStyles(colors, height),
        [colors, height]
    );

    const imageSource = isDark ? appImages.splashDark : appImages.splashLight;

    const isKeyboardOpen = keyboardHeight > 0;

    useEffect(() => {
        const showEvent =
            Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";

        const hideEvent =
            Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

        const showSubscription = Keyboard.addListener(showEvent, (event) => {
            const nextKeyboardHeight = event?.endCoordinates?.height || 0;
            setKeyboardHeight(nextKeyboardHeight);
        });

        const hideSubscription = Keyboard.addListener(hideEvent, () => {
            setKeyboardHeight(0);
        });

        return () => {
            showSubscription.remove();
            hideSubscription.remove();
        };
    }, []);

    const scrollToFormEnd = () => {
        setTimeout(() => {
            scrollRef.current?.scrollToEnd({ animated: true });
        }, Platform.OS === "android" ? 120 : 80);
    };

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

                            <View pointerEvents="none" style={styles.logoBox}>
                                <Image
                                    source={require("@/src/assets/MAK/logo-light.png")}
                                    style={styles.logo}
                                    resizeMode="contain"
                                />
                            </View>
                        </View>

                        <KeyboardAvoidingView
                            style={styles.contentSection}
                            behavior={Platform.OS === "ios" ? "padding" : undefined}
                            keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
                        >
                            <ScrollView
                                ref={scrollRef}
                                style={styles.scrollView}
                                contentContainerStyle={[
                                    styles.scrollContent,
                                    isKeyboardOpen && {
                                        paddingBottom:
                                            Platform.OS === "android"
                                                ? keyboardHeight + 28
                                                : 44,
                                    },
                                ]}
                                keyboardShouldPersistTaps="handled"
                                keyboardDismissMode="interactive"
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
                                            onFocus={scrollToFormEnd}
                                            placeholder={t("login.fullNamePlaceholder", {
                                                defaultValue: "Full Name",
                                            })}
                                            placeholderTextColor={colors.textMuted}
                                            style={[styles.input, getInputLanguageStyle(isArabic)]}
                                            autoCapitalize="words"
                                            editable={!loading}
                                            textAlign={isArabic ? "right" : "left"}
                                            returnKeyType="next"
                                        />
                                    </View>

                                    <View onTouchStart={scrollToFormEnd}>
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
                                        />
                                    </View>

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

                                    <View style={[styles.privateBox, getRowDirectionStyle(isArabic)]}>
                                        <Feather name="shield" size={22} color={colors.textMuted} />

                                        <Text
                                            style={[
                                                styles.privateText,
                                                getTextDirectionStyle(isArabic),
                                            ]}
                                        >
                                            {t("login.privatePartOne")}{" "}
                                            <Text style={styles.privateGreen}>
                                                {t("login.privatePartTwo")}
                                            </Text>
                                        </Text>
                                    </View>
                                </View>
                            </ScrollView>
                        </KeyboardAvoidingView>
                    </View>
                </ImageBackground>
            </View>
        </TouchableWithoutFeedback>
    );
}

const createStyles = (colors, height) => {
    const isSmallScreen = height < 720;
    const logoTop = Platform.OS === "android" ? 105 : 118;

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
            height: Platform.OS === "android" ? 250 : 268,
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
            width: 230,
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
            paddingHorizontal: 34,
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
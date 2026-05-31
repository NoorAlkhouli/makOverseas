import AppTopBar from "@/src/components/AppTopBar";
import { appImages } from "@/src/constants/images";
import {
    getRowDirectionStyle,
    getTextDirectionStyle,
} from "@/src/styles/globalStyles";
import { useAppTheme } from "@/src/theme/ThemeProvider";

import { authService } from "@/src/services/api/authService";
import { apiClient } from "@/src/services/api/apiClient";
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

export default function AccessCode({ navigation, route }) {
    const { t, i18n } = useTranslation();
    const isArabic = i18n.language === "ar";

    const { colors, isDark } = useAppTheme();
    const { height } = useWindowDimensions();

    const fullName = route?.params?.fullName || "";
    const phone = route?.params?.phone || "";
    const countryCode = route?.params?.countryCode || "";
    const fullPhoneNumber = route?.params?.fullPhoneNumber || "";
    const routeDeviceInfo = route?.params?.deviceInfo || null;

    const [code, setCode] = useState(["", "", "", "", "", ""]);
    const [loading, setLoading] = useState(false);
    const [keyboardOpen, setKeyboardOpen] = useState(false);

    const inputsRef = useRef([]);
    const scrollRef = useRef(null);
    const keyboardAnim = useRef(new Animated.Value(0)).current;

    const styles = useMemo(
        () => createStyles(colors, height, keyboardOpen),
        [colors, height, keyboardOpen]
    );

    const imageSource = isDark ? appImages.splashDark : appImages.splashLight;

    useEffect(() => {
        const showEvent =
            Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
        const hideEvent =
            Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

        const showSubscription = Keyboard.addListener(showEvent, (event) => {
            setKeyboardOpen(true);

            Animated.timing(keyboardAnim, {
                toValue: 1,
                duration: Platform.OS === "ios" ? event?.duration || 260 : 220,
                useNativeDriver: true,
            }).start();

            setTimeout(() => {
                scrollRef.current?.scrollTo({
                    y: Platform.OS === "android" ? 70 : 90,
                    animated: true,
                });
            }, Platform.OS === "android" ? 180 : 90);
        });

        const hideSubscription = Keyboard.addListener(hideEvent, (event) => {
            Animated.timing(keyboardAnim, {
                toValue: 0,
                duration: Platform.OS === "ios" ? event?.duration || 260 : 220,
                useNativeDriver: true,
            }).start();

            setTimeout(() => {
                scrollRef.current?.scrollTo({ y: 0, animated: true });
                setKeyboardOpen(false);
            }, Platform.OS === "android" ? 120 : 80);
        });

        return () => {
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

    const convertToEnglishDigits = (value) => {
        return value
            .replace(/[٠-٩]/g, (digit) => "٠١٢٣٤٥٦٧٨٩".indexOf(digit))
            .replace(/[۰-۹]/g, (digit) => "۰۱۲۳۴۵۶۷۸۹".indexOf(digit));
    };

    const handleCodeChange = (value, index) => {
        const englishValue = convertToEnglishDigits(value);
        const cleanValue = englishValue.replace(/[^0-9]/g, "");

        const newCode = [...code];
        newCode[index] = cleanValue.slice(-1);
        setCode(newCode);

        if (cleanValue && index < 5) {
            inputsRef.current[index + 1]?.focus();
        }
    };

    const handleBackspace = (event, index) => {
        if (event.nativeEvent.key === "Backspace" && !code[index] && index > 0) {
            inputsRef.current[index - 1]?.focus();
        }
    };

    const handleVerify = async () => {
        const finalCode = code.join("");

        if (finalCode.length !== 6) {
            Alert.alert(
                t("accessCode.invalidCodeTitle", {
                    defaultValue: "Invalid code",
                }),
                t("accessCode.invalidCodeMessage", {
                    defaultValue: "Please enter the 6-digit activation code.",
                })
            );
            return;
        }

        if (!phone || !countryCode) {
            Alert.alert(
                t("accessCode.errorTitle", {
                    defaultValue: "Error",
                }),
                t("accessCode.missingUserInfoMessage", {
                    defaultValue:
                        "User information is missing. Please go back and login again.",
                })
            );
            return;
        }

        try {
            setLoading(true);

            const currentDeviceInfo =
                route?.params?.deviceInfo || (await getOrCreateDeviceInfo());

            const deviceId = currentDeviceInfo.device_id;

            const payload = {
                phone_country_code: countryCode,
                phone_number: phone,
                code: finalCode,

                // لازم يكون string
                device_id: deviceId,

                // لازم يكون object
                device: {
                    platform: currentDeviceInfo.platform,
                    device_name: currentDeviceInfo.device_name,
                    os_version: currentDeviceInfo.os_version,
                    app_version: currentDeviceInfo.app_version,
                },
            };

            console.log("Verify Auth Payload:", JSON.stringify(payload, null, 2));

            const response = await authService.verify(payload);

            console.log("Verify Auth Success:", {
                success: response?.success,
                action: response?.data?.action,
                userId: response?.data?.user?.id,
            });

            const token = response?.data?.token;
            const user = response?.data?.user;

            if (!token || !user) {
                Alert.alert(
                    t("accessCode.wrongCodeTitle", {
                        defaultValue: "Verification failed",
                    }),
                    response?.message ||
                    t("accessCode.wrongCodeMessage", {
                        defaultValue:
                            "The activation code could not be verified. Please try again.",
                    })
                );
                return;
            }

            await apiClient.setToken(token);
            await apiClient.setDeviceId(deviceId);

            navigation.reset({
                index: 0,
                routes: [
                    {
                        name: "MainTabsNavigator",
                        params: {
                            user,
                            fullName,
                            phone,
                            countryCode,
                            fullPhoneNumber,
                        },
                    },
                ],
            });
        } catch (error) {
            console.log("Verify Auth Error Status:", error?.status);
            console.log("Verify Auth Error Code:", error?.code);
            console.log("Verify Auth Error Message:", error?.message);
            console.log("Verify Auth Validation Errors:", error?.errors);
            console.log("Verify Auth Raw Error:", error?.raw);

            Alert.alert(
                t("accessCode.errorTitle", {
                    defaultValue: "Error",
                }),
                error?.userMessage ||
                error?.message ||
                t("accessCode.errorMessage", {
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
                            <AppTopBar disabled={loading} />

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
                                contentContainerStyle={styles.scrollContent}
                                keyboardShouldPersistTaps="handled"
                                showsVerticalScrollIndicator={false}
                                bounces={false}
                                overScrollMode="never"
                            >
                                <View style={styles.formBox}>
                                    <Text style={[styles.title, getTextDirectionStyle(isArabic)]}>
                                        {t("accessCode.titleEnter")}{" "}
                                        <Text style={styles.green}>
                                            {t("accessCode.titleAccessCode")}
                                        </Text>
                                    </Text>

                                    <Text style={[styles.subtitle, getTextDirectionStyle(isArabic)]}>
                                        {t("accessCode.subtitle")}
                                    </Text>

                                    <View style={styles.codeRow}>
                                        {code.map((digit, index) => (
                                            <TextInput
                                                key={index}
                                                ref={(ref) => {
                                                    inputsRef.current[index] = ref;
                                                }}
                                                value={digit}
                                                onChangeText={(value) =>
                                                    handleCodeChange(value, index)
                                                }
                                                onKeyPress={(event) =>
                                                    handleBackspace(event, index)
                                                }
                                                style={[
                                                    styles.codeInput,
                                                    digit ? styles.codeInputActive : null,
                                                ]}
                                                keyboardType={
                                                    Platform.OS === "ios"
                                                        ? "number-pad"
                                                        : "numeric"
                                                }
                                                inputMode="numeric"
                                                maxLength={1}
                                                textAlign="center"
                                                editable={!loading}
                                                selectionColor={colors.primary}
                                            />
                                        ))}
                                    </View>

                                    <TouchableOpacity
                                        activeOpacity={0.85}
                                        style={[
                                            styles.buttonWrapper,
                                            loading && styles.buttonDisabled,
                                        ]}
                                        onPress={handleVerify}
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
                                                    {t("accessCode.verifyButton")}
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
                                                {t("accessCode.privatePartOne")}{" "}
                                                <Text style={styles.privateGreen}>
                                                    {t("accessCode.privatePartTwo")}
                                                </Text>
                                                {"\n"}
                                                {t("accessCode.privatePartThree")}
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
    const isSmallScreen = height < 720;
    const logoTop = Platform.OS === "android" ? 120 : 132;
    const logoHeight = 120;

    const activeLogoScale = keyboardOpen ? 0.62 : 1;
    const activeLogoTranslateY = keyboardOpen
        ? Platform.OS === "android"
            ? -54
            : -62
        : 0;

    const logoVisualBottom =
        logoTop +
        activeLogoTranslateY +
        logoHeight / 2 +
        (logoHeight * activeLogoScale) / 2;

    const headerGap = keyboardOpen ? 10 : isSmallScreen ? 14 : 20;

    const dynamicHeaderHeight = Math.ceil(logoVisualBottom + headerGap);

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

        scrollContent: {
            flexGrow: 1,
            paddingHorizontal: 34,
            paddingTop: keyboardOpen ? 0 : isSmallScreen ? 4 : 8,
            paddingBottom: keyboardOpen
                ? Platform.OS === "android"
                    ? 14
                    : 18
                : Platform.OS === "android"
                    ? 28
                    : 44,
            justifyContent: "flex-end",
        },

        formBox: {
            width: "100%",
        },

        title: {
            color: colors.textPrimary,
            fontSize: keyboardOpen ? 31 : isSmallScreen ? 32 : 34,
            fontWeight: "900",
            marginBottom: 12,
        },

        green: {
            color: colors.primary,
        },

        subtitle: {
            color: colors.textPrimary,
            fontSize: keyboardOpen ? 16 : isSmallScreen ? 16 : 17,
            lineHeight: keyboardOpen ? 24 : isSmallScreen ? 24 : 27,
            fontWeight: "500",
            marginBottom: keyboardOpen ? 22 : 28,
        },

        codeRow: {
            flexDirection: "row",
            justifyContent: "space-between",
            marginBottom: keyboardOpen ? 28 : 36,
        },

        codeInput: {
            width: isSmallScreen ? 42 : 45,
            height: isSmallScreen ? 54 : 57,
            borderWidth: 1.3,
            borderColor: colors.inputBorder,
            borderRadius: 14,
            backgroundColor: colors.inputBackground,
            color: colors.textPrimary,
            fontSize: 20,
            fontWeight: "800",
            paddingVertical: 0,
            includeFontPadding: false,
        },

        codeInputActive: {
            borderColor: colors.primary,
            shadowColor: colors.primary,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.7,
            shadowRadius: 10,
            elevation: 8,
        },

        buttonWrapper: {
            height: 66,
            borderRadius: 21,
            marginTop: 8,
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
            marginTop: 28,
            gap: 12,
        },

        privateText: {
            color: colors.textPrimary,
            fontSize: 15,
            fontWeight: "500",
            lineHeight: 23,
        },

        privateGreen: {
            color: colors.primary,
            fontWeight: "800",
        },
    });
};
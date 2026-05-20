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
    const [phone, setphone] = useState("");
    const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]);
    const [loading, setLoading] = useState(false);
    const [keyboardOpen, setKeyboardOpen] = useState(false);

    const scrollRef = useRef(null);
    const keyboardAnim = useRef(new Animated.Value(0)).current;

    const { height } = useWindowDimensions();

    const { t, i18n } = useTranslation();
    const isArabic = i18n.language === "ar";

    const { colors, isDark } = useAppTheme();

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

    const handleContinue = async () => {
        if (!fullName.trim()) {
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

        if (!phone.trim()) {
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

            const response = await mockLogin({
                fullName: fullName.trim(),
                countryCode: selectedCountry.code,
                phone: phone.trim(),
                fullPhoneNumber: `${selectedCountry.code}${phone.trim()}`,
            });

            if (response.success) {
                navigation.navigate("AccessCode", {
                    fullName: fullName.trim(),
                    countryCode: selectedCountry.code,
                    phone: phone.trim(),
                    fullPhoneNumber: `${selectedCountry.code}${phone.trim()}`,
                });
            } else {
                Alert.alert(
                    t("login.loginFailedTitle"),
                    response.message || t("login.loginFailedMessage")
                );
            }
        } catch (error) {
            Alert.alert(t("login.errorTitle"), t("login.errorMessage"));
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
                        {/* Fixed Header */}
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

                        {/* Scrollable Section */}
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
                                        {t("login.titleWelcome")}{" "}
                                        <Text style={styles.green}>{t("login.titleBack")}</Text>
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
                                        />
                                    </View>

                                    <CountryPhoneInput
                                        value={phone}
                                        onChangeText={setphone}
                                        selectedCountry={selectedCountry}
                                        onChangeCountry={setSelectedCountry}
                                        placeholder={t("login.phonePlaceholder", {
                                            defaultValue: "Client phone number",
                                        })}
                                        disabled={loading}
                                        isArabic={isArabic}
                                    />

                                    <TouchableOpacity
                                        activeOpacity={0.85}
                                        style={styles.buttonWrapper}
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
                                                <ActivityIndicator size="small" color={colors.textPrimary} />
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

async function mockLogin(data) {
    console.log("Login data:", data);

    return new Promise((resolve) => {
        setTimeout(() => {
            resolve({
                success: true,
                message: "User accepted",
            });
        }, 1000);
    });
}

const createStyles = (colors, height, keyboardOpen) => {
    const isSmallScreen = height < 720;
    const logoTop = Platform.OS === "android" ? 105 : 118;
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
            fontSize: keyboardOpen ? 33 : isSmallScreen ? 34 : 38,
            fontWeight: "900",
            marginBottom: 8,
        },

        green: {
            color: colors.primary,
        },

        subtitle: {
            color: colors.textPrimary,
            fontSize: keyboardOpen ? 17 : isSmallScreen ? 17 : 19,
            lineHeight: keyboardOpen ? 25 : isSmallScreen ? 25 : 28,
            fontWeight: "600",
            marginBottom: keyboardOpen ? 16 : isSmallScreen ? 18 : 22,
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
            marginTop: keyboardOpen ? 14 : 18,
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
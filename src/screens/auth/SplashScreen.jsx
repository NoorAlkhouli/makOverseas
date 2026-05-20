import { getTextDirectionStyle } from "@/src/styles/globalStyles";
import { useAppTheme } from "@/src/theme/ThemeProvider";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { appImages } from "@/src/constants/images";

const SplashScreen = ({ navigation }) => {
  const { t, i18n } = useTranslation();
  const { colors, isDark } = useAppTheme();

  const styles = useMemo(() => createStyles(colors), [colors]);
  const isArabic = i18n.language === "ar";
  const imageSource = isDark ? appImages.splashDark : appImages.splashLight;

  useEffect(() => {
    const timer = setTimeout(() => {
      navigation.replace("Login");
    }, 3000);

    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <View style={styles.root}>
      <StatusBar
        style={isDark ? "light" : "dark"}
        translucent
        backgroundColor="transparent"
      />

      <ImageBackground
        source={imageSource}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <View style={styles.overlay}>
          <View style={styles.logoContainer}>
            <Image
              source={require("@/src/assets/MAK/logo-light.png")}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          <View style={styles.bottom}>
            <ActivityIndicator size="large" color={colors.primary} />

            <Text style={[styles.text, getTextDirectionStyle(isArabic)]}>
              {t("splash.welcome")}
            </Text>
          </View>
        </View>
      </ImageBackground>
    </View>
  );
};

const createStyles = (colors) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },

    backgroundImage: {
      flex: 1,
      width: "100%",
      height: "100%",
    },

    overlay: {
      flex: 1,
      // backgroundColor: colors.authOverlay,
      alignItems: "center",
      justifyContent: "space-between",
      paddingTop: 150,
      paddingBottom: 70,
    },

    logoContainer: {
      alignItems: "center",
      justifyContent: "center",
    },

    logo: {
      width: 300,
      height: 140,
    },

    bottom: {
      alignItems: "center",
    },

    text: {
      marginTop: 20,
      color: colors.textPrimary,
      fontSize: 20,
      fontWeight: "700",
      textAlign: "center",
    },
  });

export default SplashScreen;
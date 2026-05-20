

// import AsyncStorage from "@react-native-async-storage/async-storage";


// import MaterialIcons from "@expo/vector-icons/MaterialIcons";
// import { useTranslation } from "react-i18next";
// import { StyleSheet, Text, TouchableOpacity } from "react-native";

// import {
//     getLanguageButtonPositionStyle,
//     getRowDirectionStyle,
// } from "@/src/styles/globalStyles";

// export default function LanguageButton({
//     disabled = false,
//     style,
//     withPosition = true,
// }) {
//     const { i18n } = useTranslation();

//     const isArabic = i18n.language === "ar";

//     const toggleLanguage = async () => {
//         const nextLanguage = isArabic ? "en" : "ar";

//         await AsyncStorage.setItem("appLanguage", nextLanguage);
//         await i18n.changeLanguage(nextLanguage);
//     };

//     return (
//         <TouchableOpacity
//             activeOpacity={0.85}
//             style={[
//                 styles.languageButton,
//                 getRowDirectionStyle(isArabic),
//                 withPosition && getLanguageButtonPositionStyle(isArabic),
//                 style,
//             ]}
//             onPress={toggleLanguage}
//             disabled={disabled}
//         >
//             <MaterialIcons name="language" size={22} color="#ffffff" />

//             <Text style={styles.languageText}>{isArabic ? "EN" : "AR"}</Text>
//         </TouchableOpacity>
//     );
// }

// const styles = StyleSheet.create({
//     languageButton: {
//         flexDirection: "row",
//         alignItems: "center",
//         gap: 6,
//         paddingVertical: 6,
//         paddingHorizontal: 4,
//     },

//     languageText: {
//         color: "#ffffff",
//         fontSize: 15,
//         fontWeight: "800",
//         letterSpacing: 0.5,
//     },
// });

import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, TouchableOpacity } from "react-native";

import {
    getLanguageButtonPositionStyle,
    getRowDirectionStyle,
} from "@/src/styles/globalStyles";
import { useAppTheme } from "@/src/theme/ThemeProvider";

export default function LanguageButton({
    disabled = false,
    style,
    withPosition = true,
    size = 44,
}) {
    const { i18n } = useTranslation();
    const { colors } = useAppTheme();

    const styles = createStyles(colors, size);

    const isArabic = i18n.language === "ar";

    const toggleLanguage = async () => {
        const nextLanguage = isArabic ? "en" : "ar";

        await AsyncStorage.setItem("appLanguage", nextLanguage);
        await i18n.changeLanguage(nextLanguage);
    };

    return (
        <TouchableOpacity
            activeOpacity={0.85}
            style={[
                styles.languageButton,
                getRowDirectionStyle(isArabic),
                withPosition && getLanguageButtonPositionStyle(isArabic),
                style,
            ]}
            onPress={toggleLanguage}
            disabled={disabled}
        >
            <MaterialIcons
                name="language"
                size={22}
                color={colors.textPrimary}
            />

            <Text style={styles.languageText}>
                {isArabic ? "EN" : "AR"}
            </Text>
        </TouchableOpacity>
    );
}

const createStyles = (colors, size) =>
    StyleSheet.create({
        languageButton: {
            minWidth: size,
            height: size,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            paddingHorizontal: 8,
            borderRadius: 18,
            backgroundColor: colors.cardSoft,
            borderWidth: 1,
            borderColor: colors.border,
        },

        languageText: {
            color: colors.textPrimary,
            fontSize: 15,
            fontWeight: "800",
            letterSpacing: 0.5,
        },
    });

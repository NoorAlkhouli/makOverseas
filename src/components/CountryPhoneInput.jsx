import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import {
    FlatList,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

import {
    getInputLanguageStyle,
    getRowDirectionStyle,
    getTextDirectionStyle,
} from "@/src/styles/globalStyles";
import { useAppTheme } from "@/src/theme/ThemeProvider";

const COUNTRIES = [
    { name: "Lebanon", nameAr: "لبنان", code: "+961", flag: "🇱🇧" },
    { name: "Syria", nameAr: "سوريا", code: "+963", flag: "🇸🇾" },
    { name: "United Arab Emirates", nameAr: "الإمارات", code: "+971", flag: "🇦🇪" },
    { name: "Saudi Arabia", nameAr: "السعودية", code: "+966", flag: "🇸🇦" },
    { name: "Kuwait", nameAr: "الكويت", code: "+965", flag: "🇰🇼" },
    { name: "Qatar", nameAr: "قطر", code: "+974", flag: "🇶🇦" },
    { name: "Iraq", nameAr: "العراق", code: "+964", flag: "🇮🇶" },
    { name: "Jordan", nameAr: "الأردن", code: "+962", flag: "🇯🇴" },
    { name: "Turkey", nameAr: "تركيا", code: "+90", flag: "🇹🇷" },
    { name: "Albania", nameAr: "ألبانيا", code: "+355", flag: "🇦🇱" },
    { name: "Egypt", nameAr: "مصر", code: "+20", flag: "🇪🇬" },
    { name: "United States", nameAr: "أمريكا", code: "+1", flag: "🇺🇸" },
];

export default function CountryPhoneInput({
    value,
    onChangeText,
    selectedCountry,
    onChangeCountry,
    placeholder,
    disabled = false,
    isArabic = false,
}) {
    const [modalVisible, setModalVisible] = useState(false);

    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const convertArabicDigitsToEnglish = (text) => {
        return text
            .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 1632))
            .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 1776));
    };

    const handlePhoneChange = (text) => {
        const englishDigitsText = convertArabicDigitsToEnglish(text);
        const onlyNumbers = englishDigitsText.replace(/[^0-9]/g, "");

        onChangeText(onlyNumbers);
    };

    const handleSelectCountry = (country) => {
        onChangeCountry(country);
        setModalVisible(false);
    };

    return (
        <>
            <View style={[styles.phoneInputBox, getRowDirectionStyle(isArabic)]}>
                {/* <Ionicons name="call-outline" size={25} color={colors.primary} /> */}

                <Pressable
                    style={styles.countryButton}
                    onPress={() => setModalVisible(true)}
                    disabled={disabled}
                >
                    <Text style={styles.countryText}>
                        {selectedCountry.flag} {selectedCountry.code}
                    </Text>

                    <Ionicons
                        name="chevron-down"
                        size={18}
                        color={colors.textPrimary}
                    />
                </Pressable>

                <View style={styles.phoneDivider} />

                <TextInput
                    value={value}
                    onChangeText={handlePhoneChange}
                    placeholder={placeholder}
                    placeholderTextColor={colors.textMuted}
                    style={[styles.phoneInput, getInputLanguageStyle(isArabic)]}
                    keyboardType="phone-pad"
                    editable={!disabled}
                    textAlign={isArabic ? "right" : "left"}
                    returnKeyType="done"
                />
            </View>

            <Modal
                visible={modalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setModalVisible(false)}
            >
                <Pressable
                    style={styles.modalOverlay}
                    onPress={() => setModalVisible(false)}
                >
                    <Pressable style={styles.countryModalBox}>
                        <Text style={[styles.modalTitle, getTextDirectionStyle(isArabic)]}>
                            {isArabic ? "اختاري رمز البلد" : "Select country code"}
                        </Text>

                        <FlatList
                            data={COUNTRIES}
                            keyExtractor={(item) => `${item.code}-${item.name}`}
                            showsVerticalScrollIndicator={false}
                            renderItem={({ item }) => {
                                const isSelected = item.code === selectedCountry.code;

                                return (
                                    <TouchableOpacity
                                        activeOpacity={0.82}
                                        style={[
                                            styles.countryItem,
                                            getRowDirectionStyle(isArabic),
                                            isSelected && styles.selectedCountryItem,
                                        ]}
                                        onPress={() => handleSelectCountry(item)}
                                    >
                                        <Text style={styles.countryFlag}>{item.flag}</Text>

                                        <View style={styles.countryInfo}>
                                            <Text
                                                style={[
                                                    styles.countryName,
                                                    getTextDirectionStyle(isArabic),
                                                ]}
                                            >
                                                {isArabic ? item.nameAr : item.name}
                                            </Text>

                                            <Text
                                                style={[
                                                    styles.countryCode,
                                                    getTextDirectionStyle(isArabic),
                                                ]}
                                            >
                                                {item.code}
                                            </Text>
                                        </View>

                                        {isSelected && (
                                            <Ionicons
                                                name="checkmark-circle"
                                                size={23}
                                                color={colors.primary}
                                            />
                                        )}
                                    </TouchableOpacity>
                                );
                            }}
                        />
                    </Pressable>
                </Pressable>
            </Modal>
        </>
    );
}

export { COUNTRIES };

const createStyles = (colors) =>
    StyleSheet.create({
        phoneInputBox: {
            height: 66,
            borderWidth: 1.3,
            borderColor: colors.inputBorder,
            borderRadius: 20,
            backgroundColor: colors.inputBackground,
            flexDirection: "row",
            alignItems: "center",

            // خففناها لأن الأيقونة انشالت
            paddingLeft: 18,
            paddingRight: 14,

            marginBottom: 16,
        },

        countryButton: {
            // خففنا العرض حتى نترك مساحة أكبر للرقم
            minWidth: 82,
            height: 42,
            borderRadius: 14,
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "row",

            // gap أقل حتى الرمز والسهم ما ياخدوا مساحة كبيرة
            gap: 4,

            // بدل marginHorizontal كبير
            marginRight: 6,
            marginLeft: 0,
        },

        countryText: {
            color: colors.textPrimary,

            // كان 16، صغرناه شوي
            fontSize: 14,
            fontWeight: "800",
        },

        phoneDivider: {
            width: 1,
            height: 30,
            backgroundColor: colors.inputBorder,
            opacity: 0.75,

            // خففنا الفراغ حوالين الخط
            marginLeft: 4,
            marginRight: 8,
        },

        phoneInput: {
            flex: 1,
            color: colors.textPrimary,

            // كان 18، صغرناه حتى placeholder يبين كامل
            fontSize: 15.5,
            fontWeight: "700",
            paddingVertical: 0,

            // مهم بالأندرويد حتى ما يعمل فراغ داخلي غريب
            includeFontPadding: false,
        },

        modalOverlay: {
            flex: 1,
            backgroundColor: "rgba(0, 0, 0, 0.55)",
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 24,
        },

        countryModalBox: {
            width: "100%",
            maxHeight: "70%",
            borderRadius: 24,
            backgroundColor: colors.cardStrong,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 18,
        },

        modalTitle: {
            color: colors.textPrimary,
            fontSize: 22,
            fontWeight: "900",
            marginBottom: 14,
        },

        countryItem: {
            minHeight: 64,
            borderRadius: 18,
            paddingHorizontal: 14,
            paddingVertical: 10,
            alignItems: "center",
            marginBottom: 8,
            backgroundColor: colors.cardSoft,
            borderWidth: 1,
            borderColor: colors.borderSoft,
        },

        selectedCountryItem: {
            borderColor: colors.primary,
            backgroundColor: colors.primarySoft,
        },

        countryFlag: {
            fontSize: 28,
            marginHorizontal: 10,
        },

        countryInfo: {
            flex: 1,
        },

        countryName: {
            color: colors.textPrimary,
            fontSize: 16,
            fontWeight: "800",
        },

        countryCode: {
            color: colors.primary,
            fontSize: 14,
            fontWeight: "800",
            marginTop: 2,
        },
    });
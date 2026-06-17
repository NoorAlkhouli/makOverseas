import {
    getRowDirectionStyle,
    getTextDirectionStyle,
} from "@/src/styles/globalStyles";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const DEFAULT_FORM_STATE = {
    riskLevel: "1",
    originCity: "",
    originCountry: "",
    destinationCity: "",
    destinationCountry: "",
    cargoType: "",
    containerType: "",
    volumeCbm: "",
    weightKg: "",
    etdDate: "",
    etaDate: "",
    currency: "",
    totalPrice: "",
    validUntil: "",
    includes: "",
    notes: "",
};

const getThemeColor = (colors = {}, key, fallbackKey, fallbackValue = "") => {
    return colors?.[key] || colors?.[fallbackKey] || fallbackValue;
};

const getTextColor = (colors = {}) =>
    getThemeColor(colors, "text", "textPrimary", "#061526");

const getMutedColor = (colors = {}) =>
    getThemeColor(colors, "muted", "textMuted", "#64748b");

const getCardColor = (colors = {}) =>
    getThemeColor(colors, "cardStrong", "card", "#ffffff");

const getCardSoftColor = (colors = {}) =>
    getThemeColor(colors, "cardSoft", "buttonSoft", "rgba(6, 21, 38, 0.06)");

const getInputColor = (colors = {}) =>
    getThemeColor(colors, "input", "inputBackground", "#ffffff");

const getInputBorderColor = (colors = {}) =>
    getThemeColor(colors, "inputBorder", "border", "rgba(6, 21, 38, 0.14)");

const getBorderColor = (colors = {}) =>
    getThemeColor(colors, "border", "borderSoft", "rgba(6, 21, 38, 0.14)");

const getPrimaryColor = (colors = {}) =>
    getThemeColor(colors, "primary", "blue", "#51a234");

const getBlueColor = (colors = {}) =>
    getThemeColor(colors, "blue", "primary", "#087BFF");

const getDangerColor = (colors = {}) =>
    getThemeColor(colors, "danger", "warning", "#E3342F");

const normalizeString = (value = "") => String(value || "").trim();

const normalizeCountryCode = (value = "") => {
    return normalizeString(value).toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3);
};

const normalizeCurrencyCode = (value = "") => {
    return normalizeString(value)
        .toUpperCase()
        .replace(/[^A-Z]/g, "")
        .slice(0, 5);
};

const normalizeNumberString = (value = "") => {
    const cleanValue = String(value || "")
        .replace(",", ".")
        .replace(/[^0-9.]/g, "");

    const parts = cleanValue.split(".");

    if (parts.length <= 2) {
        return cleanValue;
    }

    return `${parts[0]}.${parts.slice(1).join("")}`;
};

const padDatePart = (value = "", length = 2) => {
    return String(value || "").padStart(length, "0");
};

const normalizeDateString = (value = "") => {
    const rawValue = String(value || "")
        .replace(/[^\d/-]/g, "")
        .replace(/\//g, "-");

    const yearFirstMatch = rawValue.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);

    if (yearFirstMatch) {
        const [, year, month, day] = yearFirstMatch;
        return `${padDatePart(day)}-${padDatePart(month)}-${year}`;
    }

    const dayFirstMatch = rawValue.match(/^(\d{1,2})-(\d{1,2})-(\d{1,4})$/);

    if (dayFirstMatch) {
        const [, day, month, year] = dayFirstMatch;
        return [
            day.slice(0, 2),
            month.slice(0, 2),
            year.slice(0, 4),
        ]
            .filter(Boolean)
            .join("-");
    }

    const digitsOnly = rawValue.replace(/\D/g, "").slice(0, 8);

    if (digitsOnly.length <= 2) {
        return digitsOnly;
    }

    if (digitsOnly.length <= 4) {
        return `${digitsOnly.slice(0, 2)}-${digitsOnly.slice(2)}`;
    }

    return `${digitsOnly.slice(0, 2)}-${digitsOnly.slice(2, 4)}-${digitsOnly.slice(4, 8)}`;
};

const getDatePartsFromValue = (value = "") => {
    const rawValue = normalizeString(value).replace(/\//g, "-");

    if (!rawValue) {
        return null;
    }

    const yearFirstMatch = rawValue.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);

    if (yearFirstMatch) {
        return {
            year: Number(yearFirstMatch[1]),
            month: Number(yearFirstMatch[2]),
            day: Number(yearFirstMatch[3]),
        };
    }

    const dayFirstMatch = rawValue.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);

    if (dayFirstMatch) {
        return {
            day: Number(dayFirstMatch[1]),
            month: Number(dayFirstMatch[2]),
            year: Number(dayFirstMatch[3]),
        };
    }

    const digitsOnly = rawValue.replace(/\D/g, "");

    if (digitsOnly.length !== 8) {
        return null;
    }

    const dayFirstParts = {
        day: Number(digitsOnly.slice(0, 2)),
        month: Number(digitsOnly.slice(2, 4)),
        year: Number(digitsOnly.slice(4, 8)),
    };

    if (isValidDateParts(dayFirstParts)) {
        return dayFirstParts;
    }

    return {
        year: Number(digitsOnly.slice(0, 4)),
        month: Number(digitsOnly.slice(4, 6)),
        day: Number(digitsOnly.slice(6, 8)),
    };
};

const isValidDateParts = (parts) => {
    if (!parts) {
        return false;
    }

    const { year, month, day } = parts;

    if (
        !Number.isInteger(year) ||
        !Number.isInteger(month) ||
        !Number.isInteger(day) ||
        year < 1900 ||
        year > 2200 ||
        month < 1 ||
        month > 12 ||
        day < 1 ||
        day > 31
    ) {
        return false;
    }

    const date = new Date(year, month - 1, day);

    return (
        date.getFullYear() === year &&
        date.getMonth() === month - 1 &&
        date.getDate() === day
    );
};

const toApiDateString = (value = "") => {
    const parts = getDatePartsFromValue(normalizeDateString(value));

    if (!isValidDateParts(parts)) {
        return "";
    }

    return `${parts.year}-${padDatePart(parts.month)}-${padDatePart(parts.day)}`;
};


const normalizeIncludesArray = (value = "") => {
    return String(value || "")
        .split(/\r?\n|,/)
        .map((item) => item.trim())
        .filter(Boolean);
};

const isValidDateValue = (value) => {
    const cleanValue = normalizeString(value);

    if (!cleanValue) {
        return true;
    }

    return !!toApiDateString(cleanValue);
};

const isValidCountryCode = (value) => {
    const cleanValue = normalizeCountryCode(value);

    return /^[A-Z]{2,3}$/.test(cleanValue);
};

const isValidCurrencyCode = (value) => {
    const cleanValue = normalizeCurrencyCode(value);

    return /^[A-Z]{2,5}$/.test(cleanValue);
};

const buildQuotePayloadFromForm = (form) => {
    const payload = {
        riskLevel: Number(form.riskLevel || 1),
        originCity: normalizeString(form.originCity),
        originCountry: normalizeCountryCode(form.originCountry),
        destinationCity: normalizeString(form.destinationCity),
        destinationCountry: normalizeCountryCode(form.destinationCountry),
        cargoType: normalizeString(form.cargoType),
        containerType: normalizeString(form.containerType),
        volumeCbm: form.volumeCbm ? Number(form.volumeCbm) : undefined,
        weightKg: form.weightKg ? Number(form.weightKg) : undefined,
        etdDate: toApiDateString(form.etdDate),
        etaDate: toApiDateString(form.etaDate),
        currency: normalizeCurrencyCode(form.currency),
        totalPrice: Number(form.totalPrice),
        validUntil: toApiDateString(form.validUntil),
        includes: normalizeIncludesArray(form.includes),
        notes: normalizeString(form.notes),
    };

    Object.keys(payload).forEach((key) => {
        if (
            payload[key] === undefined ||
            payload[key] === null ||
            payload[key] === "" ||
            (Array.isArray(payload[key]) && payload[key].length === 0)
        ) {
            delete payload[key];
        }
    });

    return payload;
};

const validateQuoteForm = ({ form, tr }) => {
    const requiredFields = [
        {
            key: "originCity",
            label: tr("originCity", "Origin City"),
        },
        {
            key: "originCountry",
            label: tr("originCountry", "Origin Country"),
        },
        {
            key: "destinationCity",
            label: tr("destinationCity", "Destination City"),
        },
        {
            key: "destinationCountry",
            label: tr("destinationCountry", "Destination Country"),
        },
        {
            key: "cargoType",
            label: tr("cargoType", "Cargo Type"),
        },
        {
            key: "currency",
            label: tr("currency", "Currency"),
        },
        {
            key: "totalPrice",
            label: tr("totalPrice", "Total Price"),
        },
    ];

    const missingField = requiredFields.find((field) => {
        return !normalizeString(form[field.key]);
    });

    if (missingField) {
        return {
            isValid: false,
            message: `${missingField.label} ${tr("isRequired", "is required")}`,
        };
    }

    if (!isValidCountryCode(form.originCountry)) {
        return {
            isValid: false,
            message: tr(
                "invalidOriginCountry",
                "Origin country must be 2 or 3 letters, like CN or CHN."
            ),
        };
    }

    if (!isValidCountryCode(form.destinationCountry)) {
        return {
            isValid: false,
            message: tr(
                "invalidDestinationCountry",
                "Destination country must be 2 or 3 letters, like AE or UAE."
            ),
        };
    }

    if (!isValidCurrencyCode(form.currency)) {
        return {
            isValid: false,
            message: tr(
                "invalidCurrency",
                "Currency must be a valid code like USD, AED, SYP, EGP, LBP, or ALL."
            ),
        };
    }

    const riskLevel = Number(form.riskLevel || 1);

    if (!Number.isInteger(riskLevel) || riskLevel < 1 || riskLevel > 5) {
        return {
            isValid: false,
            message: tr("invalidRiskLevel", "Risk level must be between 1 and 5."),
        };
    }

    const totalPrice = Number(form.totalPrice);

    if (!Number.isFinite(totalPrice) || totalPrice <= 0) {
        return {
            isValid: false,
            message: tr("invalidTotalPrice", "Total price must be greater than 0."),
        };
    }

    if (
        form.volumeCbm &&
        (!Number.isFinite(Number(form.volumeCbm)) || Number(form.volumeCbm) < 0)
    ) {
        return {
            isValid: false,
            message: tr("invalidVolume", "Volume must be a valid number."),
        };
    }

    if (
        form.weightKg &&
        (!Number.isFinite(Number(form.weightKg)) || Number(form.weightKg) < 0)
    ) {
        return {
            isValid: false,
            message: tr("invalidWeight", "Weight must be a valid number."),
        };
    }

    if (!isValidDateValue(form.etdDate)) {
        return {
            isValid: false,
            message: tr("invalidEtdDateDayFirst", "ETD date must be DD-MM-YYYY."),
        };
    }

    if (!isValidDateValue(form.etaDate)) {
        return {
            isValid: false,
            message: tr("invalidEtaDateDayFirst", "ETA date must be DD-MM-YYYY."),
        };
    }

    if (!isValidDateValue(form.validUntil)) {
        return {
            isValid: false,
            message: tr("invalidValidUntilDayFirst", "Valid until date must be DD-MM-YYYY."),
        };
    }

    return {
        isValid: true,
        message: "",
    };
};

export default function QuoteFormModal({
    visible,
    colors,
    tr,
    isArabic,
    isSubmitting = false,
    onClose,
    onSubmit,
}) {
    const insets = useSafeAreaInsets();
    const [form, setForm] = useState(DEFAULT_FORM_STATE);

    const theme = useMemo(
        () => ({
            text: getTextColor(colors),
            muted: getMutedColor(colors),
            card: getCardColor(colors),
            cardSoft: getCardSoftColor(colors),
            input: getInputColor(colors),
            inputBorder: getInputBorderColor(colors),
            border: getBorderColor(colors),
            primary: getPrimaryColor(colors),
            blue: getBlueColor(colors),
            danger: getDangerColor(colors),
            overlay: getThemeColor(colors, "modalOverlay", "overlay", "rgba(0,0,0,0.55)"),
            darkText: getThemeColor(colors, "darkText", "textPrimary", "#03101f"),
        }),
        [colors]
    );

    const updateFormField = (key, value) => {
        setForm((currentForm) => ({
            ...currentForm,
            [key]: value,
        }));
    };

    const updateDateFormField = (key, value) => {
        updateFormField(key, normalizeDateString(value));
    };

    const handleClose = () => {
        if (isSubmitting) {
            return;
        }

        onClose?.();
    };

    const handleSubmit = async () => {
        const validation = validateQuoteForm({ form, tr });

        if (!validation.isValid) {
            Alert.alert(
                tr("quoteFormValidationTitle", "Check quote details"),
                validation.message
            );
            return;
        }

        const payload = buildQuotePayloadFromForm(form);
        const submitted = await onSubmit?.(payload);

        if (submitted !== false) {
            setForm(DEFAULT_FORM_STATE);
        }
    };

    if (!visible) {
        return null;
    }

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={handleClose}
            statusBarTranslucent
            navigationBarTranslucent
            presentationStyle="overFullScreen"
        >
            <View style={[styles.overlay, { backgroundColor: theme.overlay }]}>
                <KeyboardAvoidingView
                    style={styles.keyboardView}
                    behavior={Platform.OS === "ios" ? "padding" : undefined}
                >
                    <View
                        style={[
                            styles.card,
                            {
                                backgroundColor: theme.card,
                                borderColor: theme.border,
                                paddingBottom: Math.max(insets.bottom, 14),
                            },
                        ]}
                    >
                        <View style={[styles.header, getRowDirectionStyle(isArabic)]}>
                            <View style={styles.headerTitleWrapper}>
                                <Text
                                    style={[
                                        styles.title,
                                        { color: theme.text },
                                        getTextDirectionStyle(isArabic),
                                    ]}
                                >
                                    {tr("createQuote", "Create Quote")}
                                </Text>

                                <Text
                                    style={[
                                        styles.subtitle,
                                        { color: theme.muted },
                                        getTextDirectionStyle(isArabic),
                                    ]}
                                >
                                    {tr(
                                        "createQuoteSubtitle",
                                        "Fill shipment pricing details and send it to the customer."
                                    )}
                                </Text>
                            </View>

                            <TouchableOpacity
                                style={[
                                    styles.closeButton,
                                    {
                                        backgroundColor: theme.cardSoft,
                                        borderColor: theme.border,
                                    },
                                ]}
                                activeOpacity={0.8}
                                onPress={handleClose}
                                disabled={isSubmitting}
                            >
                                <Ionicons name="close" size={24} color={theme.text} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            style={styles.scroll}
                            contentContainerStyle={styles.scrollContent}
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator={false}
                        >
                            <SectionTitle
                                icon="map-marker-path"
                                title={tr("routeDetails", "Route Details")}
                                theme={theme}
                                isArabic={isArabic}
                            />

                            <View style={styles.row}>
                                <Field
                                    label={tr("originCity", "Origin City")}
                                    value={form.originCity}
                                    placeholder="Shanghai"
                                    onChangeText={(value) => updateFormField("originCity", value)}
                                    theme={theme}
                                    isArabic={isArabic}
                                    containerStyle={styles.flexField}
                                    editable={!isSubmitting}
                                />

                                <Field
                                    label={tr("originCountry", "Origin Country")}
                                    value={form.originCountry}
                                    placeholder="CN"
                                    onChangeText={(value) =>
                                        updateFormField("originCountry", normalizeCountryCode(value))
                                    }
                                    theme={theme}
                                    isArabic={isArabic}
                                    containerStyle={styles.smallField}
                                    autoCapitalize="characters"
                                    editable={!isSubmitting}
                                />
                            </View>

                            <View style={styles.row}>
                                <Field
                                    label={tr("destinationCity", "Destination City")}
                                    value={form.destinationCity}
                                    placeholder="Dubai"
                                    onChangeText={(value) =>
                                        updateFormField("destinationCity", value)
                                    }
                                    theme={theme}
                                    isArabic={isArabic}
                                    containerStyle={styles.flexField}
                                    editable={!isSubmitting}
                                />

                                <Field
                                    label={tr("destinationCountry", "Destination Country")}
                                    value={form.destinationCountry}
                                    placeholder="AE"
                                    onChangeText={(value) =>
                                        updateFormField(
                                            "destinationCountry",
                                            normalizeCountryCode(value)
                                        )
                                    }
                                    theme={theme}
                                    isArabic={isArabic}
                                    containerStyle={styles.smallField}
                                    autoCapitalize="characters"
                                    editable={!isSubmitting}
                                />
                            </View>

                            <SectionTitle
                                icon="package-variant-closed"
                                title={tr("shipmentDetails", "Shipment Details")}
                                theme={theme}
                                isArabic={isArabic}
                            />

                            <Field
                                label={tr("cargoType", "Cargo Type")}
                                value={form.cargoType}
                                placeholder={tr("cargoTypePlaceholder", "General Cargo")}
                                onChangeText={(value) => updateFormField("cargoType", value)}
                                theme={theme}
                                isArabic={isArabic}
                                editable={!isSubmitting}
                            />

                            <View style={styles.row}>
                                <Field
                                    label={tr("container", "Container")}
                                    value={form.containerType}
                                    placeholder="20ft FCL"
                                    onChangeText={(value) =>
                                        updateFormField("containerType", value)
                                    }
                                    theme={theme}
                                    isArabic={isArabic}
                                    containerStyle={styles.flexField}
                                    editable={!isSubmitting}
                                />

                                <Field
                                    label={tr("riskLevel", "Risk")}
                                    value={form.riskLevel}
                                    placeholder="1"
                                    onChangeText={(value) =>
                                        updateFormField(
                                            "riskLevel",
                                            value.replace(/[^0-9]/g, "").slice(0, 1)
                                        )
                                    }
                                    theme={theme}
                                    isArabic={isArabic}
                                    containerStyle={styles.smallField}
                                    keyboardType="numbers-and-punctuation"
                                    editable={!isSubmitting}
                                />
                            </View>

                            <View style={styles.row}>
                                <Field
                                    label={tr("volumeCbm", "Volume CBM")}
                                    value={form.volumeCbm}
                                    placeholder="12"
                                    onChangeText={(value) =>
                                        updateFormField("volumeCbm", normalizeNumberString(value))
                                    }
                                    theme={theme}
                                    isArabic={isArabic}
                                    containerStyle={styles.flexField}
                                    keyboardType="decimal-pad"
                                    editable={!isSubmitting}
                                />

                                <Field
                                    label={tr("weightKg", "Weight KG")}
                                    value={form.weightKg}
                                    placeholder="8000"
                                    onChangeText={(value) =>
                                        updateFormField("weightKg", normalizeNumberString(value))
                                    }
                                    theme={theme}
                                    isArabic={isArabic}
                                    containerStyle={styles.flexField}
                                    keyboardType="decimal-pad"
                                    editable={!isSubmitting}
                                />
                            </View>

                            <SectionTitle
                                icon="calendar-clock"
                                title={tr("scheduleDetails", "Schedule Details")}
                                theme={theme}
                                isArabic={isArabic}
                            />

                            <View style={styles.row}>
                                <Field
                                    label="ETD"
                                    value={form.etdDate}
                                    placeholder="20-10-2026"
                                    onChangeText={(value) => updateDateFormField("etdDate", value)}
                                    theme={theme}
                                    isArabic={isArabic}
                                    containerStyle={styles.flexField}
                                    keyboardType="numbers-and-punctuation"
                                    editable={!isSubmitting}
                                />

                                <Field
                                    label="ETA"
                                    value={form.etaDate}
                                    placeholder="30-10-2026"
                                    onChangeText={(value) => updateDateFormField("etaDate", value)}
                                    theme={theme}
                                    isArabic={isArabic}
                                    containerStyle={styles.flexField}
                                    keyboardType="numbers-and-punctuation"
                                    editable={!isSubmitting}
                                />
                            </View>

                            <SectionTitle
                                icon="cash-multiple"
                                title={tr("priceDetails", "Price Details")}
                                theme={theme}
                                isArabic={isArabic}
                            />

                            <View style={styles.row}>
                                <Field
                                    label={tr("currency", "Currency")}
                                    value={form.currency}
                                    placeholder="USD / AED / SYP"
                                    onChangeText={(value) =>
                                        updateFormField("currency", normalizeCurrencyCode(value))
                                    }
                                    theme={theme}
                                    isArabic={isArabic}
                                    containerStyle={styles.currencyField}
                                    autoCapitalize="characters"
                                    editable={!isSubmitting}
                                />

                                <Field
                                    label={tr("totalPrice", "Total Price")}
                                    value={form.totalPrice}
                                    placeholder="1250"
                                    onChangeText={(value) =>
                                        updateFormField("totalPrice", normalizeNumberString(value))
                                    }
                                    theme={theme}
                                    isArabic={isArabic}
                                    containerStyle={styles.flexField}
                                    keyboardType="decimal-pad"
                                    editable={!isSubmitting}
                                />
                            </View>

                            <Field
                                label={tr("validUntil", "Valid Until")}
                                value={form.validUntil}
                                placeholder="09-01-2027"
                                onChangeText={(value) => updateDateFormField("validUntil", value)}
                                theme={theme}
                                isArabic={isArabic}
                                keyboardType="numbers-and-punctuation"
                                editable={!isSubmitting}
                            />

                            <Field
                                label={tr("includes", "Includes")}
                                value={form.includes}
                                placeholder={tr(
                                    "includesPlaceholder",
                                    "Ocean Freight\nTerminal Handling\nDocumentation"
                                )}
                                onChangeText={(value) => updateFormField("includes", value)}
                                theme={theme}
                                isArabic={isArabic}
                                multiline
                                inputStyle={styles.multilineInput}
                                editable={!isSubmitting}
                            />

                            <Field
                                label={tr("notes", "Notes")}
                                value={form.notes}
                                placeholder={tr(
                                    "notesPlaceholder",
                                    "Optional notes for the customer"
                                )}
                                onChangeText={(value) => updateFormField("notes", value)}
                                theme={theme}
                                isArabic={isArabic}
                                multiline
                                inputStyle={styles.multilineInput}
                                editable={!isSubmitting}
                            />
                        </ScrollView>

                        <View style={[styles.footer, { borderTopColor: theme.border }]}>
                            <TouchableOpacity
                                style={[
                                    styles.secondaryButton,
                                    {
                                        backgroundColor: theme.cardSoft,
                                        borderColor: theme.border,
                                    },
                                ]}
                                activeOpacity={0.85}
                                onPress={handleClose}
                                disabled={isSubmitting}
                            >
                                <Text
                                    style={[
                                        styles.secondaryButtonText,
                                        { color: theme.text },
                                    ]}
                                >
                                    {tr("cancel", "Cancel")}
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[
                                    styles.primaryButton,
                                    { backgroundColor: theme.primary },
                                    isSubmitting && styles.disabledButton,
                                ]}
                                activeOpacity={0.85}
                                onPress={handleSubmit}
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <>
                                        <Ionicons name="send" size={18} color="#FFFFFF" />
                                        <Text style={styles.primaryButtonText}>
                                            {tr("sendQuote", "Send Quote")}
                                        </Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
}

function SectionTitle({ icon, title, theme, isArabic }) {
    return (
        <View style={[styles.sectionTitleRow, getRowDirectionStyle(isArabic)]}>
            <MaterialCommunityIcons name={icon} size={20} color={theme.primary} />

            <Text
                style={[
                    styles.sectionTitleText,
                    { color: theme.primary },
                    getTextDirectionStyle(isArabic),
                ]}
            >
                {title}
            </Text>
        </View>
    );
}

function Field({
    label,
    value,
    placeholder,
    onChangeText,
    theme,
    isArabic,
    containerStyle,
    inputStyle,
    multiline = false,
    editable = true,
    keyboardType,
    autoCapitalize = "none",
}) {
    return (
        <View style={[styles.field, containerStyle]}>
            <Text
                style={[
                    styles.fieldLabel,
                    { color: theme.muted },
                    getTextDirectionStyle(isArabic),
                ]}
                numberOfLines={1}
            >
                {label}
            </Text>

            <TextInput
                value={value}
                placeholder={placeholder}
                placeholderTextColor={theme.muted}
                onChangeText={onChangeText}
                editable={editable}
                keyboardType={keyboardType}
                autoCapitalize={autoCapitalize}
                multiline={multiline}
                textAlign={isArabic ? "right" : "left"}
                style={[
                    styles.input,
                    multiline && styles.inputMultiline,
                    inputStyle,
                    {
                        color: theme.text,
                        backgroundColor: theme.input,
                        borderColor: theme.inputBorder,
                        opacity: editable ? 1 : 0.7,
                        writingDirection: isArabic ? "rtl" : "ltr",
                    },
                ]}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: "flex-end",
    },

    keyboardView: {
        flex: 1,
        justifyContent: "flex-end",
    },

    card: {
        width: "100%",
        maxHeight: "92%",
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        borderWidth: 1,
        overflow: "hidden",
    },

    header: {
        minHeight: 82,
        paddingHorizontal: 18,
        paddingTop: 18,
        paddingBottom: 12,
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 12,
    },

    headerTitleWrapper: {
        flex: 1,
        minWidth: 0,
    },

    title: {
        fontSize: 20,
        fontWeight: "900",
    },

    subtitle: {
        marginTop: 4,
        fontSize: 12.5,
        fontWeight: "700",
        lineHeight: 18,
    },

    closeButton: {
        width: 42,
        height: 42,
        borderRadius: 21,
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
    },

    scroll: {
        flexGrow: 0,
    },

    scrollContent: {
        paddingHorizontal: 18,
        paddingTop: 4,
        paddingBottom: 14,
    },

    sectionTitleRow: {
        marginTop: 14,
        marginBottom: 10,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },

    sectionTitleText: {
        flex: 1,
        minWidth: 0,
        fontSize: 15,
        fontWeight: "900",
    },

    row: {
        flexDirection: "row",
        gap: 10,
    },

    field: {
        marginBottom: 12,
    },

    flexField: {
        flex: 1,
        minWidth: 0,
    },

    smallField: {
        width: 96,
        flexShrink: 0,
    },

    currencyField: {
        width: 124,
        flexShrink: 0,
    },

    fieldLabel: {
        marginBottom: 6,
        fontSize: 12,
        fontWeight: "900",
    },

    input: {
        minHeight: 48,
        borderWidth: 1,
        borderRadius: 15,
        paddingHorizontal: 13,
        paddingVertical: Platform.OS === "ios" ? 12 : 8,
        fontSize: 14.5,
        fontWeight: "700",
    },

    inputMultiline: {
        minHeight: 88,
        maxHeight: 132,
        textAlignVertical: "top",
    },

    multilineInput: {
        lineHeight: 20,
    },

    footer: {
        borderTopWidth: 1,
        paddingHorizontal: 18,
        paddingTop: 12,
        flexDirection: "row",
        gap: 10,
    },

    secondaryButton: {
        flex: 1,
        height: 50,
        borderRadius: 17,
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
    },

    secondaryButtonText: {
        fontSize: 15,
        fontWeight: "900",
    },

    primaryButton: {
        flex: 1.4,
        height: 50,
        borderRadius: 17,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
    },

    primaryButtonText: {
        color: "#FFFFFF",
        fontSize: 15,
        fontWeight: "900",
    },

    disabledButton: {
        opacity: 0.72,
    },
});
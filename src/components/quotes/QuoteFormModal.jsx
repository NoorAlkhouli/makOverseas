import {
    getRowDirectionStyle,
    getTextDirectionStyle,
} from "@/src/styles/globalStyles";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    useWindowDimensions,
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

const QUOTE_RISK_OPTIONS = [
    { value: "1", translationKey: "riskLow", fallback: "Low", arabicFallback: "منخفض" },
    { value: "2", translationKey: "riskMedium", fallback: "Medium", arabicFallback: "متوسط" },
    { value: "3", translationKey: "riskHigh", fallback: "High", arabicFallback: "مرتفع" },
    { value: "4", translationKey: "riskCritical", fallback: "Critical", arabicFallback: "حرج" },
];
const CURRENCY_OPTIONS = [
    { value: "SYP", label: "SYP" },
    { value: "USD", label: "USD" },
    { value: "AED", label: "AED" },
    { value: "EGP", label: "EGP" },
    { value: "LBP", label: "LBP" },
];

const DATE_FIELD_LABELS = {
    etdDate: "ETD",
    etaDate: "ETA",
    validUntil: "Valid Until",
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
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return `${value.getFullYear()}-${padDatePart(value.getMonth() + 1)}-${padDatePart(value.getDate())}`;
    }

    const parts = getDatePartsFromValue(normalizeDateString(value));

    if (!isValidDateParts(parts)) {
        return "";
    }

    return `${parts.year}-${padDatePart(parts.month)}-${padDatePart(parts.day)}`;
};


const getDateOnly = (date = new Date()) => {
    const nextDate = date instanceof Date ? date : new Date(date);

    if (Number.isNaN(nextDate.getTime())) {
        return new Date();
    }

    return new Date(
        nextDate.getFullYear(),
        nextDate.getMonth(),
        nextDate.getDate()
    );
};

const addYears = (date, years = 1) => {
    const baseDate = getDateOnly(date);
    return new Date(
        baseDate.getFullYear() + years,
        baseDate.getMonth(),
        baseDate.getDate()
    );
};

const addMonths = (date, months = 1) => {
    const baseDate = getDateOnly(date);
    return new Date(
        baseDate.getFullYear(),
        baseDate.getMonth() + months,
        1
    );
};

const isSameDate = (firstDate, secondDate) => {
    if (!firstDate || !secondDate) return false;

    return (
        firstDate.getFullYear() === secondDate.getFullYear() &&
        firstDate.getMonth() === secondDate.getMonth() &&
        firstDate.getDate() === secondDate.getDate()
    );
};

const isBeforeDate = (firstDate, secondDate) => {
    if (!firstDate || !secondDate) return false;
    return getDateOnly(firstDate).getTime() < getDateOnly(secondDate).getTime();
};

const isAfterDate = (firstDate, secondDate) => {
    if (!firstDate || !secondDate) return false;
    return getDateOnly(firstDate).getTime() > getDateOnly(secondDate).getTime();
};

const getDateFromApiValue = (value = "") => {
    const apiDate = toApiDateString(value);

    if (!apiDate) return null;

    const [year, month, day] = apiDate.split("-").map(Number);
    const date = new Date(year, month - 1, day);

    return Number.isNaN(date.getTime()) ? null : date;
};

const getDatePickerRange = () => {
    const today = getDateOnly(new Date());
    const minDate = new Date(1900, 0, 1);
    const maxDate = new Date(2200, 11, 31);

    return { minDate, maxDate, today };
};

const getDatePickerInitialMonth = (value = "") => {
    const { minDate, maxDate, today } = getDatePickerRange();
    const selectedDate = getDateFromApiValue(value);

    if (selectedDate && !isBeforeDate(selectedDate, minDate) && !isAfterDate(selectedDate, maxDate)) {
        return new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    }

    return new Date(today.getFullYear(), today.getMonth(), 1);
};

const formatDateForDisplay = (value = "", isArabic = false) => {
    const date = getDateFromApiValue(value);

    if (!date) return "";

    return date.toLocaleDateString(isArabic ? "ar" : "en", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
};

const getCalendarDays = (displayMonth) => {
    const monthStart = new Date(displayMonth.getFullYear(), displayMonth.getMonth(), 1);
    const startOffset = monthStart.getDay();
    const gridStart = new Date(monthStart);
    gridStart.setDate(monthStart.getDate() - startOffset);

    return Array.from({ length: 42 }).map((_, index) => {
        const nextDate = new Date(gridStart);
        nextDate.setDate(gridStart.getDate() + index);
        return nextDate;
    });
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
                "Currency must be a valid code like USD, AED, SYP, EGP, LBP."
            ),
        };
    }

    const riskLevel = Number(form.riskLevel || 1);

    if (!Number.isInteger(riskLevel) || riskLevel < 1 || riskLevel > 4) {
        return {
            isValid: false,
            message: tr("invalidRiskLevel", "Risk level must be one of Low, Medium, High, or Critical."),
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
            message: tr("invalidEtdDateDayFirst", "ETD date must be selected from the calendar."),
        };
    }

    if (!isValidDateValue(form.etaDate)) {
        return {
            isValid: false,
            message: tr("invalidEtaDateDayFirst", "ETA date must be selected from the calendar."),
        };
    }

    if (!isValidDateValue(form.validUntil)) {
        return {
            isValid: false,
            message: tr("invalidValidUntilDayFirst", "Valid until date must be selected from the calendar."),
        };
    }

    const etdApiDate = toApiDateString(form.etdDate);
    const etaApiDate = toApiDateString(form.etaDate);

    if (etdApiDate && etaApiDate && etaApiDate < etdApiDate) {
        return {
            isValid: false,
            message: tr(
                "invalidEtaBeforeEtd",
                "ETA date must be after or equal to ETD date."
            ),
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
    const { height: windowHeight } = useWindowDimensions();
    const [form, setForm] = useState(DEFAULT_FORM_STATE);
    const [activeDateField, setActiveDateField] = useState(null);
    const [keyboardFrame, setKeyboardFrame] = useState({ height: 0, screenY: 0 });

    const isAndroidKeyboardVisible = Platform.OS === "android" && keyboardFrame.height > 0;
    const shouldLiftAndroidCard =
        isAndroidKeyboardVisible &&
        keyboardFrame.screenY > 0 &&
        keyboardFrame.screenY < windowHeight - 24;
    const androidKeyboardLift = shouldLiftAndroidCard
        ? Math.max(windowHeight - keyboardFrame.screenY - insets.bottom, 0)
        : 0;
    const androidKeyboardMaxHeight = isAndroidKeyboardVisible
        ? Math.max(
            (shouldLiftAndroidCard ? keyboardFrame.screenY : windowHeight) -
            Math.max(insets.top, 0) -
            8,
            320
        )
        : undefined;

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

    useEffect(() => {
        const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
        const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

        const showSubscription = Keyboard.addListener(showEvent, (event) => {
            setKeyboardFrame({
                height: event?.endCoordinates?.height || 0,
                screenY: event?.endCoordinates?.screenY || 0,
            });
        });

        const hideSubscription = Keyboard.addListener(hideEvent, () => {
            setKeyboardFrame({ height: 0, screenY: 0 });
        });

        return () => {
            showSubscription.remove();
            hideSubscription.remove();
        };
    }, []);

    const updateFormField = (key, value) => {
        setForm((currentForm) => ({
            ...currentForm,
            [key]: value,
        }));
    };

    const openDatePicker = (key) => {
        if (isSubmitting) return;
        setActiveDateField(key);
    };

    const closeDatePicker = () => {
        setActiveDateField(null);
    };

    const handleSelectDate = (date) => {
        if (!activeDateField || !date) return;
        updateFormField(activeDateField, toApiDateString(date));
        closeDatePicker();
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
                    keyboardVerticalOffset={0}
                >
                    <View
                        style={[
                            styles.card,
                            {
                                backgroundColor: theme.card,
                                borderColor: theme.border,
                                paddingBottom: isAndroidKeyboardVisible
                                    ? Math.max(insets.bottom, 8)
                                    : Math.max(insets.bottom, 14),
                                marginBottom: androidKeyboardLift,
                                maxHeight: isAndroidKeyboardVisible
                                    ? androidKeyboardMaxHeight
                                    : "84%",
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
                                        "Fill shipment pricing details and send the quote."
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
                            contentContainerStyle={[
                                styles.scrollContent,
                                isAndroidKeyboardVisible && styles.scrollContentKeyboardOpen,
                            ]}
                            keyboardShouldPersistTaps="handled"
                            keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
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

                                <RiskSelect
                                    label={tr("riskLevel", "Risk")}
                                    value={form.riskLevel}
                                    onChange={(value) => updateFormField("riskLevel", value)}
                                    theme={theme}
                                    tr={tr}
                                    isArabic={isArabic}
                                    containerStyle={styles.flexField}
                                    disabled={isSubmitting}
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
                                <DatePickerField
                                    label="ETD"
                                    value={form.etdDate}
                                    placeholder={tr("selectDate", "Select date")}
                                    onPress={() => openDatePicker("etdDate")}
                                    theme={theme}
                                    isArabic={isArabic}
                                    containerStyle={styles.flexField}
                                    disabled={isSubmitting}
                                />

                                <DatePickerField
                                    label="ETA"
                                    value={form.etaDate}
                                    placeholder={tr("selectDate", "Select date")}
                                    onPress={() => openDatePicker("etaDate")}
                                    theme={theme}
                                    isArabic={isArabic}
                                    containerStyle={styles.flexField}
                                    disabled={isSubmitting}
                                />
                            </View>

                            <SectionTitle
                                icon="cash-multiple"
                                title={tr("priceDetails", "Price Details")}
                                theme={theme}
                                isArabic={isArabic}
                            />

                            <View style={styles.row}>
                                <CurrencySelect
                                    label={tr("currency", "Currency")}
                                    value={form.currency}
                                    placeholder="SYP / USD"
                                    onChange={(value) => updateFormField("currency", value)}
                                    theme={theme}
                                    isArabic={isArabic}
                                    containerStyle={styles.currencyField}
                                    disabled={isSubmitting}
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

                            <DatePickerField
                                label={tr("validUntil", "Valid Until")}
                                value={form.validUntil}
                                placeholder={tr("selectDate", "Select date")}
                                onPress={() => openDatePicker("validUntil")}
                                theme={theme}
                                isArabic={isArabic}
                                disabled={isSubmitting}
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

                    <QuoteDatePickerModal
                        visible={!!activeDateField}
                        value={activeDateField ? form[activeDateField] : ""}
                        title={activeDateField ? DATE_FIELD_LABELS[activeDateField] || tr("selectDate", "Select date") : tr("selectDate", "Select date")}
                        theme={theme}
                        tr={tr}
                        isArabic={isArabic}
                        onClose={closeDatePicker}
                        onSelect={handleSelectDate}
                    />
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

function RiskSelect({
    label,
    value,
    onChange,
    theme,
    tr,
    isArabic,
    containerStyle,
    disabled = false,
}) {
    const [isOpen, setIsOpen] = useState(false);
    const selectedOption = QUOTE_RISK_OPTIONS.find(
        (option) => String(option.value) === String(value)
    ) || QUOTE_RISK_OPTIONS[0];
    const selectedLabel = tr(
        selectedOption.translationKey,
        isArabic ? selectedOption.arabicFallback : selectedOption.fallback
    );

    const handleToggle = () => {
        if (disabled) return;
        setIsOpen((currentValue) => !currentValue);
    };

    const handleSelect = (nextValue) => {
        onChange?.(nextValue);
        setIsOpen(false);
    };

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

            <TouchableOpacity
                style={[
                    styles.selectButton,
                    {
                        backgroundColor: theme.input,
                        borderColor: isOpen ? theme.primary : theme.inputBorder,
                        opacity: disabled ? 0.7 : 1,
                    },
                    getRowDirectionStyle(isArabic),
                ]}
                activeOpacity={0.85}
                onPress={handleToggle}
                disabled={disabled}
            >
                <Text
                    style={[
                        styles.selectButtonText,
                        { color: theme.text },
                        getTextDirectionStyle(isArabic),
                    ]}
                    numberOfLines={1}
                >
                    {selectedLabel}
                </Text>

                <Ionicons
                    name={isOpen ? "chevron-up" : "chevron-down"}
                    size={18}
                    color={theme.muted}
                />
            </TouchableOpacity>

            {isOpen && (
                <View
                    style={[
                        styles.selectDropdown,
                        {
                            backgroundColor: theme.card,
                            borderColor: theme.border,
                        },
                    ]}
                >
                    {QUOTE_RISK_OPTIONS.map((option) => {
                        const isSelected = String(value) === String(option.value);
                        const optionLabel = tr(
                            option.translationKey,
                            isArabic ? option.arabicFallback : option.fallback
                        );

                        return (
                            <TouchableOpacity
                                key={option.value}
                                style={[
                                    styles.selectOption,
                                    getRowDirectionStyle(isArabic),
                                    isSelected && { backgroundColor: theme.cardSoft },
                                ]}
                                activeOpacity={0.85}
                                onPress={() => handleSelect(option.value)}
                            >
                                <View
                                    style={[
                                        styles.selectOptionIcon,
                                        {
                                            borderColor: isSelected ? theme.primary : theme.border,
                                            backgroundColor: isSelected ? theme.primary : theme.input,
                                        },
                                    ]}
                                >
                                    {isSelected && (
                                        <Ionicons name="checkmark" size={13} color="#FFFFFF" />
                                    )}
                                </View>

                                <Text
                                    style={[
                                        styles.selectOptionText,
                                        { color: isSelected ? theme.primary : theme.text },
                                        getTextDirectionStyle(isArabic),
                                    ]}
                                    numberOfLines={1}
                                >
                                    {optionLabel}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            )}
        </View>
    );
}

function CurrencySelect({
    label,
    value,
    placeholder,
    onChange,
    theme,
    isArabic,
    containerStyle,
    disabled = false,
}) {
    const [isOpen, setIsOpen] = useState(false);

    const selectedOption = CURRENCY_OPTIONS.find(
        (option) => String(option.value) === String(value)
    );

    const handleToggle = () => {
        if (disabled) return;
        setIsOpen((currentValue) => !currentValue);
    };

    const handleSelect = (nextValue) => {
        onChange?.(nextValue);
        setIsOpen(false);
    };

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

            <TouchableOpacity
                style={[
                    styles.selectButton,
                    {
                        backgroundColor: theme.input,
                        borderColor: isOpen ? theme.primary : theme.inputBorder,
                        opacity: disabled ? 0.7 : 1,
                    },
                    getRowDirectionStyle(isArabic),
                ]}
                activeOpacity={0.85}
                onPress={handleToggle}
                disabled={disabled}
            >
                <Text
                    style={[
                        styles.selectButtonText,
                        { color: selectedOption ? theme.text : theme.muted },
                        getTextDirectionStyle(isArabic),
                    ]}
                    numberOfLines={1}
                >
                    {selectedOption?.label || placeholder}
                </Text>

                <Ionicons
                    name={isOpen ? "chevron-up" : "chevron-down"}
                    size={18}
                    color={theme.muted}
                />
            </TouchableOpacity>

            {isOpen && (
                <View
                    style={[
                        styles.selectDropdown,
                        {
                            backgroundColor: theme.card,
                            borderColor: theme.border,
                        },
                    ]}
                >
                    {CURRENCY_OPTIONS.map((option) => {
                        const isSelected = String(value) === String(option.value);

                        return (
                            <TouchableOpacity
                                key={option.value}
                                style={[
                                    styles.selectOption,
                                    getRowDirectionStyle(isArabic),
                                    isSelected && { backgroundColor: theme.cardSoft },
                                ]}
                                activeOpacity={0.85}
                                onPress={() => handleSelect(option.value)}
                            >
                                <View
                                    style={[
                                        styles.selectOptionIcon,
                                        {
                                            borderColor: isSelected ? theme.primary : theme.border,
                                            backgroundColor: isSelected ? theme.primary : theme.input,
                                        },
                                    ]}
                                >
                                    {isSelected && (
                                        <Ionicons name="checkmark" size={13} color="#FFFFFF" />
                                    )}
                                </View>

                                <Text
                                    style={[
                                        styles.selectOptionText,
                                        { color: isSelected ? theme.primary : theme.text },
                                        getTextDirectionStyle(isArabic),
                                    ]}
                                    numberOfLines={1}
                                >
                                    {option.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            )}
        </View>
    );
}

function DatePickerField({
    label,
    value,
    placeholder,
    onPress,
    theme,
    isArabic,
    containerStyle,
    disabled = false,
}) {
    const displayValue = formatDateForDisplay(value, isArabic);

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

            <TouchableOpacity
                style={[
                    styles.datePickerButton,
                    {
                        backgroundColor: theme.input,
                        borderColor: theme.inputBorder,
                        opacity: disabled ? 0.7 : 1,
                    },
                    getRowDirectionStyle(isArabic),
                ]}
                activeOpacity={0.85}
                onPress={onPress}
                disabled={disabled}
            >
                <Text
                    style={[
                        styles.datePickerText,
                        { color: displayValue ? theme.text : theme.muted },
                        getTextDirectionStyle(isArabic),
                    ]}
                    numberOfLines={1}
                >
                    {displayValue || placeholder}
                </Text>

                <Ionicons name="calendar-outline" size={20} color={theme.primary} />
            </TouchableOpacity>
        </View>
    );
}

function QuoteDatePickerModal({
    visible,
    value,
    title,
    theme,
    tr,
    isArabic,
    onClose,
    onSelect,
}) {
    const [displayMonth, setDisplayMonth] = useState(() =>
        getDatePickerInitialMonth(value)
    );

    const { minDate, maxDate } = getDatePickerRange();
    const selectedDate = getDateFromApiValue(value);

    React.useEffect(() => {
        if (visible) {
            setDisplayMonth(getDatePickerInitialMonth(value));
        }
    }, [visible, value]);

    if (!visible) {
        return null;
    }

    const calendarDays = getCalendarDays(displayMonth);
    const monthLabel = displayMonth.toLocaleDateString(isArabic ? "ar" : "en", {
        month: "long",
        year: "numeric",
    });
    const minMonth = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    const maxMonth = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);
    const canGoPrevious = !isBeforeDate(addMonths(displayMonth, -1), minMonth);
    const canGoNext = !isAfterDate(addMonths(displayMonth, 1), maxMonth);
    const canGoPreviousYear = !isBeforeDate(addMonths(displayMonth, -12), minMonth);
    const canGoNextYear = !isAfterDate(addMonths(displayMonth, 12), maxMonth);
    const weekDays = isArabic
        ? ["أحد", "إثن", "ثلا", "أرب", "خمي", "جمع", "سبت"]
        : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
            statusBarTranslucent
            navigationBarTranslucent
            presentationStyle="overFullScreen"
        >
            <Pressable
                style={[styles.dateModalOverlay, { backgroundColor: theme.overlay }]}
                onPress={onClose}
            >
                <Pressable
                    style={[
                        styles.dateModalCard,
                        {
                            backgroundColor: theme.card,
                            borderColor: theme.border,
                        },
                    ]}
                    onPress={(event) => event.stopPropagation()}
                >
                    <View style={[styles.dateModalHeader, getRowDirectionStyle(isArabic)]}>
                        <Text
                            style={[
                                styles.dateModalTitle,
                                { color: theme.text },
                                getTextDirectionStyle(isArabic),
                            ]}
                        >
                            {title}
                        </Text>

                        <TouchableOpacity
                            style={[
                                styles.dateModalCloseButton,
                                { backgroundColor: theme.cardSoft, borderColor: theme.border },
                            ]}
                            activeOpacity={0.85}
                            onPress={onClose}
                        >
                            <Ionicons name="close" size={22} color={theme.text} />
                        </TouchableOpacity>
                    </View>

                    <View style={[styles.monthSwitcher, getRowDirectionStyle(isArabic)]}>
                        <TouchableOpacity
                            style={[
                                styles.monthButton,
                                { backgroundColor: theme.cardSoft, borderColor: theme.border },
                                !canGoPrevious && styles.disabledButton,
                            ]}
                            activeOpacity={0.85}
                            disabled={!canGoPrevious}
                            onPress={() => setDisplayMonth((currentDate) => addMonths(currentDate, -1))}
                        >
                            <Ionicons
                                name={isArabic ? "chevron-forward" : "chevron-back"}
                                size={20}
                                color={theme.text}
                            />
                        </TouchableOpacity>

                        <Text
                            style={[
                                styles.monthLabel,
                                { color: theme.primary },
                                getTextDirectionStyle(isArabic),
                            ]}
                            numberOfLines={1}
                        >
                            {monthLabel}
                        </Text>

                        <TouchableOpacity
                            style={[
                                styles.monthButton,
                                { backgroundColor: theme.cardSoft, borderColor: theme.border },
                                !canGoNext && styles.disabledButton,
                            ]}
                            activeOpacity={0.85}
                            disabled={!canGoNext}
                            onPress={() => setDisplayMonth((currentDate) => addMonths(currentDate, 1))}
                        >
                            <Ionicons
                                name={isArabic ? "chevron-back" : "chevron-forward"}
                                size={20}
                                color={theme.text}
                            />
                        </TouchableOpacity>
                    </View>

                    <View style={[styles.yearSwitcher, getRowDirectionStyle(isArabic)]}>
                        <TouchableOpacity
                            style={[
                                styles.yearButton,
                                { backgroundColor: theme.cardSoft, borderColor: theme.border },
                                !canGoPreviousYear && styles.disabledButton,
                            ]}
                            activeOpacity={0.85}
                            disabled={!canGoPreviousYear}
                            onPress={() => setDisplayMonth((currentDate) => addMonths(currentDate, -12))}
                        >
                            <Text style={[styles.yearButtonText, { color: theme.text }]}>
                                {isArabic ? "- سنة" : "-1 year"}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.yearButton,
                                { backgroundColor: theme.cardSoft, borderColor: theme.border },
                                !canGoNextYear && styles.disabledButton,
                            ]}
                            activeOpacity={0.85}
                            disabled={!canGoNextYear}
                            onPress={() => setDisplayMonth((currentDate) => addMonths(currentDate, 12))}
                        >
                            <Text style={[styles.yearButtonText, { color: theme.text }]}>
                                {isArabic ? "+ سنة" : "+1 year"}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.weekDaysGrid}>
                        {weekDays.map((weekDay) => (
                            <Text
                                key={weekDay}
                                style={[styles.weekDayText, { color: theme.muted }]}
                                numberOfLines={1}
                            >
                                {weekDay}
                            </Text>
                        ))}
                    </View>

                    <View style={styles.daysGrid}>
                        {calendarDays.map((day) => {
                            const isCurrentMonth = day.getMonth() === displayMonth.getMonth();
                            const isDisabled =
                                !isCurrentMonth ||
                                isBeforeDate(day, minDate) ||
                                isAfterDate(day, maxDate);
                            const isSelected = selectedDate && isSameDate(day, selectedDate);

                            return (
                                <TouchableOpacity
                                    key={day.toISOString()}
                                    style={[
                                        styles.dayButton,
                                        {
                                            backgroundColor: isSelected ? theme.primary : theme.cardSoft,
                                            borderColor: isSelected ? theme.primary : theme.border,
                                            opacity: isDisabled ? 0.35 : 1,
                                        },
                                    ]}
                                    activeOpacity={0.85}
                                    disabled={isDisabled}
                                    onPress={() => onSelect?.(day)}
                                >
                                    <Text
                                        style={[
                                            styles.dayButtonText,
                                            { color: isSelected ? "#FFFFFF" : theme.text },
                                        ]}
                                    >
                                        {String(day.getDate())}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    <Text
                        style={[
                            styles.dateModalHint,
                            { color: theme.muted },
                            getTextDirectionStyle(isArabic),
                        ]}
                    >
                        {tr(
                            "datePickerAllYearsHint",
                            "You can choose any valid date from previous years or future years."
                        )}
                    </Text>
                </Pressable>
            </Pressable>
        </Modal>
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
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        borderWidth: 1,
        overflow: "hidden",
        flexShrink: 1,
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
        fontSize: 18,
        fontWeight: "900",
    },

    subtitle: {
        marginTop: 4,
        fontSize: 12,
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
        flexShrink: 1,
    },

    scrollContent: {
        paddingHorizontal: 18,
        paddingTop: 4,
        paddingBottom: 14,
    },

    scrollContentKeyboardOpen: {
        paddingBottom: 30,
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

    selectButton: {
        minHeight: 48,
        borderWidth: 1,
        borderRadius: 15,
        paddingHorizontal: 13,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
    },

    selectButtonText: {
        flex: 1,
        minWidth: 0,
        fontSize: 14.5,
        fontWeight: "800",
    },

    selectDropdown: {
        marginTop: 7,
        borderWidth: 1,
        borderRadius: 16,
        overflow: "hidden",
    },

    selectOption: {
        minHeight: 46,
        flexDirection: "row",
        alignItems: "center",
        gap: 9,
        paddingHorizontal: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: "rgba(100, 116, 139, 0.18)",
    },

    selectOptionIcon: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
    },

    selectOptionText: {
        flex: 1,
        minWidth: 0,
        fontSize: 14,
        fontWeight: "900",
    },

    datePickerButton: {
        minHeight: 48,
        borderWidth: 1,
        borderRadius: 15,
        paddingHorizontal: 13,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
    },

    datePickerText: {
        flex: 1,
        minWidth: 0,
        fontSize: 14.5,
        fontWeight: "800",
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

    dateModalOverlay: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 18,
    },

    dateModalCard: {
        width: "100%",
        maxWidth: 390,
        borderWidth: 1,
        borderRadius: 24,
        padding: 16,
    },

    dateModalHeader: {
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 12,
        marginBottom: 14,
    },

    dateModalTitle: {
        flex: 1,
        minWidth: 0,
        fontSize: 16,
        fontWeight: "900",
    },

    dateModalCloseButton: {
        width: 38,
        height: 38,
        borderRadius: 19,
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
    },

    monthSwitcher: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        marginBottom: 8,
    },

    yearSwitcher: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        marginBottom: 12,
    },

    yearButton: {
        flex: 1,
        minHeight: 36,
        borderRadius: 18,
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 10,
    },

    yearButtonText: {
        fontSize: 12,
        fontWeight: "900",
    },

    monthButton: {
        width: 42,
        height: 42,
        borderRadius: 21,
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
    },

    monthLabel: {
        flex: 1,
        minWidth: 0,
        textAlign: "center",
        fontSize: 16,
        fontWeight: "900",
    },

    weekDaysGrid: {
        flexDirection: "row",
        marginBottom: 8,
    },

    weekDayText: {
        width: `${100 / 7}%`,
        textAlign: "center",
        fontSize: 11,
        fontWeight: "900",
    },

    daysGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        rowGap: 7,
    },

    dayButton: {
        width: `${100 / 7}%`,
        aspectRatio: 1,
        borderRadius: 12,
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
        transform: [{ scale: 0.9 }],
    },

    dayButtonText: {
        fontSize: 13,
        fontWeight: "900",
    },

    dateModalHint: {
        marginTop: 12,
        fontSize: 12,
        fontWeight: "700",
        lineHeight: 17,
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
import {
    getRowDirectionStyle,
    getTextDirectionStyle,
} from "@/src/styles/globalStyles";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    useWindowDimensions,
} from "react-native";
import chatService from "@/src/services/api/chatService";

const QUOTE_STATUS = {
    PENDING: 1,
    APPROVED: 2,
    REJECTED: 3,
    EXPIRED: 4,
    CANCELLED: 5,
};

const USER_ROLE = {
    CUSTOMER: 1,
    EMPLOYEE: 2,
    ADMIN: 3,
};

const isFilledValue = (value) => {
    return value !== undefined && value !== null && String(value).trim() !== "";
};

const isPlainObject = (value) => {
    return !!value && typeof value === "object" && !Array.isArray(value);
};

const normalizeString = (value, fallback = "") => {
    if (!isFilledValue(value)) {
        return fallback;
    }

    return String(value).trim();
};

const normalizeNumberValue = (value) => {
    if (!isFilledValue(value)) {
        return null;
    }

    const numericValue = Number(value);

    return Number.isFinite(numericValue) ? numericValue : null;
};

const normalizeLowerString = (value = "") => {
    return normalizeString(value).toLowerCase().replace(/[\s-]+/g, "_");
};

const getTextColor = (colors = {}) => {
    return colors.text || colors.textPrimary || "#061526";
};

const getMutedColor = (colors = {}) => {
    return colors.muted || colors.textMuted || "#64748b";
};

const getCardColor = (colors = {}) => {
    return colors.card || colors.cardStrong || "#ffffff";
};

const getModalCardColor = (colors = {}) => {
    return colors.modalCard || colors.cardStrong || colors.card || "#ffffff";
};

const getCardSoftColor = (colors = {}) => {
    return colors.cardSoft || colors.buttonSoft || "rgba(6, 21, 38, 0.06)";
};

const getOverlayColor = (colors = {}) => {
    return colors.modalOverlay || colors.overlay || "rgba(0, 0, 0, 0.55)";
};

const getBorderColor = (colors = {}) => {
    return colors.border || colors.borderSoft || "rgba(6, 21, 38, 0.14)";
};

const getPrimaryColor = (colors = {}) => {
    return colors.primary || "#51a234";
};

const getBlueColor = (colors = {}) => {
    return colors.blue || "#087BFF";
};

const getSuccessColor = (colors = {}) => {
    return colors.success || "#2FAE24";
};

const getDangerColor = (colors = {}) => {
    return colors.danger || "#E3342F";
};

const getNestedValue = (source, paths = []) => {
    if (!source || typeof source !== "object") {
        return null;
    }

    for (const path of paths) {
        const value = String(path)
            .split(".")
            .reduce((current, key) => current?.[key], source);

        if (isFilledValue(value) || isPlainObject(value)) {
            return value;
        }
    }

    return null;
};

const extractQuoteFromApiResponse = (response) => {
    const payload = response?.data || response || {};

    const candidates = [
        payload?.data?.quote,
        payload?.quote,
        payload?.data,
    ];

    return candidates.find(isPlainObject) || {};
};

const getQuotePayload = (item = {}, overrideQuote = null) => {
    const candidates = [
        overrideQuote,

        item?.quote,
        item?.quote_data,
        item?.quoteData,

        item?.raw?.quote,
        item?.raw?.quote_data,
        item?.raw?.quoteData,

        item?.raw?.data?.quote,
        item?.raw?.data?.quote_data,
        item?.raw?.data?.quoteData,

        item?.raw?.message?.quote,
        item?.raw?.message?.quote_data,
        item?.raw?.message?.quoteData,

        item?.raw?.data?.message?.quote,
        item?.raw?.data?.message?.quote_data,
        item?.raw?.data?.message?.quoteData,

        item?.raw?.data?.item?.quote,
        item?.raw?.data?.item?.quote_data,
        item?.raw?.item?.quote,
        item?.raw?.item?.quote_data,
    ];

    return candidates.find(isPlainObject) || {};
};

const getQuoteId = (item = {}, quote = {}) => {
    return (
        quote?.id ||
        quote?.quote_id ||
        quote?.quoteId ||
        item?.raw?.quote_id ||
        item?.raw?.quoteId ||
        item?.raw?.data?.message?.quote_id ||
        item?.raw?.data?.message?.quoteId ||
        item?.raw?.message?.quote_id ||
        item?.raw?.message?.quoteId ||
        item?.quote_id ||
        item?.quoteId ||
        null
    );
};

const hasRenderableQuoteData = (quote = {}) => {
    return !!(
        quote?.route ||
        quote?.status ||
        quote?.risk_level ||
        quote?.cargo_type ||
        quote?.container_type ||
        quote?.currency ||
        quote?.total_price ||
        quote?.volume_cbm ||
        quote?.weight_kg ||
        quote?.etd_date ||
        quote?.eta_date ||
        quote?.valid_until ||
        quote?.includes ||
        quote?.notes
    );
};

const normalizeStatusValue = (status) => {
    if (isPlainObject(status)) {
        return normalizeStatusValue(status.value ?? status.id ?? status.code ?? status.key);
    }

    const numericStatus = normalizeNumberValue(status);

    if (numericStatus !== null) {
        return numericStatus;
    }

    const normalizedStatus = normalizeLowerString(status);

    if (["pending", "sent", "waiting", "awaiting", "awaiting_customer", "pending_approval"].includes(normalizedStatus)) {
        return QUOTE_STATUS.PENDING;
    }

    if (["approved", "accepted"].includes(normalizedStatus)) {
        return QUOTE_STATUS.APPROVED;
    }

    if (["rejected", "declined"].includes(normalizedStatus)) {
        return QUOTE_STATUS.REJECTED;
    }

    if (["expired"].includes(normalizedStatus)) {
        return QUOTE_STATUS.EXPIRED;
    }

    if (["cancelled", "canceled"].includes(normalizedStatus)) {
        return QUOTE_STATUS.CANCELLED;
    }

    return null;
};

const getQuoteStatusValue = (quote = {}, statusOverride = null) => {
    const overrideStatusValue = normalizeStatusValue(statusOverride);

    if (overrideStatusValue !== null) {
        return overrideStatusValue;
    }

    return normalizeStatusValue(
        quote?.status ??
        quote?.state ??
        quote?.approval_status ??
        quote?.approvalStatus
    ) ?? QUOTE_STATUS.PENDING;
};

const getQuoteStatusLabel = ({ quote = {}, statusValue, tr }) => {
    const backendLabel =
        (isPlainObject(quote?.status) && normalizeString(quote.status.label)) ||
        normalizeString(quote?.status_label || quote?.statusLabel);

    if (backendLabel) {
        return backendLabel;
    }

    if (statusValue === QUOTE_STATUS.APPROVED) {
        return tr("quoteApproved", "Approved");
    }

    if (statusValue === QUOTE_STATUS.REJECTED) {
        return tr("quoteRejected", "Rejected");
    }

    if (statusValue === QUOTE_STATUS.CANCELLED) {
        return tr("quoteCancelled", "Cancelled");
    }

    if (statusValue === QUOTE_STATUS.EXPIRED) {
        return tr("quoteExpired", "Expired");
    }

    return tr("quotePending", "Pending");
};

const getStatusIcon = (statusValue) => {
    if (statusValue === QUOTE_STATUS.APPROVED) {
        return "checkmark-circle";
    }

    if (statusValue === QUOTE_STATUS.REJECTED) {
        return "close-circle";
    }

    if (statusValue === QUOTE_STATUS.CANCELLED) {
        return "ban";
    }

    if (statusValue === QUOTE_STATUS.EXPIRED) {
        return "time";
    }

    return "hourglass-outline";
};

const getStatusColor = (statusValue, colors = {}) => {
    if (statusValue === QUOTE_STATUS.APPROVED) {
        return colors.quoteApproved || getSuccessColor(colors);
    }

    if (statusValue === QUOTE_STATUS.REJECTED) {
        return colors.quoteRejected || getDangerColor(colors);
    }

    if (statusValue === QUOTE_STATUS.CANCELLED) {
        return colors.quoteCancelled || getDangerColor(colors);
    }

    if (statusValue === QUOTE_STATUS.EXPIRED) {
        return colors.quoteExpired || getDangerColor(colors);
    }

    return colors.quotePending || getBlueColor(colors) || getPrimaryColor(colors);
};

const normalizeDateForParsing = (value) => {
    const cleanValue = normalizeString(value);

    if (!cleanValue) {
        return "";
    }

    const dateOnly = cleanValue.slice(0, 10);

    if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
        return dateOnly;
    }

    if (/^\d{2}-\d{2}-\d{4}$/.test(dateOnly)) {
        const [day, month, year] = dateOnly.split("-");

        return `${year}-${month}-${day}`;
    }

    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateOnly)) {
        const [day, month, year] = dateOnly.split("/");

        return `${year}-${month}-${day}`;
    }

    return cleanValue;
};

const formatDate = (value, isArabic) => {
    if (!isFilledValue(value)) {
        return "";
    }

    const normalizedValue = normalizeDateForParsing(value);
    const date = new Date(normalizedValue);

    if (Number.isNaN(date.getTime())) {
        return String(value).slice(0, 10);
    }

    return date.toLocaleDateString(isArabic ? "ar" : "en", {
        month: "short",
        day: "2-digit",
        year: "numeric",
    });
};

const formatNumber = (value, options = {}) => {
    if (!isFilledValue(value)) {
        return "";
    }

    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) {
        return String(value);
    }

    return numericValue.toLocaleString("en", {
        maximumFractionDigits: options.maximumFractionDigits ?? 2,
        minimumFractionDigits: options.minimumFractionDigits ?? 0,
    });
};

const normalizeIncludes = (value) => {
    if (Array.isArray(value)) {
        return value
            .map((item) => normalizeString(item))
            .filter(Boolean);
    }

    if (typeof value === "string") {
        return value
            .split(/\r?\n|,/)
            .map((item) => normalizeString(item))
            .filter(Boolean);
    }

    return [];
};

const buildRouteText = ({ quote, tr }) => {
    const route = isPlainObject(quote?.route) ? quote.route : {};

    const routeDisplay = normalizeString(
        route.display ||
        route.label ||
        route.text ||
        quote.route_display ||
        quote.routeDisplay
    );

    if (routeDisplay) {
        return routeDisplay;
    }

    const originCity = normalizeString(
        route.origin_city ||
        route.originCity ||
        quote.origin_city ||
        quote.originCity ||
        getNestedValue(quote, ["origin.city"])
    );

    const originCountry = normalizeString(
        route.origin_country ||
        route.originCountry ||
        quote.origin_country ||
        quote.originCountry ||
        getNestedValue(quote, ["origin.country"])
    );

    const destinationCity = normalizeString(
        route.destination_city ||
        route.destinationCity ||
        quote.destination_city ||
        quote.destinationCity ||
        getNestedValue(quote, ["destination.city"])
    );

    const destinationCountry = normalizeString(
        route.destination_country ||
        route.destinationCountry ||
        quote.destination_country ||
        quote.destinationCountry ||
        getNestedValue(quote, ["destination.country"])
    );

    const origin = [originCity, originCountry].filter(Boolean).join(" ");
    const destination = [destinationCity, destinationCountry].filter(Boolean).join(" ");

    if (!origin && !destination) {
        return "";
    }

    return `${origin || tr("origin", "Origin")} → ${destination || tr("destination", "Destination")}`;
};

const getViewerRoleValue = (viewerRole) => {
    const numericRole = normalizeNumberValue(viewerRole);

    if (numericRole !== null) {
        return numericRole;
    }

    const normalizedRole = normalizeLowerString(viewerRole);

    if (normalizedRole === "customer" || normalizedRole === "client") {
        return USER_ROLE.CUSTOMER;
    }

    if (normalizedRole === "employee" || normalizedRole === "staff" || normalizedRole === "agent") {
        return USER_ROLE.EMPLOYEE;
    }

    if (normalizedRole === "admin" || normalizedRole === "super_admin" || normalizedRole === "administrator") {
        return USER_ROLE.ADMIN;
    }

    return null;
};

const buildQuoteViewModel = ({
    item,
    tr,
    isArabic,
    statusOverride,
    quoteOverride,
}) => {
    const quote = getQuotePayload(item, quoteOverride);
    const statusValue = getQuoteStatusValue(quote, statusOverride);
    const statusLabel = getQuoteStatusLabel({ quote, statusValue, tr });
    const statusIcon = getStatusIcon(statusValue);
    const quoteId = getQuoteId(item, quote);

    const routeText = buildRouteText({ quote, tr });

    const riskLevel = isPlainObject(quote.risk_level)
        ? normalizeString(quote.risk_level.label)
        : normalizeString(quote.risk_level || quote.riskLevel || quote.risk);

    const cargoType = normalizeString(
        quote.cargo_type ||
        quote.cargoType
    );

    const containerType = normalizeString(
        quote.container_type ||
        quote.containerType
    );

    const volume = formatNumber(quote.volume_cbm || quote.volumeCbm);
    const weight = formatNumber(quote.weight_kg || quote.weightKg);

    const volumeWeight = [
        volume ? `${volume} CBM` : "",
        weight ? `${weight} KG` : "",
    ].filter(Boolean).join(" / ");

    const etdDate = formatDate(quote.etd_date || quote.etdDate, isArabic);
    const etaDate = formatDate(quote.eta_date || quote.etaDate, isArabic);

    const currency = normalizeString(quote.currency).toUpperCase();
    const totalPrice = formatNumber(
        quote.total_price ||
        quote.totalPrice ||
        quote.price,
        {
            maximumFractionDigits: 2,
        }
    );

    const priceText = totalPrice
        ? [currency, totalPrice].filter(Boolean).join(" ")
        : "";

    const validUntil = formatDate(
        quote.valid_until ||
        quote.validUntil,
        isArabic
    );

    const includes = normalizeIncludes(quote.includes);
    const notes = normalizeString(quote.notes);

    return {
        quote,
        quoteId,
        routeText,
        riskLevel,
        cargoType,
        containerType,
        volumeWeight,
        etdDate,
        etaDate,
        currency,
        totalPrice,
        priceText,
        validUntil,
        includes,
        notes,
        statusValue,
        statusLabel,
        statusIcon,
    };
};

export default function QuoteMessageCard({
    item,
    colors,
    tr,
    time,
    isArabic,
    isCompactScreen,
    onLongPress,
    onPress,
    viewerCanCreateQuote = false,
    viewerRole = null,
}) {
    const isMine = item?.side === "me" || item?.is_mine === true;
    const [detailsVisible, setDetailsVisible] = useState(false);
    const [statusOverride, setStatusOverride] = useState(null);
    const [quoteOverride, setQuoteOverride] = useState(null);
    const [isLoadingQuote, setIsLoadingQuote] = useState(false);
    const [isChangingStatus, setIsChangingStatus] = useState(false);
    const { width } = useWindowDimensions();

    const shouldStackQuoteBody = isCompactScreen || width < 350;

    const viewModel = useMemo(
        () => buildQuoteViewModel({
            item,
            tr,
            isArabic,
            statusOverride,
            quoteOverride,
        }),
        [item, tr, isArabic, statusOverride, quoteOverride]
    );

    const textColor = getTextColor(colors);
    const mutedColor = getMutedColor(colors);
    const cardColor = getCardColor(colors);
    const cardSoftColor = getCardSoftColor(colors);
    const borderColor = getBorderColor(colors);
    const primaryColor = getPrimaryColor(colors);
    const blueColor = getBlueColor(colors);
    const dangerColor = getDangerColor(colors);
    const successColor = getSuccessColor(colors);
    const statusColor = getStatusColor(viewModel.statusValue, colors);

    // Any receiver of a pending quote can respond, regardless of role.
    // Employee -> Admin, Admin -> Employee, and Employee/Admin -> Customer all work here.
    // The sender must not see approve/reject on their own quote.
    const canViewerRespond =
        !isMine &&
        viewModel.statusValue === QUOTE_STATUS.PENDING &&
        !!viewModel.quoteId;

    const shouldFetchQuote =
        !!viewModel.quoteId &&
        !isLoadingQuote &&
        !hasRenderableQuoteData(viewModel.quote);

    const loadFullQuote = async ({ silent = true } = {}) => {
        if (!viewModel.quoteId || isLoadingQuote || hasRenderableQuoteData(viewModel.quote)) {
            return;
        }

        try {
            setIsLoadingQuote(true);

            const response = await chatService.showQuote(viewModel.quoteId);
            const nextQuote = extractQuoteFromApiResponse(response);

            if (hasRenderableQuoteData(nextQuote) || nextQuote?.id) {
                setQuoteOverride((currentQuote) => ({
                    ...(currentQuote || {}),
                    ...nextQuote,
                }));
            }
        } catch (error) {
            console.log("Show quote error:", error?.raw || error);

            if (!silent) {
                Alert.alert(
                    tr("errorTitle", "Something went wrong"),
                    error?.userMessage ||
                    tr("showQuoteError", "Could not load this quote. Please try again.")
                );
            }
        } finally {
            setIsLoadingQuote(false);
        }
    };

    useEffect(() => {
        if (!shouldFetchQuote) {
            return;
        }

        void loadFullQuote({ silent: true });
    }, [shouldFetchQuote, viewModel.quoteId]);

    const handleOpenDetails = async () => {
        setDetailsVisible(true);
        onPress?.(item);

        if (viewModel.quoteId && !hasRenderableQuoteData(viewModel.quote)) {
            await loadFullQuote({ silent: false });
        }
    };

    const handleChangeQuoteStatus = async (action) => {
        if (!viewModel.quoteId || isChangingStatus) {
            return;
        }

        try {
            setIsChangingStatus(true);

            const response = action === "approve"
                ? await chatService.approveQuote(viewModel.quoteId)
                : await chatService.rejectQuote(viewModel.quoteId);

            const nextQuote = extractQuoteFromApiResponse(response);
            const nextStatusValue = action === "approve"
                ? QUOTE_STATUS.APPROVED
                : QUOTE_STATUS.REJECTED;

            setStatusOverride(nextQuote?.status || nextStatusValue);

            if (nextQuote?.id || nextQuote?.status) {
                setQuoteOverride((currentQuote) => ({
                    ...(viewModel.quote || {}),
                    ...(currentQuote || {}),
                    ...nextQuote,
                }));
            }
        } catch (error) {
            console.log(`Quote ${action} error:`, error?.raw || error);

            Alert.alert(
                tr("errorTitle", "Something went wrong"),
                error?.userMessage ||
                (action === "approve"
                    ? tr("approveQuoteError", "Could not approve this quote. Please try again.")
                    : tr("rejectQuoteError", "Could not reject this quote. Please try again."))
            );
        } finally {
            setIsChangingStatus(false);
        }
    };

    const confirmChangeQuoteStatus = (action) => {
        const isApproveAction = action === "approve";

        Alert.alert(
            isApproveAction
                ? tr("approveQuoteTitle", "Approve quote?")
                : tr("rejectQuoteTitle", "Reject quote?"),
            isApproveAction
                ? tr("approveQuoteMessage", "Are you sure you want to approve this quote?")
                : tr("rejectQuoteMessage", "Are you sure you want to reject this quote?"),
            [
                { text: tr("cancel", "Cancel"), style: "cancel" },
                {
                    text: isApproveAction
                        ? tr("approveQuote", "Approve")
                        : tr("rejectQuote", "Reject"),
                    style: isApproveAction ? "default" : "destructive",
                    onPress: () => handleChangeQuoteStatus(action),
                },
            ]
        );
    };

    return (
        <>
            <View
                style={[
                    styles.quoteRow,
                    isMine ? styles.myQuoteRow : styles.employeeQuoteRow,
                ]}
            >
                <TouchableOpacity
                    activeOpacity={0.9}
                    delayLongPress={260}
                    onLongPress={onLongPress}
                    onPress={handleOpenDetails}
                    style={[
                        styles.quoteCard,
                        shouldStackQuoteBody && styles.quoteCardCompact,
                        {
                            backgroundColor: cardColor,
                            borderColor: statusColor,
                        },
                    ]}
                >
                    <View style={[styles.quoteHeader, getRowDirectionStyle(isArabic)]}>
                        <View style={styles.quoteHeaderTitleWrapper}>
                            <Text
                                style={[
                                    styles.quoteTitle,
                                    shouldStackQuoteBody && styles.quoteTitleCompact,
                                    { color: statusColor },
                                    getTextDirectionStyle(isArabic),
                                ]}
                                numberOfLines={1}
                            >
                                {tr("quoteSummary", "Quote Summary")}
                            </Text>

                            {!!viewModel.quoteId && (
                                <Text
                                    style={[
                                        styles.quoteNumber,
                                        { color: mutedColor },
                                        getTextDirectionStyle(isArabic),
                                    ]}
                                    numberOfLines={1}
                                >
                                    #{viewModel.quoteId}
                                </Text>
                            )}
                        </View>

                        <StatusPill
                            label={viewModel.statusLabel}
                            icon={viewModel.statusIcon}
                            statusColor={statusColor}
                            backgroundColor={cardSoftColor}
                        />
                    </View>

                    <View
                        style={[
                            styles.quoteBody,
                            shouldStackQuoteBody && styles.quoteBodyCompact,
                            !shouldStackQuoteBody && getRowDirectionStyle(isArabic),
                        ]}
                    >
                        <View style={styles.quoteDetails}>
                            <OptionalQuoteLine
                                icon="map-marker-path"
                                label={tr("route", "Route")}
                                value={viewModel.routeText}
                                colors={colors}
                                isArabic={isArabic}
                                accentColor={primaryColor}
                            />

                            <OptionalQuoteLine
                                icon="shield-check-outline"
                                label={tr("riskLevel", "Risk")}
                                value={viewModel.riskLevel}
                                colors={colors}
                                isArabic={isArabic}
                                accentColor={primaryColor}
                            />

                            <OptionalQuoteLine
                                icon="package-variant-closed"
                                label={tr("cargoType", "Cargo Type")}
                                value={viewModel.cargoType}
                                colors={colors}
                                isArabic={isArabic}
                                accentColor={primaryColor}
                            />

                            <OptionalQuoteLine
                                icon="shipping-pallet"
                                label={tr("container", "Container")}
                                value={viewModel.containerType}
                                colors={colors}
                                isArabic={isArabic}
                                accentColor={primaryColor}
                            />

                            <OptionalQuoteLine
                                icon="cube-outline"
                                label={tr("volumeWeight", "Volume / Weight")}
                                value={viewModel.volumeWeight}
                                colors={colors}
                                isArabic={isArabic}
                                accentColor={primaryColor}
                                forceLtrValue
                            />

                            <OptionalQuoteLine
                                icon="calendar-clock"
                                label="ETD"
                                value={viewModel.etdDate}
                                colors={colors}
                                isArabic={isArabic}
                                accentColor={primaryColor}
                            />

                            <OptionalQuoteLine
                                icon="calendar-check"
                                label="ETA"
                                value={viewModel.etaDate}
                                colors={colors}
                                isArabic={isArabic}
                                accentColor={primaryColor}
                            />

                            {isLoadingQuote && (
                                <View style={[styles.loadingQuoteRow, getRowDirectionStyle(isArabic)]}>
                                    <ActivityIndicator size="small" color={primaryColor} />
                                    <Text
                                        style={[
                                            styles.loadingQuoteText,
                                            { color: mutedColor },
                                            getTextDirectionStyle(isArabic),
                                        ]}
                                    >
                                        {tr("loadingQuote", "Loading quote details...")}
                                    </Text>
                                </View>
                            )}
                        </View>

                        <View
                            style={[
                                styles.priceCard,
                                shouldStackQuoteBody && styles.priceCardCompact,
                                {
                                    borderColor,
                                    backgroundColor: cardSoftColor,
                                },
                            ]}
                        >
                            <Text
                                style={[
                                    styles.priceLabel,
                                    { color: textColor },
                                    getTextDirectionStyle(isArabic),
                                ]}
                            >
                                {tr("totalPrice", "Total Price (All-In)")}
                            </Text>

                            <Text
                                style={[
                                    styles.priceValue,
                                    shouldStackQuoteBody && styles.priceValueCompact,
                                    { color: statusColor },
                                    styles.ltrValueText,
                                    !viewModel.priceText && styles.emptyPriceValue,
                                ]}
                                numberOfLines={1}
                            >
                                {viewModel.priceText || "—"}
                            </Text>

                            {!!viewModel.validUntil && (
                                <Text
                                    style={[
                                        styles.validText,
                                        { color: mutedColor },
                                        getTextDirectionStyle(isArabic),
                                    ]}
                                    numberOfLines={2}
                                >
                                    {tr("validUntil", "Valid Until")}:{" "}
                                    {viewModel.validUntil}
                                </Text>
                            )}

                            {viewModel.includes.length > 0 && (
                                <>
                                    <View
                                        style={[
                                            styles.divider,
                                            { backgroundColor: borderColor },
                                        ]}
                                    />

                                    <Text
                                        style={[
                                            styles.includesTitle,
                                            { color: statusColor },
                                            getTextDirectionStyle(isArabic),
                                        ]}
                                    >
                                        {tr("includes", "Includes")}:
                                    </Text>
                                </>
                            )}

                            {viewModel.includes.slice(0, 5).map((includeItem, index) => (
                                <View
                                    key={`${includeItem}-${index}`}
                                    style={[
                                        styles.includeRow,
                                        getRowDirectionStyle(isArabic),
                                    ]}
                                >
                                    <Ionicons
                                        name="checkmark"
                                        size={14}
                                        color={statusColor}
                                    />

                                    <Text
                                        style={[
                                            styles.includeText,
                                            { color: textColor },
                                            getTextDirectionStyle(isArabic),
                                        ]}
                                        numberOfLines={1}
                                    >
                                        {includeItem}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    </View>

                    {!!viewModel.notes && (
                        <View
                            style={[
                                styles.notesBox,
                                {
                                    backgroundColor: cardSoftColor,
                                    borderColor,
                                },
                            ]}
                        >
                            <Text
                                style={[
                                    styles.notesLabel,
                                    { color: statusColor },
                                    getTextDirectionStyle(isArabic),
                                ]}
                            >
                                {tr("notes", "Notes")}
                            </Text>

                            <Text
                                style={[
                                    styles.notesText,
                                    { color: textColor },
                                    getTextDirectionStyle(isArabic),
                                ]}
                                numberOfLines={3}
                            >
                                {viewModel.notes}
                            </Text>
                        </View>
                    )}

                    {canViewerRespond && (
                        <View style={[styles.actionRow, getRowDirectionStyle(isArabic)]}>
                            <TouchableOpacity
                                style={[
                                    styles.actionButton,
                                    { backgroundColor: successColor },
                                    isChangingStatus && styles.disabledButton,
                                ]}
                                activeOpacity={0.85}
                                onPress={() => confirmChangeQuoteStatus("approve")}
                                disabled={isChangingStatus}
                            >
                                {isChangingStatus ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <>
                                        <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                                        <Text style={styles.actionButtonText}>
                                            {tr("approveQuote", "Approve")}
                                        </Text>
                                    </>
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[
                                    styles.actionButton,
                                    styles.rejectButton,
                                    {
                                        borderColor: dangerColor,
                                        backgroundColor: cardSoftColor,
                                    },
                                    isChangingStatus && styles.disabledButton,
                                ]}
                                activeOpacity={0.85}
                                onPress={() => confirmChangeQuoteStatus("reject")}
                                disabled={isChangingStatus}
                            >
                                <Ionicons name="close" size={18} color={dangerColor} />
                                <Text style={[styles.rejectButtonText, { color: dangerColor }]}>
                                    {tr("rejectQuote", "Reject")}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    <TouchableOpacity
                        style={[
                            styles.viewQuoteButton,
                            { borderColor },
                        ]}
                        activeOpacity={0.85}
                        onPress={handleOpenDetails}
                    >
                        <View
                            style={[
                                styles.viewQuoteLeft,
                                getRowDirectionStyle(isArabic),
                            ]}
                        >
                            <MaterialCommunityIcons
                                name="file-document-outline"
                                size={20}
                                color={statusColor}
                            />

                            <Text
                                style={[
                                    styles.viewQuoteText,
                                    { color: textColor },
                                ]}
                                numberOfLines={1}
                            >
                                {tr("viewFullQuote", "View Full Quote")}
                            </Text>
                        </View>

                        <Ionicons
                            name={isArabic ? "chevron-back" : "chevron-forward"}
                            size={20}
                            color={textColor}
                        />
                    </TouchableOpacity>

                    <View style={styles.quoteMetaRow}>
                        <Text style={[styles.quoteTime, { color: mutedColor }]}>
                            {time}
                        </Text>

                        {isMine && (
                            <Ionicons
                                name="checkmark-done"
                                size={15}
                                color={blueColor}
                            />
                        )}
                    </View>
                </TouchableOpacity>
            </View>

            <QuoteDetailsModal
                visible={detailsVisible}
                onClose={() => setDetailsVisible(false)}
                viewModel={viewModel}
                statusColor={statusColor}
                colors={colors}
                tr={tr}
                isArabic={isArabic}
                canCustomerRespond={canViewerRespond}
                isChangingStatus={isChangingStatus}
                isLoadingQuote={isLoadingQuote}
                onApprove={() => confirmChangeQuoteStatus("approve")}
                onReject={() => confirmChangeQuoteStatus("reject")}
            />
        </>
    );
}

function StatusPill({ label, icon, statusColor, backgroundColor }) {
    return (
        <View
            style={[
                styles.statusPill,
                {
                    borderColor: statusColor,
                    backgroundColor,
                },
            ]}
        >
            <Ionicons
                name={icon}
                size={14}
                color={statusColor}
            />

            <Text
                style={[
                    styles.statusText,
                    { color: statusColor },
                ]}
                numberOfLines={1}
            >
                {label}
            </Text>
        </View>
    );
}

function OptionalQuoteLine(props) {
    if (!isFilledValue(props.value)) {
        return null;
    }

    return <QuoteLine {...props} />;
}

function OptionalDetailRow(props) {
    if (!isFilledValue(props.value)) {
        return null;
    }

    return <DetailRow {...props} />;
}

function QuoteLine({
    icon,
    label,
    value,
    colors,
    isArabic,
    accentColor,
    forceLtrValue = false,
}) {
    const textColor = getTextColor(colors);
    const mutedColor = getMutedColor(colors);

    return (
        <View style={[styles.quoteLine, getRowDirectionStyle(isArabic)]}>
            <MaterialCommunityIcons
                name={icon}
                size={21}
                color={accentColor || getPrimaryColor(colors)}
            />

            <View style={styles.quoteLineTextWrapper}>
                <Text
                    style={[
                        styles.quoteLineLabel,
                        { color: mutedColor },
                        getTextDirectionStyle(isArabic),
                    ]}
                    numberOfLines={1}
                >
                    {label}
                </Text>

                <Text
                    style={[
                        styles.quoteLineValue,
                        { color: textColor },
                        forceLtrValue
                            ? [
                                styles.ltrQuoteLineValue,
                                isArabic
                                    ? styles.ltrQuoteLineValueArabic
                                    : styles.ltrQuoteLineValueEnglish,
                            ]
                            : getTextDirectionStyle(isArabic),
                    ]}
                    numberOfLines={2}
                >
                    {value}
                </Text>
            </View>
        </View>
    );
}

function DetailRow({ label, value, colors, isArabic, forceLtrValue = false }) {
    const textColor = getTextColor(colors);
    const mutedColor = getMutedColor(colors);
    const borderColor = getBorderColor(colors);
    const cardSoftColor = getCardSoftColor(colors);

    return (
        <View
            style={[
                styles.detailRow,
                {
                    backgroundColor: cardSoftColor,
                    borderColor,
                },
            ]}
        >
            <Text
                style={[
                    styles.detailLabel,
                    { color: mutedColor },
                    getTextDirectionStyle(isArabic),
                ]}
                numberOfLines={1}
            >
                {label}
            </Text>

            <Text
                style={[
                    styles.detailValue,
                    { color: textColor },
                    forceLtrValue
                        ? [
                            styles.ltrDetailValue,
                            isArabic
                                ? styles.ltrDetailValueArabic
                                : styles.ltrDetailValueEnglish,
                        ]
                        : getTextDirectionStyle(isArabic),
                ]}
            >
                {value}
            </Text>
        </View>
    );
}

function QuoteDetailsModal({
    visible,
    onClose,
    viewModel,
    statusColor,
    colors,
    tr,
    isArabic,
    canCustomerRespond,
    isChangingStatus,
    isLoadingQuote,
    onApprove,
    onReject,
}) {
    const textColor = getTextColor(colors);
    const mutedColor = getMutedColor(colors);
    const modalCardColor = getModalCardColor(colors);
    const cardSoftColor = getCardSoftColor(colors);
    const borderColor = getBorderColor(colors);
    const overlayColor = getOverlayColor(colors);
    const successColor = getSuccessColor(colors);
    const dangerColor = getDangerColor(colors);

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
            <View style={[styles.detailsOverlay, { backgroundColor: overlayColor }]}>
                <View
                    style={[
                        styles.detailsCard,
                        {
                            backgroundColor: modalCardColor,
                            borderColor,
                        },
                    ]}
                >
                    <View style={[styles.detailsHeader, getRowDirectionStyle(isArabic)]}>
                        <View style={styles.detailsTitleWrapper}>
                            <Text
                                style={[
                                    styles.detailsTitle,
                                    { color: statusColor },
                                    getTextDirectionStyle(isArabic),
                                ]}
                            >
                                {tr("quoteSummary", "Quote Summary")}
                            </Text>

                            {!!viewModel.quoteId && (
                                <Text
                                    style={[
                                        styles.detailsSubtitle,
                                        { color: mutedColor },
                                        getTextDirectionStyle(isArabic),
                                    ]}
                                >
                                    #{viewModel.quoteId}
                                </Text>
                            )}
                        </View>

                        <TouchableOpacity
                            style={[
                                styles.detailsCloseButton,
                                {
                                    backgroundColor: cardSoftColor,
                                    borderColor,
                                },
                            ]}
                            activeOpacity={0.85}
                            onPress={onClose}
                        >
                            <Ionicons name="close" size={24} color={textColor} />
                        </TouchableOpacity>
                    </View>

                    <View style={[styles.detailsStatusRow, getRowDirectionStyle(isArabic)]}>
                        <StatusPill
                            label={viewModel.statusLabel}
                            icon={viewModel.statusIcon}
                            statusColor={statusColor}
                            backgroundColor={cardSoftColor}
                        />

                        <Text
                            style={[
                                styles.detailsStatusText,
                                { color: mutedColor },
                                getTextDirectionStyle(isArabic),
                            ]}
                        >
                            {tr("quoteStatusHint", "The recipient can approve or reject the quote while it is pending.")}
                        </Text>
                    </View>

                    {isLoadingQuote && (
                        <View style={[styles.detailsLoadingRow, getRowDirectionStyle(isArabic)]}>
                            <ActivityIndicator size="small" color={statusColor} />
                            <Text
                                style={[
                                    styles.detailsStatusText,
                                    { color: mutedColor },
                                    getTextDirectionStyle(isArabic),
                                ]}
                            >
                                {tr("loadingQuote", "Loading quote details...")}
                            </Text>
                        </View>
                    )}

                    <ScrollView
                        style={styles.detailsScroll}
                        contentContainerStyle={styles.detailsScrollContent}
                        showsVerticalScrollIndicator={false}
                    >
                        <OptionalDetailRow
                            label={tr("route", "Route")}
                            value={viewModel.routeText}
                            colors={colors}
                            isArabic={isArabic}
                        />

                        <OptionalDetailRow
                            label={tr("riskLevel", "Risk")}
                            value={viewModel.riskLevel}
                            colors={colors}
                            isArabic={isArabic}
                        />

                        <OptionalDetailRow
                            label={tr("cargoType", "Cargo Type")}
                            value={viewModel.cargoType}
                            colors={colors}
                            isArabic={isArabic}
                        />

                        <OptionalDetailRow
                            label={tr("container", "Container")}
                            value={viewModel.containerType}
                            colors={colors}
                            isArabic={isArabic}
                        />

                        <OptionalDetailRow
                            label={tr("volumeWeight", "Volume / Weight")}
                            value={viewModel.volumeWeight}
                            colors={colors}
                            isArabic={isArabic}
                            forceLtrValue
                        />

                        <OptionalDetailRow
                            label="ETD"
                            value={viewModel.etdDate}
                            colors={colors}
                            isArabic={isArabic}
                        />

                        <OptionalDetailRow
                            label="ETA"
                            value={viewModel.etaDate}
                            colors={colors}
                            isArabic={isArabic}
                        />

                        <OptionalDetailRow
                            label={tr("totalPrice", "Total Price")}
                            value={viewModel.priceText}
                            colors={colors}
                            isArabic={isArabic}
                            forceLtrValue
                        />

                        <OptionalDetailRow
                            label={tr("validUntil", "Valid Until")}
                            value={viewModel.validUntil}
                            colors={colors}
                            isArabic={isArabic}
                        />

                        {viewModel.includes.length > 0 && (
                            <View
                                style={[
                                    styles.detailRow,
                                    {
                                        backgroundColor: cardSoftColor,
                                        borderColor,
                                    },
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.detailLabel,
                                        { color: mutedColor },
                                        getTextDirectionStyle(isArabic),
                                    ]}
                                >
                                    {tr("includes", "Includes")}
                                </Text>

                                {viewModel.includes.map((includeItem, index) => (
                                    <View
                                        key={`${includeItem}-${index}`}
                                        style={[
                                            styles.detailsIncludeRow,
                                            getRowDirectionStyle(isArabic),
                                        ]}
                                    >
                                        <Ionicons
                                            name="checkmark"
                                            size={15}
                                            color={statusColor}
                                        />
                                        <Text
                                            style={[
                                                styles.detailsIncludeText,
                                                { color: textColor },
                                                getTextDirectionStyle(isArabic),
                                            ]}
                                        >
                                            {includeItem}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        )}

                        <OptionalDetailRow
                            label={tr("notes", "Notes")}
                            value={viewModel.notes}
                            colors={colors}
                            isArabic={isArabic}
                        />
                    </ScrollView>

                    {canCustomerRespond && (
                        <View
                            style={[
                                styles.detailsActions,
                                {
                                    borderTopColor: borderColor,
                                },
                                getRowDirectionStyle(isArabic),
                            ]}
                        >
                            <TouchableOpacity
                                style={[
                                    styles.detailsActionButton,
                                    { backgroundColor: successColor },
                                    isChangingStatus && styles.disabledButton,
                                ]}
                                activeOpacity={0.85}
                                onPress={onApprove}
                                disabled={isChangingStatus}
                            >
                                {isChangingStatus ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <>
                                        <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                                        <Text style={styles.actionButtonText}>
                                            {tr("approveQuote", "Approve")}
                                        </Text>
                                    </>
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[
                                    styles.detailsActionButton,
                                    styles.rejectButton,
                                    {
                                        borderColor: dangerColor,
                                        backgroundColor: cardSoftColor,
                                    },
                                    isChangingStatus && styles.disabledButton,
                                ]}
                                activeOpacity={0.85}
                                onPress={onReject}
                                disabled={isChangingStatus}
                            >
                                <Ionicons name="close" size={18} color={dangerColor} />
                                <Text style={[styles.rejectButtonText, { color: dangerColor }]}>
                                    {tr("rejectQuote", "Reject")}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    quoteRow: {
        marginBottom: 10,
        flexDirection: "row",
    },

    myQuoteRow: {
        justifyContent: "flex-end",
    },

    employeeQuoteRow: {
        justifyContent: "flex-start",
    },

    quoteCard: {
        width: "100%",
        maxWidth: 560,
        borderRadius: 18,
        borderWidth: 1.4,
        padding: 14,
    },

    quoteCardCompact: {
        padding: 12,
        borderRadius: 16,
    },

    quoteHeader: {
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 10,
        marginBottom: 12,
    },

    quoteHeaderTitleWrapper: {
        flex: 1,
        minWidth: 0,
    },

    quoteTitle: {
        fontSize: 16,
        fontWeight: "900",
    },

    quoteTitleCompact: {
        fontSize: 15,
    },

    quoteNumber: {
        marginTop: 2,
        fontSize: 11,
        fontWeight: "800",
    },

    statusPill: {
        minHeight: 28,
        maxWidth: 140,
        borderRadius: 14,
        borderWidth: 1,
        paddingHorizontal: 8,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 5,
        flexShrink: 0,
    },

    statusText: {
        fontSize: 11,
        fontWeight: "900",
    },

    quoteBody: {
        flexDirection: "row",
        gap: 12,
    },

    quoteBodyCompact: {
        flexDirection: "column",
        gap: 12,
    },

    quoteDetails: {
        flex: 1,
        gap: 9,
        minWidth: 0,
    },

    loadingQuoteRow: {
        marginTop: 2,
        flexDirection: "row",
        alignItems: "center",
        gap: 7,
    },

    loadingQuoteText: {
        flex: 1,
        minWidth: 0,
        fontSize: 12,
        fontWeight: "800",
    },

    quoteLine: {
        flexDirection: "row",
        gap: 8,
        alignItems: "flex-start",
    },

    quoteLineTextWrapper: {
        flex: 1,
        minWidth: 0,
    },

    quoteLineLabel: {
        fontSize: 12,
        fontWeight: "700",
    },

    quoteLineValue: {
        fontSize: 13,
        fontWeight: "800",
        marginTop: 1,
        lineHeight: 18,
    },

    ltrQuoteLineValue: {
        writingDirection: "ltr",
    },

    ltrQuoteLineValueArabic: {
        textAlign: "right",
    },

    ltrQuoteLineValueEnglish: {
        textAlign: "left",
    },

    ltrValueText: {
        writingDirection: "ltr",
    },

    priceCard: {
        width: 164,
        borderRadius: 16,
        borderWidth: 1,
        padding: 10,
        flexShrink: 0,
    },

    priceCardCompact: {
        width: "100%",
    },

    priceLabel: {
        fontSize: 12,
        fontWeight: "800",
        textAlign: "center",
    },

    priceValue: {
        marginTop: 5,
        fontSize: 21,
        fontWeight: "900",
        textAlign: "center",
    },

    emptyPriceValue: {
        opacity: 0.55,
    },

    priceValueCompact: {
        fontSize: 20,
    },

    validText: {
        marginTop: 6,
        fontSize: 11,
        fontWeight: "700",
        textAlign: "center",
        lineHeight: 16,
    },

    divider: {
        height: 1,
        marginVertical: 8,
    },

    includesTitle: {
        fontSize: 12,
        fontWeight: "900",
        marginBottom: 4,
    },

    includeRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        marginTop: 3,
    },

    includeText: {
        flex: 1,
        minWidth: 0,
        fontSize: 10.5,
        fontWeight: "700",
    },

    notesBox: {
        marginTop: 12,
        borderWidth: 1,
        borderRadius: 14,
        padding: 10,
    },

    notesLabel: {
        fontSize: 12,
        fontWeight: "900",
        marginBottom: 3,
    },

    notesText: {
        fontSize: 12.5,
        fontWeight: "700",
        lineHeight: 18,
    },

    actionRow: {
        marginTop: 13,
        flexDirection: "row",
        gap: 9,
    },

    actionButton: {
        flex: 1,
        minHeight: 44,
        borderRadius: 14,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 7,
        paddingHorizontal: 10,
    },

    actionButtonText: {
        color: "#FFFFFF",
        fontSize: 14,
        fontWeight: "900",
    },

    rejectButton: {
        borderWidth: 1,
    },

    rejectButtonText: {
        fontSize: 14,
        fontWeight: "900",
    },

    disabledButton: {
        opacity: 0.7,
    },

    viewQuoteButton: {
        marginTop: 13,
        borderWidth: 1,
        borderRadius: 13,
        paddingVertical: 10,
        paddingHorizontal: 12,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
    },

    viewQuoteLeft: {
        flex: 1,
        minWidth: 0,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },

    viewQuoteText: {
        fontSize: 14,
        fontWeight: "900",
    },

    quoteMetaRow: {
        marginTop: 6,
        flexDirection: "row",
        justifyContent: "flex-end",
        alignItems: "center",
        gap: 4,
    },

    quoteTime: {
        fontSize: 11.5,
        fontWeight: "600",
    },

    detailsOverlay: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 18,
        paddingVertical: 36,
    },

    detailsCard: {
        width: "100%",
        maxWidth: 350,
        maxHeight: "90%",
        borderWidth: 1,
        borderRadius: 24,
        overflow: "hidden",
    },

    detailsHeader: {
        minHeight: 70,
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 10,
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 12,
    },

    detailsTitleWrapper: {
        flex: 1,
        minWidth: 0,
    },

    detailsTitle: {
        fontSize: 19,
        fontWeight: "900",
    },

    detailsSubtitle: {
        marginTop: 3,
        fontSize: 12,
        fontWeight: "800",
    },

    detailsCloseButton: {
        width: 42,
        height: 42,
        borderRadius: 21,
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
    },

    detailsStatusRow: {
        paddingHorizontal: 16,
        paddingBottom: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },

    detailsLoadingRow: {
        paddingHorizontal: 16,
        paddingBottom: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },

    detailsStatusText: {
        flex: 1,
        minWidth: 0,
        fontSize: 11.5,
        fontWeight: "700",
        lineHeight: 17,
    },

    detailsScroll: {
        flexGrow: 0,
    },

    detailsScrollContent: {
        paddingHorizontal: 16,
        paddingBottom: 14,
        gap: 8,
    },

    detailRow: {
        borderWidth: 1,
        borderRadius: 14,
        padding: 10,
    },

    detailLabel: {
        fontSize: 11.5,
        fontWeight: "900",
        marginBottom: 4,
    },

    detailValue: {
        fontSize: 14,
        fontWeight: "800",
        lineHeight: 20,
    },

    ltrDetailValue: {
        writingDirection: "ltr",
    },

    ltrDetailValueArabic: {
        textAlign: "right",
    },

    ltrDetailValueEnglish: {
        textAlign: "left",
    },

    detailsIncludeRow: {
        marginTop: 6,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },

    detailsIncludeText: {
        flex: 1,
        minWidth: 0,
        fontSize: 13,
        fontWeight: "800",
        lineHeight: 18,
    },

    detailsActions: {
        borderTopWidth: 1,
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 16,
        flexDirection: "row",
        gap: 10,
    },

    detailsActionButton: {
        flex: 1,
        minHeight: 46,
        borderRadius: 15,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 7,
        paddingHorizontal: 10,
    },
});
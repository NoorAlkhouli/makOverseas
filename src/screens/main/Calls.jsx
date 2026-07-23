import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";

import MainNavBar from "@/src/components/MainNavBar";
import { useAppRealtime } from "@/src/context/AppRealtimeProvider";
import { LANGUAGE_STORAGE_KEY } from "@/src/i18n";
import apiClient, { API_BASE_URL } from "@/src/services/api/apiClient";
import notificationService from "@/src/services/api/notificationService";
import {
  getRowDirectionStyle,
  getTextDirectionStyle,
  getTextInputDirectionFromValue,
} from "@/src/styles/globalStyles";
import { useAppTheme } from "@/src/theme/ThemeProvider";

const CALL_NOTIFICATION_TYPES = {
  INCOMING: 3,
  MISSED: 4,
};

const CALL_FILTERS = ["all", "missed", "incoming", "outgoing"];

const CALLS_TEXT = {
  en: {
    navTitle: "Calls",
    title: "Calls",
    subtitle: "Your recent voice calls",
    searchPlaceholder: "Search calls...",
    all: "All",
    missed: "Missed",
    incoming: "Incoming",
    outgoing: "Outgoing",
    recentCalls: "Recent calls",
    newCall: "New call",
    loading: "Loading calls...",
    errorTitle: "Couldn't load calls",
    errorText: "Please check your connection and try again.",
    retry: "Try again",
    emptyTitle: "No calls found",
    emptyText: "Incoming and missed calls will appear here.",
    outgoingEmpty:
      "Outgoing call history will appear when it becomes available from the server.",
    noSearchResults: "No calls match your search.",
    unknownCaller: "Unknown caller",
    detailsTitle: "Call details",
    callId: "Call ID",
    status: "Status",
    date: "Date",
    close: "Close",
    today: "Today",
    yesterday: "Yesterday",
  },
  ar: {
    navTitle: "المكالمات",
    title: "المكالمات",
    subtitle: "مكالماتك الصوتية الأخيرة",
    searchPlaceholder: "البحث في المكالمات...",
    all: "الكل",
    missed: "الفائتة",
    incoming: "الواردة",
    outgoing: "الصادرة",
    recentCalls: "المكالمات الأخيرة",
    newCall: "مكالمة جديدة",
    loading: "جاري تحميل المكالمات...",
    errorTitle: "تعذّر تحميل المكالمات",
    errorText: "تحققي من الاتصال وحاولي مرة ثانية.",
    retry: "إعادة المحاولة",
    emptyTitle: "لا توجد مكالمات",
    emptyText: "ستظهر المكالمات الواردة والفائتة هنا.",
    outgoingEmpty:
      "سيظهر سجل المكالمات الصادرة عندما يصبح متاحاً من السيرفر.",
    noSearchResults: "لا توجد مكالمات مطابقة للبحث.",
    unknownCaller: "متصل غير معروف",
    detailsTitle: "تفاصيل المكالمة",
    callId: "رقم المكالمة",
    status: "الحالة",
    date: "التاريخ",
    close: "إغلاق",
    today: "اليوم",
    yesterday: "أمس",
  },
};

const getRealtimeNotification = (payload) => {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  if (payload.notification?.id) {
    return payload.notification;
  }

  if (payload.data?.notification?.id) {
    return payload.data.notification;
  }

  if (payload.id && (payload.title || payload.type)) {
    return payload;
  }

  if (payload.data?.id && (payload.data?.title || payload.data?.type)) {
    return payload.data;
  }

  return null;
};

const getCallId = (notification) => {
  return (
    notification?.action?.call_id ??
    notification?.action?.target_id ??
    notification?.data?.call_id ??
    null
  );
};

const getCaller = (notification) => {
  return (
    notification?.caller ??
    notification?.data?.caller ??
    notification?.data?.user ??
    null
  );
};

const normalizeAvatarUrl = (value) => {
  if (!value || typeof value !== "string") {
    return null;
  }

  const cleanValue = value.trim();

  if (!cleanValue) {
    return null;
  }

  if (
    cleanValue.startsWith("http://") ||
    cleanValue.startsWith("https://")
  ) {
    return cleanValue;
  }

  if (cleanValue.startsWith("/")) {
    return `${API_BASE_URL}${cleanValue}`;
  }

  return `${API_BASE_URL}/${cleanValue}`;
};

const getInitials = (name) => {
  if (!name || typeof name !== "string") {
    return "?";
  }

  const words = name.trim().split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return "?";
  }

  return words
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
};

const formatCallDate = (value, isArabic, strings) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const now = new Date();
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );
  const callDayStart = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );
  const dayDifference = Math.round(
    (todayStart.getTime() - callDayStart.getTime()) / 86400000
  );
  const locale = isArabic ? "ar" : "en";
  const timeText = new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);

  if (dayDifference === 0) {
    return `${strings.today}, ${timeText}`;
  }

  if (dayDifference === 1) {
    return `${strings.yesterday}, ${timeText}`;
  }

  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  }).format(date);
};

const normalizeCallNotification = (notification, isArabic, strings) => {
  if (!notification?.id) {
    return null;
  }

  const type = Number(notification.type);

  if (
    type !== CALL_NOTIFICATION_TYPES.INCOMING &&
    type !== CALL_NOTIFICATION_TYPES.MISSED
  ) {
    return null;
  }

  const caller = getCaller(notification);
  const callerName =
    caller?.full_name ||
    caller?.fullName ||
    notification?.data?.caller_name ||
    notification?.data?.callerName ||
    notification?.title ||
    strings.unknownCaller;
  const kind =
    type === CALL_NOTIFICATION_TYPES.MISSED ? "missed" : "incoming";
  const createdAt = notification.created_at || new Date().toISOString();

  return {
    id: String(notification.id),
    callId: getCallId(notification),
    type,
    kind,
    callerName,
    body: notification.body || "",
    avatar: normalizeAvatarUrl(
      caller?.avatar ||
      caller?.avatar_url ||
      notification?.data?.caller_avatar ||
      notification?.data?.avatar ||
      null
    ),
    createdAt,
    dateText: formatCallDate(createdAt, isArabic, strings),
    readAt: notification.read_at || null,
    raw: notification,
  };
};

const sortCallsNewestFirst = (items) => {
  return [...items].sort((first, second) => {
    const firstTime = new Date(first.createdAt).getTime();
    const secondTime = new Date(second.createdAt).getTime();

    return secondTime - firstTime;
  });
};

export default function Calls({ navigation, route }) {
  const { t, i18n } = useTranslation();
  const { width } = useWindowDimensions();
  const { colors, isDark } = useAppTheme();
  const { latestNotificationEvent } = useAppRealtime();

  const isArabic = i18n.language === "ar";
  const isSmallScreen = width < 380;
  const strings = isArabic ? CALLS_TEXT.ar : CALLS_TEXT.en;

  const styles = useMemo(
    () => createStyles(colors, isSmallScreen),
    [colors, isSmallScreen]
  );

  const [showNavTitle, setShowNavTitle] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [calls, setCalls] = useState([]);
  const [selectedCall, setSelectedCall] = useState(null);
  const [highlightedCallId, setHighlightedCallId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const mainScrollRef = useRef(null);
  const hasLoadedCallsRef = useRef(false);
  const knownNotificationIdsRef = useRef(new Set());
  const handledNotificationEventRef = useRef(null);
  const handledRouteCallRef = useRef(null);

  const loadCalls = useCallback(
    async ({ refreshing = false } = {}) => {
      try {
        setErrorMessage("");

        if (refreshing) {
          setIsRefreshing(true);
        } else if (!hasLoadedCallsRef.current) {
          setIsLoading(true);
        }

        const result = await notificationService.getNotifications({
          page: 1,
          perPage: 100,
        });

        const nextCalls = result.items
          .map((notification) =>
            normalizeCallNotification(
              notification,
              isArabic,
              strings
            )
          )
          .filter(Boolean);

        knownNotificationIdsRef.current = new Set(
          nextCalls.map((call) => call.id)
        );

        setCalls(sortCallsNewestFirst(nextCalls));
        hasLoadedCallsRef.current = true;
      } catch (error) {
        console.log("Load call notifications error:", error?.raw || error);
        setErrorMessage(error?.userMessage || strings.errorText);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [isArabic, strings]
  );

  useFocusEffect(
    useCallback(() => {
      loadCalls();
    }, [loadCalls])
  );

  useEffect(() => {
    if (
      !latestNotificationEvent ||
      handledNotificationEventRef.current === latestNotificationEvent
    ) {
      return;
    }

    handledNotificationEventRef.current = latestNotificationEvent;

    const notification = getRealtimeNotification(latestNotificationEvent);
    const normalizedCall = normalizeCallNotification(
      notification,
      isArabic,
      strings
    );

    if (!normalizedCall) {
      return;
    }

    knownNotificationIdsRef.current.add(normalizedCall.id);

    setCalls((currentCalls) =>
      sortCallsNewestFirst([
        normalizedCall,
        ...currentCalls.filter((item) => item.id !== normalizedCall.id),
      ])
    );
  }, [isArabic, latestNotificationEvent, strings]);

  const targetCallId =
    route?.params?.callId ?? route?.params?.call_id ?? null;
  const targetNotificationId = route?.params?.notificationId ?? null;

  useEffect(() => {
    if (!targetCallId || isLoading) {
      return;
    }

    const routeKey = `${targetNotificationId || "call"}:${targetCallId}`;

    if (handledRouteCallRef.current === routeKey) {
      return;
    }

    const targetCall = calls.find(
      (item) => String(item.callId) === String(targetCallId)
    );

    handledRouteCallRef.current = routeKey;

    navigation.setParams({
      callId: undefined,
      call_id: undefined,
      notificationId: undefined,
      notificationAction: undefined,
    });

    if (!targetCall) {
      return;
    }

    setSearchText("");
    setActiveFilter("all");
    setHighlightedCallId(String(targetCall.callId));
    setSelectedCall(targetCall);

    setTimeout(() => {
      setHighlightedCallId(null);
    }, 2200);
  }, [calls, isLoading, navigation, targetCallId, targetNotificationId]);

  const filteredCalls = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();

    return calls.filter((call) => {
      const matchesFilter =
        activeFilter === "all"
          ? true
          : activeFilter === "outgoing"
            ? false
            : call.kind === activeFilter;
      const matchesSearch =
        !keyword ||
        call.callerName.toLowerCase().includes(keyword) ||
        call.body.toLowerCase().includes(keyword) ||
        String(call.callId || "").includes(keyword);

      return matchesFilter && matchesSearch;
    });
  }, [activeFilter, calls, searchText]);

  const handleScroll = useCallback(
    (event) => {
      const y = event.nativeEvent.contentOffset.y;

      if (y > 45 && !showNavTitle) {
        setShowNavTitle(true);
      }

      if (y <= 45 && showNavTitle) {
        setShowNavTitle(false);
      }
    },
    [showNavTitle]
  );

  const toggleLanguage = async () => {
    const nextLanguage = isArabic ? "en" : "ar";

    setShowNavTitle(false);
    mainScrollRef.current?.scrollTo({ y: 0, animated: false });

    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
    await apiClient.setLanguage(nextLanguage);
    await i18n.changeLanguage(nextLanguage);

    setTimeout(() => {
      mainScrollRef.current?.scrollTo({ y: 0, animated: false });
    }, 80);
  };

  const handleNewCall = () => {
    navigation.navigate("Search", {
      mode: "start_call",
      source: "calls",
    });
  };

  const getEmptyMessage = () => {
    if (searchText.trim()) {
      return strings.noSearchResults;
    }

    if (activeFilter === "outgoing") {
      return strings.outgoingEmpty;
    }

    return strings.emptyText;
  };

  const renderCallsContent = () => {
    if (isLoading) {
      return (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={colors.primary} />

          <Text
            style={[
              styles.centerText,
              getTextDirectionStyle(isArabic),
            ]}
          >
            {strings.loading}
          </Text>
        </View>
      );
    }

    if (errorMessage && calls.length === 0) {
      return (
        <View style={styles.errorBox}>
          <Feather
            name="alert-circle"
            size={34}
            color={colors.danger}
          />

          <Text style={styles.errorTitle}>{strings.errorTitle}</Text>
          <Text style={styles.errorText}>{errorMessage}</Text>

          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.retryButton}
            onPress={() => loadCalls()}
          >
            <Text style={styles.retryButtonText}>
              {strings.retry}
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (filteredCalls.length === 0) {
      return (
        <View style={styles.emptyBox}>
          <View style={styles.emptyIconBox}>
            <Feather
              name="phone-call"
              size={28}
              color={colors.primary}
            />
          </View>

          <Text style={styles.emptyTitle}>{strings.emptyTitle}</Text>
          <Text style={styles.emptyText}>{getEmptyMessage()}</Text>
        </View>
      );
    }

    return (
      <View style={styles.callsList}>
        {filteredCalls.map((call) => (
          <CallCard
            key={call.id}
            call={call}
            colors={colors}
            styles={styles}
            strings={strings}
            isArabic={isArabic}
            isHighlighted={
              highlightedCallId &&
              String(call.callId) === highlightedCallId
            }
            onPress={() => setSelectedCall(call)}
          />
        ))}
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <StatusBar
        style={isDark ? "light" : "dark"}
        translucent
        backgroundColor="transparent"
      />

      <MainNavBar
        navigation={navigation}
        title={strings.navTitle}
        showTitle={showNavTitle}
        onToggleLanguage={toggleLanguage}
        menuItems={[
          {
            key: "profile",
            label: t("bottomTabs.profile"),
            iconType: "feather",
            iconName: "user",
            onPress: () => navigation.navigate("Profile"),
          },
        ]}
      />

      <ScrollView
        ref={mainScrollRef}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadCalls({ refreshing: true })}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <View style={styles.headerBox}>
          <Text
            style={[
              styles.title,
              getTextDirectionStyle(isArabic),
            ]}
          >
            {strings.title}
          </Text>

          <Text
            style={[
              styles.subtitle,
              getTextDirectionStyle(isArabic),
            ]}
          >
            {strings.subtitle}
          </Text>
        </View>

        <View
          style={[
            styles.searchBox,
            getRowDirectionStyle(isArabic),
          ]}
        >
          <Feather name="search" size={20} color={colors.textMuted} />

          <TextInput
            value={searchText}
            onChangeText={setSearchText}
            placeholder={strings.searchPlaceholder}
            placeholderTextColor={colors.textMuted}
            style={[
              styles.searchInput,
              getTextInputDirectionFromValue(
                searchText,
                isArabic
              ),
            ]}
            autoCorrect={false}
            autoCapitalize="none"
          />

          {!!searchText && (
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => setSearchText("")}
            >
              <Feather
                name="x"
                size={18}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[
            styles.filtersContent,
            isArabic && styles.filtersContentArabic,
          ]}
          style={styles.filtersScroll}
        >
          {CALL_FILTERS.map((filterKey) => {
            const isActive = activeFilter === filterKey;

            return (
              <TouchableOpacity
                key={filterKey}
                activeOpacity={0.85}
                style={[
                  styles.filterButton,
                  isActive && styles.filterButtonActive,
                ]}
                onPress={() => setActiveFilter(filterKey)}
              >
                <Text
                  style={[
                    styles.filterButtonText,
                    isActive &&
                    styles.filterButtonTextActive,
                  ]}
                >
                  {strings[filterKey]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View
          style={[
            styles.sectionHeader,
            getRowDirectionStyle(isArabic),
          ]}
        >
          <View
            style={[
              styles.sectionTitleBox,
              getRowDirectionStyle(isArabic),
            ]}
          >
            <Feather
              name="clock"
              size={21}
              color={colors.primary}
            />

            <Text
              style={[
                styles.sectionTitle,
                getTextDirectionStyle(isArabic),
              ]}
            >
              {strings.recentCalls}
            </Text>
          </View>

          <View style={styles.sectionLine} />

          <TouchableOpacity
            activeOpacity={0.86}
            style={styles.newCallButton}
            onPress={handleNewCall}
            accessibilityRole="button"
            accessibilityLabel={strings.newCall}
          >
            <Feather
              name="phone-call"
              size={21}
              color={colors.darkText}
            />
            <View style={styles.newCallPlusBadge}>
              <Feather
                name="plus"
                size={10}
                color={colors.darkText}
              />
            </View>
          </TouchableOpacity>
        </View>

        {renderCallsContent()}
      </ScrollView>

      <CallDetailsModal
        visible={Boolean(selectedCall)}
        call={selectedCall}
        colors={colors}
        styles={styles}
        strings={strings}
        isArabic={isArabic}
        onClose={() => setSelectedCall(null)}
      />
    </View>
  );
}

function CallCard({
  call,
  colors,
  styles,
  strings,
  isArabic,
  isHighlighted,
  onPress,
}) {
  const isMissed = call.kind === "missed";
  const statusColor = isMissed ? colors.danger : colors.primary;
  const iconName = isMissed ? "phone-missed" : "phone-incoming";
  const statusText = isMissed ? strings.missed : strings.incoming;

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      style={[
        styles.callCard,
        getRowDirectionStyle(isArabic),
        isHighlighted && styles.callCardHighlighted,
      ]}
      onPress={onPress}
    >
      <View style={styles.avatarBox}>
        {call.avatar ? (
          <Image
            source={{ uri: call.avatar }}
            style={styles.avatarImage}
            resizeMode="cover"
          />
        ) : (
          <Text style={styles.avatarText}>
            {getInitials(call.callerName)}
          </Text>
        )}
      </View>

      <View style={styles.callContent}>
        <Text
          numberOfLines={1}
          style={[
            styles.callerName,
            isMissed && { color: colors.danger },
            getTextDirectionStyle(isArabic),
          ]}
        >
          {call.callerName}
        </Text>

        <View
          style={[
            styles.callStatusRow,
            getRowDirectionStyle(isArabic),
          ]}
        >
          <Feather name={iconName} size={16} color={statusColor} />
          <Text style={[styles.callStatusText, { color: statusColor }]}>
            {statusText}
          </Text>
        </View>

        {!!call.body && (
          <Text
            numberOfLines={1}
            style={[
              styles.callBody,
              getTextDirectionStyle(isArabic),
            ]}
          >
            {call.body}
          </Text>
        )}
      </View>

      <View
        style={[
          styles.callMeta,
          isArabic && styles.callMetaArabic,
        ]}
      >
        <Text numberOfLines={1} style={styles.callDateText}>
          {call.dateText}
        </Text>

        <View style={styles.infoButton}>
          <Feather
            name="info"
            size={19}
            color={colors.textPrimary}
          />
        </View>
      </View>
    </TouchableOpacity>
  );
}

function CallDetailsModal({
  visible,
  call,
  colors,
  styles,
  strings,
  isArabic,
  onClose,
}) {
  if (!call) {
    return null;
  }

  const isMissed = call.kind === "missed";
  const statusText = isMissed ? strings.missed : strings.incoming;
  const statusColor = isMissed ? colors.danger : colors.primary;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View
            style={[
              styles.modalHeader,
              getRowDirectionStyle(isArabic),
            ]}
          >
            <Text
              style={[
                styles.modalTitle,
                getTextDirectionStyle(isArabic),
              ]}
            >
              {strings.detailsTitle}
            </Text>

            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.modalCloseIcon}
              onPress={onClose}
            >
              <Feather
                name="x"
                size={20}
                color={colors.textPrimary}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.modalPersonBox}>
            <View style={styles.modalAvatarBox}>
              {call.avatar ? (
                <Image
                  source={{ uri: call.avatar }}
                  style={styles.avatarImage}
                  resizeMode="cover"
                />
              ) : (
                <Text style={styles.modalAvatarText}>
                  {getInitials(call.callerName)}
                </Text>
              )}
            </View>

            <Text style={styles.modalCallerName} numberOfLines={2}>
              {call.callerName}
            </Text>

            <View style={styles.modalStatusPill}>
              <Feather
                name={isMissed ? "phone-missed" : "phone-incoming"}
                size={16}
                color={statusColor}
              />
              <Text style={[styles.modalStatusText, { color: statusColor }]}>
                {statusText}
              </Text>
            </View>
          </View>

          <View style={styles.detailsBox}>
            <DetailRow
              label={strings.date}
              value={call.dateText}
              isArabic={isArabic}
              styles={styles}
            />

            <View style={styles.detailDivider} />

            <DetailRow
              label={strings.callId}
              value={call.callId ? String(call.callId) : "—"}
              isArabic={isArabic}
              styles={styles}
            />

            {!!call.body && (
              <>
                <View style={styles.detailDivider} />
                <Text
                  style={[
                    styles.modalBodyText,
                    getTextDirectionStyle(isArabic),
                  ]}
                >
                  {call.body}
                </Text>
              </>
            )}
          </View>

          <TouchableOpacity
            activeOpacity={0.86}
            style={styles.modalCloseButton}
            onPress={onClose}
          >
            <Text style={styles.modalCloseButtonText}>
              {strings.close}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function DetailRow({ label, value, isArabic, styles }) {
  return (
    <View style={[styles.detailRow, getRowDirectionStyle(isArabic)]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const createStyles = (colors, isSmallScreen) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },

    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: isSmallScreen ? 14 : 20,
      paddingTop: Platform.OS === "android" ? 130 : 145,
      paddingBottom: Platform.OS === "android" ? 120 : 130,
    },

    headerBox: {
      marginTop: 10,
      marginBottom: 18,
    },

    title: {
      color: colors.textPrimary,
      fontSize: isSmallScreen ? 32 : 36,
      fontWeight: "900",
      marginBottom: 8,
    },

    subtitle: {
      color: colors.textSecondary,
      fontSize: isSmallScreen ? 14.5 : 16,
      lineHeight: isSmallScreen ? 22 : 24,
      fontWeight: "700",
    },

    searchBox: {
      minHeight: 54,
      borderRadius: 17,
      paddingHorizontal: 14,
      backgroundColor: colors.cardSoft,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 14,
    },

    searchInput: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: "700",
      paddingVertical: 0,
    },

    filtersScroll: {
      flexGrow: 0,
      height: 44,
      maxHeight: 44,
      marginBottom: 18,
    },

    filtersContent: {
      height: 44,
      alignItems: "center",
      gap: 9,
      paddingRight: 4,
    },

    filtersContentArabic: {
      flexDirection: "row-reverse",
      paddingRight: 0,
      paddingLeft: 4,
    },

    filterButton: {
      minWidth: isSmallScreen ? 76 : 86,
      height: 42,
      paddingHorizontal: 14,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.cardSoft,
      borderWidth: 1,
      borderColor: colors.border,
    },

    filterButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },

    filterButtonText: {
      color: colors.textSecondary,
      fontSize: isSmallScreen ? 12.5 : 13.5,
      fontWeight: "800",
    },

    filterButtonTextActive: {
      color: colors.darkText,
      fontWeight: "900",
    },

    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
      marginTop: 2,
      marginBottom: 12,
    },

    sectionTitleBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },

    sectionTitle: {
      color: colors.textPrimary,
      fontSize: isSmallScreen ? 19 : 21,
      fontWeight: "900",
    },

    sectionLine: {
      flex: 1,
      height: 1,
      backgroundColor: colors.borderSoft,
    },

    newCallButton: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
      position: "relative",
    },

    newCallPlusBadge: {
      position: "absolute",
      right: 8,
      top: 7,
      width: 15,
      height: 15,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.textPrimary,
    },

    callsList: {
      gap: 10,
      marginBottom: 16,
    },

    callCard: {
      minHeight: isSmallScreen ? 96 : 104,
      borderRadius: 18,
      padding: isSmallScreen ? 10 : 12,
      backgroundColor: colors.cardStrong,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      flexDirection: "row",
      alignItems: "center",
      gap: isSmallScreen ? 9 : 12,
    },

    callCardHighlighted: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
    },

    avatarBox: {
      width: isSmallScreen ? 58 : 64,
      height: isSmallScreen ? 58 : 64,
      borderRadius: isSmallScreen ? 29 : 32,
      overflow: "hidden",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.avatarBackground,
      borderWidth: 1,
      borderColor: colors.avatarBorder,
    },

    avatarImage: {
      width: "100%",
      height: "100%",
    },

    avatarText: {
      color: colors.textPrimary,
      fontSize: isSmallScreen ? 18 : 20,
      fontWeight: "900",
    },

    callContent: {
      flex: 1,
      minWidth: 0,
      justifyContent: "center",
    },

    callerName: {
      color: colors.textPrimary,
      fontSize: isSmallScreen ? 15 : 16.5,
      fontWeight: "900",
      marginBottom: 5,
    },

    callStatusRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },

    callStatusText: {
      fontSize: isSmallScreen ? 12.5 : 13.5,
      fontWeight: "800",
    },

    callBody: {
      color: colors.textMuted,
      fontSize: 11.5,
      fontWeight: "600",
      marginTop: 4,
    },

    callMeta: {
      width: isSmallScreen ? 92 : 110,
      minHeight: 62,
      alignItems: "flex-end",
      justifyContent: "space-between",
    },

    callMetaArabic: {
      alignItems: "flex-start",
    },

    callDateText: {
      color: colors.textMuted,
      fontSize: isSmallScreen ? 10.5 : 11.5,
      lineHeight: 16,
      fontWeight: "700",
      textAlign: "right",
    },

    infoButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.buttonSoft,
    },

    centerBox: {
      marginTop: 42,
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    },

    centerText: {
      color: colors.textSecondary,
      fontSize: 15,
      fontWeight: "700",
      marginTop: 12,
      textAlign: "center",
    },

    errorBox: {
      marginTop: 24,
      borderRadius: 22,
      padding: 22,
      alignItems: "center",
      backgroundColor: colors.cardStrong,
      borderWidth: 1,
      borderColor: colors.borderSoft,
    },

    errorTitle: {
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: "900",
      marginTop: 10,
      marginBottom: 6,
      textAlign: "center",
    },

    errorText: {
      color: colors.textSecondary,
      fontSize: 14,
      lineHeight: 21,
      fontWeight: "600",
      textAlign: "center",
      marginBottom: 16,
    },

    retryButton: {
      minHeight: 42,
      borderRadius: 13,
      paddingHorizontal: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
    },

    retryButtonText: {
      color: colors.darkText,
      fontSize: 14,
      fontWeight: "900",
    },

    emptyBox: {
      marginTop: 18,
      borderRadius: 22,
      padding: 24,
      alignItems: "center",
      backgroundColor: colors.cardStrong,
      borderWidth: 1,
      borderColor: colors.borderSoft,
    },

    emptyIconBox: {
      width: 58,
      height: 58,
      borderRadius: 29,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primarySoft,
      borderWidth: 1,
      borderColor: colors.primary,
    },

    emptyTitle: {
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: "900",
      marginTop: 12,
      marginBottom: 6,
      textAlign: "center",
    },

    emptyText: {
      color: colors.textSecondary,
      fontSize: 14,
      lineHeight: 21,
      fontWeight: "600",
      textAlign: "center",
    },

    modalOverlay: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
      backgroundColor: colors.modalOverlay,
    },

    modalCard: {
      width: "100%",
      maxWidth: 430,
      borderRadius: 24,
      padding: 18,
      backgroundColor: colors.modalCard,
      borderWidth: 1,
      borderColor: colors.border,
    },

    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 16,
    },

    modalTitle: {
      color: colors.textPrimary,
      fontSize: 19,
      fontWeight: "900",
    },

    modalCloseIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.buttonSoft,
      borderWidth: 1,
      borderColor: colors.borderSoft,
    },

    modalPersonBox: {
      alignItems: "center",
      paddingVertical: 8,
    },

    modalAvatarBox: {
      width: 82,
      height: 82,
      borderRadius: 41,
      overflow: "hidden",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.avatarBackground,
      borderWidth: 1,
      borderColor: colors.avatarBorder,
    },

    modalAvatarText: {
      color: colors.textPrimary,
      fontSize: 26,
      fontWeight: "900",
    },

    modalCallerName: {
      color: colors.textPrimary,
      fontSize: 20,
      fontWeight: "900",
      marginTop: 10,
      textAlign: "center",
    },

    modalStatusPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 9,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: colors.buttonSoft,
    },

    modalStatusText: {
      fontSize: 13,
      fontWeight: "900",
    },

    detailsBox: {
      marginTop: 14,
      borderRadius: 16,
      paddingHorizontal: 14,
      backgroundColor: colors.cardSoft,
      borderWidth: 1,
      borderColor: colors.borderSoft,
    },

    detailRow: {
      minHeight: 48,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },

    detailLabel: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: "700",
    },

    detailValue: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: 13,
      fontWeight: "800",
      textAlign: "right",
    },

    detailDivider: {
      height: 1,
      backgroundColor: colors.borderSoft,
    },

    modalBodyText: {
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 20,
      fontWeight: "600",
      paddingVertical: 13,
    },

    modalCloseButton: {
      minHeight: 48,
      marginTop: 16,
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
    },

    modalCloseButtonText: {
      color: colors.darkText,
      fontSize: 15,
      fontWeight: "900",
    },
  });
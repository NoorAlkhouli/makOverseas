import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useIsFocused } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Platform,
  RefreshControl,
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
import apiClient from "@/src/services/api/apiClient";
import { initiateCall } from "@/src/services/api/callService";
import { searchCallableContacts } from "@/src/services/api/searchService";
import {
  getRowDirectionStyle,
  getTextDirectionStyle,
  getTextInputDirectionFromValue,
} from "@/src/styles/globalStyles";
import { useAppTheme } from "@/src/theme/ThemeProvider";

const SEARCH_TEXT = {
  en: {
    navTitle: "New call",
    title: "New call",
    subtitle: "Choose someone from your conversations",
    searchPlaceholder: "Search by name or department...",
    helperText: "Only direct conversations with calling enabled are shown.",
    loading: "Loading contacts...",
    errorTitle: "Couldn't load contacts",
    errorText: "Please check your connection and try again.",
    retry: "Try again",
    emptyTitle: "No contacts available",
    emptyText: "Start a direct chat first, then the contact will appear here.",
    noResultsTitle: "No matching contacts",
    noResultsText: "Try another name or department.",
    online: "Online",
    offline: "Offline",
    call: "Call",
    confirmTitle: "Start voice call?",
    confirmText: "Call {{name}} now?",
    cancel: "Cancel",
    start: "Call",
    calling: "Calling...",
    callCreatedTitle: "Call started",
    callCreatedText: "The call request was sent to {{name}}.",
    ok: "OK",
    callFailedTitle: "Couldn't start the call",
    noConversation: "A direct conversation is required before starting a call.",
    activeCall: "There is already an active call.",
  },
  ar: {
    navTitle: "مكالمة جديدة",
    title: "مكالمة جديدة",
    subtitle: "اختاري شخصاً من محادثاتك",
    searchPlaceholder: "البحث بالاسم أو القسم...",
    helperText: "تظهر فقط المحادثات الفردية المسموح بإجراء مكالمة معها.",
    loading: "جاري تحميل جهات الاتصال...",
    errorTitle: "تعذّر تحميل جهات الاتصال",
    errorText: "تحققي من الاتصال وحاولي مرة ثانية.",
    retry: "إعادة المحاولة",
    emptyTitle: "لا توجد جهات اتصال متاحة",
    emptyText: "ابدئي محادثة فردية أولاً، وبعدها سيظهر الشخص هنا.",
    noResultsTitle: "لا توجد نتائج مطابقة",
    noResultsText: "جرّبي اسماً أو قسماً آخر.",
    online: "متصل الآن",
    offline: "غير متصل",
    call: "اتصال",
    confirmTitle: "بدء مكالمة صوتية؟",
    confirmText: "هل تريدين الاتصال بـ {{name}} الآن؟",
    cancel: "إلغاء",
    start: "اتصال",
    calling: "جاري الاتصال...",
    callCreatedTitle: "بدأت المكالمة",
    callCreatedText: "تم إرسال طلب المكالمة إلى {{name}}.",
    ok: "حسناً",
    callFailedTitle: "تعذّر بدء المكالمة",
    noConversation: "يجب وجود محادثة فردية قبل بدء المكالمة.",
    activeCall: "توجد مكالمة فعّالة حالياً.",
  },
};

const getErrorCode = (error) => {
  return (
    error?.code ||
    error?.raw?.code ||
    error?.raw?.data?.code ||
    error?.response?.data?.code ||
    null
  );
};

const replaceName = (value, name) => {
  return value.replace("{{name}}", name || "");
};

const ContactAvatar = ({ contact, isOnline, styles }) => {
  return (
    <View style={styles.avatarBox}>
      {contact.avatar ? (
        <Image source={{ uri: contact.avatar }} style={styles.avatar} />
      ) : (
        <Text style={styles.avatarInitials}>{contact.initials}</Text>
      )}

      {isOnline && <View style={styles.onlineDot} />}
    </View>
  );
};

export default function Search({ navigation }) {
  const { t, i18n } = useTranslation();
  const { width } = useWindowDimensions();
  const { colors, isDark } = useAppTheme();
  const realtime = useAppRealtime();
  const isFocused = useIsFocused();

  const isArabic = i18n.language === "ar";
  const isSmallScreen = width < 380;
  const strings = isArabic ? SEARCH_TEXT.ar : SEARCH_TEXT.en;
  const styles = useMemo(
    () => createStyles(colors, isSmallScreen),
    [colors, isSmallScreen],
  );

  const [searchText, setSearchText] = useState("");
  const [contacts, setContacts] = useState([]);
  const [showNavTitle, setShowNavTitle] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [callingUserId, setCallingUserId] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  const requestIdRef = useRef(0);
  const listRef = useRef(null);

  const loadContacts = useCallback(
    async ({ query = "", refreshing = false, silent = false } = {}) => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;

      try {
        setErrorMessage("");

        if (refreshing) {
          setIsRefreshing(true);
        } else if (!silent) {
          setIsLoading(true);
        }

        const result = await searchCallableContacts({
          query,
          page: 1,
          perPage: 100,
        });

        if (requestId !== requestIdRef.current) {
          return;
        }

        setContacts(result.items);
      } catch (error) {
        if (requestId !== requestIdRef.current) {
          return;
        }

        console.log("Search callable contacts error:", error?.raw || error);

        if (!silent) {
          setContacts([]);
          setErrorMessage(error?.userMessage || strings.errorText);
        }
      } finally {
        if (requestId === requestIdRef.current) {
          if (!silent) {
            setIsLoading(false);
          }
          setIsRefreshing(false);
        }
      }
    },
    [strings.errorText],
  );

  useEffect(() => {
    if (!isFocused) {
      return undefined;
    }

    const timer = setTimeout(
      () => {
        loadContacts({ query: searchText });
      },
      searchText.trim() ? 350 : 0,
    );

    return () => clearTimeout(timer);
  }, [isFocused, loadContacts, searchText]);

  useEffect(() => {
    if (!isFocused) {
      return undefined;
    }

    const presenceRefreshInterval = setInterval(() => {
      loadContacts({
        query: searchText,
        silent: true,
      });
    }, 30000);

    return () => clearInterval(presenceRefreshInterval);
  }, [isFocused, loadContacts, searchText]);

  const isContactOnline = useCallback(
    (contact) => {
      const hasRealtimePresenceSnapshot =
        Number(realtime?.presenceVersion ?? 0) > 0;

      if (
        hasRealtimePresenceSnapshot &&
        typeof realtime?.isUserOnline === "function"
      ) {
        const realtimeStatus = realtime.isUserOnline(contact.userId);

        if (typeof realtimeStatus === "boolean") {
          return realtimeStatus;
        }
      }

      const onlineUserIds = realtime?.onlineUserIds;

      if (hasRealtimePresenceSnapshot && onlineUserIds instanceof Set) {
        return (
          onlineUserIds.has(contact.userId) ||
          onlineUserIds.has(String(contact.userId))
        );
      }

      if (hasRealtimePresenceSnapshot && Array.isArray(onlineUserIds)) {
        return onlineUserIds.some(
          (userId) => String(userId) === String(contact.userId),
        );
      }

      return contact.isOnline;
    },
    [realtime],
  );

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
    [showNavTitle],
  );

  const toggleLanguage = async () => {
    const nextLanguage = isArabic ? "en" : "ar";

    setShowNavTitle(false);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });

    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
    await apiClient.setLanguage(nextLanguage);
    await i18n.changeLanguage(nextLanguage);

    setTimeout(() => {
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
    }, 80);
  };

  const getCallErrorMessage = (error) => {
    const code = getErrorCode(error);

    if (code === "NO_CONVERSATION_FOR_CALL") {
      return strings.noConversation;
    }

    if (code === "ACTIVE_CALL_EXISTS") {
      return strings.activeCall;
    }

    return error?.userMessage || error?.message || strings.errorText;
  };

  const startCall = async (contact) => {
    try {
      setCallingUserId(contact.userId);

      const call = await initiateCall(contact.userId);

      Alert.alert(
        strings.callCreatedTitle,
        replaceName(strings.callCreatedText, contact.name),
        [
          {
            text: strings.ok,
            onPress: () => {
              navigation.navigate("Calls", {
                initiatedCallId: call?.id ?? null,
                refreshAt: Date.now(),
              });
            },
          },
        ],
      );
    } catch (error) {
      console.log("Initiate call error:", error?.raw || error);

      Alert.alert(strings.callFailedTitle, getCallErrorMessage(error), [
        { text: strings.ok },
      ]);
    } finally {
      setCallingUserId(null);
    }
  };

  const confirmCall = (contact) => {
    if (callingUserId) {
      return;
    }

    Alert.alert(
      strings.confirmTitle,
      replaceName(strings.confirmText, contact.name),
      [
        {
          text: strings.cancel,
          style: "cancel",
        },
        {
          text: strings.start,
          onPress: () => startCall(contact),
        },
      ],
    );
  };

  const renderContact = ({ item }) => {
    const isCalling = callingUserId === item.userId;
    const isOnline = isContactOnline(item);

    return (
      <TouchableOpacity
        activeOpacity={0.86}
        disabled={Boolean(callingUserId)}
        onPress={() => confirmCall(item)}
        style={[styles.contactCard, getRowDirectionStyle(isArabic)]}
      >
        <ContactAvatar contact={item} isOnline={isOnline} styles={styles} />

        <View style={styles.contactInfo}>
          <Text
            numberOfLines={1}
            style={[styles.contactName, getTextDirectionStyle(isArabic)]}
          >
            {item.name}
          </Text>

          <Text
            numberOfLines={1}
            style={[styles.contactSubtitle, getTextDirectionStyle(isArabic)]}
          >
            {isOnline ? strings.online : strings.offline}
          </Text>
        </View>

        <View style={styles.callButton}>
          {isCalling ? (
            <ActivityIndicator size="small" color={colors.darkText} />
          ) : (
            <Feather name="phone" size={20} color={colors.darkText} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => {
    if (isLoading) {
      return (
        <View style={styles.stateBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.stateText}>{strings.loading}</Text>
        </View>
      );
    }

    if (errorMessage) {
      return (
        <View style={styles.stateBox}>
          <Feather name="alert-circle" size={34} color={colors.danger} />
          <Text style={styles.stateTitle}>{strings.errorTitle}</Text>
          <Text style={styles.stateText}>{errorMessage}</Text>
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.retryButton}
            onPress={() => loadContacts({ query: searchText })}
          >
            <Text style={styles.retryButtonText}>{strings.retry}</Text>
          </TouchableOpacity>
        </View>
      );
    }

    const hasQuery = Boolean(searchText.trim());

    return (
      <View style={styles.stateBox}>
        <View style={styles.stateIconBox}>
          <Feather
            name={hasQuery ? "search" : "users"}
            size={29}
            color={colors.primary}
          />
        </View>
        <Text style={styles.stateTitle}>
          {hasQuery ? strings.noResultsTitle : strings.emptyTitle}
        </Text>
        <Text style={styles.stateText}>
          {hasQuery ? strings.noResultsText : strings.emptyText}
        </Text>
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
            key: "calls",
            label: isArabic ? "المكالمات" : "Calls",
            iconType: "feather",
            iconName: "phone-call",
            onPress: () => navigation.navigate("Calls"),
          },
          {
            key: "profile",
            label: t("bottomTabs.profile"),
            iconType: "feather",
            iconName: "user",
            onPress: () => navigation.navigate("Profile"),
          },
        ]}
      />

      <FlatList
        ref={listRef}
        data={contacts}
        keyExtractor={(item) => item.id}
        renderItem={renderContact}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={[
          styles.listContent,
          contacts.length === 0 && styles.listContentEmpty,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() =>
              loadContacts({
                query: searchText,
                refreshing: true,
              })
            }
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListHeaderComponent={
          <View>
            <View style={styles.titleBox}>
              <Text style={[styles.title, getTextDirectionStyle(isArabic)]}>
                {strings.title}
              </Text>
              <Text style={[styles.subtitle, getTextDirectionStyle(isArabic)]}>
                {strings.subtitle}
              </Text>
            </View>

            <View style={[styles.searchBox, getRowDirectionStyle(isArabic)]}>
              <Feather name="search" size={21} color={colors.textMuted} />
              <TextInput
                value={searchText}
                onChangeText={setSearchText}
                placeholder={strings.searchPlaceholder}
                placeholderTextColor={colors.textMuted}
                style={[
                  styles.searchInput,
                  getTextInputDirectionFromValue(searchText, isArabic),
                ]}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
              />
              {!!searchText && (
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() => setSearchText("")}
                >
                  <Feather name="x" size={19} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>

            <View style={[styles.helperBox, getRowDirectionStyle(isArabic)]}>
              <Feather name="info" size={17} color={colors.blue} />
              <Text
                style={[styles.helperText, getTextDirectionStyle(isArabic)]}
              >
                {strings.helperText}
              </Text>
            </View>
          </View>
        }
        ListEmptyComponent={renderEmpty}
      />
    </View>
  );
}

const createStyles = (colors, isSmallScreen) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },
    listContent: {
      paddingHorizontal: isSmallScreen ? 16 : 20,
      paddingTop: Platform.OS === "android" ? 130 : 145,
      paddingBottom: Platform.OS === "android" ? 120 : 130,
      gap: 12,
    },
    listContentEmpty: {
      flexGrow: 1,
    },
    titleBox: {
      marginBottom: 20,
    },
    title: {
      color: colors.textPrimary,
      fontSize: isSmallScreen ? 32 : 38,
      fontWeight: "900",
      letterSpacing: -0.8,
    },
    subtitle: {
      marginTop: 7,
      color: colors.textSecondary,
      fontSize: isSmallScreen ? 15 : 17,
      fontWeight: "700",
    },
    searchBox: {
      minHeight: 56,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 16,
      borderRadius: 18,
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.inputBorder,
    },
    searchInput: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: "700",
      paddingVertical: 0,
    },
    helperBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
      marginTop: 12,
      marginBottom: 18,
      paddingHorizontal: 13,
      paddingVertical: 11,
      borderRadius: 14,
      backgroundColor: colors.blueSoft,
      borderWidth: 1,
      borderColor: colors.blueBorder,
    },
    helperText: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: 12.5,
      lineHeight: 18,
      fontWeight: "700",
    },
    contactCard: {
      minHeight: 82,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 13,
      paddingVertical: 12,
      borderRadius: 20,
      backgroundColor: colors.cardSoft,
      borderWidth: 1,
      borderColor: colors.border,
    },
    avatarBox: {
      width: 54,
      height: 54,
      borderRadius: 27,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.avatarBackground,
      borderWidth: 1,
      borderColor: colors.avatarBorder,
      position: "relative",
    },
    avatar: {
      width: "100%",
      height: "100%",
      borderRadius: 27,
    },
    avatarInitials: {
      color: colors.textPrimary,
      fontSize: 17,
      fontWeight: "900",
    },
    onlineDot: {
      position: "absolute",
      right: 0,
      bottom: 1,
      width: 13,
      height: 13,
      borderRadius: 7,
      backgroundColor: colors.success,
      borderWidth: 2,
      borderColor: colors.statusBorder,
    },
    contactInfo: {
      flex: 1,
      minWidth: 0,
    },
    contactName: {
      color: colors.textPrimary,
      fontSize: isSmallScreen ? 15.5 : 17,
      fontWeight: "900",
    },
    contactSubtitle: {
      marginTop: 5,
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: "700",
    },
    callButton: {
      width: 46,
      height: 46,
      borderRadius: 23,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
    },
    stateBox: {
      flex: 1,
      minHeight: 250,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 24,
      paddingVertical: 34,
      borderRadius: 22,
      backgroundColor: colors.cardSoft,
      borderWidth: 1,
      borderColor: colors.border,
    },
    stateIconBox: {
      width: 68,
      height: 68,
      borderRadius: 34,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primarySoft,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    stateTitle: {
      marginTop: 17,
      color: colors.textPrimary,
      fontSize: 19,
      fontWeight: "900",
      textAlign: "center",
    },
    stateText: {
      marginTop: 9,
      color: colors.textSecondary,
      fontSize: 14,
      lineHeight: 21,
      fontWeight: "600",
      textAlign: "center",
    },
    retryButton: {
      marginTop: 18,
      paddingHorizontal: 20,
      paddingVertical: 11,
      borderRadius: 14,
      backgroundColor: colors.primary,
    },
    retryButtonText: {
      color: colors.darkText,
      fontSize: 14,
      fontWeight: "900",
    },
  });
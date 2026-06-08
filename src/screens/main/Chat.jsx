import MainNavBar from "@/src/components/MainNavBar";
import { appImages } from "@/src/constants/images";
import chatService from "@/src/services/api/chatService";
import {
    getAutoTextDirectionStyle,
    getRowDirectionStyle,
    getTextDirectionStyle,
    getTextInputDirectionFromValue,
} from "@/src/styles/globalStyles";
import { useAppTheme } from "@/src/theme/ThemeProvider";
import { Feather } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    ActivityIndicator,
    ImageBackground,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

const CHAT_LIST_PER_PAGE = 20;

const filters = [
    "all",
    "groups",
    "sales",
    "airFreightSales",
    "seaFreightSales",
    "landFreightSales",
    "accounting",
];

const getNestedValue = (object, paths, fallback = "") => {
    for (const path of paths) {
        const value = String(path)
            .split(".")
            .reduce((current, key) => current?.[key], object);

        if (value !== undefined && value !== null && value !== "") {
            return value;
        }
    }

    return fallback;
};

const getConversationItems = (response) => {
    if (Array.isArray(response)) return response;
    if (Array.isArray(response?.items)) return response.items;
    if (Array.isArray(response?.data)) return response.data;
    if (Array.isArray(response?.data?.items)) return response.data.items;
    if (Array.isArray(response?.conversations)) return response.conversations;
    if (Array.isArray(response?.data?.conversations)) return response.data.conversations;

    return [];
};


const getPaginationMeta = (response) => {
    return (
        response?.meta ||
        response?.data?.meta ||
        response?.pagination ||
        response?.data?.pagination ||
        null
    );
};

const getDepartmentText = (conversation) => {
    const department = getNestedValue(conversation, [
        "department.name",
        "department.title",
        "department_name",
        "department",
        "employee.department.name",
        "employee.department.title",
        "employee.department_name",
        "employee.department",
        "customer.department.name",
        "customer.department.title",
        "customer.department_name",
        "customer.department",
        "participant.department.name",
        "participant.department.title",
        "participant.department_name",
        "participant.department",
        "other_participant.department.name",
        "other_participant.department.title",
        "other_participant.department_name",
        "other_participant.department",
        "meta.department.name",
        "meta.department.title",
        "meta.department",
    ]);

    if (typeof department === "object") {
        return String(department?.name || department?.title || "");
    }

    return String(department || "");
};

const normalizeId = (value) => {
    if (value === undefined || value === null || value === "") {
        return null;
    }

    if (typeof value === "object") {
        return null;
    }

    return String(value);
};

const getParticipantUserId = (participant) => {
    if (!participant) return null;

    return normalizeId(
        participant.user_id ||
        participant.userId ||
        participant.user?.id ||
        participant.user?.user_id ||
        participant.profile?.user_id ||
        participant.profile?.id
    );
};

const isCurrentUserParticipant = (participant) => {
    if (!participant) return false;

    return !!(
        participant.is_me === true ||
        participant.isMe === true ||
        participant.me === true ||
        participant.user?.is_me === true ||
        participant.user?.isMe === true
    );
};

const getTargetUserIdFromParticipants = (conversation) => {
    const participantLists = [
        conversation?.participants,
        conversation?.members,
        conversation?.users,
        conversation?.conversation_participants,
    ];

    for (const list of participantLists) {
        if (!Array.isArray(list) || list.length === 0) {
            continue;
        }

        const otherParticipant = list.find((participant) => !isCurrentUserParticipant(participant));
        const targetUserId = getParticipantUserId(otherParticipant);

        if (targetUserId) {
            return targetUserId;
        }
    }

    return null;
};

const getDirectTargetUserId = (conversation) => {
    const participantTargetUserId = getTargetUserIdFromParticipants(conversation);

    if (participantTargetUserId) {
        return participantTargetUserId;
    }

    const targetUserId = getNestedValue(conversation, [
        "target_user_id",
        "targetUserId",
        "other_participant.user_id",
        "other_participant.userId",
        "other_participant.user.id",
        "participant.user_id",
        "participant.userId",
        "participant.user.id",
        "employee.user_id",
        "employee.userId",
        "employee.user.id",
        "customer.user_id",
        "customer.userId",
        "customer.user.id",
        "receiver.user_id",
        "receiver.userId",
        "receiver.user.id",
        "user_id",
        "user.id",
    ]);

    return normalizeId(targetUserId);
};


const formatConversationTime = (value, isArabic) => {
    if (!value) return "";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    const now = new Date();
    const isSameDay =
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate();

    if (isSameDay) {
        return date.toLocaleTimeString(isArabic ? "ar" : "en", {
            hour: "numeric",
            minute: "2-digit",
        });
    }

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);

    const isYesterday =
        date.getFullYear() === yesterday.getFullYear() &&
        date.getMonth() === yesterday.getMonth() &&
        date.getDate() === yesterday.getDate();

    if (isYesterday) {
        return isArabic ? "أمس" : "Yesterday";
    }

    return date.toLocaleDateString(isArabic ? "ar" : "en", {
        month: "short",
        day: "numeric",
    });
};


const getConversationLatestMessageObject = (conversation) => {
    return (
        conversation?.latest_message ||
        conversation?.last_message ||
        conversation?.message_object ||
        conversation?.messageItem ||
        conversation?.message_item ||
        conversation?.message ||
        null
    );
};

const getConversationAttachment = (message) => {
    if (!message || typeof message !== "object") {
        return null;
    }

    if (Array.isArray(message?.attachments) && message.attachments.length > 0) {
        return message.attachments[0];
    }

    return (
        message?.attachment ||
        message?.file ||
        message?.media ||
        null
    );
};

const getConversationAttachmentName = (attachment, fallback = "") => {
    return String(
        attachment?.name ||
        attachment?.file_name ||
        attachment?.filename ||
        attachment?.original_name ||
        attachment?.title ||
        fallback ||
        ""
    );
};

const getConversationMessageType = (message, attachment) => {
    const rawType = message?.type ?? message?.message_type ?? attachment?.type ?? "";
    const normalizedType = String(rawType || "").toLowerCase();
    const mimeType = String(
        attachment?.mime_type ||
        attachment?.mimeType ||
        message?.mime_type ||
        message?.mimeType ||
        ""
    ).toLowerCase();
    const fileName = getConversationAttachmentName(attachment).toLowerCase();

    if (rawType === 2 || ["2", "image", "photo"].includes(normalizedType) || mimeType.includes("image")) {
        return "image";
    }

    if (rawType === 4 || normalizedType === "4" || normalizedType.includes("video") || mimeType.includes("video")) {
        return "video";
    }

    if (
        rawType === 3 ||
        ["3", "file", "document", "attachment"].includes(normalizedType) ||
        !!attachment
    ) {
        if (
            mimeType.includes("image") ||
            fileName.endsWith(".jpg") ||
            fileName.endsWith(".jpeg") ||
            fileName.endsWith(".png") ||
            fileName.endsWith(".webp")
        ) {
            return "image";
        }

        if (
            mimeType.includes("video") ||
            fileName.endsWith(".mp4") ||
            fileName.endsWith(".mov") ||
            fileName.endsWith(".m4v")
        ) {
            return "video";
        }

        return "document";
    }

    if (rawType === 7 || normalizedType === "7" || normalizedType === "quote") {
        return "quote";
    }

    return "text";
};

const getConversationMessagePreview = (conversation, isArabic) => {
    const directPreview = getNestedValue(conversation, [
        "latest_message_preview",
        "latest_message.body",
        "latest_message.text",
        "last_message.body",
        "last_message.text",
        "preview",
    ]);

    if (directPreview) {
        return String(directPreview);
    }

    const latestMessage = getConversationLatestMessageObject(conversation);

    if (typeof latestMessage === "string" && latestMessage.trim()) {
        return latestMessage.trim();
    }

    const body = getNestedValue(latestMessage, [
        "body",
        "text",
        "caption",
        "message",
    ]);

    if (body) {
        return String(body);
    }

    const attachment = getConversationAttachment(latestMessage);
    const attachmentName = getConversationAttachmentName(attachment);

    if (attachmentName) {
        return attachmentName;
    }

    const messageType = getConversationMessageType(latestMessage, attachment);

    if (messageType === "image") {
        return isArabic ? "صورة" : "Image";
    }

    if (messageType === "video") {
        return isArabic ? "فيديو" : "Video";
    }

    if (messageType === "document") {
        return isArabic ? "ملف مرفق" : "Attachment";
    }

    if (messageType === "quote") {
        return isArabic ? "عرض سعر" : "Quote";
    }

    return "";
};

const normalizeConversation = (conversation, isArabic) => {
    const id = getNestedValue(conversation, ["id", "conversation_id"]);

    const name = getNestedValue(
        conversation,
        [
            "display_name",
            "title",
            "name",
            "employee.name",
            "customer.name",
            "participant.name",
            "other_participant.name",
            "user.name",
        ],
        isArabic ? "محادثة" : "Conversation"
    );

    const message = getConversationMessagePreview(conversation, isArabic);

    const time = getNestedValue(conversation, [
        "latest_message_at",
        "last_message_at",
        "latest_message.created_at",
        "last_message.created_at",
        "updated_at",
        "created_at",
        "time",
    ]);

    const unread = Number(
        getNestedValue(conversation, ["unread_count", "unread", "unread_messages_count"], 0) || 0
    );

    const isOnline = Boolean(
        getNestedValue(conversation, [
            "is_online",
            "online",
            "employee.is_online",
            "customer.is_online",
            "participant.is_online",
            "other_participant.is_online",
        ], false)
    );

    const conversationType = String(
        getNestedValue(conversation, ["type", "conversation_type"], "")
    ).toLowerCase();

    const isGroup =
        conversation?.is_group === true ||
        conversation?.isGroup === true ||
        conversation?.group === true ||
        conversation?.type === 2 ||
        conversationType === "group" ||
        conversationType === "groups";

    const targetUserId = isGroup ? null : getDirectTargetUserId(conversation);

    return {
        id: String(id || conversation?.uuid || conversation?.key || Date.now()),
        conversationId: id,
        targetUserId,
        name: String(name || (isArabic ? "محادثة" : "Conversation")),
        department: getDepartmentText(conversation),
        message: String(message || ""),
        time: formatConversationTime(time, isArabic),
        unread: Number.isFinite(unread) ? unread : 0,
        status: isOnline ? "online" : "away",
        isGroup,
        raw: conversation,
    };
};

export default function Chat({ navigation }) {
    const { t, i18n } = useTranslation();
    const isArabic = i18n.language === "ar";

    const { colors, isDark } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const [chats, setChats] = useState([]);
    const [search, setSearch] = useState("");
    const [activeFilter, setActiveFilter] = useState("all");
    const [showNavTitle, setShowNavTitle] = useState(false);
    const [selectMode, setSelectMode] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [paginationMeta, setPaginationMeta] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [errorMessage, setErrorMessage] = useState("");

    const imageSource = isDark ? appImages.splashDark : appImages.splashLight;
    const filtersScrollRef = useRef(null);
    const hasLoadedInitialConversationsRef = useRef(false);

    const unreadTotal = useMemo(() => {
        return chats.reduce((total, chat) => total + Number(chat.unread || 0), 0);
    }, [chats]);

    const fetchConversations = useCallback(
        async ({
            page = 1,
            fullLoading = false,
            refreshLoading = false,
            loadMore = false,
        } = {}) => {
            try {
                if (fullLoading) {
                    setIsLoading(true);
                }

                if (refreshLoading) {
                    setIsRefreshing(true);
                }

                if (loadMore) {
                    setIsLoadingMore(true);
                }

                setErrorMessage("");

                const response = await chatService.listConversations({
                    page,
                    perPage: CHAT_LIST_PER_PAGE,
                });

                const preparedChats = getConversationItems(response).map((conversation) =>
                    normalizeConversation(conversation, isArabic)
                );

                setChats((currentChats) => {
                    if (page === 1) {
                        return preparedChats;
                    }

                    const existingIds = new Set(currentChats.map((chat) => String(chat.id)));
                    const uniqueNewChats = preparedChats.filter(
                        (chat) => !existingIds.has(String(chat.id))
                    );

                    return [...currentChats, ...uniqueNewChats];
                });

                setPaginationMeta(getPaginationMeta(response));
                setCurrentPage(page);
            } catch (error) {
                console.log("List conversations error:", error?.raw || error);
                setErrorMessage(
                    error?.userMessage ||
                    (isArabic
                        ? "صار خطأ أثناء تحميل المحادثات. حاولي مرة ثانية."
                        : "Something went wrong while loading conversations.")
                );
            } finally {
                setIsLoading(false);
                setIsRefreshing(false);
                setIsLoadingMore(false);
            }
        },
        [isArabic]
    );

    useFocusEffect(
        useCallback(() => {
            let isActive = true;

            fetchConversations({
                page: 1,
                fullLoading: !hasLoadedInitialConversationsRef.current,
            }).finally(() => {
                if (isActive) {
                    hasLoadedInitialConversationsRef.current = true;
                }
            });

            return () => {
                isActive = false;
            };
        }, [fetchConversations])
    );

    const visibleChats = useMemo(() => {
        const searchText = search.trim().toLowerCase();

        return chats.filter((chat) => {
            const chatName = String(chat.name || "").toLowerCase();
            const chatDepartment = String(chat.department || "").toLowerCase();
            const chatMessage = String(chat.message || "").toLowerCase();

            const matchesSearch =
                !searchText ||
                chatName.includes(searchText) ||
                chatDepartment.includes(searchText) ||
                chatMessage.includes(searchText);

            const matchesFilter =
                activeFilter === "all" ||
                (activeFilter === "groups" && chat.isGroup === true) ||
                (activeFilter === "sales" && chatDepartment.includes("sales")) ||
                (activeFilter === "airFreightSales" && chatDepartment.includes("air")) ||
                (activeFilter === "seaFreightSales" && chatDepartment.includes("sea")) ||
                (activeFilter === "landFreightSales" && chatDepartment.includes("land")) ||
                (activeFilter === "accounting" && chatDepartment.includes("accounting"));

            return matchesSearch && matchesFilter;
        });
    }, [activeFilter, chats, search]);

    const canLoadMore = useMemo(() => {
        if (!paginationMeta) {
            return false;
        }

        const current = Number(
            paginationMeta.current_page ||
            paginationMeta.currentPage ||
            paginationMeta.page ||
            currentPage ||
            1
        );

        const last = Number(
            paginationMeta.last_page ||
            paginationMeta.lastPage ||
            paginationMeta.total_pages ||
            paginationMeta.totalPages ||
            1
        );

        return current < last;
    }, [currentPage, paginationMeta]);

    const handleLoadMore = () => {
        if (isLoading || isLoadingMore || !canLoadMore) {
            return;
        }

        fetchConversations({
            page: currentPage + 1,
            loadMore: true,
        });
    };

    useEffect(() => {
        setTimeout(() => {
            if (isArabic) {
                filtersScrollRef.current?.scrollToEnd({ animated: false });
            } else {
                filtersScrollRef.current?.scrollTo({ x: 0, animated: false });
            }
        }, 100);
    }, [isArabic]);

    const toggleLanguage = () => {
        const nextLanguage = isArabic ? "en" : "ar";
        i18n.changeLanguage(nextLanguage);
    };

    const handleSelectChats = () => {
        setSelectMode((prev) => !prev);
    };

    const handleReadAll = async () => {
        const previousChats = chats;

        setChats((currentChats) =>
            currentChats.map((chat) => ({
                ...chat,
                unread: 0,
            }))
        );

        try {
            await chatService.markAllConversationsRead();
        } catch (error) {
            console.log("Mark all conversations read error:", error?.raw || error);
            setChats(previousChats);
        }
    };

    const handleChatPress = (selectedChat) => {
        if (selectMode) {
            return;
        }

        setChats((currentChats) =>
            currentChats.map((chat) =>
                chat.id === selectedChat.id
                    ? {
                        ...chat,
                        unread: 0,
                    }
                    : chat
            )
        );

        if (selectedChat.conversationId) {
            chatService.markConversationRead(selectedChat.conversationId).catch((error) => {
                console.log("Mark conversation read error:", error?.raw || error);
            });
        }

        navigation.navigate("IndividualChat", {
            conversationId: selectedChat.conversationId,
            conversation: selectedChat.raw,
            targetUserId: selectedChat.targetUserId,
            target_user_id: selectedChat.targetUserId,
            isGroup: selectedChat.isGroup,
            is_group: selectedChat.isGroup,
            employee: {
                id: selectedChat.targetUserId,
                user_id: selectedChat.targetUserId,
                target_user_id: selectedChat.targetUserId,
                name: selectedChat.name,
                department: selectedChat.department,
                status: selectedChat.status,
                conversation_id: selectedChat.conversationId,
                is_group: selectedChat.isGroup,
            },
        });
    };

    const handleScroll = (event) => {
        const y = event.nativeEvent.contentOffset.y;
        setShowNavTitle(y > 45);
    };

    const chatMenuItems = [
        {
            key: "selectChats",
            label: selectMode
                ? t("chat.menuCancelSelect")
                : t("chat.menuSelectChats"),
            iconType: "feather",
            iconName: selectMode ? "x-square" : "check-square",
            onPress: handleSelectChats,
        },
        {
            key: "readAll",
            label: t("chat.menuReadAll"),
            iconType: "feather",
            iconName: "check-circle",
            onPress: handleReadAll,
        },
    ];

    const renderChatCards = () => {
        if (isLoading) {
            return (
                <View style={styles.loadingBox}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={[styles.stateText, getTextDirectionStyle(isArabic)]}>
                        {isArabic ? "جاري تحميل المحادثات..." : "Loading conversations..."}
                    </Text>
                </View>
            );
        }

        if (errorMessage && chats.length === 0) {
            return (
                <View style={styles.loadingBox}>
                    <Feather name="alert-circle" size={30} color={colors.danger} />
                    <Text style={[styles.stateText, getTextDirectionStyle(isArabic)]}>
                        {errorMessage}
                    </Text>
                    <TouchableOpacity
                        activeOpacity={0.85}
                        style={styles.retryButton}
                        onPress={() => fetchConversations({ fullLoading: true })}
                    >
                        <Text style={styles.retryButtonText}>
                            {isArabic ? "إعادة المحاولة" : "Try again"}
                        </Text>
                    </TouchableOpacity>
                </View>
            );
        }

        if (visibleChats.length === 0) {
            return (
                <View style={styles.loadingBox}>
                    <Feather name="message-circle" size={30} color={colors.textMuted} />
                    <Text style={[styles.stateText, getTextDirectionStyle(isArabic)]}>
                        {isArabic ? "لا توجد محادثات حالياً." : "No conversations yet."}
                    </Text>
                </View>
            );
        }

        return (
            <>
                {visibleChats.map((chat) => (
                    <TouchableOpacity
                        key={chat.id}
                        activeOpacity={0.88}
                        style={[styles.chatCard, getRowDirectionStyle(isArabic)]}
                        onPress={() => handleChatPress(chat)}
                    >
                        {selectMode && (
                            <View style={styles.selectCircle}>
                                <Feather
                                    name="circle"
                                    size={20}
                                    color={colors.textSecondary}
                                />
                            </View>
                        )}

                        <View style={styles.avatarBox}>
                            <View style={styles.avatarCircle}>
                                <Feather
                                    name="user"
                                    size={28}
                                    color={colors.textPrimary}
                                />
                            </View>

                            <View
                                style={[
                                    styles.statusDot,
                                    chat.status === "away" && styles.statusDotAway,
                                ]}
                            />
                        </View>

                        <View style={styles.chatInfo}>
                            <View
                                style={[
                                    styles.chatTopRow,
                                    getRowDirectionStyle(isArabic),
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.staffName,
                                        getTextDirectionStyle(isArabic),
                                    ]}
                                    numberOfLines={1}
                                >
                                    {chat.name}
                                </Text>

                                <Text style={styles.chatTime}>{chat.time}</Text>
                            </View>

                            {!!chat.department && (
                                <View
                                    style={[
                                        styles.departmentRow,
                                        getRowDirectionStyle(isArabic),
                                    ]}
                                >
                                    <Text style={styles.departmentText} numberOfLines={1}>
                                        {chat.department}
                                    </Text>
                                </View>
                            )}

                            <Text
                                style={[
                                    styles.messageText,
                                    getAutoTextDirectionStyle(chat.message, isArabic),
                                ]}
                                numberOfLines={2}
                            >
                                {chat.message || (isArabic ? "لا توجد رسائل بعد" : "No messages yet")}
                            </Text>
                        </View>

                        {chat.unread > 0 && (
                            <View style={styles.unreadBadge}>
                                <Text style={styles.unreadText}>{chat.unread}</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                ))}

                {canLoadMore && (
                    <TouchableOpacity
                        activeOpacity={0.85}
                        style={styles.loadMoreButton}
                        onPress={handleLoadMore}
                        disabled={isLoadingMore}
                    >
                        {isLoadingMore ? (
                            <ActivityIndicator size="small" color={colors.darkText} />
                        ) : (
                            <Text style={styles.loadMoreText}>
                                {isArabic ? "تحميل المزيد" : "Load more"}
                            </Text>
                        )}
                    </TouchableOpacity>
                )}
            </>
        );
    };

    return (
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
                    <MainNavBar
                        navigation={navigation}
                        title={t("chat.title")}
                        showTitle={showNavTitle}
                        notificationCount={unreadTotal}
                        onToggleLanguage={toggleLanguage}
                        menuItems={chatMenuItems}
                    />

                    <ScrollView
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        onScroll={handleScroll}
                        scrollEventThrottle={16}
                        refreshControl={
                            <RefreshControl
                                refreshing={isRefreshing}
                                onRefresh={() => fetchConversations({ page: 1, refreshLoading: true })}
                                tintColor={colors.primary}
                                colors={[colors.primary]}
                            />
                        }
                    >
                        <View style={styles.headerBox}>
                            <Text style={[styles.title, getTextDirectionStyle(isArabic)]}>
                                {t("chat.title")}
                            </Text>

                            <Text style={[styles.subtitle, getTextDirectionStyle(isArabic)]}>
                                {t("chat.subtitle")}
                            </Text>
                        </View>

                        <View style={[styles.searchBox, getRowDirectionStyle(isArabic)]}>
                            <Feather name="search" size={21} color={colors.textMuted} />

                            <TextInput
                                value={search}
                                onChangeText={setSearch}
                                placeholder={t("chat.searchPlaceholder")}
                                placeholderTextColor={colors.textMuted}
                                style={[
                                    styles.searchInput,
                                    getTextInputDirectionFromValue(search, isArabic),
                                ]}
                                autoCorrect={false}
                                autoCapitalize="none"
                            />

                            <TouchableOpacity activeOpacity={0.85} style={styles.filterButton}>
                                <Feather name="sliders" size={20} color={colors.textPrimary} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            ref={filtersScrollRef}
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            style={styles.filtersScroll}
                            contentContainerStyle={[
                                styles.filtersRow,
                                isArabic && styles.filtersRowArabic,
                            ]}
                            onContentSizeChange={() => {
                                if (isArabic) {
                                    filtersScrollRef.current?.scrollToEnd({ animated: false });
                                }
                            }}
                        >
                            {filters.map((filter) => {
                                const isActive = activeFilter === filter;

                                return (
                                    <TouchableOpacity
                                        key={filter}
                                        activeOpacity={0.85}
                                        style={[
                                            styles.filterChip,
                                            isActive && styles.filterChipActive,
                                        ]}
                                        onPress={() => setActiveFilter(filter)}
                                    >
                                        <Text
                                            style={[
                                                styles.filterChipText,
                                                isActive && styles.filterChipTextActive,
                                            ]}
                                        >
                                            {t(`chat.filters.${filter}`)}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>

                        <View style={styles.chatCardsWrapper}>
                            {renderChatCards()}
                        </View>
                    </ScrollView>
                </View>
            </ImageBackground>
        </View>
    );
}

const SCREEN_PADDING = 20;

const createStyles = (colors) =>
    StyleSheet.create({
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
            backgroundColor: colors.overlay,
        },

        selectCircle: {
            width: 28,
            height: 28,
            borderRadius: 14,
            alignItems: "center",
            justifyContent: "center",
        },

        scrollContent: {
            flexGrow: 1,
            paddingHorizontal: 20,
            paddingTop: Platform.OS === "android" ? 130 : 150,
            paddingBottom: Platform.OS === "android" ? 120 : 135,
        },

        headerBox: {
            marginBottom: 26,
        },

        title: {
            color: colors.textPrimary,
            fontSize: 35,
            fontWeight: "900",
            marginBottom: 8,
        },

        subtitle: {
            color: colors.textSecondary,
            fontSize: 17,
            lineHeight: 25,
            fontWeight: "500",
        },

        searchBox: {
            height: 58,
            borderRadius: 20,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
            gap: 10,
            marginBottom: 18,
        },

        searchInput: {
            flex: 1,
            color: colors.textPrimary,
            fontSize: 16,
            fontWeight: "600",
            paddingVertical: 0,
        },

        filterButton: {
            width: 42,
            height: 42,
            borderRadius: 16,
            backgroundColor: colors.buttonSoft,
            alignItems: "center",
            justifyContent: "center",
        },

        filtersScroll: {
            height: 62,
            maxHeight: 62,
            marginHorizontal: -SCREEN_PADDING,
            marginBottom: 10,
        },

        filtersRow: {
            height: 62,
            paddingHorizontal: SCREEN_PADDING,
            paddingBottom: 10,
            gap: 12,
            alignItems: "center",
        },

        filtersRowArabic: {
            flexDirection: "row-reverse",
        },

        filterChip: {
            height: 44,
            paddingHorizontal: 22,
            borderRadius: 16,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: "center",
            justifyContent: "center",
        },

        filterChipActive: {
            borderColor: colors.primary,
            backgroundColor: colors.primarySoft,
        },

        filterChipText: {
            color: colors.textPrimary,
            fontSize: 14,
            fontWeight: "700",
        },

        filterChipTextActive: {
            color: colors.textPrimary,
        },

        chatCardsWrapper: {
            gap: 12,
            marginTop: 0,
            paddingTop: 0,
        },

        chatCard: {
            minHeight: 112,
            borderRadius: 20,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.borderSoft,
            flexDirection: "row",
            alignItems: "center",
            padding: 14,
            gap: 12,
        },

        avatarBox: {
            width: 58,
            height: 58,
        },

        avatarCircle: {
            width: 58,
            height: 58,
            borderRadius: 29,
            backgroundColor: colors.avatarBackground,
            borderWidth: 1,
            borderColor: colors.avatarBorder,
            alignItems: "center",
            justifyContent: "center",
        },

        statusDot: {
            position: "absolute",
            right: 1,
            bottom: 2,
            width: 14,
            height: 14,
            borderRadius: 7,
            backgroundColor: colors.primary,
            borderWidth: 2,
            borderColor: colors.statusBorder,
        },

        statusDotAway: {
            backgroundColor: colors.warning,
        },

        chatInfo: {
            flex: 1,
        },

        chatTopRow: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            marginBottom: 6,
        },

        staffName: {
            flex: 1,
            color: colors.textPrimary,
            fontSize: 17,
            fontWeight: "900",
        },

        chatTime: {
            color: colors.textMuted,
            fontSize: 12,
            fontWeight: "600",
        },

        departmentRow: {
            alignSelf: "flex-start",
            marginBottom: 7,
        },

        departmentText: {
            color: colors.blue,
            fontSize: 11,
            fontWeight: "700",
            paddingHorizontal: 9,
            paddingVertical: 4,
            borderRadius: 10,
            backgroundColor: colors.blueSoft,
            borderWidth: 1,
            borderColor: colors.blueBorder,
        },

        messageText: {
            color: colors.textSecondary,
            fontSize: 14,
            lineHeight: 21,
            fontWeight: "500",
        },

        unreadBadge: {
            minWidth: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: colors.primary,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 8,
        },

        unreadText: {
            color: colors.darkText,
            fontSize: 13,
            fontWeight: "900",
        },

        loadMoreButton: {
            alignSelf: "center",
            minHeight: 44,
            minWidth: 142,
            borderRadius: 14,
            paddingHorizontal: 18,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.primary,
            marginTop: 6,
            marginBottom: 4,
        },

        loadMoreText: {
            color: colors.darkText,
            fontSize: 14,
            fontWeight: "900",
        },

        loadingBox: {
            minHeight: 112,
            borderRadius: 20,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.borderSoft,
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            gap: 10,
        },

        stateText: {
            color: colors.textSecondary,
            fontSize: 14,
            lineHeight: 21,
            fontWeight: "700",
            textAlign: "center",
        },

        retryButton: {
            minHeight: 42,
            borderRadius: 13,
            paddingHorizontal: 18,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.primary,
            marginTop: 4,
        },

        retryButtonText: {
            color: colors.darkText,
            fontSize: 14,
            fontWeight: "900",
        },
    });

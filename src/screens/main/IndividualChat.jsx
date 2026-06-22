import QuoteFormModal from "@/src/components/quotes/QuoteFormModal";
import {
    getRowDirectionStyle,
    getTextDirectionStyle,
} from "@/src/styles/globalStyles";
import { useAppTheme } from "@/src/theme/ThemeProvider";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import {
    AudioModule,
    RecordingPresets,
    setAudioModeAsync,
    useAudioRecorder,
    useAudioRecorderState,
} from "expo-audio";
import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as IntentLauncher from "expo-intent-launcher";
import * as Sharing from "expo-sharing";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    Alert,
    Image,
    InteractionManager,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import ChatPatternBackground from "../../components/ChatPatternBackground";
import IndividualChatComposer from "../../components/IndividualChatComposer";
import IndividualChatHeader from "../../components/IndividualChatHeader";
import IndividualChatMessagesList from "../../components/IndividualChatMessagesList";
import { API_BASE_URL } from "../../constants/config/apiConfig";
import { useAppRealtime } from "../../context/AppRealtimeProvider";
import chatService from "../../services/api/chatService";
import {
    leaveConversationChannel,
    sendConversationTypingWhisper,
    subscribeToConversationChannel,
} from "../../services/realtime/conversationRealtimeService";
// import {
//     ScannedDocumentConfirmModal,
//     useScanDocument,
// } from "../../components/ScanDocumentTools";
import {
    ChatCameraCaptureModal,
    MediaConfirmModal,
    MediaPreviewModal,
    useIndividualChatMedia,
} from "../../components/useIndividualChatMedia";


const formatFileSize = (bytes) => {
    if (!bytes && bytes !== 0) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatAudioDuration = (milliseconds = 0) => {
    const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

const getRecorderUri = (audioRecorder, recorderState) => {
    const candidates = [
        audioRecorder?.uri,
        audioRecorder?.url,
        audioRecorder?._uri,
        audioRecorder?._url,
        recorderState?.uri,
        recorderState?.url,
        recorderState?.recordingUri,
        recorderState?.recording_uri,
    ];

    const validUri = candidates.find((value) => {
        const cleanValue = String(value || "").trim();

        return (
            cleanValue.startsWith("file://") ||
            cleanValue.startsWith("content://")
        );
    });

    return validUri ? String(validUri).trim() : "";
};

const getVoiceRecordingFileName = () => `voice-message-${Date.now()}.m4a`;

const getFileIconName = (mimeType = "", fileName = "") => {
    const lowerName = fileName.toLowerCase();
    const lowerType = mimeType.toLowerCase();

    if (lowerType.includes("pdf") || lowerName.endsWith(".pdf")) {
        return "file-pdf-box";
    }

    if (
        lowerType.includes("word") ||
        lowerName.endsWith(".doc") ||
        lowerName.endsWith(".docx")
    ) {
        return "file-word-box";
    }

    if (
        lowerType.includes("excel") ||
        lowerType.includes("spreadsheet") ||
        lowerName.endsWith(".xls") ||
        lowerName.endsWith(".xlsx") ||
        lowerName.endsWith(".csv")
    ) {
        return "file-excel-box";
    }

    if (
        lowerType.includes("image") ||
        lowerName.endsWith(".png") ||
        lowerName.endsWith(".jpg") ||
        lowerName.endsWith(".jpeg") ||
        lowerName.endsWith(".webp")
    ) {
        return "file-image";
    }

    if (
        lowerType.includes("video") ||
        lowerName.endsWith(".mp4") ||
        lowerName.endsWith(".mov")
    ) {
        return "file-video";
    }

    if (
        lowerType.includes("zip") ||
        lowerName.endsWith(".zip") ||
        lowerName.endsWith(".rar")
    ) {
        return "folder-zip";
    }

    return "file-document";
};


const getFileExtension = (fileName = "", mimeType = "") => {
    const cleanName = String(fileName || "").split("?")[0];
    const dotIndex = cleanName.lastIndexOf(".");

    if (dotIndex !== -1 && dotIndex < cleanName.length - 1) {
        return cleanName.slice(dotIndex + 1).toLowerCase();
    }

    const cleanMimeType = String(mimeType || "").toLowerCase();

    if (cleanMimeType.includes("pdf")) return "pdf";
    if (cleanMimeType.includes("png")) return "png";
    if (cleanMimeType.includes("jpeg") || cleanMimeType.includes("jpg")) return "jpg";
    if (cleanMimeType.includes("webp")) return "webp";
    if (cleanMimeType.includes("gif")) return "gif";

    return "";
};

const isPdfDocument = (documentItem) => {
    const extension = getFileExtension(documentItem?.fileName, documentItem?.mimeType);
    const mimeType = String(documentItem?.mimeType || "").toLowerCase();

    return extension === "pdf" || mimeType.includes("pdf");
};

const isImageDocument = (documentItem) => {
    const extension = getFileExtension(documentItem?.fileName, documentItem?.mimeType);
    const mimeType = String(documentItem?.mimeType || "").toLowerCase();

    return (
        mimeType.includes("image") ||
        ["jpg", "jpeg", "png", "webp", "gif"].includes(extension)
    );
};

const decodeFileName = (fileName = "attached-file") => {
    try {
        return decodeURIComponent(String(fileName || "attached-file"));
    } catch {
        return String(fileName || "attached-file");
    }
};

const sanitizeFileName = (fileName = "attached-file") => {
    const safeName = decodeFileName(fileName)
        .replace(/[^\w.\-() ]+/g, "_")
        .replace(/\s+/g, "_");

    return safeName || `attached-file-${Date.now()}`;
};

const isRemoteDocumentUri = (uri = "") => {
    const cleanUri = String(uri || "").trim().toLowerCase();

    return cleanUri.startsWith("http://") || cleanUri.startsWith("https://");
};

const ensureLocalDocumentUri = async (documentItem) => {
    if (!documentItem?.uri) return null;

    const sourceUri = String(documentItem.uri || "").trim();

    if (!sourceUri) return null;

    const safeName = sanitizeFileName(documentItem.fileName || `attached-file-${Date.now()}`);
    const targetUri = `${FileSystem.cacheDirectory}${safeName}`;

    if (sourceUri === targetUri || sourceUri === decodeURI(targetUri)) {
        return targetUri;
    }

    try {
        const targetInfo = await FileSystem.getInfoAsync(targetUri);

        if (targetInfo.exists) {
            return targetUri;
        }

        if (isRemoteDocumentUri(sourceUri)) {
            const downloadResult = await FileSystem.downloadAsync(sourceUri, targetUri);

            return downloadResult?.uri || targetUri;
        }

        await FileSystem.copyAsync({
            from: sourceUri,
            to: targetUri,
        });

        return targetUri;
    } catch (error) {
        console.log("Prepare document file error:", error);
        return isRemoteDocumentUri(sourceUri) ? null : sourceUri;
    }
};


const getConversationIdFromRoute = (route, employee) => {
    return (
        route?.params?.conversationId ||
        route?.params?.conversation_id ||
        route?.params?.conversation?.id ||
        route?.params?.chat?.id ||
        employee?.conversation_id ||
        employee?.conversationId ||
        employee?.conversation?.id ||
        null
    );
};



const getTargetUserIdFromRoute = (route, employee, conversation) => {
    return (
        route?.params?.targetUserId ||
        route?.params?.target_user_id ||
        route?.params?.userId ||
        route?.params?.user_id ||
        route?.params?.customerId ||
        route?.params?.customer_id ||
        route?.params?.employeeId ||
        route?.params?.employee_id ||
        employee?.target_user_id ||
        employee?.targetUserId ||
        employee?.user_id ||
        employee?.userId ||
        employee?.id ||
        conversation?.target_user_id ||
        conversation?.targetUserId ||
        conversation?.other_participant?.id ||
        conversation?.other_participant?.user_id ||
        conversation?.participant?.id ||
        conversation?.participant?.user_id ||
        conversation?.employee?.id ||
        conversation?.employee?.user_id ||
        conversation?.customer?.id ||
        conversation?.customer?.user_id ||
        conversation?.user?.id ||
        conversation?.user_id ||
        null
    );
};

const isGroupConversationFromRoute = (route, employee, conversation) => {
    return !!(
        route?.params?.isGroup === true ||
        route?.params?.is_group === true ||
        route?.params?.conversation?.is_group === true ||
        route?.params?.conversation?.isGroup === true ||
        route?.params?.chat?.is_group === true ||
        route?.params?.chat?.isGroup === true ||
        employee?.is_group === true ||
        employee?.isGroup === true ||
        employee?.conversation?.is_group === true ||
        employee?.conversation?.isGroup === true ||
        conversation?.is_group === true ||
        conversation?.isGroup === true ||
        conversation?.type === 2 ||
        String(conversation?.type || "").toLowerCase() === "group"
    );
};

const getInitialBlockedState = (route, employee) => {
    return !!(
        route?.params?.isBlocked ||
        route?.params?.is_blocked ||
        route?.params?.conversation?.is_blocked ||
        route?.params?.conversation?.blocked_by_me ||
        route?.params?.conversation?.is_blocked_for_me ||
        route?.params?.conversation?.block ||
        route?.params?.isBlockedForMe ||
        route?.params?.is_blocked_for_me ||
        route?.params?.blockedByMe ||
        route?.params?.blocked_by_me ||
        employee?.is_blocked ||
        employee?.blocked_by_me ||
        employee?.is_blocked_for_me ||
        employee?.block
    );
};

const normalizeTruthy = (value) => {
    if (value === true || value === 1) return true;
    if (value === false || value === 0) return false;

    if (typeof value === "string") {
        const cleanValue = value.trim().toLowerCase();

        if (["1", "true", "yes", "blocked", "disabled"].includes(cleanValue)) {
            return true;
        }

        if (["0", "false", "no", "null", "undefined", "active", "enabled"].includes(cleanValue)) {
            return false;
        }
    }

    return null;
};

const getNestedSourceValue = (source, paths = []) => {
    if (!source || typeof source !== "object") {
        return null;
    }

    for (const path of paths) {
        const value = String(path)
            .split(".")
            .reduce((current, key) => current?.[key], source);

        if (value !== undefined && value !== null && value !== "") {
            return value;
        }
    }

    return null;
};

const getBooleanFromSources = (sources = [], paths = []) => {
    for (const source of sources) {
        const value = getNestedSourceValue(source, paths);
        const normalized = normalizeTruthy(value);

        if (normalized !== null) {
            return normalized;
        }
    }

    return null;
};

const getCurrentUserIdFromProfile = (profile) => {
    return (
        profile?.id ||
        profile?.user_id ||
        profile?.userId ||
        profile?.user?.id ||
        profile?.profile?.id ||
        null
    );
};

const getConversationBlockInfoFromSources = (...sources) => {
    const validSources = sources.filter(Boolean);

    const blockedForMe = getBooleanFromSources(validSources, [
        "is_blocked_for_me",
        "isBlockedForMe",
        "blocked_for_me",
        "blockedForMe",
        "meta.is_blocked_for_me",
        "meta.isBlockedForMe",
        "conversation.is_blocked_for_me",
        "conversation.isBlockedForMe",
    ]);

    const blockedByMe = getBooleanFromSources(validSources, [
        "blocked_by_me",
        "blockedByMe",
        "is_blocked_by_me",
        "isBlockedByMe",
        "meta.blocked_by_me",
        "meta.blockedByMe",
        "conversation.blocked_by_me",
        "conversation.blockedByMe",
    ]);

    const directBlocked = getBooleanFromSources(validSources, [
        "is_blocked",
        "isBlocked",
        "blocked",
        "meta.is_blocked",
        "meta.isBlocked",
        "conversation.is_blocked",
        "conversation.isBlocked",
    ]);

    const hasBlockObject = validSources.some((source) => {
        const block = getNestedSourceValue(source, [
            "block",
            "conversation.block",
            "data.block",
            "data.conversation.block",
        ]);

        return !!block && typeof block === "object";
    });

    const isBlocked =
        blockedForMe === true ||
        blockedByMe === true ||
        directBlocked === true ||
        hasBlockObject;

    return {
        isBlocked,
        blockedForMe: blockedForMe === true,
        blockedByMe: blockedByMe === true,
        hasBlockObject,
    };
};

const getConversationCanSendMessageFromSources = (...sources) => {
    const value = getBooleanFromSources(sources.filter(Boolean), [
        "can_send_message",
        "canSendMessage",
        "permissions.can_send_message",
        "permissions.canSendMessage",
        "meta.can_send_message",
        "meta.canSendMessage",
        "conversation.can_send_message",
        "conversation.canSendMessage",
        "data.can_send_message",
        "data.canSendMessage",
        "data.conversation.can_send_message",
        "data.conversation.canSendMessage",
    ]);

    return value;
};

const getConversationCanBlockFromSources = (...sources) => {
    const value = getBooleanFromSources(sources.filter(Boolean), [
        "can_block",
        "canBlock",
        "can_block_customer",
        "canBlockCustomer",
        "can_block_participants",
        "canBlockParticipants",
        "permissions.can_block",
        "permissions.canBlock",
        "permissions.block",
        "abilities.can_block",
        "abilities.canBlock",
        "meta.can_block",
        "meta.canBlock",
        "conversation.can_block",
        "conversation.canBlock",
    ]);

    return value;
};

const getConversationIdFromBlockEvent = (payload) => {
    return getNormalizedChatValue(
        payload?.conversation_id ||
        payload?.conversationId ||
        payload?.conversation?.id ||
        payload?.data?.conversation_id ||
        payload?.data?.conversationId ||
        payload?.data?.conversation?.id ||
        payload?.item?.conversation_id ||
        payload?.item?.conversationId ||
        payload?.item?.conversation?.id ||
        null
    );
};

const getConversationPayloadFromBlockEvent = (payload) => {
    return (
        payload?.conversation ||
        payload?.data?.conversation ||
        payload?.item?.conversation ||
        payload?.data ||
        payload?.item ||
        payload ||
        null
    );
};


const getProfilePayload = (response) => {
    return (
        response?.data?.data?.user ||
        response?.data?.data?.profile ||
        response?.data?.data ||
        response?.data?.user ||
        response?.data?.profile ||
        response?.data ||
        response?.user ||
        response?.profile ||
        response ||
        null
    );
};

const getProfileRoleValue = (profile) => {
    const roleValue =
        profile?.role?.value ??
        profile?.role_id ??
        profile?.roleId ??
        profile?.role ??
        profile?.user?.role?.value ??
        profile?.user?.role_id ??
        profile?.user?.roleId ??
        profile?.user?.role ??
        profile?.profile?.role?.value ??
        profile?.profile?.role_id ??
        profile?.profile?.roleId ??
        profile?.profile?.role ??
        null;

    const numericRole = Number(roleValue);

    if ([1, 2, 3].includes(numericRole)) {
        return numericRole;
    }

    const roleText = normalizeRoleText(
        typeof roleValue === "string"
            ? roleValue
            : profile?.role?.label ||
            profile?.role?.name ||
            profile?.role_name ||
            profile?.roleName ||
            profile?.type ||
            profile?.user_type ||
            profile?.userType ||
            profile?.user?.role?.label ||
            profile?.user?.role?.name ||
            profile?.user?.role_name ||
            profile?.user?.roleName ||
            ""
    );

    if (["customer", "client", "user", "customer_user", "client_user"].includes(roleText)) {
        return 1;
    }

    if (["employee", "staff", "agent", "support", "sales", "operation", "operations"].includes(roleText)) {
        return 2;
    }

    if (["admin", "super_admin", "administrator"].includes(roleText)) {
        return 3;
    }

    return null;
};

const normalizeRoleText = (value = "") => {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, "_");
};

const getNestedProfileValue = (source, paths = []) => {
    if (!source || typeof source !== "object") {
        return null;
    }

    for (const path of paths) {
        const value = String(path)
            .split(".")
            .reduce((current, key) => current?.[key], source);

        if (value !== undefined && value !== null && value !== "") {
            return value;
        }
    }

    return null;
};

const hasTruthyQuotePermission = (source) => {
    if (!source || typeof source !== "object") {
        return false;
    }

    const directValues = [
        source?.can_create_quote,
        source?.canCreateQuote,
        source?.can_create_quotes,
        source?.canCreateQuotes,
        source?.create_quote,
        source?.createQuote,
        source?.create_quotes,
        source?.createQuotes,
        source?.is_admin,
        source?.isAdmin,
        source?.is_employee,
        source?.isEmployee,
    ];

    if (
        directValues.some((value) =>
            value === true ||
            value === 1 ||
            value === "1" ||
            String(value).toLowerCase() === "true"
        )
    ) {
        return true;
    }

    const nestedSources = [
        source?.permissions,
        source?.abilities,
        source?.meta,
        source?.raw,
        source?.user,
        source?.profile,
        source?.data,
    ].filter(Boolean);

    if (nestedSources.some((nestedSource) => hasTruthyQuotePermission(nestedSource))) {
        return true;
    }

    const permissionCollections = [
        source?.permissions,
        source?.abilities,
        source?.roles,
        source?.scopes,
    ].filter(Array.isArray);

    return permissionCollections.some((collection) =>
        collection.some((item) => {
            const normalizedItem = normalizeRoleText(
                typeof item === "string"
                    ? item
                    : item?.name ||
                    item?.slug ||
                    item?.key ||
                    item?.title ||
                    item?.permission ||
                    item?.ability
            );

            return [
                "create_quote",
                "create_quotes",
                "can_create_quote",
                "can_create_quotes",
                "quotes_create",
                "quote_create",
                "admin",
                "super_admin",
                "employee",
                "staff",
            ].includes(normalizedItem);
        })
    );
};

const isExplicitCustomerProfile = (profile) => {
    if (!profile || typeof profile !== "object") {
        return false;
    }

    const roleCandidates = [
        profile?.role,
        profile?.role_name,
        profile?.roleName,
        profile?.type,
        profile?.user_type,
        profile?.userType,
        profile?.account_type,
        profile?.accountType,
        profile?.guard,
        profile?.user?.role,
        profile?.user?.role_name,
        profile?.user?.roleName,
        profile?.user?.type,
        profile?.user?.user_type,
        profile?.profile?.role,
        profile?.profile?.type,
        getNestedProfileValue(profile, ["role.name", "role.slug", "role.key", "role.title"]),
    ]
        .map(normalizeRoleText)
        .filter(Boolean);

    return roleCandidates.some((role) =>
        [
            "customer",
            "client",
            "user",
            "guest",
            "customer_user",
            "client_user",
        ].includes(role)
    );
};

const canProfileCreateQuotes = (profile) => {
    if (!profile || typeof profile !== "object") {
        return false;
    }

    const profileRole = getProfileRoleValue(profile);

    if (profileRole !== null) {
        return canRoleCreateQuotes(profileRole);
    }

    if (isExplicitCustomerProfile(profile)) {
        return false;
    }

    if (hasTruthyQuotePermission(profile)) {
        return true;
    }

    const roleCandidates = [
        profile?.role,
        profile?.role_name,
        profile?.roleName,
        profile?.type,
        profile?.user_type,
        profile?.userType,
        profile?.account_type,
        profile?.accountType,
        profile?.guard,
        profile?.user?.role,
        profile?.user?.role_name,
        profile?.user?.roleName,
        profile?.user?.type,
        profile?.user?.user_type,
        profile?.profile?.role,
        profile?.profile?.type,
        getNestedProfileValue(profile, ["role.name", "role.slug", "role.key", "role.title"]),
    ]
        .map(normalizeRoleText)
        .filter(Boolean);

    return roleCandidates.some((role) =>
        [
            "admin",
            "super_admin",
            "administrator",
            "employee",
            "staff",
            "agent",
            "support",
            "sales",
            "manager",
            "operation",
            "operations",
        ].includes(role)
    );
};

const canConversationCreateQuotes = (...sources) => {
    return sources.some((source) => hasTruthyQuotePermission(source));
};

const USER_ROLE = {
    CUSTOMER: 1,
    EMPLOYEE: 2,
    ADMIN: 3,
};

const canRoleCreateQuotes = (roleValue) => {
    const numericRole = Number(roleValue);

    return numericRole === USER_ROLE.EMPLOYEE || numericRole === USER_ROLE.ADMIN;
};

const canRoleBlockConversations = (roleValue) => {
    const numericRole = Number(roleValue);

    return numericRole === USER_ROLE.EMPLOYEE || numericRole === USER_ROLE.ADMIN;
};

const getMessagePreviewText = (message, tr) => {
    if (!message) return "";

    if (message.text) return message.text;
    if (message.body) return message.body;
    if (message.caption) return message.caption;
    if (message.fileName) return message.fileName;

    if (message.type === "image") return tr("imageMessage", "Image");
    if (message.type === "video") return tr("videoMessage", "Video");
    if (message.type === "document") return tr("document", "Document");
    if (message.type === "audio") return tr("voiceMessage", "Voice message");
    if (message.type === "quote") return tr("quoteSummary", "Quote Summary");

    return tr("message", "Message");
};

const buildReplyMessage = (message, tr) => {
    if (!message) return null;

    return {
        id: message.id,
        type: message.type,
        side: message.side,
        text: getMessagePreviewText(message, tr),
    };
};

const getMessageDeleteId = (message) => {
    const messageId =
        message?.raw?.id ||
        message?.message_id ||
        message?.id ||
        null;

    const numericMessageId = Number(messageId);

    if (!Number.isInteger(numericMessageId) || numericMessageId <= 0) {
        return null;
    }

    return numericMessageId;
};

const isMessageDeletable = (message) => {
    if (
        !message ||
        message.is_deleted ||
        message.isLocal ||
        message.isOptimistic ||
        message.isSending
    ) {
        return false;
    }

    return !!getMessageDeleteId(message);
};

const getValidApiMessageId = (message) => {
    const messageId =
        message?.raw?.id ||
        message?.message_id ||
        message?.id ||
        null;

    const numericMessageId = Number(messageId);

    if (!Number.isInteger(numericMessageId) || numericMessageId <= 0) {
        return null;
    }

    return numericMessageId;
};

const SHOW_CONVERSATION_MESSAGES_PER_PAGE = 30;

const getShowConversationPayload = (response) => {
    return response?.data || response || {};
};

const getShowConversationObject = (response) => {
    const payload = getShowConversationPayload(response);

    return (
        payload?.conversation ||
        payload?.data?.conversation ||
        payload?.item ||
        payload ||
        null
    );
};


const getNormalizedChatValue = (value) => {
    if (value === undefined || value === null || value === "") {
        return null;
    }

    if (typeof value === "object") {
        return null;
    }

    return String(value);
};

const getConversationIdFromShowConversationObject = (conversationObject) => {
    return (
        getNormalizedChatValue(conversationObject?.id) ||
        getNormalizedChatValue(conversationObject?.conversation_id) ||
        getNormalizedChatValue(conversationObject?.conversationId) ||
        null
    );
};

const getIsGroupFromConversationObject = (conversationObject, fallbackIsGroup = false) => {
    if (conversationObject?.is_group === true || conversationObject?.isGroup === true) {
        return true;
    }

    if (conversationObject?.is_group === false || conversationObject?.isGroup === false) {
        return false;
    }

    if (conversationObject?.type === 2) {
        return true;
    }

    if (conversationObject?.type === 1) {
        return false;
    }

    return fallbackIsGroup;
};

const getTargetUserIdFromShowConversationObject = (conversationObject, fallbackTargetUserId = null) => {
    if (!conversationObject || conversationObject?.is_group === true || conversationObject?.isGroup === true) {
        return null;
    }

    return (
        getNormalizedChatValue(conversationObject?.target_user_id) ||
        getNormalizedChatValue(conversationObject?.targetUserId) ||
        getNormalizedChatValue(conversationObject?.other_participant?.id) ||
        getNormalizedChatValue(conversationObject?.other_participant?.user_id) ||
        getNormalizedChatValue(conversationObject?.other_participant?.user?.id) ||
        getNormalizedChatValue(conversationObject?.participant?.id) ||
        getNormalizedChatValue(conversationObject?.participant?.user_id) ||
        getNormalizedChatValue(conversationObject?.participant?.user?.id) ||
        getNormalizedChatValue(fallbackTargetUserId) ||
        null
    );
};



const isPlainObject = (value) => {
    return !!value && typeof value === "object" && !Array.isArray(value);
};

const getMessageResponseObject = (response) => {
    const payload = response?.data || response || {};

    const candidates = [
        payload?.data?.message,
        payload?.message,
        payload?.item,
        payload?.data?.item,
        payload?.data,
    ];

    return candidates.find(isPlainObject) || null;
};


const getQuotePayloadFromMessageResponse = (message) => {
    const candidates = [
        message?.quote,
        message?.quote_data,
        message?.quoteData,
        message?.data?.quote,
        message?.data?.quote_data,
        message?.data?.quoteData,
        message?.message?.quote,
        message?.message?.quote_data,
        message?.raw?.quote,
        message?.raw?.quote_data,
    ];

    return candidates.find(isPlainObject) || null;
};

const getQuoteIdFromMessageResponse = (message) => {
    return (
        message?.quote_id ||
        message?.quoteId ||
        message?.data?.quote_id ||
        message?.data?.quoteId ||
        message?.quote?.id ||
        message?.quote_data?.id ||
        message?.quoteData?.id ||
        null
    );
};

const getQuoteObjectFromQuoteResponse = (response) => {
    const payload = response?.data || response || {};

    const candidates = [
        payload?.data?.quote,
        payload?.quote,
        payload?.data?.item?.quote,
        payload?.item?.quote,
        payload?.message?.quote,
        payload?.data?.message?.quote,
    ];

    return candidates.find(isPlainObject) || null;
};

const buildQuoteResponseWithFallbackQuote = (response, quotePayload = {}) => {
    const responseMessage = getMessageResponseObject(response);

    if (!responseMessage) {
        return response;
    }

    const responseQuote =
        getQuotePayloadFromMessageResponse(responseMessage) ||
        getQuoteObjectFromQuoteResponse(response);

    const fallbackQuoteId =
        getQuoteIdFromMessageResponse(responseMessage) ||
        responseQuote?.id ||
        null;

    const fallbackRoute =
        responseQuote?.route ||
        quotePayload?.route ||
        {
            origin_city: quotePayload?.origin_city || quotePayload?.originCity || "",
            origin_country: quotePayload?.origin_country || quotePayload?.originCountry || "",
            destination_city: quotePayload?.destination_city || quotePayload?.destinationCity || "",
            destination_country: quotePayload?.destination_country || quotePayload?.destinationCountry || "",
        };

    const fallbackQuote = responseQuote || {
        ...quotePayload,
        ...(fallbackQuoteId ? { id: fallbackQuoteId } : {}),
        route: fallbackRoute,
        status:
            responseMessage?.status ||
            responseMessage?.quote_status ||
            quotePayload?.status ||
            {
                value: 1,
                label: "Pending",
            },
    };

    const enhancedMessage = {
        ...responseMessage,
        quote_id: responseMessage?.quote_id || responseMessage?.quoteId || fallbackQuoteId,
        quoteId: responseMessage?.quoteId || responseMessage?.quote_id || fallbackQuoteId,
        quote: fallbackQuote,
        quote_data: fallbackQuote,
        quoteData: fallbackQuote,
    };

    const responseData = response?.data;

    if (isPlainObject(responseData)) {
        return {
            ...response,
            data: {
                ...responseData,
                data: isPlainObject(responseData?.data)
                    ? {
                        ...responseData.data,
                        quote: fallbackQuote,
                        message: enhancedMessage,
                        item:
                            responseData.data.item === responseMessage
                                ? enhancedMessage
                                : responseData.data.item,
                    }
                    : responseData?.data,
                quote: responseData?.quote || fallbackQuote,
                message: enhancedMessage,
                item:
                    responseData?.item === responseMessage
                        ? enhancedMessage
                        : responseData?.item,
            },
        };
    }

    return {
        ...response,
        quote: fallbackQuote,
        message: enhancedMessage,
    };
};

const getConversationFromMessageResponse = (response) => {
    const payload = response?.data || response || {};
    const message = getMessageResponseObject(response);

    const candidates = [
        payload?.conversation,
        payload?.data?.conversation,
        message?.conversation,
        message?.data?.conversation,
    ];

    return candidates.find(isPlainObject) || null;
};

const getConversationIdFromMessageResponse = (response) => {
    const conversation = getConversationFromMessageResponse(response);
    const message = getMessageResponseObject(response);

    return (
        conversation?.id ||
        conversation?.conversation_id ||
        message?.conversation_id ||
        message?.conversationId ||
        null
    );
};

const getShowConversationMessagesWrapper = (response) => {
    const payload = getShowConversationPayload(response);

    return (
        payload?.messages ||
        payload?.data?.messages ||
        payload?.conversation?.messages ||
        payload?.data?.conversation?.messages ||
        []
    );
};

const getShowConversationMessages = (response) => {
    const messagesWrapper = getShowConversationMessagesWrapper(response);

    if (Array.isArray(messagesWrapper)) return messagesWrapper;
    if (Array.isArray(messagesWrapper?.items)) return messagesWrapper.items;
    if (Array.isArray(messagesWrapper?.data)) return messagesWrapper.data;
    if (Array.isArray(messagesWrapper?.data?.items)) return messagesWrapper.data.items;

    return [];
};

const isApiMessageDeleted = (message) => {
    if (!message) return false;

    return !!(
        message?.is_deleted === true ||
        message?.deleted_at ||
        message?.deletedAt ||
        message?.isDeleted === true ||
        message?.raw?.is_deleted === true ||
        message?.raw?.deleted_at ||
        message?.raw?.deletedAt ||
        message?.raw?.isDeleted === true
    );
};

const getVisibleShowConversationMessages = (response) => {
    return getShowConversationMessages(response).filter(
        (message) => !isApiMessageDeleted(message)
    );
};

const getShowConversationMessagesMeta = (response) => {
    const payload = getShowConversationPayload(response);
    const messagesWrapper = getShowConversationMessagesWrapper(response);

    return (
        messagesWrapper?.meta ||
        messagesWrapper?.pagination ||
        messagesWrapper?.data?.meta ||
        messagesWrapper?.data?.pagination ||
        payload?.meta ||
        payload?.pagination ||
        payload?.data?.meta ||
        payload?.data?.pagination ||
        null
    );
};

const getPaginationNumberValue = (value) => {
    if (value === undefined || value === null || value === "") {
        return null;
    }

    const numericValue = Number(value);

    if (!Number.isFinite(numericValue) || numericValue <= 0) {
        return null;
    }

    return Math.floor(numericValue);
};

const getPaginationPageFromUrl = (url = "") => {
    const cleanUrl = String(url || "").trim();

    if (!cleanUrl) {
        return null;
    }

    const pageMatch = cleanUrl.match(/[?&]page=(\d+)/i);

    return getPaginationNumberValue(pageMatch?.[1]);
};

const getNextOlderMessagesPage = (meta) => {
    if (!meta || typeof meta !== "object") {
        return null;
    }

    const directNextPage =
        getPaginationNumberValue(meta?.next_page) ||
        getPaginationNumberValue(meta?.nextPage) ||
        getPaginationNumberValue(meta?.next);

    if (directNextPage) {
        return directNextPage;
    }

    const nextPageFromUrl =
        getPaginationPageFromUrl(meta?.next_page_url) ||
        getPaginationPageFromUrl(meta?.nextPageUrl) ||
        getPaginationPageFromUrl(meta?.links?.next) ||
        getPaginationPageFromUrl(meta?.next_url) ||
        getPaginationPageFromUrl(meta?.nextUrl);

    if (nextPageFromUrl) {
        return nextPageFromUrl;
    }

    const currentPage =
        getPaginationNumberValue(meta?.current_page) ||
        getPaginationNumberValue(meta?.currentPage) ||
        getPaginationNumberValue(meta?.page);

    const lastPage =
        getPaginationNumberValue(meta?.last_page) ||
        getPaginationNumberValue(meta?.lastPage) ||
        getPaginationNumberValue(meta?.total_pages) ||
        getPaginationNumberValue(meta?.totalPages);

    if (currentPage && lastPage && currentPage < lastPage) {
        return currentPage + 1;
    }

    const perPage =
        getPaginationNumberValue(meta?.per_page) ||
        getPaginationNumberValue(meta?.perPage);

    const total = getPaginationNumberValue(meta?.total);

    if (currentPage && perPage && total && currentPage * perPage < total) {
        return currentPage + 1;
    }

    return null;
};


const getAttachmentRawName = (attachment) => {
    return String(
        attachment?.name ||
        attachment?.file_name ||
        attachment?.filename ||
        attachment?.original_name ||
        attachment?.originalName ||
        attachment?.fileName ||
        attachment?.path ||
        attachment?.url ||
        attachment?.uri ||
        ""
    ).toLowerCase();
};

const getAttachmentRawMimeType = (attachment) => {
    return String(
        attachment?.mime_type ||
        attachment?.mimeType ||
        attachment?.type ||
        attachment?.content_type ||
        attachment?.contentType ||
        ""
    ).toLowerCase();
};

const isVideoAttachment = (attachment) => {
    const mimeType = getAttachmentRawMimeType(attachment);
    const name = getAttachmentRawName(attachment);

    return (
        mimeType.startsWith("video/") ||
        [".mp4", ".mov", ".m4v", ".webm", ".avi", ".mkv", ".3gp"].some((extension) =>
            name.includes(extension)
        )
    );
};

const isImageAttachment = (attachment) => {
    const mimeType = getAttachmentRawMimeType(attachment);
    const name = getAttachmentRawName(attachment);

    return (
        mimeType.startsWith("image/") ||
        [".jpg", ".jpeg", ".png", ".webp", ".gif"].some((extension) =>
            name.includes(extension)
        )
    );
};

const isAudioAttachment = (attachment) => {
    const mimeType = getAttachmentRawMimeType(attachment);
    const name = getAttachmentRawName(attachment);

    return (
        mimeType.startsWith("audio/") ||
        [".m4a", ".mp3", ".aac", ".wav", ".ogg", ".oga", ".webm", ".amr"].some((extension) =>
            name.includes(extension)
        )
    );
};

const getApiMessageType = (message) => {
    const rawType = message?.type ?? message?.message_type ?? 1;
    const attachment = getFirstApiAttachment(message);

    if (typeof rawType === "number") {
        if (rawType === 2) return "image";
        if (rawType === 3) {
            if (isVideoAttachment(attachment)) return "video";
            if (isImageAttachment(attachment)) return "image";
            if (isAudioAttachment(attachment)) return "audio";
            return "document";
        }
        if (rawType === 4) return "video";
        if (rawType === 5) return "system";
        if (rawType === 6) return "call";
        if (rawType === 7) return "quote";
        if (rawType === 8) return "audio";

        return "text";
    }

    const normalizedType = String(rawType || "text").toLowerCase();

    if (["2", "image", "photo"].includes(normalizedType)) return "image";
    if (["4", "video"].includes(normalizedType) || normalizedType.startsWith("video/")) return "video";
    if (["8", "audio", "voice", "voice_message", "voice-message"].includes(normalizedType) || normalizedType.startsWith("audio/")) return "audio";
    if (normalizedType.startsWith("image/")) return "image";
    if (["3", "file", "document", "attachment"].includes(normalizedType)) {
        if (isVideoAttachment(attachment)) return "video";
        if (isImageAttachment(attachment)) return "image";
        if (isAudioAttachment(attachment)) return "audio";
        return "document";
    }
    if (["5", "system"].includes(normalizedType)) return "system";
    if (["6", "call"].includes(normalizedType)) return "call";
    if (["7", "quote"].includes(normalizedType)) return "quote";

    return "text";
};

const getApiMessageBody = (message) => {
    return String(message?.body || message?.text || message?.caption || "");
};

const getFirstApiAttachment = (message) => {
    const attachmentLists = [
        message?.attachments,
        message?.data?.attachments,
        message?.message?.attachments,
        message?.raw?.attachments,
    ];

    for (const attachments of attachmentLists) {
        if (Array.isArray(attachments) && attachments.length > 0) {
            return attachments[0];
        }
    }

    return (
        message?.attachment ||
        message?.file ||
        message?.media ||
        message?.audio ||
        message?.voice ||
        message?.data?.attachment ||
        message?.data?.file ||
        message?.data?.media ||
        message?.data?.audio ||
        message?.raw?.attachment ||
        message?.raw?.file ||
        message?.raw?.media ||
        message?.raw?.audio ||
        null
    );
};

const normalizeRemoteAttachmentUri = (uri = "") => {
    const cleanUri = String(uri || "").trim();

    if (!cleanUri) {
        return "";
    }

    if (
        cleanUri.startsWith("http://") ||
        cleanUri.startsWith("https://") ||
        cleanUri.startsWith("file://") ||
        cleanUri.startsWith("content://")
    ) {
        return encodeURI(cleanUri);
    }

    if (cleanUri.startsWith("//")) {
        return encodeURI(`https:${cleanUri}`);
    }

    const cleanBaseUrl = String(API_BASE_URL || "").replace(/\/$/, "");
    const cleanPath = cleanUri.startsWith("/") ? cleanUri : `/${cleanUri}`;

    return encodeURI(`${cleanBaseUrl}${cleanPath}`);
};

const getAttachmentUri = (attachment) => {
    const rawUri =
        attachment?.url ||
        attachment?.file_url ||
        attachment?.fileUrl ||
        attachment?.full_url ||
        attachment?.fullUrl ||
        attachment?.original_url ||
        attachment?.originalUrl ||
        attachment?.download_url ||
        attachment?.downloadUrl ||
        attachment?.preview_url ||
        attachment?.previewUrl ||
        attachment?.temporary_url ||
        attachment?.temporaryUrl ||
        attachment?.signed_url ||
        attachment?.signedUrl ||
        attachment?.public_url ||
        attachment?.publicUrl ||
        attachment?.audio_url ||
        attachment?.audioUrl ||
        attachment?.voice_url ||
        attachment?.voiceUrl ||
        attachment?.file_path ||
        attachment?.filePath ||
        attachment?.path ||
        attachment?.uri ||
        "";

    return normalizeRemoteAttachmentUri(rawUri);
};

const getAttachmentName = (attachment, fallback = "attached-file") => {
    return String(
        attachment?.name ||
        attachment?.file_name ||
        attachment?.fileName ||
        attachment?.filename ||
        attachment?.original_name ||
        attachment?.originalName ||
        fallback
    );
};

const getAudioDurationMillisFromMessage = (message, attachment) => {
    const durationValue =
        message?.duration_millis ||
        message?.durationMillis ||
        message?.audio_duration_millis ||
        message?.audioDurationMillis ||
        attachment?.duration_millis ||
        attachment?.durationMillis ||
        message?.duration ||
        attachment?.duration ||
        0;

    const numericDuration = Number(durationValue || 0);

    if (!Number.isFinite(numericDuration) || numericDuration <= 0) {
        return 0;
    }

    return numericDuration > 0 && numericDuration < 1000
        ? Math.round(numericDuration * 1000)
        : Math.round(numericDuration);
};

const formatApiMessageTime = (value, isArabic) => {
    if (!value) return "";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleTimeString(isArabic ? "ar" : "en", {
        hour: "numeric",
        minute: "2-digit",
    });
};

const getApiMessageCreatedValue = (message) => {
    const dateValue =
        message?.created_at ||
        message?.sent_at ||
        message?.time ||
        message?.createdAt ||
        message?.sentAt ||
        null;

    if (dateValue) {
        const date = new Date(dateValue);

        if (!Number.isNaN(date.getTime())) {
            return date.getTime();
        }
    }

    const numericId = Number(message?.id || message?.message_id || message?.uuid);

    if (Number.isFinite(numericId)) {
        return numericId;
    }

    return 0;
};

const sortMessagesOldestToNewest = (messages = []) => {
    return [...messages].sort(
        (firstMessage, secondMessage) =>
            getApiMessageCreatedValue(firstMessage) -
            getApiMessageCreatedValue(secondMessage)
    );
};

const findMessageById = (messages = [], messageId) => {
    if (!messageId) return null;

    const targetId = String(messageId);

    return messages.find((item) => {
        const itemId = item?.id || item?.message_id || item?.uuid || item?.raw?.id;
        return itemId !== undefined && itemId !== null && String(itemId) === targetId;
    }) || null;
};

const getReplyMessageText = (message, tr, knownMessages = []) => {
    if (!message) return "";

    const directText =
        message?.text ||
        message?.body ||
        message?.caption ||
        message?.fileName ||
        message?.file_name ||
        message?.filename ||
        "";

    if (directText) {
        return String(directText);
    }

    const nestedMessage =
        message?.message ||
        message?.data?.message ||
        message?.raw ||
        null;

    if (nestedMessage && nestedMessage !== message) {
        const nestedText = getReplyMessageText(nestedMessage, tr, knownMessages);

        if (nestedText) {
            return nestedText;
        }
    }

    const replyId =
        message?.id ||
        message?.message_id ||
        message?.uuid ||
        message?.reply_to_message_id ||
        message?.replyToMessageId ||
        null;

    const knownMessage = findMessageById(knownMessages, replyId);

    if (knownMessage && knownMessage !== message) {
        const knownText = getReplyMessageText(knownMessage, tr, []);

        if (knownText) {
            return knownText;
        }
    }

    const type = getApiMessageType(message);
    const attachment = getFirstApiAttachment(message);

    if (attachment) {
        const attachmentName = getAttachmentName(attachment, "");

        if (attachmentName) {
            return attachmentName;
        }
    }

    if (type === "image") return tr("imageMessage", "Image");
    if (type === "video") return tr("videoMessage", "Video");
    if (type === "document") return tr("document", "Document");
    if (type === "audio") return tr("voiceMessage", "Voice message");
    if (type === "quote") return tr("quoteSummary", "Quote Summary");

    return tr("message", "Message");
};

const normalizeApiReplyMessage = (message, tr, knownMessages = []) => {
    if (!message) return null;

    const type = getApiMessageType(message);

    return {
        id: message?.id || message?.message_id || message?.uuid,
        type,
        side: message?.is_mine || message?.side === "me" ? "me" : "employee",
        text: getReplyMessageText(message, tr, knownMessages),
    };
};

const normalizeApiMessage = (message, tr, isArabic, knownMessages = []) => {
    const type = getApiMessageType(message);
    const attachment = getFirstApiAttachment(message);
    const attachmentUri = getAttachmentUri(attachment);
    const body = getApiMessageBody(message);
    const isMine = message?.is_mine === true || message?.sender?.is_me === true;
    const replySource =
        message?.reply_to_message ||
        message?.reply_to ||
        message?.parent_message ||
        message?.quoted_message ||
        findMessageById(knownMessages, message?.reply_to_message_id || message?.replyToMessageId) ||
        null;

    const baseMessage = {
        id: String(message?.id || message?.uuid || Date.now()),
        side: isMine ? "me" : "employee",
        type,
        time: formatApiMessageTime(message?.created_at || message?.sent_at || message?.time, isArabic),
        is_mine: isMine,
        is_deleted: message?.is_deleted === true || !!message?.deleted_at,
        raw: message,
        replyToMessage: normalizeApiReplyMessage(replySource, tr, knownMessages),
        reply_to_message_id: message?.reply_to_message_id || replySource?.id || null,
    };

    if (type === "image") {
        return {
            ...baseMessage,
            image: attachmentUri ? { uri: attachmentUri } : null,
            uri: attachmentUri,
            caption: body,
        };
    }

    if (type === "video") {
        return {
            ...baseMessage,
            video: attachmentUri ? { uri: attachmentUri } : null,
            uri: attachmentUri,
            caption: body,
        };
    }

    if (type === "document") {
        return {
            ...baseMessage,
            uri: attachmentUri,
            fileName: getAttachmentName(attachment, tr("attachedFile", "Attached file")),
            mimeType: attachment?.mime_type || attachment?.mimeType || "application/octet-stream",
            size: attachment?.size || attachment?.file_size || attachment?.size_bytes || 0,
            caption: body,
        };
    }

    if (type === "audio") {
        return {
            ...baseMessage,
            uri: attachmentUri,
            fileName: getAttachmentName(attachment, tr("voiceMessage", "Voice message")),
            mimeType: attachment?.mime_type || attachment?.mimeType || "audio/mp4",
            size: attachment?.size || attachment?.file_size || attachment?.size_bytes || 0,
            durationMillis: getAudioDurationMillisFromMessage(message, attachment),
            caption: body,
        };
    }

    if (type === "quote") {
        const quotePayload =
            message?.quote ||
            message?.quote_data ||
            message?.quoteData ||
            message?.data?.quote ||
            message?.data?.quote_data ||
            message?.data?.quoteData ||
            message?.message?.quote ||
            message?.message?.quote_data ||
            message?.raw?.quote ||
            message?.raw?.quote_data ||
            null;

        return {
            ...baseMessage,
            quote: quotePayload,
            quote_data: quotePayload,
            quoteData: quotePayload,
            text: body,
        };
    }

    return {
        ...baseMessage,
        type: "text",
        text: body,
    };
};

const getLocalMessageTypeFromPayloadType = (type) => {
    const messageType = Number(type);

    if (messageType === 2) return "image";
    if (messageType === 3) return "document";
    if (messageType === 4) return "video";
    if (messageType === 7) return "quote";
    if (messageType === 8) return "audio";

    return "text";
};

const createOptimisticMessage = ({
    type = 1,
    body = "",
    attachment,
    localReplyMessage,
    tr,
}) => {
    const localType = getLocalMessageTypeFromPayloadType(type);
    const tempId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const cleanBody = String(body || "");

    const baseMessage = {
        id: tempId,
        local_id: tempId,
        tempId,
        side: "me",
        type: localType,
        time: tr("now", "Now"),
        is_mine: true,
        isLocal: true,
        isOptimistic: true,
        isSending: true,
        isFailed: false,
        sendStatus: "sending",
        status: "sending",
        delivery_status: "sending",
        raw: null,
        replyToMessage: localReplyMessage
            ? buildReplyMessage(localReplyMessage, tr)
            : null,
        reply_to_message_id: getValidApiMessageId(localReplyMessage),
    };

    if (localType === "image") {
        return {
            ...baseMessage,
            image: attachment?.uri ? { uri: attachment.uri } : null,
            uri: attachment?.uri || "",
            caption: cleanBody,
            size: attachment?.size || attachment?.fileSize || attachment?.file_size || 0,
        };
    }

    if (localType === "video") {
        return {
            ...baseMessage,
            video: attachment?.uri ? { uri: attachment.uri } : null,
            uri: attachment?.uri || "",
            caption: cleanBody,
            size: attachment?.size || attachment?.fileSize || attachment?.file_size || 0,
        };
    }

    if (localType === "document") {
        return {
            ...baseMessage,
            uri: attachment?.uri || "",
            fileName:
                attachment?.name ||
                attachment?.fileName ||
                attachment?.filename ||
                tr("attachedFile", "Attached file"),
            mimeType: attachment?.type || attachment?.mimeType || "application/octet-stream",
            size: attachment?.size || attachment?.fileSize || attachment?.file_size || 0,
            caption: cleanBody,
        };
    }

    if (localType === "audio") {
        const durationMillis = Number(
            attachment?.durationMillis ||
            attachment?.duration_millis ||
            0
        );

        return {
            ...baseMessage,
            uri: attachment?.uri || "",
            fileName:
                attachment?.name ||
                attachment?.fileName ||
                attachment?.filename ||
                tr("voiceMessage", "Voice message"),
            mimeType: attachment?.type || attachment?.mimeType || attachment?.mime_type || "audio/mp4",
            size: attachment?.size || attachment?.fileSize || attachment?.file_size || 0,
            durationMillis: Number.isFinite(durationMillis) ? durationMillis : 0,
            duration: Math.round((Number.isFinite(durationMillis) ? durationMillis : 0) / 1000),
            caption: cleanBody,
        };
    }

    return {
        ...baseMessage,
        type: "text",
        text: cleanBody,
    };
};

const markMessageAsFailed = (message) => ({
    ...message,
    isSending: false,
    isFailed: true,
    sendStatus: "failed",
    status: "failed",
    delivery_status: "failed",
});

const markMessageAsSent = (message) => ({
    ...message,
    isSending: false,
    isFailed: false,
    isLocal: false,
    isOptimistic: false,
    sendStatus: "sent",
    status: "sent",
    delivery_status: "sent",
});

const getApiMessageTypeFromLocalMessage = (message) => {
    const localType = String(message?.type || "text").toLowerCase();

    if (localType === "image") return 2;
    if (localType === "document") return 3;
    if (localType === "video") return 4;
    if (localType === "quote") return 7;
    if (localType === "audio") return 8;

    return 1;
};

const getRetryAttachmentFromMessage = (message) => {
    const retryType = getApiMessageTypeFromLocalMessage(message);

    if (retryType === 1) {
        return null;
    }

    const uri =
        message?.uri ||
        message?.image?.uri ||
        message?.video?.uri ||
        null;

    if (!uri) {
        return null;
    }

    return {
        uri,
        name:
            message?.fileName ||
            message?.name ||
            message?.filename ||
            `attachment-${Date.now()}`,
        type:
            message?.mimeType ||
            message?.attachmentMimeType ||
            (retryType === 2
                ? "image/jpeg"
                : retryType === 4
                    ? "video/mp4"
                    : retryType === 8
                        ? "audio/mp4"
                        : "application/octet-stream"),
        size: message?.size || message?.fileSize || message?.file_size || 0,
        fileSize: message?.size || message?.fileSize || message?.file_size || 0,
        durationMillis: message?.durationMillis || message?.duration_millis || 0,
    };
};

const shouldKeepMessageAsMine = (message) => {
    return !!(
        message?.side === "me" ||
        message?.is_mine === true ||
        message?.isLocal === true ||
        message?.isOptimistic === true ||
        message?.isSending === true
    );
};

const forceMessageAsMine = (message) => ({
    ...message,
    side: "me",
    is_mine: true,
});

const getComparableMessageId = (message) => {
    return (
        message?.raw?.id ||
        message?.message_id ||
        message?.id ||
        message?.uuid ||
        null
    );
};

const getMessageComparableText = (message) => {
    return String(
        message?.text ||
        message?.caption ||
        message?.body ||
        message?.raw?.body ||
        message?.raw?.text ||
        message?.raw?.caption ||
        ""
    ).trim();
};

const getMessageComparableType = (message) => {
    return String(
        message?.type ||
        getApiMessageType(message?.raw || message) ||
        "text"
    );
};

const getMessageComparableFileName = (message) => {
    const attachment = getFirstApiAttachment(message?.raw || message);

    return String(
        message?.fileName ||
        message?.name ||
        message?.filename ||
        attachment?.name ||
        attachment?.file_name ||
        attachment?.filename ||
        attachment?.original_name ||
        ""
    ).trim();
};

const isLikelySameOutgoingMessage = (localMessage, incomingMessage) => {
    if (!shouldKeepMessageAsMine(localMessage)) {
        return false;
    }

    const localType = getMessageComparableType(localMessage);
    const incomingType = getMessageComparableType(incomingMessage);

    if (localType !== incomingType) {
        return false;
    }

    const localText = getMessageComparableText(localMessage);
    const incomingText = getMessageComparableText(incomingMessage);

    if (localType === "text" || localType === "quote") {
        return (
            (localMessage?.isSending || localMessage?.isOptimistic || localMessage?.isLocal) &&
            !!localText &&
            !!incomingText &&
            localText === incomingText
        );
    }

    const localFileName = getMessageComparableFileName(localMessage);
    const incomingFileName = getMessageComparableFileName(incomingMessage);

    if (localFileName && incomingFileName && localFileName === incomingFileName) {
        return true;
    }

    // For media/file messages, only allow a loose same-type match while the local
    // message is still optimistic/sending. This prevents a sender's own realtime
    // event from appearing as if the receiver sent it, while avoiding old-message
    // false matches after the upload flow is already settled.
    return (
        ["image", "video", "document", "audio"].includes(localType) &&
        (localMessage?.isSending || localMessage?.isOptimistic || localMessage?.isLocal)
    );
};


const getOutgoingMessageSignature = ({ type = 1, body = "", attachment } = {}) => {
    const localType = getLocalMessageTypeFromPayloadType(type);
    const cleanBody = String(body || "").trim();
    const fileName = String(
        attachment?.name ||
        attachment?.fileName ||
        attachment?.filename ||
        ""
    ).trim();

    return `${localType}|${cleanBody}|${fileName}`;
};

const getApiMessageSignature = (message) => {
    const localType = getApiMessageType(message);
    const cleanBody = getApiMessageBody(message).trim();
    const attachment = getFirstApiAttachment(message);
    const fileName = getAttachmentName(attachment, "").trim();

    return `${localType}|${cleanBody}|${fileName}`;
};

const getMessageSenderId = (message) => {
    const source = message?.raw || message || {};

    return (
        source?.sender?.id ||
        source?.sender_id ||
        source?.senderId ||
        source?.user_id ||
        source?.userId ||
        null
    );
};

const rememberOwnSenderIdFromMessage = (ownSenderIdsRef, message) => {
    const senderId = getMessageSenderId(message);

    if (!senderId) {
        return;
    }

    ownSenderIdsRef.current.add(String(senderId));
};

const rememberOwnSenderIdsFromMessages = (ownSenderIdsRef, messages = []) => {
    messages.forEach((message) => {
        if (
            message?.is_mine === true ||
            message?.isMine === true ||
            message?.sender?.is_me === true ||
            message?.side === "me"
        ) {
            rememberOwnSenderIdFromMessage(ownSenderIdsRef, message);
        }
    });
};

const isMessageFromKnownOwnSender = (ownSenderIdsRef, message) => {
    const senderId = getMessageSenderId(message);

    if (!senderId) {
        return false;
    }

    return ownSenderIdsRef.current.has(String(senderId));
};

const OUTGOING_MESSAGE_SIGNATURE_TTL_MS = 10 * 60 * 1000;

const rememberOutgoingMessageSignature = (pendingSignaturesRef, signature) => {
    if (!signature) {
        return;
    }

    pendingSignaturesRef.current.set(signature, Date.now());
};

const rememberOutgoingApiMessage = (
    ownMessageIdsRef,
    pendingSignaturesRef,
    ownSenderIdsRef,
    message
) => {
    if (message?.id) {
        ownMessageIdsRef.current.add(String(message.id));
    }

    rememberOwnSenderIdFromMessage(ownSenderIdsRef, message);

    const signature = getApiMessageSignature(message);
    rememberOutgoingMessageSignature(pendingSignaturesRef, signature);
};

const isRecentOutgoingMessageSignature = (pendingSignaturesRef, signature) => {
    if (!signature) {
        return false;
    }

    const createdAt = pendingSignaturesRef.current.get(signature);

    if (!createdAt) {
        return false;
    }

    return Date.now() - createdAt <= OUTGOING_MESSAGE_SIGNATURE_TTL_MS;
};

const pruneOldOutgoingMessageSignatures = (pendingSignaturesRef) => {
    const now = Date.now();

    pendingSignaturesRef.current.forEach((createdAt, signature) => {
        if (now - createdAt > OUTGOING_MESSAGE_SIGNATURE_TTL_MS) {
            pendingSignaturesRef.current.delete(signature);
        }
    });
};


const getConversationBlockedStateFromShowResponse = (response) => {
    const conversation = getShowConversationObject(response);

    return !!(
        conversation?.is_blocked ||
        conversation?.blocked_by_me ||
        conversation?.block?.is_blocked ||
        conversation?.meta?.is_blocked
    );
};

const getNestedPresenceValue = (source, paths = []) => {
    if (!source || typeof source !== "object") {
        return null;
    }

    for (const path of paths) {
        const value = String(path)
            .split(".")
            .reduce((current, key) => current?.[key], source);

        if (value !== undefined && value !== null && value !== "") {
            return value;
        }
    }

    return null;
};

const getLastSeenAtFromSources = (...sources) => {
    const paths = [
        "last_seen_at",
        "lastSeenAt",
        "last_seen",
        "lastSeen",
        "offline_at",
        "offlineAt",
        "disconnected_at",
        "disconnectedAt",
        "employee.last_seen_at",
        "employee.lastSeenAt",
        "employee.last_seen",
        "employee.lastSeen",
        "customer.last_seen_at",
        "customer.lastSeenAt",
        "customer.last_seen",
        "customer.lastSeen",
        "participant.last_seen_at",
        "participant.lastSeenAt",
        "participant.last_seen",
        "participant.lastSeen",
        "other_participant.last_seen_at",
        "other_participant.lastSeenAt",
        "other_participant.last_seen",
        "other_participant.lastSeen",
        "user.last_seen_at",
        "user.lastSeenAt",
        "user.last_seen",
        "user.lastSeen",
    ];

    for (const source of sources) {
        const value = getNestedPresenceValue(source, paths);

        if (value) {
            return value;
        }
    }

    return null;
};

const formatLastSeenText = (lastSeenAt, isArabic) => {
    if (!lastSeenAt) {
        return isArabic ? "غير متصل" : "Offline";
    }

    const date = new Date(lastSeenAt);

    if (Number.isNaN(date.getTime())) {
        return isArabic
            ? `آخر ظهور ${String(lastSeenAt)}`
            : `Last seen ${String(lastSeenAt)}`;
    }

    const locale = isArabic ? "ar" : "en";
    const now = new Date();
    const isSameDay =
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate();
    const timeText = date.toLocaleTimeString(locale, {
        hour: "numeric",
        minute: "2-digit",
    });

    if (isSameDay) {
        return isArabic ? `آخر ظهور ${timeText}` : `Last seen ${timeText}`;
    }

    const dateText = date.toLocaleDateString(locale, {
        month: "short",
        day: "numeric",
    });

    return isArabic
        ? `آخر ظهور ${dateText} ${timeText}`
        : `Last seen ${dateText} ${timeText}`;
};

const formatPresenceText = ({
    isBlocked,
    isTyping,
    isRecording,
    isOnline,
    lastSeenAt,
    personName = "",
    isGroup = false,
    isArabic,
    tr,
}) => {
    if (isBlocked) {
        return tr("blocked", "Blocked");
    }

    const activityText = getActivityText({
        isRecording,
        isTyping,
        personName,
        isGroup,
        isArabic,
        tr,
    });

    if (activityText) {
        return activityText;
    }

    if (isGroup) {
        return "";
    }

    if (isOnline) {
        return tr("onlineNow", isArabic ? "متصل الآن" : "Online now");
    }

    return formatLastSeenText(lastSeenAt, isArabic);
};


const getProfileTextFromSources = (sources = [], paths = []) => {
    for (const source of sources) {
        if (!source || typeof source !== "object") {
            continue;
        }

        for (const path of paths) {
            const value = String(path)
                .split(".")
                .reduce((current, key) => current?.[key], source);

            if (value !== undefined && value !== null && value !== "" && typeof value !== "object") {
                const cleanValue = String(value).trim();

                if (cleanValue) {
                    return cleanValue;
                }
            }
        }
    }

    return "";
};

const getProfileAvatarFromSources = (sources = []) => {
    const avatarPaths = [
        "avatar",
        "avatar_url",
        "avatarUrl",
        "image",
        "photo",
        "profile_photo",
        "profilePhoto",
        "target_user.avatar",
        "target_user.avatar_url",
        "target_user.avatarUrl",
        "targetUser.avatar",
        "targetUser.avatar_url",
        "targetUser.avatarUrl",
        "other_participant.avatar",
        "other_participant.avatar_url",
        "other_participant.avatarUrl",
        "other_participant.user.avatar",
        "other_participant.user.avatar_url",
        "other_participant.user.avatarUrl",
        "participant.avatar",
        "participant.avatar_url",
        "participant.avatarUrl",
        "participant.user.avatar",
        "participant.user.avatar_url",
        "participant.user.avatarUrl",
        "employee.avatar",
        "employee.avatar_url",
        "employee.avatarUrl",
        "employee.user.avatar",
        "employee.user.avatar_url",
        "employee.user.avatarUrl",
        "customer.avatar",
        "customer.avatar_url",
        "customer.avatarUrl",
        "customer.user.avatar",
        "customer.user.avatar_url",
        "customer.user.avatarUrl",
        "user.avatar",
        "user.avatar_url",
        "user.avatarUrl",
    ];

    for (const source of sources) {
        if (!source || typeof source !== "object") {
            continue;
        }

        for (const path of avatarPaths) {
            const value = String(path)
                .split(".")
                .reduce((current, key) => current?.[key], source);
            const avatarValue = value && typeof value === "object"
                ? value.url ||
                value.full_url ||
                value.fullUrl ||
                value.path ||
                value.src ||
                value.preview_url ||
                value.previewUrl ||
                null
                : value;
            const avatar = normalizeRemoteAttachmentUri(avatarValue);

            if (avatar) {
                return avatar;
            }
        }
    }

    return null;
};

const getChatProfileInfoFromSources = (...sources) => {
    const validSources = sources.filter(Boolean);

    const name = getProfileTextFromSources(validSources, [
        "display_name",
        "full_name",
        "fullName",
        "name",
        "title",
        "target_user.full_name",
        "target_user.fullName",
        "target_user.name",
        "target_user.display_name",
        "targetUser.full_name",
        "targetUser.fullName",
        "targetUser.name",
        "targetUser.display_name",
        "other_participant.full_name",
        "other_participant.fullName",
        "other_participant.name",
        "other_participant.display_name",
        "other_participant.user.full_name",
        "other_participant.user.fullName",
        "other_participant.user.name",
        "participant.full_name",
        "participant.fullName",
        "participant.name",
        "participant.display_name",
        "participant.user.full_name",
        "participant.user.fullName",
        "participant.user.name",
        "employee.full_name",
        "employee.fullName",
        "employee.name",
        "employee.display_name",
        "employee.user.full_name",
        "employee.user.fullName",
        "employee.user.name",
        "customer.full_name",
        "customer.fullName",
        "customer.name",
        "customer.display_name",
        "customer.user.full_name",
        "customer.user.fullName",
        "customer.user.name",
        "user.full_name",
        "user.fullName",
        "user.name",
    ]);

    const department = getProfileTextFromSources(validSources, [
        "department.name",
        "department.title",
        "department_name",
        "department",
        "target_user.department.name",
        "target_user.department.title",
        "target_user.department_name",
        "targetUser.department.name",
        "targetUser.department.title",
        "targetUser.department_name",
        "other_participant.department.name",
        "other_participant.department.title",
        "other_participant.department_name",
        "other_participant.user.department.name",
        "other_participant.user.department.title",
        "participant.department.name",
        "participant.department.title",
        "participant.department_name",
        "employee.department.name",
        "employee.department.title",
        "employee.department_name",
        "employee.user.department.name",
        "employee.user.department.title",
        "customer.department.name",
        "customer.department.title",
        "customer.department_name",
        "user.department.name",
        "user.department.title",
    ]);

    const phone = getProfileTextFromSources(validSources, [
        "phone",
        "phone_e164",
        "phoneE164",
        "mobile",
        "target_user.phone",
        "target_user.phone_e164",
        "targetUser.phone",
        "other_participant.phone",
        "other_participant.phone_e164",
        "other_participant.user.phone",
        "participant.phone",
        "participant.user.phone",
        "employee.phone",
        "employee.phone_e164",
        "employee.user.phone",
        "customer.phone",
        "customer.phone_e164",
        "customer.user.phone",
        "user.phone",
        "user.phone_e164",
    ]);

    const username = getProfileTextFromSources(validSources, [
        "username",
        "user_name",
        "target_user.username",
        "targetUser.username",
        "other_participant.username",
        "other_participant.user.username",
        "participant.username",
        "participant.user.username",
        "employee.username",
        "employee.user.username",
        "customer.username",
        "customer.user.username",
        "user.username",
    ]);

    const email = getProfileTextFromSources(validSources, [
        "email",
        "target_user.email",
        "targetUser.email",
        "other_participant.email",
        "other_participant.user.email",
        "participant.email",
        "participant.user.email",
        "employee.email",
        "employee.user.email",
        "customer.email",
        "customer.user.email",
        "user.email",
    ]);

    const location = getProfileTextFromSources(validSources, [
        "location",
        "address",
        "city",
        "country",
        "target_user.location",
        "targetUser.location",
        "other_participant.location",
        "other_participant.user.location",
        "participant.location",
        "participant.user.location",
        "employee.location",
        "employee.user.location",
        "customer.location",
        "customer.user.location",
        "user.location",
    ]);

    return {
        name,
        department,
        avatar: getProfileAvatarFromSources(validSources),
        phone,
        username,
        email,
        location,
    };
};


const getGroupParticipantCandidates = (source) => {
    if (!source || typeof source !== "object") {
        return [];
    }

    const candidates = [
        source?.participants,
        source?.members,
        source?.users,
        source?.conversation_participants,
        source?.conversationParticipants,
        source?.data?.participants,
        source?.data?.members,
        source?.data?.users,
        source?.conversation?.participants,
        source?.conversation?.members,
        source?.conversation?.users,
    ];

    return candidates.filter(Array.isArray).flat();
};

const getGroupParticipantId = (participant) => {
    if (!participant || typeof participant !== "object") {
        return null;
    }

    return getNormalizedChatValue(
        participant?.user_id ||
        participant?.userId ||
        participant?.user?.id ||
        participant?.profile?.user_id ||
        participant?.profile?.id ||
        participant?.id ||
        null
    );
};

const getGroupParticipantsCountFromSources = (...sources) => {
    const participants = sources
        .filter(Boolean)
        .flatMap((source) => getGroupParticipantCandidates(source));

    if (!participants.length) {
        const directCount = sources
            .map((source) => (
                source?.participants_count ||
                source?.participantsCount ||
                source?.members_count ||
                source?.membersCount ||
                source?.users_count ||
                source?.usersCount ||
                source?.conversation?.participants_count ||
                source?.conversation?.participantsCount ||
                null
            ))
            .find((value) => Number(value) > 0);

        const numericDirectCount = Number(directCount || 0);
        return Number.isFinite(numericDirectCount) && numericDirectCount > 0
            ? Math.floor(numericDirectCount)
            : 0;
    }

    const seenIds = new Set();
    let anonymousCount = 0;

    participants.forEach((participant) => {
        const participantId = getGroupParticipantId(participant);

        if (!participantId) {
            anonymousCount += 1;
            return;
        }

        seenIds.add(String(participantId));
    });

    return seenIds.size + anonymousCount;
};

const mergeChatProfileInfo = (currentInfo = {}, nextInfo = {}) => ({
    name: nextInfo.name || currentInfo.name || "",
    department: nextInfo.department || currentInfo.department || null,
    avatar: nextInfo.avatar || currentInfo.avatar || null,
    phone: nextInfo.phone || currentInfo.phone || "",
    username: nextInfo.username || currentInfo.username || "",
    email: nextInfo.email || currentInfo.email || "",
    location: nextInfo.location || currentInfo.location || "",
});

const getInitialsFromName = (name = "") => {
    const initials = String(name || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();

    return initials || "MO";
};

const getRealtimeActivityUserName = (event, fallback = "") => {
    const candidates = [
        event?.user_name,
        event?.userName,
        event?.name,
        event?.display_name,
        event?.displayName,
        event?.sender?.name,
        event?.sender?.full_name,
        event?.sender?.display_name,
        event?.user?.name,
        event?.user?.full_name,
        event?.user?.display_name,
        event?.data?.user_name,
        event?.data?.userName,
        event?.data?.name,
        event?.data?.user?.name,
        fallback,
    ];

    const name = candidates.find((value) => {
        const cleanValue = String(value || "").trim();
        return cleanValue.length > 0 && cleanValue !== "undefined" && cleanValue !== "null";
    });

    return name ? String(name).trim() : "";
};

const getActivityText = ({
    isRecording,
    isTyping,
    personName,
    isGroup,
    isArabic,
    tr,
}) => {
    const cleanName = String(personName || "").trim();

    if (isRecording) {
        if (isArabic) {
            return cleanName
                ? `${cleanName} عم يسجل رسالة صوتية...`
                : isGroup
                    ? "أحد الأعضاء عم يسجل رسالة صوتية..."
                    : "عم يسجل رسالة صوتية...";
        }

        return cleanName
            ? `${cleanName} is recording...`
            : isGroup
                ? "Someone is recording..."
                : tr("recordingNow", "Recording...");
    }

    if (isTyping) {
        if (isArabic) {
            return cleanName
                ? `${cleanName} عم يكتب...`
                : isGroup
                    ? "أحد الأعضاء عم يكتب..."
                    : "عم يكتب...";
        }

        return cleanName
            ? `${cleanName} is typing...`
            : isGroup
                ? "Someone is typing..."
                : tr("typingNow", "Typing...");
    }

    return "";
};

export default function IndividualChatScreen({ navigation, route }) {
    const { t, i18n } = useTranslation();
    const insets = useSafeAreaInsets();
    const { width, height } = useWindowDimensions();
    const messagesScrollRef = useRef(null);
    const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
    const recorderState = useAudioRecorderState(audioRecorder, 250);
    const isRecordingRef = useRef(false);
    const isCancellingRecordingRef = useRef(false);
    const isStoppingRecordingRef = useRef(false);

    const {
        colors: appColors,
        isDark,
        setThemeMode,
        changeTheme,
        toggleTheme,
    } = useAppTheme();
    const {
        currentUserId,
        isUserOnline,
        latestConversationBlockEvent,
    } = useAppRealtime();

    const employee = route?.params?.employee;
    const conversation = route?.params?.conversation;
    const initialConversationId = getConversationIdFromRoute(route, employee);
    const initialIsGroupConversation = isGroupConversationFromRoute(route, employee, conversation);
    const initialTargetUserId = getTargetUserIdFromRoute(route, employee, conversation);
    const [activeConversationId, setActiveConversationId] = useState(initialConversationId);
    const [resolvedChatConfig, setResolvedChatConfig] = useState(() => ({
        conversationId: getNormalizedChatValue(initialConversationId),
        isGroup: initialIsGroupConversation,
        targetUserId: getNormalizedChatValue(initialTargetUserId),
    }));
    const conversationId = resolvedChatConfig.conversationId || activeConversationId;
    const isGroupConversation = resolvedChatConfig.isGroup === true;
    const targetUserId = resolvedChatConfig.targetUserId || initialTargetUserId;
    const [chatProfileInfo, setChatProfileInfo] = useState(() =>
        getChatProfileInfoFromSources(
            employee,
            conversation,
            route?.params?.customer,
            route?.params
        )
    );

    const employeeName =
        chatProfileInfo.name ||
        employee?.name ||
        conversation?.display_name ||
        conversation?.title ||
        conversation?.name ||
        conversation?.employee?.name ||
        conversation?.customer?.name ||
        conversation?.participant?.name ||
        conversation?.other_participant?.name ||
        "";
    const employeeDepartment =
        chatProfileInfo.department ||
        employee?.department ||
        employee?.department_name ||
        conversation?.department?.name ||
        conversation?.department?.title ||
        conversation?.department_name ||
        conversation?.employee?.department?.name ||
        conversation?.employee?.department?.title ||
        conversation?.employee?.department_name ||
        null;
    const employeeAvatar = chatProfileInfo.avatar || null;
    const employeeInitials = getInitialsFromName(employeeName);

    const [menuVisible, setMenuVisible] = useState(false);
    const [attachMenuVisible, setAttachMenuVisible] = useState(false);
    const [messageText, setMessageText] = useState("");
    const [messages, setMessages] = useState([]);
    const messagesRef = useRef([]);
    const ownRealtimeMessageIdsRef = useRef(new Set());
    const ownSenderIdsRef = useRef(new Set());
    const pendingOutgoingSignaturesRef = useRef(new Map());
    const [isLoadingConversation, setIsLoadingConversation] = useState(false);
    const [isLoadingOlderMessages, setIsLoadingOlderMessages] = useState(false);
    const [conversationMessagesMeta, setConversationMessagesMeta] = useState(null);
    const [isBlocked, setIsBlocked] = useState(() => getInitialBlockedState(route, employee));
    const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
    const [previewDocument, setPreviewDocument] = useState(null);
    const [replyingToMessage, setReplyingToMessage] = useState(null);
    const [messageOptionsMessage, setMessageOptionsMessage] = useState(null);
    const [copyToastVisible, setCopyToastVisible] = useState(false);
    const copyToastTimerRef = useRef(null);
    const [isTargetTyping, setIsTargetTyping] = useState(false);
    const [isTargetRecordingVoice, setIsTargetRecordingVoice] = useState(false);
    const [targetActivityName, setTargetActivityName] = useState("");
    const typingTimeoutRef = useRef(null);
    const recordingTimeoutRef = useRef(null);
    const typingStopTimeoutRef = useRef(null);
    const recordingWhisperIntervalRef = useRef(null);
    const lastTypingWhisperAtRef = useRef(0);
    const [targetLastSeenAt, setTargetLastSeenAt] = useState(() =>
        getLastSeenAtFromSources(employee, conversation, route?.params?.customer)
    );
    const loadedConversationIdRef = useRef(null);
    const [isMutatingChat, setIsMutatingChat] = useState(false);
    const openLibraryAfterCameraCloseRef = useRef(false);
    const openLibraryTimerRef = useRef(null);
    const isLoadingOlderMessagesRef = useRef(false);
    const messagesScrollOffsetYRef = useRef(0);
    const messagesContentHeightRef = useRef(0);
    const shouldKeepScrollPositionAfterOlderLoadRef = useRef(false);
    const olderMessagesScrollOffsetBeforePrependRef = useRef(0);
    const olderMessagesContentHeightBeforePrependRef = useRef(0);
    const suppressAutoScrollAfterOlderLoadUntilRef = useRef(0);
    const canLoadOlderMessagesRef = useRef(false);
    const [canCreateQuote, setCanCreateQuote] = useState(false);
    const [currentUserRole, setCurrentUserRole] = useState(null);
    const [currentProfileUserId, setCurrentProfileUserId] = useState(null);
    const [currentProfileDisplayName, setCurrentProfileDisplayName] = useState("");
    const [groupParticipantsCount, setGroupParticipantsCount] = useState(() =>
        getGroupParticipantsCountFromSources(
            conversation,
            employee,
            route?.params?.conversation,
            route?.params
        )
    );
    const [canSendMessage, setCanSendMessage] = useState(() => {
        const initialCanSend = getConversationCanSendMessageFromSources(
            conversation,
            employee,
            route?.params?.conversation,
            route?.params
        );

        return initialCanSend === null ? !getInitialBlockedState(route, employee) : initialCanSend;
    });
    const [canBlockConversation, setCanBlockConversation] = useState(false);
    const lastHandledBlockEventRef = useRef(null);
    const [quoteFormVisible, setQuoteFormVisible] = useState(false);
    const [isSubmittingQuote, setIsSubmittingQuote] = useState(false);

    const tr = (key, fallback) =>
        t(`individualChat.${key}`, {
            defaultValue: fallback || key,
        });

    const language = i18n.language?.startsWith("ar") ? "ar" : "en";
    const isArabic = language === "ar";
    const groupHeaderSubtitle = useMemo(() => {
        if (!isGroupConversation) {
            return "";
        }

        const count = Number(groupParticipantsCount || 0);

        if (Number.isFinite(count) && count > 0) {
            return isArabic
                ? `${count} أعضاء`
                : `${count} members`;
        }

        return tr("groupChat", isArabic ? "محادثة جماعية" : "Group chat");
    }, [groupParticipantsCount, isArabic, isGroupConversation]);
    const hasMessage = messageText.trim().length > 0;
    const isRecordingVoice = !!recorderState?.isRecording;
    const recordingDurationText = formatAudioDuration(recorderState?.durationMillis || 0);

    const isCompactScreen = width < 390;
    const isVeryCompactScreen = width < 350;
    const isShortScreen = height < 720;

    const imageMessageWidth = Math.min(width * 0.68, 285);
    const imageMessageHeight = Math.min(height * 0.28, 250);

    const colors = useMemo(() => {
        const headerSurface = isDark
            ? appColors.background
            : appColors.cardStrong;

        return {
            ...appColors,

            screen: appColors.background,

            statusHeader: headerSurface,
            header: headerSurface,
            transparentHeader: headerSurface,

            text: appColors.textPrimary,
            muted: appColors.textMuted,
            input: appColors.inputBackground,

            myBubble: appColors.blueSoft,
            employeeBubble: appColors.card,

            modalCard: appColors.cardStrong,
            modalOverlay: appColors.overlay,
            modalStatusBar: headerSurface,
            previewBackground: appColors.background,
        };
    }, [appColors, isDark]);

    const canViewerCreateQuote =
        (canSendMessage && !isBlocked) &&
        (canRoleCreateQuotes(currentUserRole) ||
            (currentUserRole === null && canCreateQuote));

    const cannotSendBecauseBlocked = isBlocked || !canSendMessage;
    const blockedComposerMessage = isBlocked
        ? tr(
            "blockedComposerMessage",
            isArabic
                ? "هذه المحادثة محظورة، لا يمكنك إرسال رسائل."
                : "This conversation is blocked. You cannot send messages."
        )
        : tr(
            "sendingUnavailableMessage",
            isArabic
                ? "إرسال الرسائل غير متاح في هذه المحادثة."
                : "Sending messages is not available in this conversation."
        );

    const canViewerBlockConversation =
        !isGroupConversation &&
        (
            canBlockConversation === true ||
            canRoleBlockConversations(currentUserRole)
        );

    useEffect(() => {
        let isMounted = true;

        const loadCurrentProfileForQuotePermissions = async () => {
            try {
                const response = await chatService.getProfile();
                const profile = getProfilePayload(response);

                if (!isMounted) {
                    return;
                }

                const profileRole = getProfileRoleValue(profile);
                const profileUserId = getCurrentUserIdFromProfile(profile);
                const profileDisplayName = getProfileTextFromSources([profile], [
                    "full_name",
                    "fullName",
                    "display_name",
                    "displayName",
                    "name",
                    "user.full_name",
                    "user.fullName",
                    "user.display_name",
                    "user.displayName",
                    "user.name",
                    "profile.full_name",
                    "profile.fullName",
                    "profile.display_name",
                    "profile.displayName",
                    "profile.name",
                ]);

                setCurrentUserRole(profileRole);
                setCurrentProfileUserId(profileUserId);
                setCurrentProfileDisplayName(profileDisplayName);
                const initialCanBlockValue = getConversationCanBlockFromSources(
                    conversation,
                    employee,
                    route?.params
                );

                setCanBlockConversation(
                    !initialIsGroupConversation &&
                    (
                        canRoleBlockConversations(profileRole) ||
                        initialCanBlockValue === true
                    )
                );

                if (profileRole !== null) {
                    setCanCreateQuote(canRoleCreateQuotes(profileRole));
                    return;
                }

                setCanCreateQuote(
                    canProfileCreateQuotes(profile) ||
                    canConversationCreateQuotes(conversation, employee, route?.params)
                );
            } catch (error) {
                console.log("Load quote permissions profile error:", error?.raw || error);

                if (isMounted) {
                    setCanCreateQuote((currentValue) =>
                        currentValue ||
                        canConversationCreateQuotes(conversation, employee, route?.params)
                    );
                }
            }
        };

        loadCurrentProfileForQuotePermissions();

        return () => {
            isMounted = false;
        };
    }, []);

    const targetOnline = !isGroupConversation && !!targetUserId && isUserOnline?.(targetUserId);
    const targetTyping = isTargetTyping === true;
    const targetRecording = isTargetRecordingVoice === true;
    const headerActivityName = targetActivityName || (!isGroupConversation ? employeeName : "");
    const headerPresenceText = formatPresenceText({
        isBlocked,
        isTyping: targetTyping,
        isRecording: targetRecording,
        isOnline: targetOnline,
        lastSeenAt: targetLastSeenAt,
        personName: headerActivityName,
        isGroup: isGroupConversation,
        isArabic,
        tr,
    });

    const scrollToBottom = (animated = true) => {
        requestAnimationFrame(() => {
            messagesScrollRef.current?.scrollToEnd({ animated });
        });
    };

    const markActiveConversationRead = (
        conversationIdValue = conversationId,
        sourceMessages = messagesRef.current || []
    ) => {
        const normalizedConversationId = getNormalizedChatValue(conversationIdValue);

        if (!normalizedConversationId) {
            return;
        }

        const safeMessages = Array.isArray(sourceMessages) ? sourceMessages : [];
        const lastMessage = safeMessages[safeMessages.length - 1] || null;
        const lastMessageId = getValidApiMessageId(lastMessage);

        chatService.markConversationRead(
            normalizedConversationId,
            lastMessageId
        ).catch((error) => {
            console.log("Mark conversation read error:", error?.raw || error);
        });
    };

    const showCopyToast = () => {
        if (copyToastTimerRef.current) {
            clearTimeout(copyToastTimerRef.current);
        }

        setCopyToastVisible(true);

        copyToastTimerRef.current = setTimeout(() => {
            setCopyToastVisible(false);
            copyToastTimerRef.current = null;
        }, 1500);
    };

    useEffect(() => {
        return () => {
            if (copyToastTimerRef.current) {
                clearTimeout(copyToastTimerRef.current);
            }
        };
    }, []);

    useEffect(() => {
        return () => {
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }

            if (recordingTimeoutRef.current) {
                clearTimeout(recordingTimeoutRef.current);
            }

            if (typingStopTimeoutRef.current) {
                clearTimeout(typingStopTimeoutRef.current);
            }

            if (recordingWhisperIntervalRef.current) {
                clearInterval(recordingWhisperIntervalRef.current);
                recordingWhisperIntervalRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        return () => {
            if (openLibraryTimerRef.current) {
                clearTimeout(openLibraryTimerRef.current);
                openLibraryTimerRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);

    useEffect(() => {
        setTimeout(() => {
            scrollToBottom(false);
        }, 120);
    }, []);

    useEffect(() => {
        if (
            shouldKeepScrollPositionAfterOlderLoadRef.current ||
            isLoadingOlderMessagesRef.current ||
            Date.now() < suppressAutoScrollAfterOlderLoadUntilRef.current
        ) {
            return;
        }

        setTimeout(() => {
            if (
                shouldKeepScrollPositionAfterOlderLoadRef.current ||
                isLoadingOlderMessagesRef.current ||
                Date.now() < suppressAutoScrollAfterOlderLoadUntilRef.current
            ) {
                return;
            }

            scrollToBottom(true);
        }, 100);
    }, [messages.length]);

    useEffect(() => {
        if (cannotSendBecauseBlocked) {
            cancelVoiceRecordingIfActive();
            sendTypingWhisper(false);
        }
    }, [cannotSendBecauseBlocked]);

    useEffect(() => {
        const showEvent =
            Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
        const hideEvent =
            Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

        const keyboardShowListener = Keyboard.addListener(showEvent, () => {
            setIsKeyboardVisible(true);

            setTimeout(() => {
                scrollToBottom(true);
            }, Platform.OS === "ios" ? 160 : 280);
        });

        const keyboardHideListener = Keyboard.addListener(hideEvent, () => {
            setIsKeyboardVisible(false);

            setTimeout(() => {
                scrollToBottom(true);
            }, 80);
        });

        return () => {
            keyboardShowListener.remove();
            keyboardHideListener.remove();
        };
    }, []);

    useEffect(() => {
        markActiveConversationRead(conversationId);
    }, [conversationId]);

    useEffect(() => {
        const markConversationReadOnLeave = () => {
            const normalizedConversationId = getNormalizedChatValue(conversationId);

            if (!normalizedConversationId) {
                return;
            }

            const currentMessages = messagesRef.current || [];
            const lastMessage = currentMessages[currentMessages.length - 1] || null;
            const lastMessageId = getValidApiMessageId(lastMessage);

            chatService.markConversationRead(
                normalizedConversationId,
                lastMessageId
            ).catch((error) => {
                console.log("Mark conversation read on leave error:", error?.raw || error);
            });
        };

        const unsubscribe = navigation.addListener(
            "beforeRemove",
            markConversationReadOnLeave
        );

        return unsubscribe;
    }, [navigation, conversationId]);

    useEffect(() => {
        if (!latestConversationBlockEvent) {
            return;
        }

        if (lastHandledBlockEventRef.current === latestConversationBlockEvent) {
            return;
        }

        lastHandledBlockEventRef.current = latestConversationBlockEvent;

        const normalizedConversationId = getNormalizedChatValue(conversationId);
        const blockConversationId = getConversationIdFromBlockEvent(latestConversationBlockEvent);

        if (
            normalizedConversationId &&
            blockConversationId &&
            String(normalizedConversationId) !== String(blockConversationId)
        ) {
            return;
        }

        const blockPayload = getConversationPayloadFromBlockEvent(latestConversationBlockEvent);
        const blockInfo = getConversationBlockInfoFromSources(blockPayload, latestConversationBlockEvent);
        const nextCanSend = getConversationCanSendMessageFromSources(blockPayload, latestConversationBlockEvent);

        setIsBlocked(blockInfo.isBlocked);

        if (nextCanSend !== null) {
            setCanSendMessage(nextCanSend);
        } else {
            setCanSendMessage(!blockInfo.isBlocked);
        }

        if (blockInfo.isBlocked) {
            cancelVoiceRecordingIfActive();
            sendTypingWhisper(false);
        }
    }, [latestConversationBlockEvent, conversationId]);

    useEffect(() => {
        const normalizedConversationId = getNormalizedChatValue(conversationId);

        if (!normalizedConversationId) {
            return;
        }

        subscribeToConversationChannel({
            conversationId: normalizedConversationId,

            onMessageSent: (apiMessage) => {
                console.log(
                    "[IndividualChat] onMessageSent RECEIVED:",
                    JSON.stringify(apiMessage, null, 2)
                );

                console.log("[IndividualChat] onMessageSent CHECK:", {
                    id: apiMessage?.id,
                    conversation_id: apiMessage?.conversation_id,
                    conversationId: apiMessage?.conversationId,
                    type: apiMessage?.type,
                    isDeleted: isApiMessageDeleted(apiMessage),
                    attachmentsCount: Array.isArray(apiMessage?.attachments)
                        ? apiMessage.attachments.length
                        : 0,
                    firstAttachment: Array.isArray(apiMessage?.attachments)
                        ? apiMessage.attachments[0]
                        : null,
                });


                if (!apiMessage?.id || isApiMessageDeleted(apiMessage)) {
                    return;
                }

                const currentMessages = messagesRef.current || [];
                const incomingSignature = getApiMessageSignature(apiMessage);
                const isKnownOwnRealtimeMessage = ownRealtimeMessageIdsRef.current.has(
                    String(apiMessage.id)
                );
                const isPendingOutgoingRealtimeMessage = isRecentOutgoingMessageSignature(
                    pendingOutgoingSignaturesRef,
                    incomingSignature
                );
                const isFromKnownOwnSender = isMessageFromKnownOwnSender(
                    ownSenderIdsRef,
                    apiMessage
                );

                pruneOldOutgoingMessageSignatures(pendingOutgoingSignaturesRef);

                const normalizedMessage = normalizeApiMessage(
                    apiMessage,
                    tr,
                    isArabic,
                    currentMessages
                );

                const hasSameMessageId = currentMessages.some((message) => {
                    const messageId = getComparableMessageId(message);

                    return (
                        messageId !== undefined &&
                        messageId !== null &&
                        String(messageId) === String(apiMessage.id)
                    );
                });

                const hasMatchingLocalOutgoingMessage = currentMessages.some((message) =>
                    isLikelySameOutgoingMessage(message, normalizedMessage)
                );

                const ownRealtimeMessageShouldNotAppend =
                    isKnownOwnRealtimeMessage ||
                    isPendingOutgoingRealtimeMessage ||
                    isFromKnownOwnSender ||
                    hasSameMessageId ||
                    hasMatchingLocalOutgoingMessage;

                if (ownRealtimeMessageShouldNotAppend) {
                    ownRealtimeMessageIdsRef.current.add(String(apiMessage.id));
                    rememberOwnSenderIdFromMessage(ownSenderIdsRef, apiMessage);
                    rememberOutgoingMessageSignature(
                        pendingOutgoingSignaturesRef,
                        incomingSignature
                    );

                    setMessages((prevMessages) => {
                        const existingIndex = prevMessages.findIndex((message) => {
                            const messageId = getComparableMessageId(message);

                            return (
                                messageId !== undefined &&
                                messageId !== null &&
                                String(messageId) === String(apiMessage.id)
                            );
                        });

                        if (existingIndex !== -1) {
                            return prevMessages.map((message, index) =>
                                index === existingIndex && shouldKeepMessageAsMine(message)
                                    ? markMessageAsSent(forceMessageAsMine(normalizedMessage))
                                    : message
                            );
                        }

                        const preparedOwnMessage = forceMessageAsMine(normalizedMessage);
                        const localSendingIndex = prevMessages.findIndex((message) =>
                            isLikelySameOutgoingMessage(message, preparedOwnMessage)
                        );

                        if (localSendingIndex === -1) {
                            return prevMessages;
                        }

                        return prevMessages.map((message, index) =>
                            index === localSendingIndex
                                ? markMessageAsSent(preparedOwnMessage)
                                : message
                        );
                    });

                    console.log(
                        '[Conversation Realtime] Own MessageSent ignored to prevent duplicate:',
                        apiMessage.id
                    );

                    return;
                }

                const preparedMessage = normalizedMessage;

                setMessages((prevMessages) => {
                    const existingIndex = prevMessages.findIndex((message) => {
                        const messageId = getComparableMessageId(message);

                        return (
                            messageId !== undefined &&
                            messageId !== null &&
                            String(messageId) === String(preparedMessage.id)
                        );
                    });

                    if (existingIndex !== -1) {
                        return prevMessages.map((message, index) =>
                            index === existingIndex
                                ? markMessageAsSent(preparedMessage)
                                : message
                        );
                    }

                    return [...prevMessages, preparedMessage];
                });

                markActiveConversationRead(normalizedConversationId, [
                    ...currentMessages,
                    preparedMessage,
                ]);

                setTimeout(() => {
                    scrollToBottom(true);
                }, 80);
            },

            onMessageUpdated: (apiMessage) => {
                if (!apiMessage?.id) {
                    return;
                }

                if (isApiMessageDeleted(apiMessage)) {
                    setMessages((prevMessages) =>
                        prevMessages.filter((message) => {
                            const messageId =
                                message?.raw?.id ||
                                message?.message_id ||
                                message?.id ||
                                null;

                            return String(messageId) !== String(apiMessage.id);
                        })
                    );

                    return;
                }

                const currentMessages = messagesRef.current || [];
                const incomingSignature = getApiMessageSignature(apiMessage);
                const isOwnRealtimeMessage =
                    ownRealtimeMessageIdsRef.current.has(String(apiMessage.id)) ||
                    isMessageFromKnownOwnSender(ownSenderIdsRef, apiMessage) ||
                    isRecentOutgoingMessageSignature(
                        pendingOutgoingSignaturesRef,
                        incomingSignature
                    );

                if (isOwnRealtimeMessage) {
                    ownRealtimeMessageIdsRef.current.add(String(apiMessage.id));
                    rememberOwnSenderIdFromMessage(ownSenderIdsRef, apiMessage);
                }

                const normalizedMessage = normalizeApiMessage(
                    apiMessage,
                    tr,
                    isArabic,
                    currentMessages
                );
                const preparedMessage = isOwnRealtimeMessage
                    ? forceMessageAsMine(normalizedMessage)
                    : normalizedMessage;

                pruneOldOutgoingMessageSignatures(pendingOutgoingSignaturesRef);

                setMessages((prevMessages) =>
                    prevMessages.map((message) => {
                        const messageId = getComparableMessageId(message);

                        if (String(messageId) !== String(preparedMessage.id)) {
                            return message;
                        }

                        return shouldKeepMessageAsMine(message)
                            ? markMessageAsSent(forceMessageAsMine(preparedMessage))
                            : preparedMessage;
                    })
                );
            },

            onTyping: (typingEvent) => {
                const typingConversationId = getNormalizedChatValue(
                    typingEvent?.conversation_id || typingEvent?.conversationId
                );
                const typingUserId = getNormalizedChatValue(
                    typingEvent?.user_id || typingEvent?.userId
                );
                const normalizedCurrentUserId = getNormalizedChatValue(currentUserId);
                const normalizedTargetUserId = getNormalizedChatValue(targetUserId);
                const isRecordingNow =
                    typingEvent?.is_recording === true ||
                    typingEvent?.isRecording === true ||
                    String(typingEvent?.activity || "").toLowerCase() === "recording";
                const isTypingNow =
                    !isRecordingNow &&
                    typingEvent?.is_typing !== false &&
                    typingEvent?.isTyping !== false &&
                    String(typingEvent?.activity || "typing").toLowerCase() !== "idle";

                if (
                    typingConversationId &&
                    typingConversationId !== normalizedConversationId
                ) {
                    return;
                }

                if (
                    typingUserId &&
                    normalizedCurrentUserId &&
                    typingUserId === normalizedCurrentUserId
                ) {
                    return;
                }

                if (
                    !isGroupConversation &&
                    typingUserId &&
                    normalizedTargetUserId &&
                    typingUserId !== normalizedTargetUserId
                ) {
                    return;
                }

                const nextActivityName = getRealtimeActivityUserName(
                    typingEvent,
                    isGroupConversation ? "" : employeeName
                );

                if (typingTimeoutRef.current) {
                    clearTimeout(typingTimeoutRef.current);
                    typingTimeoutRef.current = null;
                }

                if (recordingTimeoutRef.current) {
                    clearTimeout(recordingTimeoutRef.current);
                    recordingTimeoutRef.current = null;
                }

                if (!isTypingNow && !isRecordingNow) {
                    setIsTargetTyping(false);
                    setIsTargetRecordingVoice(false);
                    setTargetActivityName("");
                    return;
                }

                setTargetActivityName(nextActivityName);

                if (isRecordingNow) {
                    setIsTargetTyping(false);
                    setIsTargetRecordingVoice(true);

                    recordingTimeoutRef.current = setTimeout(() => {
                        setIsTargetRecordingVoice(false);
                        setTargetActivityName("");
                        recordingTimeoutRef.current = null;
                    }, 4200);

                    return;
                }

                setIsTargetRecordingVoice(false);
                setIsTargetTyping(true);

                typingTimeoutRef.current = setTimeout(() => {
                    setIsTargetTyping(false);
                    setTargetActivityName("");
                    typingTimeoutRef.current = null;
                }, 2800);
            },
        });

        return () => {
            leaveConversationChannel(normalizedConversationId);
        };
    }, [conversationId, currentUserId, employeeName, isArabic, isGroupConversation, targetUserId]);


    useEffect(() => {
        const normalizedConversationId = getNormalizedChatValue(conversationId);

        if (!normalizedConversationId) {
            return;
        }

        if (loadedConversationIdRef.current === normalizedConversationId) {
            return;
        }

        loadedConversationIdRef.current = normalizedConversationId;
        canLoadOlderMessagesRef.current = false;
        messagesContentHeightRef.current = 0;
        messagesScrollOffsetYRef.current = 0;
        shouldKeepScrollPositionAfterOlderLoadRef.current = false;

        let isMounted = true;

        const fetchShowConversation = async () => {
            try {
                setIsLoadingConversation(true);

                const response = await chatService.showConversation(normalizedConversationId, {
                    page: 1,
                    per_page: SHOW_CONVERSATION_MESSAGES_PER_PAGE,
                });

                if (!isMounted) {
                    return;
                }

                const showConversationObject = getShowConversationObject(response);
                const nextChatProfileInfo = getChatProfileInfoFromSources(
                    showConversationObject,
                    showConversationObject?.target_user,
                    showConversationObject?.targetUser,
                    showConversationObject?.other_participant,
                    showConversationObject?.participant,
                    showConversationObject?.employee,
                    showConversationObject?.customer,
                    showConversationObject?.user,
                    employee,
                    conversation,
                    route?.params?.customer,
                    route?.params
                );

                setChatProfileInfo((currentInfo) =>
                    mergeChatProfileInfo(currentInfo, nextChatProfileInfo)
                );

                const nextConversationId =
                    getConversationIdFromShowConversationObject(showConversationObject) ||
                    normalizedConversationId;
                const nextIsGroup = getIsGroupFromConversationObject(
                    showConversationObject,
                    isGroupConversation
                );
                const nextTargetUserId = nextIsGroup
                    ? null
                    : getTargetUserIdFromShowConversationObject(
                        showConversationObject,
                        targetUserId
                    );
                const nextGroupParticipantsCount = getGroupParticipantsCountFromSources(
                    showConversationObject,
                    showConversationObject?.raw,
                    showConversationObject?.meta,
                    conversation,
                    employee,
                    route?.params
                );

                setGroupParticipantsCount(nextGroupParticipantsCount);

                const nextCanSendValue = getConversationCanSendMessageFromSources(
                    showConversationObject,
                    showConversationObject?.raw,
                    showConversationObject?.meta,
                    showConversationObject?.permissions,
                    conversation,
                    employee,
                    route?.params
                );
                const nextBlockInfo = getConversationBlockInfoFromSources(
                    showConversationObject,
                    showConversationObject?.raw,
                    showConversationObject?.meta,
                    showConversationObject?.permissions,
                    conversation,
                    employee,
                    route?.params
                );
                const nextCanBlockValue = getConversationCanBlockFromSources(
                    showConversationObject,
                    showConversationObject?.raw,
                    showConversationObject?.meta,
                    showConversationObject?.permissions,
                    conversation,
                    employee,
                    route?.params
                );

                setIsBlocked(nextBlockInfo.isBlocked);
                setCanSendMessage(
                    nextCanSendValue === null ? !nextBlockInfo.isBlocked : nextCanSendValue
                );
                setCanBlockConversation(
                    !nextIsGroup &&
                    (
                        canRoleBlockConversations(currentUserRole) ||
                        nextCanBlockValue === true
                    )
                );

                setCanCreateQuote((currentValue) => {
                    if (canRoleCreateQuotes(currentUserRole)) {
                        return true;
                    }

                    if (Number(currentUserRole) === USER_ROLE.CUSTOMER) {
                        return false;
                    }

                    return (
                        currentValue ||
                        canConversationCreateQuotes(
                            showConversationObject,
                            showConversationObject?.raw,
                            showConversationObject?.meta,
                            showConversationObject?.permissions,
                            conversation,
                            employee,
                            route?.params
                        )
                    );
                });

                setResolvedChatConfig({
                    conversationId: nextConversationId,
                    isGroup: nextIsGroup,
                    targetUserId: nextTargetUserId,
                });
                setTargetLastSeenAt(
                    getLastSeenAtFromSources(
                        showConversationObject,
                        showConversationObject?.other_participant,
                        showConversationObject?.participant,
                        showConversationObject?.employee,
                        showConversationObject?.customer,
                        employee,
                        conversation,
                        route?.params?.customer
                    )
                );

                if (nextConversationId) {
                    setActiveConversationId(nextConversationId);
                }

                const visibleApiMessages = getVisibleShowConversationMessages(response);
                rememberOwnSenderIdsFromMessages(ownSenderIdsRef, visibleApiMessages);

                const preparedMessages = sortMessagesOldestToNewest(
                    visibleApiMessages
                ).map((message) => normalizeApiMessage(message, tr, isArabic, visibleApiMessages));

                setMessages((prev) => {
                    const localMessages = prev.filter(
                        (message) =>
                            message?.isLocal ||
                            message?.isOptimistic ||
                            message?.isSending ||
                            message?.isFailed
                    );

                    if (localMessages.length === 0) {
                        return preparedMessages;
                    }

                    const apiMessageIds = new Set(
                        preparedMessages.map((message) => String(message.id))
                    );

                    return [
                        ...preparedMessages,
                        ...localMessages.filter(
                            (message) => !apiMessageIds.has(String(message.id))
                        ),
                    ];
                });

                markActiveConversationRead(nextConversationId, preparedMessages);

                setConversationMessagesMeta(getShowConversationMessagesMeta(response));

                setTimeout(() => {
                    scrollToBottom(false);
                    canLoadOlderMessagesRef.current = true;
                }, 120);
            } catch (error) {
                loadedConversationIdRef.current = null;
                console.log("Show conversation error:", error?.raw || error);

                if (isMounted) {
                    Alert.alert(
                        tr("errorTitle", "Something went wrong"),
                        error?.userMessage ||
                        tr(
                            "showConversationError",
                            "Could not load this conversation. Please try again."
                        )
                    );
                }
            } finally {
                if (isMounted) {
                    setIsLoadingConversation(false);
                }
            }
        };

        fetchShowConversation();

        return () => {
            isMounted = false;
        };
    }, [conversationId]);

    const hasOlderMessages = !!getNextOlderMessagesPage(conversationMessagesMeta);

    const handleMessagesScroll = (event) => {
        messagesScrollOffsetYRef.current = Number(
            event?.nativeEvent?.contentOffset?.y || 0
        );
    };

    const handleMessagesContentSizeChange = (contentWidth, contentHeight) => {
        const nextContentHeight = Number(contentHeight || 0);
        const previousContentHeight = messagesContentHeightRef.current;

        messagesContentHeightRef.current = nextContentHeight;

        if (shouldKeepScrollPositionAfterOlderLoadRef.current) {
            const baselineContentHeight = olderMessagesContentHeightBeforePrependRef.current;
            const baselineOffsetY = olderMessagesScrollOffsetBeforePrependRef.current;

            if (baselineContentHeight > 0 && nextContentHeight > baselineContentHeight) {
                const heightDifference = nextContentHeight - baselineContentHeight;
                const nextOffsetY = Math.max(0, baselineOffsetY + heightDifference);

                shouldKeepScrollPositionAfterOlderLoadRef.current = false;
                olderMessagesScrollOffsetBeforePrependRef.current = 0;
                olderMessagesContentHeightBeforePrependRef.current = 0;
                suppressAutoScrollAfterOlderLoadUntilRef.current = Date.now() + 900;

                requestAnimationFrame(() => {
                    messagesScrollRef.current?.scrollTo({
                        y: nextOffsetY,
                        animated: false,
                    });
                });
            }

            return;
        }

        if (
            isLoadingOlderMessagesRef.current ||
            Date.now() < suppressAutoScrollAfterOlderLoadUntilRef.current
        ) {
            return;
        }

        scrollToBottom(false);
    };

    const loadOlderMessages = async () => {
        const normalizedConversationId = getNormalizedChatValue(conversationId);
        const nextPage = getNextOlderMessagesPage(conversationMessagesMeta);

        if (
            !normalizedConversationId ||
            !nextPage ||
            isLoadingConversation ||
            isLoadingOlderMessagesRef.current ||
            !canLoadOlderMessagesRef.current
        ) {
            return;
        }

        isLoadingOlderMessagesRef.current = true;
        suppressAutoScrollAfterOlderLoadUntilRef.current = Date.now() + 1200;
        setIsLoadingOlderMessages(true);

        try {
            const response = await chatService.showConversation(normalizedConversationId, {
                page: nextPage,
                per_page: SHOW_CONVERSATION_MESSAGES_PER_PAGE,
            });

            const visibleApiMessages = getVisibleShowConversationMessages(response);
            rememberOwnSenderIdsFromMessages(ownSenderIdsRef, visibleApiMessages);

            const knownMessages = [
                ...visibleApiMessages,
                ...(messagesRef.current || []).map((message) => message?.raw || message),
            ];

            const preparedOlderMessages = sortMessagesOldestToNewest(
                visibleApiMessages
            ).map((message) =>
                normalizeApiMessage(message, tr, isArabic, knownMessages)
            );

            setMessages((prevMessages) => {
                const existingMessageIds = new Set(
                    prevMessages
                        .map((message) => getComparableMessageId(message))
                        .filter((messageId) => messageId !== undefined && messageId !== null)
                        .map((messageId) => String(messageId))
                );

                const uniqueOlderMessages = preparedOlderMessages.filter((message) => {
                    const messageId = getComparableMessageId(message);

                    if (messageId === undefined || messageId === null) {
                        return true;
                    }

                    return !existingMessageIds.has(String(messageId));
                });

                if (uniqueOlderMessages.length === 0) {
                    return prevMessages;
                }

                olderMessagesScrollOffsetBeforePrependRef.current = messagesScrollOffsetYRef.current;
                olderMessagesContentHeightBeforePrependRef.current = messagesContentHeightRef.current;
                shouldKeepScrollPositionAfterOlderLoadRef.current = true;
                suppressAutoScrollAfterOlderLoadUntilRef.current = Date.now() + 1200;

                return [...uniqueOlderMessages, ...prevMessages];
            });

            setConversationMessagesMeta(getShowConversationMessagesMeta(response));
        } catch (error) {
            shouldKeepScrollPositionAfterOlderLoadRef.current = false;
            olderMessagesScrollOffsetBeforePrependRef.current = 0;
            olderMessagesContentHeightBeforePrependRef.current = 0;
            suppressAutoScrollAfterOlderLoadUntilRef.current = Date.now() + 900;
            console.log("Load older conversation messages error:", error?.raw || error);
        } finally {
            isLoadingOlderMessagesRef.current = false;
            suppressAutoScrollAfterOlderLoadUntilRef.current = Date.now() + 900;
            setIsLoadingOlderMessages(false);
        }
    };

    const handleChangeLanguage = (value) => {
        i18n.changeLanguage(value);
    };

    const handleChangeTheme = (value) => {
        const nextShouldBeDark = value === "dark";

        setMenuVisible(false);

        if (nextShouldBeDark === isDark) {
            return;
        }

        requestAnimationFrame(() => {
            if (typeof setThemeMode === "function") {
                setThemeMode(value);
                return;
            }

            if (typeof changeTheme === "function") {
                changeTheme(value);
                return;
            }

            if (typeof toggleTheme === "function") {
                toggleTheme();
            }
        });
    };

    const addMessages = (nextMessages) => {
        setMessages((prev) => [...prev, ...nextMessages]);

        setTimeout(() => {
            scrollToBottom(true);
        }, 120);
    };

    const appendMessageResponseToList = async (
        response,
        localReplyMessage = null,
        optimisticMessageId = null
    ) => {
        const nextConversationId = getConversationIdFromMessageResponse(response);
        const responseMessage = getMessageResponseObject(response);

        if (responseMessage?.id) {
            rememberOutgoingApiMessage(
                ownRealtimeMessageIdsRef,
                pendingOutgoingSignaturesRef,
                ownSenderIdsRef,
                responseMessage
            );
        }

        const responseMessageWithReply =
            responseMessage &&
                localReplyMessage &&
                !responseMessage.reply_to_message &&
                !responseMessage.reply_to &&
                !responseMessage.parent_message &&
                !responseMessage.quoted_message
                ? {
                    ...responseMessage,
                    reply_to_message:
                        localReplyMessage.raw ||
                        localReplyMessage,
                }
                : responseMessage;

        if (nextConversationId) {
            const normalizedConversationId = getNormalizedChatValue(nextConversationId);

            setActiveConversationId(normalizedConversationId);
            setResolvedChatConfig((currentConfig) => ({
                ...currentConfig,
                conversationId: normalizedConversationId,
            }));
        }

        if (isApiMessageDeleted(responseMessageWithReply)) {
            if (optimisticMessageId) {
                setMessages((prev) =>
                    prev.filter((message) => String(message.id) !== String(optimisticMessageId))
                );
            }

            return;
        }

        if (responseMessageWithReply?.id || responseMessageWithReply?.uuid) {
            const preparedMessage = forceMessageAsMine(
                normalizeApiMessage(
                    responseMessageWithReply,
                    tr,
                    isArabic,
                    messagesRef.current || messages
                )
            );

            setMessages((prev) => {
                const existingIndex = prev.findIndex((item) => {
                    const itemId = getComparableMessageId(item);

                    return (
                        itemId !== undefined &&
                        itemId !== null &&
                        String(itemId) === String(preparedMessage.id)
                    );
                });

                if (existingIndex !== -1) {
                    return prev.map((item, index) =>
                        index === existingIndex
                            ? markMessageAsSent(forceMessageAsMine(preparedMessage))
                            : item
                    );
                }

                if (optimisticMessageId) {
                    const optimisticIndex = prev.findIndex(
                        (item) => String(item.id) === String(optimisticMessageId)
                    );

                    if (optimisticIndex !== -1) {
                        return prev.map((item, index) =>
                            index === optimisticIndex
                                ? markMessageAsSent(preparedMessage)
                                : item
                        );
                    }
                }

                return [...prev, markMessageAsSent(preparedMessage)];
            });

            return;
        }

        if (optimisticMessageId) {
            setMessages((prev) =>
                prev.map((item) =>
                    String(item.id) === String(optimisticMessageId)
                        ? markMessageAsSent(item)
                        : item
                )
            );
        }
    };

    const sendOutgoingChatMessage = async ({
        type = 1,
        body = "",
        attachment,
        replyToMessageId,
        localReplyMessage,
    } = {}) => {
        const activeConversationIdForSend = getNormalizedChatValue(conversationId);
        const activeTargetUserIdForSend = getNormalizedChatValue(targetUserId);

        if (cannotSendBecauseBlocked) {
            showBlockedSendAlert();
            return false;
        }

        if (!activeConversationIdForSend && !activeTargetUserIdForSend) {
            Alert.alert(
                tr("missingConversationTitle", "Conversation not ready"),
                tr("missingConversationMessage", "Please open a saved conversation before sending messages.")
            );
            return false;
        }

        if (isGroupConversation && !activeConversationIdForSend) {
            Alert.alert(
                tr("missingConversationTitle", "Conversation not ready"),
                tr("missingGroupConversationMessage", "Group conversations need a saved conversation before sending messages.")
            );
            return false;
        }

        const messagePayload = {
            type,
            body,
            attachment,
            replyToMessageId,
        };
        const outgoingSignature = getOutgoingMessageSignature(messagePayload);

        rememberOutgoingMessageSignature(
            pendingOutgoingSignaturesRef,
            outgoingSignature
        );

        const optimisticMessage = createOptimisticMessage({
            type,
            body,
            attachment,
            localReplyMessage,
            tr,
        });

        setMessages((prev) => [...prev, optimisticMessage]);

        setTimeout(() => {
            scrollToBottom(true);
        }, 40);

        try {
            setIsMutatingChat(true);

            if (attachment) {
                console.log("[SEND MESSAGE DEBUG] Sending attachment message:", {
                    activeConversationIdForSend,
                    activeTargetUserIdForSend,
                    type,
                    body,
                    attachment: {
                        uri: attachment?.uri,
                        name: attachment?.name,
                        fileName: attachment?.fileName,
                        filename: attachment?.filename,
                        type: attachment?.type,
                        mimeType: attachment?.mimeType,
                        mime_type: attachment?.mime_type,
                        size: attachment?.size,
                        durationMillis: attachment?.durationMillis,
                        duration_millis: attachment?.duration_millis,
                    },
                    replyToMessageId,
                });
            }

            const response = activeConversationIdForSend
                ? await chatService.sendMessage(activeConversationIdForSend, messagePayload)
                : await chatService.startDirectMessage(
                    activeTargetUserIdForSend,
                    messagePayload
                );

            const responseMessage = getMessageResponseObject(response);
            rememberOutgoingApiMessage(
                ownRealtimeMessageIdsRef,
                pendingOutgoingSignaturesRef,
                ownSenderIdsRef,
                responseMessage
            );

            await appendMessageResponseToList(
                response,
                localReplyMessage,
                optimisticMessage.id
            );

            setTimeout(() => {
                scrollToBottom(true);
            }, 100);

            return true;
        } catch (error) {
            console.log("Send message error:", error?.raw || error);

            setMessages((prev) =>
                prev.map((message) =>
                    String(message.id) === String(optimisticMessage.id)
                        ? markMessageAsFailed(message)
                        : message
                )
            );

            return false;
        } finally {
            setIsMutatingChat(false);
        }
    };

    const sendTypingWhisper = (isTyping, options = {}) => {
        const normalizedConversationId = getNormalizedChatValue(conversationId);

        if (!normalizedConversationId) {
            return;
        }

        const isRecording = options?.isRecording === true;

        sendConversationTypingWhisper({
            conversationId: normalizedConversationId,
            userId: currentUserId,
            userName: currentProfileDisplayName || "",
            user_name: currentProfileDisplayName || "",
            targetUserId: isGroupConversation ? null : targetUserId,
            isTyping: isRecording ? false : isTyping === true,
            is_typing: isRecording ? false : isTyping === true,
            isRecording,
            is_recording: isRecording,
            activity: isRecording ? "recording" : isTyping ? "typing" : "idle",
        });
    };

    const handleTyping = (text) => {
        if (cannotSendBecauseBlocked) {
            sendTypingWhisper(false);
            return;
        }

        const hasTypedText = String(text || "").trim().length > 0;
        const now = Date.now();

        if (!hasTypedText) {
            if (typingStopTimeoutRef.current) {
                clearTimeout(typingStopTimeoutRef.current);
                typingStopTimeoutRef.current = null;
            }

            sendTypingWhisper(false);
            lastTypingWhisperAtRef.current = 0;
            return;
        }

        if (now - lastTypingWhisperAtRef.current > 1200) {
            sendTypingWhisper(true);
            lastTypingWhisperAtRef.current = now;
        }

        if (typingStopTimeoutRef.current) {
            clearTimeout(typingStopTimeoutRef.current);
        }

        typingStopTimeoutRef.current = setTimeout(() => {
            sendTypingWhisper(false);
            typingStopTimeoutRef.current = null;
            lastTypingWhisperAtRef.current = 0;
        }, 1800);
    };


    useEffect(() => {
        if (recordingWhisperIntervalRef.current) {
            clearInterval(recordingWhisperIntervalRef.current);
            recordingWhisperIntervalRef.current = null;
        }

        if (!isRecordingVoice || cannotSendBecauseBlocked) {
            sendTypingWhisper(false);
            return;
        }

        sendTypingWhisper(false, { isRecording: true });

        recordingWhisperIntervalRef.current = setInterval(() => {
            sendTypingWhisper(false, { isRecording: true });
        }, 2200);

        return () => {
            if (recordingWhisperIntervalRef.current) {
                clearInterval(recordingWhisperIntervalRef.current);
                recordingWhisperIntervalRef.current = null;
            }

            sendTypingWhisper(false);
        };
    }, [cannotSendBecauseBlocked, conversationId, currentProfileDisplayName, currentUserId, isGroupConversation, isRecordingVoice, targetUserId]);

    const handleSend = () => {
        if (cannotSendBecauseBlocked) {
            showBlockedSendAlert();
            return;
        }

        const cleanText = messageText.trim();
        if (!cleanText) return;

        const replyToMessageId = getValidApiMessageId(replyingToMessage);

        const currentReplyingToMessage = replyingToMessage;

        setMessageText("");
        setReplyingToMessage(null);
        sendTypingWhisper(false);

        void sendOutgoingChatMessage({
            type: 1,
            body: cleanText,
            replyToMessageId,
            localReplyMessage: currentReplyingToMessage,
        });
    };

    const handleSubmitQuote = async (quotePayload) => {
        const activeConversationIdForQuote = getNormalizedChatValue(conversationId);

        if (cannotSendBecauseBlocked) {
            showBlockedSendAlert();
            return false;
        }

        if (!canViewerCreateQuote) {
            Alert.alert(
                tr("quoteUnavailableTitle", "Quote unavailable"),
                tr("quotePermissionMessage", "You do not have permission to create quotes.")
            );
            return false;
        }

        if (!activeConversationIdForQuote) {
            Alert.alert(
                tr("missingConversationTitle", "Conversation not ready"),
                tr("quoteNeedsConversationMessage", "Please open a saved conversation before sending a quote.")
            );
            return false;
        }

        try {
            setIsSubmittingQuote(true);

            const response = await chatService.createQuote(
                activeConversationIdForQuote,
                quotePayload
            );

            const responseMessage = getMessageResponseObject(response);

            if (responseMessage?.id) {
                rememberOutgoingApiMessage(
                    ownRealtimeMessageIdsRef,
                    pendingOutgoingSignaturesRef,
                    ownSenderIdsRef,
                    responseMessage
                );
            }

            await appendMessageResponseToList(
                buildQuoteResponseWithFallbackQuote(response, quotePayload)
            );

            setQuoteFormVisible(false);

            setTimeout(() => {
                scrollToBottom(true);
            }, 100);

            return true;
        } catch (error) {
            console.log("Create quote error:", error?.raw || error);

            Alert.alert(
                tr("errorTitle", "Something went wrong"),
                error?.userMessage ||
                tr("createQuoteError", "Could not send the quote. Please check the details and try again.")
            );

            return false;
        } finally {
            setIsSubmittingQuote(false);
        }
    };

    const getFileNameExtension = (fileName = "") => {
        const cleanName = String(fileName || "").split("?")[0].toLowerCase();
        const dotIndex = cleanName.lastIndexOf(".");

        if (dotIndex === -1 || dotIndex === cleanName.length - 1) {
            return "";
        }

        return cleanName.slice(dotIndex + 1);
    };

    const inferMimeTypeFromMedia = (mediaItem = {}, fallbackMimeType = "application/octet-stream") => {
        const explicitMimeType = String(
            mediaItem.mimeType ||
            mediaItem.mime_type ||
            mediaItem.contentType ||
            mediaItem.content_type ||
            ""
        ).trim();

        if (explicitMimeType.includes("/")) {
            return explicitMimeType;
        }

        const fileName = String(
            mediaItem.fileName ||
            mediaItem.name ||
            mediaItem.filename ||
            mediaItem.uri ||
            mediaItem.video?.uri ||
            mediaItem.image?.uri ||
            ""
        );
        const extension = getFileNameExtension(fileName);

        if (["jpg", "jpeg"].includes(extension)) return "image/jpeg";
        if (extension === "png") return "image/png";
        if (extension === "webp") return "image/webp";
        if (extension === "gif") return "image/gif";
        if (extension === "mp4") return "video/mp4";
        if (["mov", "qt"].includes(extension)) return "video/quicktime";
        if (extension === "m4v") return "video/x-m4v";
        if (extension === "webm") return "video/webm";
        if (extension === "3gp") return "video/3gpp";
        if (extension === "m4a") return "audio/mp4";
        if (extension === "mp3") return "audio/mpeg";
        if (extension === "aac") return "audio/aac";
        if (extension === "wav") return "audio/wav";
        if (extension === "ogg" || extension === "oga") return "audio/ogg";
        if (extension === "amr") return "audio/amr";
        if (extension === "pdf") return "application/pdf";
        if (extension === "txt") return "text/plain";
        if (extension === "csv") return "text/csv";
        if (extension === "doc") return "application/msword";
        if (extension === "docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        if (extension === "xls") return "application/vnd.ms-excel";
        if (extension === "xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

        return fallbackMimeType;
    };

    const inferOutgoingMessageType = (mediaItem = {}) => {
        const rawType = String(
            mediaItem.type ||
            mediaItem.mediaType ||
            mediaItem.assetType ||
            mediaItem.kind ||
            ""
        ).toLowerCase();
        const mimeType = inferMimeTypeFromMedia(mediaItem, "").toLowerCase();
        const fileName = String(
            mediaItem.fileName ||
            mediaItem.name ||
            mediaItem.filename ||
            mediaItem.uri ||
            mediaItem.video?.uri ||
            mediaItem.image?.uri ||
            ""
        ).toLowerCase();

        if (
            rawType === "audio" ||
            rawType === "voice" ||
            rawType === "voice_message" ||
            rawType === "voice-message" ||
            mimeType.startsWith("audio/") ||
            [".m4a", ".mp3", ".aac", ".wav", ".ogg", ".oga", ".amr"].some((extension) => fileName.includes(extension))
        ) {
            return 8;
        }

        if (
            rawType === "image" ||
            rawType === "photo" ||
            mimeType.startsWith("image/") ||
            [".jpg", ".jpeg", ".png", ".webp", ".gif"].some((extension) => fileName.includes(extension))
        ) {
            return 2;
        }

        if (
            rawType === "video" ||
            mimeType.startsWith("video/") ||
            [".mp4", ".mov", ".m4v", ".webm", ".avi", ".mkv", ".3gp"].some((extension) => fileName.includes(extension))
        ) {
            return 4;
        }

        return 3;
    };

    const getLocalAttachmentSize = async (uri) => {
        if (!uri) {
            return 0;
        }

        try {
            const fileInfo = await FileSystem.getInfoAsync(uri, {
                size: true,
            });

            return Number(fileInfo?.size || 0);
        } catch (error) {
            console.log("Get local attachment size error:", error);
            return 0;
        }
    };

    const handleSendMediaMessage = async (mediaItem) => {
        if (cannotSendBecauseBlocked) {
            showBlockedSendAlert();
            return false;
        }

        if (!mediaItem) return;

        const mediaUri =
            mediaItem.uri ||
            mediaItem.image?.uri ||
            mediaItem.video?.uri ||
            null;

        if (!mediaUri) {
            Alert.alert(
                tr("errorTitle", "Something went wrong"),
                tr("mediaSendError", "Could not send this media. Please try again.")
            );
            return;
        }

        const messageType = inferOutgoingMessageType(mediaItem);
        const attachmentMimeType = inferMimeTypeFromMedia(
            mediaItem,
            messageType === 2
                ? "image/jpeg"
                : messageType === 4
                    ? "video/mp4"
                    : "application/octet-stream"
        );

        const replyToMessageId = getValidApiMessageId(replyingToMessage);

        const currentReplyingToMessage = replyingToMessage;
        const attachmentSize =
            Number(
                mediaItem.size ||
                mediaItem.fileSize ||
                mediaItem.filesize ||
                mediaItem.file_size ||
                0
            ) || await getLocalAttachmentSize(mediaUri);

        setReplyingToMessage(null);

        return await sendOutgoingChatMessage({
            type: messageType,
            body: mediaItem.caption || "",
            attachment: {
                uri: mediaUri,
                name:
                    mediaItem.fileName ||
                    mediaItem.name ||
                    mediaItem.filename ||
                    `attachment-${Date.now()}`,
                type: attachmentMimeType,
                size: attachmentSize,
                fileSize: attachmentSize,
            },
            replyToMessageId,
            localReplyMessage: currentReplyingToMessage,
        });
    };

    const startVoiceRecording = async () => {
        if (cannotSendBecauseBlocked) {
            showBlockedSendAlert();
            return;
        }

        if (isRecordingRef.current || recorderState?.isRecording || isStoppingRecordingRef.current) {
            return;
        }

        try {
            Keyboard.dismiss();

            const permissionResult =
                await AudioModule.requestRecordingPermissionsAsync();

            if (!permissionResult.granted) {
                Alert.alert(
                    tr("permissionNeeded", "Permission needed"),
                    tr(
                        "microphonePermissionMessage",
                        "Please allow microphone access to record voice messages."
                    )
                );
                return;
            }

            await setAudioModeAsync({
                allowsRecording: true,
                playsInSilentMode: true,
            });

            await audioRecorder.prepareToRecordAsync();
            audioRecorder.record();
            isRecordingRef.current = true;
            isStoppingRecordingRef.current = false;

            console.log("[VOICE RECORDING DEBUG] Voice recording started:", {
                conversationId,
                targetUserId,
            });
        } catch (error) {
            isRecordingRef.current = false;
            isStoppingRecordingRef.current = false;
            console.log("Voice recording start error:", error);

            try {
                await setAudioModeAsync({
                    allowsRecording: false,
                    playsInSilentMode: true,
                });
            } catch (audioModeError) {
                console.log("Audio mode reset after start error:", audioModeError);
            }

            Alert.alert(
                tr("errorTitle", "Something went wrong"),
                tr("voiceRecordStartError", "Could not start recording. Please try again.")
            );
        }
    };

    const stopVoiceRecording = async () => {
        if (isStoppingRecordingRef.current) {
            return;
        }

        if (!isRecordingRef.current && !recorderState?.isRecording) {
            return;
        }

        isStoppingRecordingRef.current = true;

        let voiceUri = "";
        let durationMillis = Number(recorderState?.durationMillis || 0);

        try {
            await audioRecorder.stop();
            isRecordingRef.current = false;

            await new Promise((resolve) => setTimeout(resolve, 120));

            voiceUri = getRecorderUri(audioRecorder, recorderState);

            await setAudioModeAsync({
                allowsRecording: false,
                playsInSilentMode: true,
            });

            if (!voiceUri) {
                Alert.alert(
                    tr("errorTitle", "Something went wrong"),
                    tr("voiceRecordUriError", "The voice message was not saved correctly.")
                );
                return;
            }

            if (!Number.isFinite(durationMillis) || durationMillis <= 0) {
                durationMillis = 1000;
            }

            if (durationMillis < 500) {
                Alert.alert(
                    tr("voiceTooShortTitle", "Voice message too short"),
                    tr("voiceTooShortMessage", "Please record a longer voice message.")
                );
                return;
            }

            const replyToMessageId = getValidApiMessageId(replyingToMessage);
            const currentReplyingToMessage = replyingToMessage;

            setReplyingToMessage(null);

            const voiceSize = await getLocalAttachmentSize(voiceUri);
            const voiceFileName = getVoiceRecordingFileName();

            console.log("[VOICE RECORDING DEBUG] Sending voice message:", {
                conversationId,
                targetUserId,
                voiceUri,
                voiceFileName,
                voiceSize,
                durationMillis,
            });

            const sentSuccessfully = await sendOutgoingChatMessage({
                type: 8,
                body: "",
                attachment: {
                    uri: voiceUri,
                    name: voiceFileName,
                    fileName: voiceFileName,
                    filename: voiceFileName,
                    type: "audio/mp4",
                    mimeType: "audio/mp4",
                    mime_type: "audio/mp4",
                    size: voiceSize,
                    fileSize: voiceSize,
                    file_size: voiceSize,
                    durationMillis,
                    duration_millis: durationMillis,
                    duration: Math.round(durationMillis / 1000),
                },
                replyToMessageId,
                localReplyMessage: currentReplyingToMessage,
            });

            console.log("[VOICE RECORDING DEBUG] Voice send result:", {
                sentSuccessfully,
                conversationId,
                targetUserId,
            });
        } catch (error) {
            isRecordingRef.current = false;
            console.log("[VOICE RECORDING DEBUG] Voice recording stop/send error:", error);

            Alert.alert(
                tr("errorTitle", "Something went wrong"),
                tr("voiceRecordStopError", "Could not send the voice message. Please try again.")
            );
        } finally {
            isStoppingRecordingRef.current = false;

            try {
                await setAudioModeAsync({
                    allowsRecording: false,
                    playsInSilentMode: true,
                });
            } catch (audioModeError) {
                console.log("[VOICE RECORDING DEBUG] Audio mode reset after stop error:", audioModeError);
            }
        }
    };


    const cancelVoiceRecordingIfActive = async () => {
        const isActuallyRecording = isRecordingRef.current || !!recorderState?.isRecording;

        if (!isActuallyRecording || isCancellingRecordingRef.current || isStoppingRecordingRef.current) {
            return;
        }

        isCancellingRecordingRef.current = true;

        try {
            await audioRecorder.stop();
        } catch (error) {
            console.log("Voice recording cancel error:", error);
        } finally {
            isRecordingRef.current = false;
            isCancellingRecordingRef.current = false;
            isStoppingRecordingRef.current = false;

            try {
                await setAudioModeAsync({
                    allowsRecording: false,
                    playsInSilentMode: true,
                });
            } catch (audioModeError) {
                console.log("Audio mode reset error:", audioModeError);
            }
        }
    };

    const handleMicPress = async () => {
        if (isStoppingRecordingRef.current) {
            return;
        }

        if (isRecordingRef.current || isRecordingVoice) {
            await stopVoiceRecording();
            return;
        }

        await startVoiceRecording();
    };

    const {
        previewMedia,
        setPreviewMedia,
        selectedMediaToSend,
        cameraCaptureVisible,
        pickMediaFromLibrary,
        takePhotoWithCamera,
        handleCloseCameraCapture,
        handleCameraCaptured,
        handleConfirmSendMedia,
        handleCancelSelectedMedia,
        handleSaveMediaToDevice,
    } = useIndividualChatMedia({
        tr,
        addMessages,
        cancelVoiceRecordingIfActive,
        onSendMedia: handleSendMediaMessage,
    });

    useEffect(() => {
        if (cameraCaptureVisible || !openLibraryAfterCameraCloseRef.current) {
            return;
        }

        openLibraryAfterCameraCloseRef.current = false;

        console.log("[CameraLibrary] camera modal closed, scheduling library picker...");

        InteractionManager.runAfterInteractions(() => {
            if (openLibraryTimerRef.current) {
                clearTimeout(openLibraryTimerRef.current);
                openLibraryTimerRef.current = null;
            }

            openLibraryTimerRef.current = setTimeout(async () => {
                openLibraryTimerRef.current = null;

                try {
                    console.log("[CameraLibrary] opening ImagePicker.launchImageLibraryAsync...");
                    await pickMediaFromLibrary();
                    console.log("[CameraLibrary] pickMediaFromLibrary finished.");
                } catch (error) {
                    console.log("[CameraLibrary] pickMediaFromLibrary failed:", error);

                    Alert.alert(
                        tr("errorTitle", "Something went wrong"),
                        tr("mediaPickerError", "Could not select the media. Please try again.")
                    );
                }
            }, Platform.OS === "android" ? 450 : 650);
        });
    }, [cameraCaptureVisible, pickMediaFromLibrary]);

    // const {
    //     selectedScannedDocument,
    //     selectedScannedDocuments,
    //     activeScannedPageIndex,
    //     isScanningDocument,
    //     isCreatingScannedPdf,
    //     scanDocumentWithCamera,
    //     handleAddScannedPages,
    //     handleRetakeScannedPage,
    //     handleDeleteScannedPage,
    //     handleCancelScannedDocument,
    //     handleConfirmSendScannedDocument,
    //     setActiveScannedPageIndex,
    // } = useScanDocument({
    //     tr,
    //     addMessages,
    //     cancelVoiceRecordingIfActive,
    //     onSendScannedDocument: handleSendMediaMessage,
    // });

    const showBlockedSendAlert = () => {
        Alert.alert(
            tr("blockedConversationTitle", isArabic ? "المحادثة محظورة" : "Conversation blocked"),
            blockedComposerMessage
        );
    };

    const openAttachMenu = async () => {
        if (cannotSendBecauseBlocked) {
            showBlockedSendAlert();
            return;
        }

        Keyboard.dismiss();
        await cancelVoiceRecordingIfActive();

        setTimeout(() => {
            setAttachMenuVisible(true);
        }, Platform.OS === "android" ? 90 : 40);
    };

    const openChatMenu = () => {
        Keyboard.dismiss();

        setTimeout(() => {
            setMenuVisible(true);
        }, Platform.OS === "android" ? 90 : 40);
    };

    const pickDocumentsFromDevice = async () => {
        try {
            await cancelVoiceRecordingIfActive();
            console.log("Opening document picker...");

            const result = await DocumentPicker.getDocumentAsync({
                type: "*/*",
                copyToCacheDirectory: true,
            });

            console.log("Document picker result:", result);

            if (result.canceled || !result.assets?.length) {
                return;
            }

            const asset = result.assets[0];

            const newDocumentMessage = {
                id: `${Date.now()}-document`,
                side: "me",
                type: "document",
                uri: asset.uri,
                fileName: asset.name || `file-${Date.now()}`,
                mimeType: asset.mimeType || "application/octet-stream",
                size: asset.size,
                time: tr("now", "Now"),
            };

            await handleSendMediaMessage(newDocumentMessage);
        } catch (error) {
            console.log("Document picker error:", error);

            Alert.alert(
                tr("errorTitle", "Something went wrong"),
                tr("documentPickerError", "Could not select the file. Please try again.")
            );
        }
    };

    const handleAttachmentPress = async (type) => {
        setAttachMenuVisible(false);

        if (cannotSendBecauseBlocked) {
            showBlockedSendAlert();
            return;
        }

        if (type === "camera") {
            await takePhotoWithCamera();
            return;
        }


        if (type === "photos") {
            await pickMediaFromLibrary();
            return;
        }

        if (type === "document") {
            await pickDocumentsFromDevice();
            return;
        }

        if (type === "quote") {
            await cancelVoiceRecordingIfActive();
            setQuoteFormVisible(true);
            return;
        }

        if (type === "scan") {
            if (typeof scanDocumentWithCamera === "function") {
                await scanDocumentWithCamera();
                return;
            }

            Alert.alert(
                tr("scanUnavailableTitle", "Scan unavailable"),
                tr("scanUnavailableMessage", "Document scanning is not available right now.")
            );
        }
    };


    const handleOpenDocument = async (documentItem) => {
        try {
            if (!documentItem?.uri) return;

            const isPdf = isPdfDocument(documentItem);
            const mimeType = isPdf
                ? "application/pdf"
                : documentItem.mimeType || "application/octet-stream";
            const localUri = await ensureLocalDocumentUri(documentItem);

            if (!localUri) return;

            const canShare = await Sharing.isAvailableAsync();

            // Most stable cross-platform behavior for local PDFs:
            // iPhone: opens the iOS sheet so the user can choose Files, Google Drive, Books, Adobe, etc.
            // Android: opens the app chooser/share sheet where Google Drive/PDF readers can appear.
            if (canShare) {
                await Sharing.shareAsync(localUri, {
                    mimeType,
                    UTI: isPdf ? "com.adobe.pdf" : undefined,
                    dialogTitle: isPdf
                        ? tr("openPdfWithApp", "Open PDF with Google Drive or another app")
                        : documentItem.fileName || tr("openFile", "Open file"),
                });
                return;
            }

            // Android fallback only, in case Sharing is not available.
            if (Platform.OS === "android") {
                const androidUri = localUri.startsWith("content://")
                    ? localUri
                    : await FileSystem.getContentUriAsync(localUri);

                await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
                    data: androidUri,
                    type: mimeType,
                    flags: 1,
                });

                return;
            }

            Alert.alert(
                tr("openUnavailableTitle", "Open unavailable"),
                tr("openUnavailableMessage", "No app is available to open this file on this device.")
            );
        } catch (error) {
            console.log("Open document error:", error);

            try {
                const isPdf = isPdfDocument(documentItem);
                const localUri = await ensureLocalDocumentUri(documentItem);
                const canShare = await Sharing.isAvailableAsync();

                if (canShare && localUri) {
                    await Sharing.shareAsync(localUri, {
                        mimeType: isPdf
                            ? "application/pdf"
                            : documentItem?.mimeType || "application/octet-stream",
                        UTI: isPdf ? "com.adobe.pdf" : undefined,
                        dialogTitle: isPdf
                            ? tr("openPdfWithApp", "Open PDF with Google Drive or another app")
                            : documentItem?.fileName || tr("openFile", "Open file"),
                    });
                    return;
                }
            } catch (fallbackError) {
                console.log("Open document fallback error:", fallbackError);
            }

            Alert.alert(
                tr("errorTitle", "Something went wrong"),
                tr("openDocumentError", "Could not open the file. Please try again.")
            );
        }
    };

    const handleSaveDocumentToDevice = async (documentItem) => {
        try {
            if (!documentItem?.uri) return;

            const localUri = await ensureLocalDocumentUri(documentItem);
            const canShare = await Sharing.isAvailableAsync();

            if (!canShare || !localUri) {
                Alert.alert(
                    tr("saveUnavailableTitle", "Save unavailable"),
                    tr("saveDocumentUnavailableMessage", "Saving this file is not available on this device.")
                );
                return;
            }

            await Sharing.shareAsync(localUri, {
                mimeType: documentItem.mimeType || "application/octet-stream",
                UTI: isPdfDocument(documentItem) ? "com.adobe.pdf" : undefined,
                dialogTitle: documentItem.fileName || tr("saveFile", "Save file"),
            });
        } catch (error) {
            console.log("Save document error:", error);

            Alert.alert(
                tr("errorTitle", "Something went wrong"),
                tr("saveDocumentError", "Could not save the file. Please try again.")
            );
        }
    };

    const handleMessageReply = (message) => {
        setReplyingToMessage(message);

        setTimeout(() => {
            scrollToBottom(true);
        }, 120);
    };

    const handleCopyMessage = async (message) => {
        const textToCopy = getMessagePreviewText(message, tr);

        if (!textToCopy) {
            Alert.alert(
                tr("copyUnavailableTitle", "Copy unavailable"),
                tr("copyUnavailableMessage", "There is no text to copy from this message.")
            );
            return;
        }

        try {
            await Clipboard.setStringAsync(textToCopy);

            showCopyToast();
        } catch (error) {
            console.log("Copy message error:", error);

            Alert.alert(
                tr("errorTitle", "Something went wrong"),
                tr("copyMessageError", "Could not copy this message. Please try again.")
            );
        }
    };

    const handleDeleteMessage = (message) => {
        if (!isMessageDeletable(message)) {
            Alert.alert(
                tr("deleteUnavailableTitle", "Delete unavailable"),
                tr("deleteUnavailableMessage", "This message cannot be deleted.")
            );
            return;
        }

        const messageDeleteId = getMessageDeleteId(message);

        if (!messageDeleteId) {
            Alert.alert(
                tr("deleteUnavailableTitle", "Delete unavailable"),
                tr("deleteUnavailableMessage", "This message cannot be deleted yet.")
            );
            return;
        }

        Alert.alert(
            tr("confirmDeleteMessageTitle", "Delete message?"),
            tr("confirmDeleteMessageBody", "This message will be deleted from the conversation."),
            [
                { text: tr("cancel", "Cancel"), style: "cancel" },
                {
                    text: tr("delete", "Delete"),
                    style: "destructive",
                    onPress: async () => {
                        const previousMessages = messagesRef.current || messages;

                        setMessages((prev) =>
                            prev.filter((item) => getMessageDeleteId(item) !== messageDeleteId)
                        );

                        try {
                            await chatService.deleteMessage(messageDeleteId);
                        } catch (error) {
                            console.log("Delete message error:", error);
                            setMessages(previousMessages);

                            Alert.alert(
                                tr("errorTitle", "Something went wrong"),
                                error?.userMessage ||
                                tr("deleteMessageError", "Could not delete this message. Please try again.")
                            );
                        }
                    },
                },
            ]
        );
    };

    const handleRetryFailedMessage = async (message) => {
        if (cannotSendBecauseBlocked) {
            showBlockedSendAlert();
            return;
        }

        if (!message?.isFailed) {
            return;
        }

        const retryType = getApiMessageTypeFromLocalMessage(message);
        const retryAttachment = getRetryAttachmentFromMessage(message);
        const retryBody = message?.text || message?.caption || message?.body || "";
        const retryReplyToMessageId =
            message?.reply_to_message_id ||
            getValidApiMessageId(message?.replyToMessage) ||
            null;
        const retryReplyMessage = message?.replyToMessage || null;

        if (retryType !== 1 && !retryAttachment?.uri) {
            Alert.alert(
                tr("retryUnavailableTitle", "Retry unavailable"),
                tr("retryUnavailableMessage", "This file is no longer available on this device.")
            );
            return;
        }

        setMessageOptionsMessage(null);

        setMessages((prevMessages) =>
            prevMessages.filter((item) => String(item.id) !== String(message.id))
        );

        await sendOutgoingChatMessage({
            type: retryType,
            body: retryBody,
            attachment: retryAttachment || undefined,
            replyToMessageId: retryReplyToMessageId,
            localReplyMessage: retryReplyMessage,
        });
    };

    const handleMessageLongPress = (message) => {
        setMessageOptionsMessage(message);
    };

    const handleToggleBlockContact = () => {
        setMenuVisible(false);

        if (!canViewerBlockConversation) {
            return;
        }

        if (!conversationId) {
            Alert.alert(
                tr("missingConversationTitle", "Conversation not ready"),
                tr("missingConversationMessage", "Please open a saved conversation before using this action.")
            );
            return;
        }

        if (isBlocked) {
            Alert.alert(
                tr("confirmUnblockTitle", "Unblock contact?"),
                tr(
                    "confirmUnblockMessage",
                    "You will be able to receive messages from this contact again."
                ),
                [
                    { text: tr("cancel", "Cancel"), style: "cancel" },
                    {
                        text: tr("unblock", "Unblock Contact"),
                        onPress: async () => {
                            try {
                                setIsMutatingChat(true);
                                await chatService.unblockConversationCustomer(conversationId);
                                setIsBlocked(false);
                                setCanSendMessage(true);
                            } catch (error) {
                                console.log("Unblock conversation error:", error);

                                Alert.alert(
                                    tr("errorTitle", "Something went wrong"),
                                    error?.userMessage ||
                                    tr("unblockError", "Could not unblock this contact. Please try again.")
                                );
                            } finally {
                                setIsMutatingChat(false);
                            }
                        },
                    },
                ]
            );

            return;
        }

        Alert.alert(
            tr("confirmBlockTitle", "Block contact?"),
            tr("confirmBlockMessage", "You will no longer receive messages from this contact."),
            [
                { text: tr("cancel", "Cancel"), style: "cancel" },
                {
                    text: tr("block", "Block Contact"),
                    style: "destructive",
                    onPress: async () => {
                        try {
                            setIsMutatingChat(true);
                            await chatService.blockConversationCustomer(conversationId);
                            setIsBlocked(true);
                            setCanSendMessage(false);
                            await cancelVoiceRecordingIfActive();
                            sendTypingWhisper(false);
                        } catch (error) {
                            console.log("Block conversation error:", error);

                            Alert.alert(
                                tr("errorTitle", "Something went wrong"),
                                error?.userMessage ||
                                tr("blockError", "Could not block this contact. Please try again.")
                            );
                        } finally {
                            setIsMutatingChat(false);
                        }
                    },
                },
            ]
        );
    };

    const handleClearConversation = () => {
        setMenuVisible(false);

        Alert.alert(
            tr("confirmClearTitle", "Clear chat?"),
            tr("confirmClearMessage", "This will clear your local view of this conversation without deleting it for everyone."),
            [
                { text: tr("cancel", "Cancel"), style: "cancel" },
                {
                    text: tr("clearChat", "Clear Chat"),
                    style: "destructive",
                    onPress: async () => {
                        const previousMessages = messages;

                        setMessages([]);

                        if (!conversationId) {
                            return;
                        }

                        try {
                            setIsMutatingChat(true);
                            await chatService.clearConversation(conversationId);
                        } catch (error) {
                            console.log("Clear conversation error:", error);
                            setMessages(previousMessages);

                            Alert.alert(
                                tr("errorTitle", "Something went wrong"),
                                error?.userMessage ||
                                tr("clearConversationError", "Could not clear this chat. Please try again.")
                            );
                        } finally {
                            setIsMutatingChat(false);
                        }
                    },
                },
            ]
        );
    };

    // KeyboardAvoidingView now owns keyboard resizing on both iOS and Android.
    // Keep this value at 0 so the composer does not receive an extra manual offset
    // that can push it incorrectly on different Android screen sizes.
    const androidKeyboardSpace = 0;

    return (
        <SafeAreaView
            edges={["top"]}
            style={[styles.safeArea, { backgroundColor: colors.statusHeader }]}
        >
            <StatusBar
                style={isDark ? "light" : "dark"}
                translucent={false}
                backgroundColor={colors.statusHeader}
            />

            <KeyboardAvoidingView
                style={[styles.flex, { backgroundColor: colors.screen }]}
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                keyboardVerticalOffset={0}
                enabled
            >
                <View style={[styles.container, { backgroundColor: colors.screen }]}>
                    <IndividualChatHeader
                        navigation={navigation}
                        colors={colors}
                        employeeInitials={employeeInitials}
                        employeeName={employeeName}
                        employeeDepartment={employeeDepartment}
                        employeeAvatar={employeeAvatar}
                        isGroup={isGroupConversation}
                        groupParticipantsCount={groupParticipantsCount}
                        groupSubtitle={groupHeaderSubtitle}
                        isBlocked={isBlocked}
                        tr={tr}
                        isCompactScreen={isCompactScreen}
                        isVeryCompactScreen={isVeryCompactScreen}
                        isShortScreen={isShortScreen}
                        onOpenMenu={openChatMenu}
                        conversationId={conversationId}         // أضفتها
                        targetUserId={targetUserId}             // أضفتها
                        employeePhone={chatProfileInfo.phone || employee?.phone}         // أضفتها
                        employeeUsername={chatProfileInfo.username || employee?.username}   // أضفتها
                        employeeEmail={chatProfileInfo.email || employee?.email}         // أضفتها
                        employeeLocation={chatProfileInfo.location || employee?.location}   // أضفتها
                        isOnline={targetOnline}
                        isTyping={targetTyping}
                        isRecordingVoice={targetRecording}
                        activityName={headerActivityName}
                        lastSeenAt={targetLastSeenAt}
                        presenceText={headerPresenceText}
                    />

                    <ChatPatternBackground topOffset={Platform.OS === "android" ? 76 : 78} />

                    <IndividualChatMessagesList
                        messages={messages}
                        messagesScrollRef={messagesScrollRef}
                        colors={colors}
                        tr={tr}
                        isArabic={isArabic}
                        isCompactScreen={isCompactScreen}
                        isShortScreen={isShortScreen}
                        isKeyboardVisible={isKeyboardVisible}
                        imageMessageWidth={imageMessageWidth}
                        imageMessageHeight={imageMessageHeight}
                        onContentSizeChange={handleMessagesContentSizeChange}
                        onScroll={handleMessagesScroll}
                        onLoadOlderMessages={loadOlderMessages}
                        isLoadingOlderMessages={isLoadingOlderMessages}
                        hasOlderMessages={hasOlderMessages}
                        onOpenImage={setPreviewMedia}
                        onOpenVideo={setPreviewMedia}
                        onOpenDocument={setPreviewDocument}
                        onMessageLongPress={handleMessageLongPress}
                        canCreateQuote={canViewerCreateQuote}
                        viewerRole={currentUserRole}
                    />

                    <IndividualChatComposer
                        colors={colors}
                        tr={tr}
                        isArabic={isArabic}
                        isCompactScreen={isCompactScreen}
                        messageText={messageText}
                        onChangeMessageText={setMessageText}
                        onTyping={handleTyping}
                        isRecordingVoice={isRecordingVoice}
                        recordingDurationText={recordingDurationText}
                        hasMessage={hasMessage}
                        insetsBottom={insets.bottom}
                        androidKeyboardSpace={androidKeyboardSpace}
                        onOpenAttachMenu={openAttachMenu}
                        onTakePhoto={takePhotoWithCamera}
                        onSend={handleSend}
                        onMicPress={handleMicPress}
                        replyingToMessage={replyingToMessage}
                        onCancelReply={() => setReplyingToMessage(null)}
                        disabled={cannotSendBecauseBlocked}
                        disabledReason={blockedComposerMessage}
                        onFocusInput={() => {
                            setTimeout(() => {
                                scrollToBottom(true);
                            }, 220);
                        }}
                    />
                </View>

                <AttachmentOptionsModal
                    visible={attachMenuVisible}
                    onClose={() => setAttachMenuVisible(false)}
                    onSelect={handleAttachmentPress}
                    colors={colors}
                    tr={tr}
                    isArabic={isArabic}
                    isCompactScreen={isCompactScreen}
                    canCreateQuote={canViewerCreateQuote}
                />

                <QuoteFormModal
                    visible={quoteFormVisible}
                    colors={colors}
                    tr={tr}
                    isArabic={isArabic}
                    isSubmitting={isSubmittingQuote}
                    onClose={() => setQuoteFormVisible(false)}
                    onSubmit={handleSubmitQuote}
                />

                <ChatOptionsModal
                    visible={menuVisible}
                    onClose={() => setMenuVisible(false)}
                    colors={colors}
                    tr={tr}
                    language={language}
                    isDark={isDark}
                    isBlocked={isBlocked}
                    canBlock={canViewerBlockConversation}
                    onChangeLanguage={handleChangeLanguage}
                    onChangeTheme={handleChangeTheme}
                    onToggleBlock={handleToggleBlockContact}
                    onClear={handleClearConversation}
                    isMutatingChat={isMutatingChat}
                    isArabic={isArabic}
                />

                <MessageOptionsModal
                    visible={!!messageOptionsMessage}
                    message={messageOptionsMessage}
                    previewText={getMessagePreviewText(messageOptionsMessage, tr)}
                    canDelete={isMessageDeletable(messageOptionsMessage)}
                    canRetry={messageOptionsMessage?.isFailed === true}
                    colors={colors}
                    tr={tr}
                    isArabic={isArabic}
                    onClose={() => setMessageOptionsMessage(null)}
                    onRetry={() => {
                        const selectedMessage = messageOptionsMessage;

                        if (selectedMessage) {
                            handleRetryFailedMessage(selectedMessage);
                        }
                    }}
                    onReply={() => {
                        const selectedMessage = messageOptionsMessage;
                        setMessageOptionsMessage(null);

                        if (selectedMessage) {
                            handleMessageReply(selectedMessage);
                        }
                    }}
                    onCopy={() => {
                        const selectedMessage = messageOptionsMessage;
                        setMessageOptionsMessage(null);

                        if (selectedMessage) {
                            handleCopyMessage(selectedMessage);
                        }
                    }}
                    onDelete={() => {
                        const selectedMessage = messageOptionsMessage;
                        setMessageOptionsMessage(null);

                        if (selectedMessage) {
                            handleDeleteMessage(selectedMessage);
                        }
                    }}
                />

                <CopyToast
                    visible={copyToastVisible}
                    colors={colors}
                    tr={tr}
                    isArabic={isArabic}
                />

                <ChatCameraCaptureModal
                    visible={cameraCaptureVisible}
                    colors={colors}
                    tr={tr}
                    onClose={handleCloseCameraCapture}
                    onCaptured={handleCameraCaptured}
                    onOpenLibrary={() => {
                        console.log("[CameraLibrary] library button pressed inside camera.");

                        if (openLibraryTimerRef.current) {
                            clearTimeout(openLibraryTimerRef.current);
                            openLibraryTimerRef.current = null;
                        }

                        openLibraryAfterCameraCloseRef.current = true;
                        handleCloseCameraCapture();
                    }}
                />

                <MediaPreviewModal
                    visible={!!previewMedia}
                    mediaItem={previewMedia}
                    image={previewMedia?.image}
                    video={previewMedia?.video || (previewMedia?.type === "video" && previewMedia?.uri ? { uri: previewMedia.uri } : null)}
                    caption={previewMedia?.caption}
                    time={previewMedia?.time}
                    colors={colors}
                    isDark={isDark}
                    tr={tr}
                    onClose={() => setPreviewMedia(null)}
                    onSave={() => handleSaveMediaToDevice(previewMedia)}
                />

                <MediaConfirmModal
                    visible={!!selectedMediaToSend}
                    mediaItem={selectedMediaToSend}
                    image={selectedMediaToSend?.image}
                    video={selectedMediaToSend?.video || (selectedMediaToSend?.type === "video" && selectedMediaToSend?.uri ? { uri: selectedMediaToSend.uri } : null)}
                    caption={selectedMediaToSend?.caption}
                    colors={colors}
                    isDark={isDark}
                    tr={tr}
                    onCancel={handleCancelSelectedMedia}
                    onSend={(finalMedia) => {
                        const isPressEvent =
                            !!finalMedia?.nativeEvent ||
                            !!finalMedia?.dispatchConfig ||
                            !!finalMedia?.target;

                        handleConfirmSendMedia(isPressEvent ? undefined : finalMedia);
                    }}
                />

                {/* <ScannedDocumentConfirmModal
                    visible={!!selectedScannedDocument}
                    documentItem={selectedScannedDocument}
                    documents={selectedScannedDocuments}
                    activeIndex={activeScannedPageIndex}
                    colors={colors}
                    tr={tr}
                    isLoading={isScanningDocument || isCreatingScannedPdf}
                    onCancel={handleCancelScannedDocument}
                    onAddPage={handleAddScannedPages}
                    onDeletePage={handleDeleteScannedPage}
                    onRetake={handleRetakeScannedPage}
                    onChangePage={setActiveScannedPageIndex}
                    onSend={handleConfirmSendScannedDocument}
                />  */}
                <DocumentPreviewModal
                    visible={!!previewDocument}
                    documentItem={previewDocument}
                    colors={colors}
                    isDark={isDark}
                    tr={tr}
                    onClose={() => setPreviewDocument(null)}
                    onOpen={() => handleOpenDocument(previewDocument)}
                    onSave={() => handleSaveDocumentToDevice(previewDocument)}
                />
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

function MessageOptionsModal({
    visible,
    message,
    previewText,
    canDelete,
    canRetry,
    colors,
    tr,
    isArabic,
    onClose,
    onRetry,
    onReply,
    onCopy,
    onDelete,
}) {
    if (!visible || !message) {
        return null;
    }

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
                style={[
                    styles.messageOptionsOverlay,
                    { backgroundColor: colors.modalOverlay },
                ]}
                onPress={onClose}
            >
                <Pressable
                    style={[
                        styles.messageOptionsCard,
                        {
                            backgroundColor: colors.modalCard,
                            borderColor: colors.border,
                        },
                    ]}
                    onPress={(event) => event.stopPropagation()}
                >
                    <Text
                        style={[
                            styles.messageOptionsTitle,
                            { color: colors.text },
                            getTextDirectionStyle(isArabic),
                        ]}
                    >
                        {tr("messageOptionsTitle", "Message options")}
                    </Text>

                    {!!previewText && (
                        <Text
                            style={[
                                styles.messageOptionsPreview,
                                { color: colors.muted },
                                getTextDirectionStyle(isArabic),
                            ]}
                            numberOfLines={2}
                        >
                            {previewText}
                        </Text>
                    )}

                    {canRetry && (
                        <TouchableOpacity
                            style={[
                                styles.messageOptionsButton,
                                { backgroundColor: colors.buttonSoft },
                            ]}
                            activeOpacity={0.86}
                            onPress={onRetry}
                        >
                            <Text style={[styles.messageOptionsButtonText, { color: colors.primary }]}>
                                {tr("retry", "Retry")}
                            </Text>
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity
                        style={[
                            styles.messageOptionsButton,
                            { backgroundColor: colors.buttonSoft },
                        ]}
                        activeOpacity={0.86}
                        onPress={onReply}
                    >
                        <Text style={[styles.messageOptionsButtonText, { color: colors.text }]}>
                            {tr("reply", "Reply")}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[
                            styles.messageOptionsButton,
                            { backgroundColor: colors.buttonSoft },
                        ]}
                        activeOpacity={0.86}
                        onPress={onCopy}
                    >
                        <Text style={[styles.messageOptionsButtonText, { color: colors.text }]}>
                            {tr("copy", "Copy")}
                        </Text>
                    </TouchableOpacity>

                    {canDelete && (
                        <TouchableOpacity
                            style={[
                                styles.messageOptionsButton,
                                { backgroundColor: colors.buttonSoft },
                            ]}
                            activeOpacity={0.86}
                            onPress={onDelete}
                        >
                            <Text
                                style={[
                                    styles.messageOptionsButtonText,
                                    { color: colors.danger },
                                ]}
                            >
                                {tr("delete", "Delete")}
                            </Text>
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity
                        style={[
                            styles.messageOptionsButton,
                            { backgroundColor: colors.buttonSoft },
                        ]}
                        activeOpacity={0.86}
                        onPress={onClose}
                    >
                        <Text style={[styles.messageOptionsButtonText, { color: colors.text }]}>
                            {tr("cancel", "Cancel")}
                        </Text>
                    </TouchableOpacity>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

function CopyToast({ visible, colors, tr, isArabic }) {
    if (!visible) {
        return null;
    }

    return (
        <View pointerEvents="none" style={styles.copyToastWrapper}>
            <View
                style={[
                    styles.copyToastBox,
                    {
                        backgroundColor: colors.modalCard,
                        borderColor: colors.border,
                    },
                ]}
            >
                <Ionicons name="checkmark-circle" size={18} color={colors.primary} />

                <Text
                    style={[
                        styles.copyToastText,
                        { color: colors.text },
                        getTextDirectionStyle(isArabic),
                    ]}
                    numberOfLines={1}
                >
                    {tr("copiedMessageShort", "Copied")}
                </Text>
            </View>
        </View>
    );
}

function DocumentPreviewModal({
    visible,
    documentItem,
    colors,
    isDark,
    tr,
    onClose,
    onOpen,
    onSave,
}) {
    const { width } = useWindowDimensions();
    const shouldStackActions = width < 390;
    const [localPreviewUri, setLocalPreviewUri] = useState(null);
    const [isPreparingPreview, setIsPreparingPreview] = useState(false);
    const [previewFailed, setPreviewFailed] = useState(false);

    const fileIconName = getFileIconName(
        documentItem?.mimeType,
        documentItem?.fileName
    );
    const fileSizeText = formatFileSize(documentItem?.size);
    const canPreviewAsImage = isImageDocument(documentItem);
    const canPreviewAsPdf = isPdfDocument(documentItem);
    const canPreviewInsideApp = canPreviewAsImage || canPreviewAsPdf;

    useEffect(() => {
        let isMounted = true;

        const preparePreview = async () => {
            if (!visible || !documentItem?.uri || !canPreviewInsideApp) {
                setLocalPreviewUri(null);
                setPreviewFailed(false);
                return;
            }

            setIsPreparingPreview(true);
            setPreviewFailed(false);

            try {
                const nextUri = await ensureLocalDocumentUri(documentItem);

                if (isMounted) {
                    setLocalPreviewUri(nextUri);
                }
            } catch (error) {
                console.log("Document preview prepare error:", error);

                if (isMounted) {
                    setPreviewFailed(true);
                    setLocalPreviewUri(null);
                }
            } finally {
                if (isMounted) {
                    setIsPreparingPreview(false);
                }
            }
        };

        preparePreview();

        return () => {
            isMounted = false;
        };
    }, [visible, documentItem?.uri, documentItem?.fileName, documentItem?.mimeType]);

    const renderPreviewContent = () => {
        if (isPreparingPreview) {
            return (
                <View style={[styles.documentPreviewLoading, { backgroundColor: colors.cardSoft, borderColor: colors.border }]}>
                    <MaterialCommunityIcons
                        name={fileIconName}
                        size={58}
                        color={colors.blue}
                    />
                    <Text style={[styles.documentPreviewLoadingText, { color: colors.text }]}>
                        {tr("preparingPreview", "Preparing preview...")}
                    </Text>
                </View>
            );
        }

        if (canPreviewAsImage && localPreviewUri && !previewFailed) {
            return (
                <Image
                    source={{ uri: localPreviewUri }}
                    style={styles.documentInlineImage}
                    resizeMode="contain"
                />
            );
        }

        // Android/iOS WebView is not reliable for local PDF files.
        // Keep real inline preview for image files, and guide PDFs to open in Google Drive/another reader.
        if (canPreviewAsPdf) {
            return (
                <View
                    style={[
                        styles.documentPreviewCard,
                        {
                            backgroundColor: colors.cardStrong,
                            borderColor: colors.border,
                        },
                    ]}
                >
                    <View
                        style={[
                            styles.documentPreviewIcon,
                            {
                                backgroundColor: colors.cardSoft,
                                borderColor: colors.border,
                            },
                        ]}
                    >
                        <MaterialCommunityIcons
                            name="file-pdf-box"
                            size={64}
                            color={colors.blue}
                        />
                    </View>

                    <Text
                        style={[styles.documentPreviewName, { color: colors.text }]}
                        numberOfLines={3}
                    >
                        {documentItem?.fileName || tr("attachedFile", "Attached file")}
                    </Text>

                    <Text
                        style={[styles.documentPreviewMeta, { color: colors.muted }]}
                        numberOfLines={3}
                    >
                        {tr(
                            "pdfExternalPreviewMessage",
                            "PDF files open best in Google Drive, Files, Books, Adobe, or another PDF app."
                        )}
                    </Text>
                </View>
            );
        }

        return (
            <View
                style={[
                    styles.documentPreviewCard,
                    {
                        backgroundColor: colors.cardStrong,
                        borderColor: colors.border,
                    },
                ]}
            >
                <View
                    style={[
                        styles.documentPreviewIcon,
                        {
                            backgroundColor: colors.cardSoft,
                            borderColor: colors.border,
                        },
                    ]}
                >
                    <MaterialCommunityIcons
                        name={fileIconName}
                        size={58}
                        color={colors.blue}
                    />
                </View>

                <Text
                    style={[styles.documentPreviewName, { color: colors.text }]}
                    numberOfLines={3}
                >
                    {documentItem?.fileName || tr("attachedFile", "Attached file")}
                </Text>

                <Text
                    style={[styles.documentPreviewMeta, { color: colors.muted }]}
                    numberOfLines={2}
                >
                    {previewFailed && canPreviewInsideApp
                        ? tr("previewUnavailable", "Preview is not available for this file. You can still open or save it.")
                        : fileSizeText || documentItem?.mimeType || tr("file", "File")}
                </Text>
            </View>
        );
    };

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
            <View
                style={[
                    styles.documentPreviewRoot,
                    { backgroundColor: colors.previewBackground },
                ]}
            >
                <StatusBar
                    style="light"
                    translucent
                    backgroundColor="transparent"
                />

                <View style={styles.documentPreviewHeader}>
                    <TouchableOpacity
                        style={[styles.documentPreviewHeaderButton, { backgroundColor: colors.buttonSoft, borderColor: colors.border }]}
                        activeOpacity={0.85}
                        onPress={onClose}
                    >
                        <Ionicons name="close" size={28} color={colors.text} />
                    </TouchableOpacity>

                    <View style={[styles.documentPreviewHeaderTextWrapper, { backgroundColor: colors.cardStrong, borderColor: colors.border }]}>
                        <Text style={[styles.documentPreviewHeaderTitle, { color: colors.text }]} numberOfLines={1}>
                            {documentItem?.fileName || tr("attachedFile", "Attached file")}
                        </Text>
                        <Text style={[styles.documentPreviewHeaderMeta, { color: colors.muted }]} numberOfLines={1}>
                            {fileSizeText || documentItem?.mimeType || tr("file", "File")}
                        </Text>
                    </View>
                </View>

                <View style={styles.documentPreviewBody}>
                    {renderPreviewContent()}
                </View>

                <View
                    style={[
                        styles.documentPreviewBottomBar,
                        shouldStackActions && styles.documentPreviewBottomBarStacked,
                        {
                            backgroundColor: colors.cardStrong,
                        },
                    ]}
                >
                    <TouchableOpacity
                        style={[
                            styles.documentPreviewButton,
                            shouldStackActions && styles.documentPreviewButtonStacked,
                            { backgroundColor: colors.primary },
                        ]}
                        activeOpacity={0.85}
                        onPress={onOpen}
                    >
                        <Ionicons name="open-outline" size={19} color={colors.darkText} />
                        <Text style={[styles.documentPreviewButtonText, { color: colors.darkText }]} numberOfLines={1}>
                            {canPreviewAsPdf
                                ? tr("openWithApp", "Open with app")
                                : tr("openFile", "Open file")}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[
                            styles.documentPreviewButton,
                            styles.documentPreviewSaveButton,
                            { backgroundColor: colors.buttonSoft, borderColor: colors.border },
                            shouldStackActions && styles.documentPreviewButtonStacked,
                        ]}
                        activeOpacity={0.85}
                        onPress={onSave}
                    >
                        <Ionicons name="download-outline" size={19} color={colors.text} />
                        <Text style={[styles.documentPreviewButtonText, { color: colors.text }]} numberOfLines={1}>
                            {tr("save", "Save")}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

function AttachmentOptionsModal({
    visible,
    onClose,
    onSelect,
    colors,
    tr,
    isArabic,
    isCompactScreen,
    canCreateQuote = false,
}) {
    if (!visible) {
        return null;
    }

    const attachmentItems = [
        {
            key: "camera",
            label: tr("camera", "Camera"),
            iconType: "ion",
            iconName: "camera",
            color: colors.text,
        },
        {
            key: "photos",
            label: tr("photosAndVideos", "Photos & Videos"),
            iconType: "ion",
            iconName: "images",
            color: colors.blue,
        },
        {
            key: "document",
            label: tr("document", "Document"),
            iconType: "material",
            iconName: "file-document",
            color: colors.blue,
        },
        ...(canCreateQuote
            ? [
                {
                    key: "quote",
                    label: tr("quote", "Quote"),
                    iconType: "material",
                    iconName: "file-document-edit-outline",
                    color: colors.primary || colors.blue,
                },
            ]
            : []),
        {
            key: "scan",
            label: tr("scanDocument", "Scan Document"),
            iconType: "ion",
            iconName: "scan-outline",
            color: colors.primary || colors.blue,
        },
    ];

    return (
        <View style={styles.attachmentOverlayRoot} pointerEvents="box-none">
            <Pressable
                style={[
                    styles.modalOverlay,
                    { backgroundColor: colors.modalOverlay },
                ]}
                onPress={onClose}
            >
                <Pressable
                    style={[
                        styles.attachmentCard,
                        isCompactScreen && styles.attachmentCardCompact,
                        {
                            backgroundColor: colors.modalCard,
                            borderColor: colors.border,
                        },
                    ]}
                >
                    <View style={[styles.attachmentHeader, getRowDirectionStyle(isArabic)]}>
                        <Text
                            style={[
                                styles.attachmentTitle,
                                { color: colors.text },
                                getTextDirectionStyle(isArabic),
                            ]}
                        >
                            {tr("attachmentTitle", "Attach")}
                        </Text>

                        <TouchableOpacity onPress={onClose} activeOpacity={0.8}>
                            <Ionicons name="close" size={24} color={colors.text} />
                        </TouchableOpacity>
                    </View>

                    <View style={[styles.attachmentGrid, getRowDirectionStyle(isArabic)]}>
                        {attachmentItems.map((item) => (
                            <TouchableOpacity
                                key={item.key}
                                style={styles.attachmentItem}
                                activeOpacity={0.85}
                                onPress={() => onSelect(item.key)}
                            >
                                <View
                                    style={[
                                        styles.attachmentIconCircle,
                                        isCompactScreen && styles.attachmentIconCircleCompact,
                                        {
                                            backgroundColor: colors.cardSoft,
                                            borderColor: colors.border,
                                        },
                                    ]}
                                >
                                    {item.iconType === "material" ? (
                                        <MaterialCommunityIcons
                                            name={item.iconName}
                                            size={isCompactScreen ? 29 : 33}
                                            color={item.color}
                                        />
                                    ) : (
                                        <Ionicons
                                            name={item.iconName}
                                            size={isCompactScreen ? 28 : 31}
                                            color={item.color}
                                        />
                                    )}
                                </View>

                                <Text
                                    style={[
                                        styles.attachmentLabel,
                                        isCompactScreen && styles.attachmentLabelCompact,
                                        { color: colors.text },
                                    ]}
                                    numberOfLines={1}
                                >
                                    {item.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </Pressable>
            </Pressable>
        </View>
    );
}

function ChatOptionsModal({
    visible,
    onClose,
    colors,
    tr,
    language,
    isDark,
    isBlocked,
    canBlock = false,
    onChangeLanguage,
    onChangeTheme,
    onToggleBlock,
    onClear,
    isMutatingChat,
    isArabic,
}) {
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
                style={[
                    styles.modalOverlay,
                    { backgroundColor: colors.modalOverlay },
                ]}
                onPress={onClose}
            >
                <Pressable
                    style={[
                        styles.menuCard,
                        {
                            backgroundColor: colors.modalCard,
                            borderColor: colors.border,
                        },
                    ]}
                >
                    <View style={[styles.menuHeader, getRowDirectionStyle(isArabic)]}>
                        <Text style={[styles.menuTitle, { color: colors.text }]}>
                            {tr("menuTitle", "Chat Options")}
                        </Text>

                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={24} color={colors.text} />
                        </TouchableOpacity>
                    </View>

                    <Text
                        style={[
                            styles.menuSectionTitle,
                            { color: colors.muted },
                            getTextDirectionStyle(isArabic),
                        ]}
                    >
                        {tr("theme", "Theme")}
                    </Text>

                    <View style={styles.segmentRow}>
                        <OptionPill
                            label={tr("darkMode", "Dark Mode")}
                            active={isDark}
                            colors={colors}
                            onPress={() => onChangeTheme("dark")}
                        />

                        <OptionPill
                            label={tr("lightMode", "Light Mode")}
                            active={!isDark}
                            colors={colors}
                            onPress={() => onChangeTheme("light")}
                        />
                    </View>

                    <Text
                        style={[
                            styles.menuSectionTitle,
                            { color: colors.muted },
                            getTextDirectionStyle(isArabic),
                        ]}
                    >
                        {tr("language", "Language")}
                    </Text>

                    <View style={styles.segmentRow}>
                        <OptionPill
                            label={tr("english", "English")}
                            active={language === "en"}
                            colors={colors}
                            onPress={() => onChangeLanguage("en")}
                        />

                        <OptionPill
                            label={tr("arabic", "Arabic")}
                            active={language === "ar"}
                            colors={colors}
                            onPress={() => onChangeLanguage("ar")}
                        />
                    </View>

                    {canBlock && (
                        <TouchableOpacity
                            style={[
                                styles.dangerRow,
                                { borderColor: isBlocked ? colors.primary : colors.border },
                            ]}
                            onPress={onToggleBlock}
                            disabled={isMutatingChat}
                        >
                            <Ionicons
                                name={isBlocked ? "checkmark-circle-outline" : "ban-outline"}
                                size={22}
                                color={isBlocked ? colors.primary : colors.danger}
                            />

                            <Text
                                style={[
                                    styles.dangerText,
                                    { color: isBlocked ? colors.primary : colors.danger },
                                ]}
                            >
                                {isBlocked
                                    ? tr("unblock", "Unblock Contact")
                                    : tr("block", "Block Contact")}
                            </Text>
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity
                        style={[
                            styles.dangerRow,
                            { borderColor: colors.border },
                        ]}
                        onPress={onClear}
                        disabled={isMutatingChat}
                    >
                        <Ionicons name="trash-bin-outline" size={22} color={colors.danger} />
                        <Text style={[styles.dangerText, { color: colors.danger }]}>
                            {tr("clearChat", "Clear Chat")}
                        </Text>
                    </TouchableOpacity>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

function OptionPill({ label, active, colors, onPress }) {
    return (
        <TouchableOpacity
            style={[
                styles.optionPill,
                {
                    backgroundColor: active ? colors.primary : colors.cardSoft,
                    borderColor: active ? colors.primary : colors.border,
                },
            ]}
            onPress={onPress}
            activeOpacity={0.85}
        >
            <Text
                style={[
                    styles.optionText,
                    { color: active ? colors.darkText : colors.text },
                ]}
            >
                {label}
            </Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
    },

    flex: {
        flex: 1,
    },

    container: {
        flex: 1,
        position: "relative",
    },

    documentPreviewRoot: {
        flex: 1,
    },

    documentPreviewCenter: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 22,
    },

    documentPreviewCard: {
        width: "100%",
        maxWidth: 360,
        borderWidth: 1,
        borderRadius: 28,
        padding: 22,
        alignItems: "center",
    },

    documentPreviewIcon: {
        width: 104,
        height: 104,
        borderRadius: 30,
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 18,
    },

    documentPreviewName: {
        fontSize: 17,
        fontWeight: "900",
        textAlign: "center",
        lineHeight: 23,
    },

    documentPreviewMeta: {
        marginTop: 8,
        fontSize: 13,
        fontWeight: "700",
        textAlign: "center",
    },

    documentPreviewActions: {
        width: "100%",
        marginTop: 22,
        gap: 10,
    },

    documentPreviewButton: {
        flex: 1,
        minWidth: 0,
        height: 50,
        borderRadius: 16,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        paddingHorizontal: 12,
    },

    documentPreviewButtonStacked: {
        width: "100%",
        flex: 0,
    },

    documentPreviewSecondaryButton: {
        backgroundColor: "transparent",
        borderWidth: 1,
    },

    documentPreviewButtonText: {
        fontSize: 15,
        fontWeight: "900",
    },

    documentPreviewSecondaryText: {
        fontSize: 15,
        fontWeight: "900",
    },

    documentPreviewHeader: {
        position: "absolute",
        top: Platform.OS === "ios" ? 58 : 34,
        left: 18,
        right: 18,
        zIndex: 10,
        minHeight: 48,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },

    documentPreviewHeaderButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
    },

    documentPreviewHeaderTextWrapper: {
        flex: 1,
        minWidth: 0,
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 16,
        borderWidth: 1,
    },

    documentPreviewHeaderTitle: {
        fontSize: 14,
        fontWeight: "900",
    },

    documentPreviewHeaderMeta: {
        marginTop: 2,
        fontSize: 11,
        fontWeight: "700",
    },

    documentPreviewBody: {
        flex: 1,
        paddingTop: Platform.OS === "ios" ? 112 : 88,
        paddingHorizontal: 12,
        paddingBottom: Platform.OS === "ios" ? 128 : 112,
        alignItems: "center",
        justifyContent: "center",
    },

    documentInlineImage: {
        width: "100%",
        height: "100%",
        borderRadius: 18,
    },

    documentPreviewLoading: {
        width: "100%",
        maxWidth: 340,
        minHeight: 220,
        borderRadius: 24,
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 22,
    },

    documentPreviewLoadingText: {
        marginTop: 12,
        fontSize: 15,
        fontWeight: "800",
        textAlign: "center",
    },

    documentPreviewBottomBar: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: 18,
        paddingTop: 14,
        paddingBottom: Platform.OS === "ios" ? 34 : 18,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },

    documentPreviewBottomBarStacked: {
        flexDirection: "column",
        alignItems: "stretch",
        paddingHorizontal: 14,
        gap: 8,
    },

    documentPreviewSaveButton: {
        borderWidth: 1,
    },

    messageOptionsOverlay: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 22,
    },

    messageOptionsCard: {
        width: "100%",
        maxWidth: 330,
        borderRadius: 28,
        borderWidth: 1,
        paddingHorizontal: 18,
        paddingTop: 20,
        paddingBottom: 18,
        overflow: "hidden",
    },

    messageOptionsTitle: {
        fontSize: 18,
        fontWeight: "900",
        marginBottom: 10,
    },

    messageOptionsPreview: {
        fontSize: 15,
        lineHeight: 22,
        fontWeight: "600",
        marginBottom: 16,
    },

    messageOptionsButton: {
        minHeight: 50,
        borderRadius: 25,
        alignItems: "center",
        justifyContent: "center",
        marginTop: 8,
        paddingHorizontal: 14,
    },

    messageOptionsButtonText: {
        fontSize: 17,
        fontWeight: "900",
    },

    copyToastWrapper: {
        position: "absolute",
        left: 18,
        right: 18,
        bottom: Platform.OS === "ios" ? 118 : 96,
        alignItems: "center",
        zIndex: 90,
        elevation: 90,
    },

    copyToastBox: {
        minHeight: 42,
        maxWidth: 220,
        borderRadius: 21,
        borderWidth: 1,
        paddingHorizontal: 14,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 7,
    },

    copyToastText: {
        fontSize: 13,
        fontWeight: "900",
    },

    attachmentOverlayRoot: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 50,
        elevation: 50,
    },

    modalOverlay: {
        flex: 1,
        justifyContent: "flex-end",
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 16,
    },

    attachmentCard: {
        width: "100%",
        alignSelf: "stretch",
        borderWidth: 1,
        borderRadius: 26,
        paddingHorizontal: 18,
        paddingTop: 18,
        paddingBottom: 24,
    },

    attachmentCardCompact: {
        paddingHorizontal: 14,
        paddingBottom: 20,
    },

    attachmentHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 18,
    },

    attachmentTitle: {
        flex: 1,
        fontSize: 19,
        fontWeight: "900",
    },

    attachmentGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "space-between",
        rowGap: 16,
        columnGap: 10,
    },

    attachmentItem: {
        width: "48%",
        alignItems: "center",
        gap: 9,
        minWidth: 0,
    },

    attachmentIconCircle: {
        width: 74,
        height: 74,
        borderRadius: 37,
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
    },

    attachmentIconCircleCompact: {
        width: 62,
        height: 62,
        borderRadius: 31,
    },

    attachmentLabel: {
        fontSize: 13,
        fontWeight: "800",
        textAlign: "center",
    },

    attachmentLabelCompact: {
        fontSize: 12,
    },

    menuCard: {
        width: "100%",
        alignSelf: "stretch",
        borderWidth: 1,
        borderRadius: 24,
        padding: 18,
    },

    menuHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 18,
    },

    menuTitle: {
        fontSize: 19,
        fontWeight: "900",
    },

    menuSectionTitle: {
        fontSize: 13,
        fontWeight: "800",
        marginBottom: 8,
        marginTop: 10,
    },

    segmentRow: {
        flexDirection: "row",
        gap: 10,
        marginBottom: 4,
    },

    optionPill: {
        flex: 1,
        borderWidth: 1,
        borderRadius: 14,
        paddingVertical: 12,
        alignItems: "center",
    },

    optionText: {
        fontSize: 14,
        fontWeight: "800",
    },

    dangerRow: {
        marginTop: 12,
        paddingVertical: 14,
        paddingHorizontal: 12,
        borderRadius: 15,
        borderWidth: 1,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },

    dangerText: {
        fontSize: 15,
        fontWeight: "800",
    },
}); 
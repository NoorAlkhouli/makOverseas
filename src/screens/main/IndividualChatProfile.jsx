import { Feather, Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    ActivityIndicator,
    Alert,
    Animated,
    Image,
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
    View,
} from "react-native";

import { appImages } from "@/src/constants/images";
import { LANGUAGE_STORAGE_KEY } from "@/src/i18n";
import chatService from "@/src/services/api/chatService";
import employeeService from "@/src/services/api/employeeService";
import {
    getRowDirectionStyle,
    getTextDirectionStyle,
    getTextInputDirectionFromValue,
} from "@/src/styles/globalStyles";
import { useAppTheme } from "@/src/theme/ThemeProvider";

const CUSTOMER_SEARCH_MIN_LENGTH = 2;
const CUSTOMER_SEARCH_DEBOUNCE_MS = 450;
const CONVERSATION_SEARCH_DEBOUNCE_MS = 450;


const normalizeId = (value) => {
    if (value === undefined || value === null || value === "") {
        return null;
    }

    if (typeof value === "object") {
        return null;
    }

    return String(value);
};

const normalizeBoolean = (value, fallback = false) => {
    if (value === true || value === 1) return true;
    if (value === false || value === 0) return false;

    if (typeof value === "string") {
        const cleanValue = value.trim().toLowerCase();

        if (["1", "true", "yes", "group", "admin", "owner"].includes(cleanValue)) {
            return true;
        }

        if (["0", "false", "no", "direct", "member"].includes(cleanValue)) {
            return false;
        }
    }

    return fallback;
};

const getNestedValue = (object, paths = [], fallback = null) => {
    if (!object || typeof object !== "object") {
        return fallback;
    }

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

const getSafeText = (value, fallback = "") => {
    if (value === undefined || value === null || value === "") {
        return fallback;
    }

    if (typeof value === "object") {
        return String(
            value?.name ||
            value?.title ||
            value?.full_name ||
            value?.description ||
            fallback ||
            ""
        );
    }

    return String(value);
};

const normalizeAvatarUrl = (value) => {
    if (!value) return null;

    if (typeof value === "string") {
        const cleanValue = value.trim();
        return cleanValue.length > 0 ? cleanValue : null;
    }

    if (typeof value === "object") {
        return normalizeAvatarUrl(
            value.url ||
            value.path ||
            value.src ||
            value.full_url ||
            value.fullUrl ||
            value.preview_url ||
            value.previewUrl
        );
    }

    return null;
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

const getCurrentUserIdFromProfile = (profile) => {
    return normalizeId(
        profile?.id ||
        profile?.user_id ||
        profile?.userId ||
        profile?.user?.id ||
        profile?.profile?.id ||
        profile?.profile?.user_id ||
        profile?.profile?.userId ||
        null
    );
};

const normalizeProfileRoleValue = (role) => {
    if (role === undefined || role === null || role === "") {
        return null;
    }

    if (typeof role === "object") {
        return normalizeProfileRoleValue(
            role.value ||
            role.id ||
            role.key ||
            role.name ||
            role.slug ||
            role.title ||
            role.label
        );
    }

    const roleText = String(role).trim().toLowerCase();
    const numericRole = Number(roleText);

    if ([1, 2, 3].includes(numericRole)) {
        return numericRole;
    }

    if (roleText.includes("admin")) return 3;
    if (roleText.includes("employee") || roleText.includes("staff") || roleText.includes("agent")) return 2;
    if (roleText.includes("customer") || roleText.includes("client")) return 1;

    return null;
};

const getCurrentUserRoleFromProfile = (profile) => {
    return normalizeProfileRoleValue(
        profile?.role?.value ??
        profile?.role?.id ??
        profile?.role_id ??
        profile?.roleId ??
        profile?.role ??
        profile?.user?.role?.value ??
        profile?.user?.role?.id ??
        profile?.user?.role_id ??
        profile?.user?.roleId ??
        profile?.user?.role ??
        profile?.profile?.role?.value ??
        profile?.profile?.role?.id ??
        profile?.profile?.role_id ??
        profile?.profile?.roleId ??
        profile?.profile?.role ??
        null
    );
};

const getConversationPayload = (response) => {
    const payload = response?.data || response || {};

    return (
        payload?.data?.conversation ||
        payload?.conversation ||
        payload?.data?.item ||
        payload?.item ||
        payload?.data ||
        payload ||
        null
    );
};

const getConversationParticipants = (conversation) => {
    const candidates = [
        conversation?.participants,
        conversation?.members,
        conversation?.users,
        conversation?.conversation_participants,
        conversation?.conversationParticipants,
        conversation?.data?.participants,
        conversation?.data?.members,
        conversation?.data?.users,
    ];

    return candidates.filter(Array.isArray).flat();
};

const getParticipantUserId = (participant) => {
    return normalizeId(
        participant?.user_id ||
        participant?.userId ||
        participant?.user?.id ||
        participant?.profile?.user_id ||
        participant?.profile?.id ||
        participant?.id ||
        null
    );
};

const getParticipantRoleValue = (participant) => {
    const rawRole =
        participant?.participant_role?.value ??
        participant?.participantRole?.value ??
        participant?.role?.value ??
        participant?.role_id ??
        participant?.roleId ??
        participant?.participant_role ??
        participant?.participantRole ??
        participant?.role ??
        null;

    const numericRole = Number(rawRole);

    if ([1, 2, 3].includes(numericRole)) {
        return numericRole;
    }

    const roleText = String(
        rawRole ||
        participant?.role?.label ||
        participant?.role?.name ||
        participant?.participant_role?.label ||
        participant?.participantRole?.label ||
        ""
    )
        .trim()
        .toLowerCase();

    if (roleText.includes("owner")) return 3;
    if (roleText.includes("admin")) return 2;

    return 1;
};

const isParticipantCurrentUser = (participant, currentUserId) => {
    const participantUserId = getParticipantUserId(participant);

    return !!(
        participant?.is_me === true ||
        participant?.isMe === true ||
        participant?.me === true ||
        participant?.user?.is_me === true ||
        participant?.user?.isMe === true ||
        (
            participantUserId &&
            currentUserId &&
            String(participantUserId) === String(currentUserId)
        )
    );
};

const canCurrentUserManageGroup = ({
    conversation,
    participants = [],
    currentUserId,
    currentUserRole,
}) => {
    const directCanManage = normalizeBoolean(
        conversation?.can_manage_group ??
        conversation?.canManageGroup ??
        conversation?.permissions?.can_manage_group ??
        conversation?.permissions?.canManageGroup ??
        conversation?.permissions?.manage_group ??
        conversation?.abilities?.can_manage_group ??
        conversation?.meta?.can_manage_group,
        false
    );

    if (directCanManage) {
        return true;
    }

    const currentParticipant = participants.find((participant) =>
        isParticipantCurrentUser(participant, currentUserId)
    );

    const currentRole = getParticipantRoleValue(currentParticipant);

    return currentRole === 2 || currentRole === 3;
};

const getParticipantDisplayName = (participant, fallback = "Member") => {
    return getSafeText(
        getNestedValue(participant, [
            "full_name",
            "fullName",
            "name",
            "display_name",
            "displayName",
            "user.full_name",
            "user.fullName",
            "user.name",
            "user.display_name",
            "profile.full_name",
            "profile.fullName",
            "profile.name",
        ], fallback),
        fallback
    );
};

const getParticipantSubtitle = (participant, isArabic) => {
    const roleValue = getParticipantRoleValue(participant);

    if (roleValue === 3) {
        return isArabic ? "مالك الغروب" : "Group owner";
    }

    if (roleValue === 2) {
        return isArabic ? "مشرف" : "Admin";
    }

    return getSafeText(
        getNestedValue(participant, [
            "department.name",
            "department.title",
            "department_name",
            "user.department.name",
            "user.department.title",
            "phone",
            "phone_number",
            "user.phone",
        ], isArabic ? "عضو" : "Member"),
        isArabic ? "عضو" : "Member"
    );
};

const getParticipantAvatar = (participant) => {
    const avatarPaths = [
        "avatar",
        "avatar_url",
        "avatarUrl",
        "image",
        "photo",
        "user.avatar",
        "user.avatar_url",
        "user.avatarUrl",
        "user.image",
        "user.photo",
        "profile.avatar",
        "profile.avatar_url",
        "profile.avatarUrl",
    ];

    for (const path of avatarPaths) {
        const avatar = normalizeAvatarUrl(getNestedValue(participant, [path], null));

        if (avatar) {
            return avatar;
        }
    }

    return null;
};

const getInitials = (name = "") => {
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

const normalizeMemberCandidate = (item, type = "employee", isArabic = false) => {
    const userId = normalizeId(
        item?.user_id ||
        item?.userId ||
        item?.user?.id ||
        item?.profile?.user_id ||
        item?.profile?.id ||
        item?.id
    );

    if (!userId) {
        return null;
    }

    const name = getSafeText(
        getNestedValue(item, [
            "full_name",
            "fullName",
            "name",
            "display_name",
            "displayName",
            "user.full_name",
            "user.fullName",
            "user.name",
            "profile.full_name",
            "profile.fullName",
            "profile.name",
        ], type === "customer" ? (isArabic ? "عميل" : "Customer") : (isArabic ? "موظف" : "Employee"))
    );

    const subtitle = getSafeText(
        getNestedValue(item, [
            "department.name",
            "department.title",
            "department_name",
            "department",
            "phone",
            "phone_number",
            "phoneNumber",
            "mobile",
            "user.phone",
            "user.phone_number",
            "profile.phone",
        ], type === "customer" ? (isArabic ? "عميل" : "Customer") : (isArabic ? "موظف" : "Employee"))
    );

    return {
        key: `${type}-${userId}`,
        id: userId,
        userId,
        type,
        name,
        subtitle,
        avatar: getParticipantAvatar(item),
        raw: item,
    };
};

const getItemsFromResponse = (response) => {
    const data =
        response?.data?.data ||
        response?.data?.items ||
        response?.data?.employees ||
        response?.data?.customers ||
        response?.data ||
        response?.items ||
        response?.employees ||
        response?.customers ||
        response;

    if (!Array.isArray(data)) {
        return [];
    }

    const flattenedItems = [];

    data.forEach((item) => {
        const nestedItems =
            item?.employees ||
            item?.users ||
            item?.members ||
            item?.items ||
            item?.data ||
            null;

        if (Array.isArray(nestedItems)) {
            nestedItems.forEach((nestedItem) => {
                flattenedItems.push({
                    ...nestedItem,
                    department:
                        nestedItem?.department ||
                        item?.department ||
                        {
                            id: item?.id,
                            name: item?.name || item?.title,
                            description: item?.description,
                        },
                });
            });
        } else {
            flattenedItems.push(item);
        }
    });

    return flattenedItems;
};

const uniqueMembers = (members = []) => {
    const seenIds = new Set();

    return members.filter((member) => {
        if (!member?.userId) {
            return false;
        }

        const key = String(member.userId);

        if (seenIds.has(key)) {
            return false;
        }

        seenIds.add(key);
        return true;
    });
};

const getUserSearchItemsFromResponse = (response) => {
    const payload = response?.data?.data || response?.data || response || {};

    const groups = [
        { type: "admin", source: payload?.admins },
        { type: "employee", source: payload?.employees },
        { type: "customer", source: payload?.customers },
    ];

    return groups.flatMap(({ type, source }) => {
        const items = Array.isArray(source?.items)
            ? source.items
            : Array.isArray(source)
                ? source
                : [];

        return items.map((item) => ({
            ...item,
            user_search_type: type,
            type,
        }));
    });
};

const searchUsersForGroupMembers = async (query) => {
    const cleanQuery = String(query || "").trim();

    if (!cleanQuery) {
        return [];
    }

    const response = await chatService.searchUsers(cleanQuery, {
        per_group: 10,
    });

    return getUserSearchItemsFromResponse(response);
};

const filterOutExistingMembers = ({ members = [], participants = [], currentUserId = null }) => {
    const blockedIds = new Set(
        participants
            .map((participant) => getParticipantUserId(participant))
            .filter(Boolean)
            .map(String)
    );

    if (currentUserId) {
        blockedIds.add(String(currentUserId));
    }

    return members.filter((member) => !blockedIds.has(String(member?.userId)));
};


const getResponseItems = (response) => {
    const payload = response?.data || response || {};
    const candidates = [
        payload?.data?.items,
        payload?.data?.data,
        payload?.data?.messages,
        payload?.data?.media,
        payload?.data,
        payload?.items,
        payload?.messages,
        payload?.media,
        payload,
    ];

    const items = candidates.find(Array.isArray);
    return Array.isArray(items) ? items : [];
};

const formatRoleLabel = (role, isArabic) => {
    const roleValue = normalizeProfileRoleValue(role);

    if (roleValue === 3) return isArabic ? "مدير" : "Admin";
    if (roleValue === 2) return isArabic ? "موظف" : "Employee";
    if (roleValue === 1) return isArabic ? "عميل" : "Customer";

    return getSafeText(
        role?.label || role?.name || role?.title || role,
        isArabic ? "مستخدم" : "User"
    );
};

const formatStatusLabel = (status, isArabic) => {
    const rawStatus = typeof status === "object"
        ? status?.value ?? status?.id ?? status?.key ?? status?.name ?? status?.label
        : status;
    const numericStatus = Number(rawStatus);
    const statusText = String(rawStatus || status?.label || status?.name || "").trim().toLowerCase();

    if (numericStatus === 1 || statusText.includes("pending")) return isArabic ? "بانتظار الموافقة" : "Pending";
    if (numericStatus === 2 || statusText.includes("approved") || statusText.includes("active")) return isArabic ? "موافق عليه" : "Approved";
    if (numericStatus === 3 || statusText.includes("blocked")) return isArabic ? "محظور" : "Blocked";
    if (numericStatus === 4 || statusText.includes("deleted")) return isArabic ? "محذوف" : "Deleted";

    return getSafeText(status?.label || status?.name || status, "");
};

const formatDateText = (value) => {
    if (!value) return "";

    try {
        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return String(value);
        }

        return date.toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
        });
    } catch (error) {
        return String(value);
    }
};

const getDirectParticipantFromConversation = ({ conversation, currentUserId, targetUserId }) => {
    const participants = getConversationParticipants(conversation);
    const normalizedTargetId = normalizeId(
        targetUserId ||
        conversation?.target_user_id ||
        conversation?.targetUserId ||
        conversation?.other_user_id ||
        conversation?.otherUserId
    );

    if (normalizedTargetId) {
        const targetParticipant = participants.find((participant) =>
            String(getParticipantUserId(participant)) === String(normalizedTargetId)
        );

        if (targetParticipant) {
            return targetParticipant;
        }
    }

    return participants.find((participant) =>
        !isParticipantCurrentUser(participant, currentUserId)
    ) || null;
};

const normalizeDirectProfile = ({ conversation, participant, routeProfile, data, isArabic }) => {
    const source = participant?.user || participant?.profile || participant || {};
    const conversationName = getSafeText(
        conversation?.display_name || conversation?.title || conversation?.name,
        ""
    );
    const name = getSafeText(
        source?.full_name ||
        source?.fullName ||
        source?.name ||
        source?.display_name ||
        source?.displayName ||
        participant?.full_name ||
        participant?.name ||
        routeProfile?.name ||
        conversationName ||
        data.name,
        isArabic ? "مستخدم" : "User"
    );
    const phone = getSafeText(
        source?.phone_e164 ||
        source?.phoneE164 ||
        source?.phone ||
        source?.phone_number ||
        source?.phoneNumber ||
        participant?.phone_e164 ||
        participant?.phone ||
        routeProfile?.phone ||
        routeProfile?.phone_e164,
        ""
    );
    const role =
        source?.role ??
        source?.role_id ??
        source?.roleId ??
        participant?.role ??
        participant?.role_id ??
        participant?.roleId ??
        routeProfile?.role ??
        routeProfile?.role_id ??
        null;
    const status =
        source?.status ??
        source?.status_id ??
        source?.statusId ??
        participant?.status ??
        participant?.status_id ??
        participant?.statusId ??
        routeProfile?.status ??
        routeProfile?.status_id ??
        null;
    const department = getSafeText(
        source?.department?.name ||
        source?.department?.title ||
        source?.department_name ||
        source?.departmentName ||
        participant?.department?.name ||
        participant?.department?.title ||
        participant?.department_name ||
        routeProfile?.department,
        formatRoleLabel(role, isArabic)
    );

    return {
        id: normalizeId(source?.id || source?.user_id || participant?.user_id || data.targetUserId),
        name,
        initials: getInitials(name),
        avatar: getParticipantAvatar(participant) || normalizeAvatarUrl(source?.avatar || source?.avatar_url || routeProfile?.avatar || data.avatar),
        phone,
        roleLabel: formatRoleLabel(role, isArabic),
        statusLabel: formatStatusLabel(status, isArabic),
        approvedAt: formatDateText(source?.approved_at || source?.approvedAt || participant?.approved_at || routeProfile?.approved_at),
        department,
    };
};

const getAttachmentFromItem = (item) => {
    const attachments = Array.isArray(item?.attachments)
        ? item.attachments
        : Array.isArray(item?.message?.attachments)
            ? item.message.attachments
            : [];

    return item?.attachment || item?.file || item?.media || attachments[0] || item;
};

const getMediaUri = (item) => {
    const attachment = getAttachmentFromItem(item);

    return normalizeAvatarUrl(
        attachment?.url ||
        attachment?.full_url ||
        attachment?.fullUrl ||
        attachment?.preview_url ||
        attachment?.previewUrl ||
        attachment?.thumbnail_url ||
        attachment?.thumbnailUrl ||
        attachment?.path ||
        item?.url ||
        item?.full_url ||
        item?.preview_url
    );
};

const getItemFileName = (item, fallback = "Attachment") => {
    const attachment = getAttachmentFromItem(item);

    return getSafeText(
        attachment?.file_name ||
        attachment?.filename ||
        attachment?.name ||
        attachment?.original_name ||
        attachment?.title ||
        item?.file_name ||
        item?.filename ||
        item?.title ||
        item?.body,
        fallback
    );
};

const getItemSubtitle = (item, fallback = "") => {
    const attachment = getAttachmentFromItem(item);
    const size = attachment?.size || attachment?.size_bytes || attachment?.sizeBytes;
    const duration = attachment?.duration || attachment?.duration_seconds || attachment?.durationSeconds;

    if (duration) return `${duration}s`;
    if (size) return `${size}`;

    return getSafeText(
        item?.created_at || item?.createdAt || item?.sent_at || item?.sentAt,
        fallback
    );
};

const normalizeGalleryMediaItem = (item, index) => {
    const attachment = getAttachmentFromItem(item);
    const uri = getMediaUri(item);
    const rawType = String(
        attachment?.type ||
        attachment?.mime_type ||
        attachment?.mimeType ||
        item?.type ||
        item?.message_type ||
        ""
    ).toLowerCase();
    const type = rawType.includes("video") || Number(rawType) === 4 || Number(rawType) === 2
        ? "video"
        : "image";

    return {
        key: String(item?.id || attachment?.id || `media-${index}`),
        type,
        image: uri ? { uri } : null,
        title: getItemFileName(item, type === "video" ? "Video" : "Image"),
        subtitle: getItemSubtitle(item, ""),
        raw: item,
    };
};

const normalizeListAttachmentItem = (item, index, type, isArabic) => {
    const defaultTitle = type === "audio"
        ? isArabic ? "رسالة صوتية" : "Voice message"
        : type === "quote"
            ? isArabic ? "عرض سعر" : "Quote"
            : isArabic ? "ملف" : "File";

    return {
        key: String(item?.id || getAttachmentFromItem(item)?.id || `${type}-${index}`),
        icon: type === "audio" ? "mic" : type === "quote" ? "file-text" : "file",
        title: getItemFileName(item, defaultTitle),
        subtitle: getItemSubtitle(item, ""),
        raw: item,
    };
};

const normalizeSearchMessageItem = (item, index, isArabic) => {
    const attachment = getAttachmentFromItem(item);
    const title = getSafeText(
        item?.sender?.full_name ||
        item?.sender?.name ||
        item?.user?.full_name ||
        item?.user?.name ||
        item?.author?.full_name ||
        item?.author?.name,
        isArabic ? "رسالة" : "Message"
    );
    const subtitle = getSafeText(
        item?.body ||
        item?.text ||
        item?.message ||
        attachment?.file_name ||
        attachment?.filename ||
        item?.quote?.route ||
        item?.quote?.commodity,
        isArabic ? "نتيجة بحث" : "Search result"
    );

    return {
        key: String(item?.id || `search-${index}`),
        icon: attachment?.id ? "paperclip" : "message-circle",
        title,
        subtitle,
        raw: item,
    };
};

const callListConversationMedia = async (conversationId, params = {}) => {
    if (typeof chatService.listConversationMedia === "function") {
        return chatService.listConversationMedia(conversationId, params);
    }

    if (typeof chatService.getConversationMedia === "function") {
        return chatService.getConversationMedia(conversationId, params);
    }

    if (typeof chatService.listMedia === "function") {
        return chatService.listMedia(conversationId, params);
    }

    throw new Error("chatService.listConversationMedia is missing");
};

const callSearchConversationMessages = async (conversationId, params = {}) => {
    if (typeof chatService.searchConversationMessages === "function") {
        return chatService.searchConversationMessages(conversationId, params);
    }

    if (typeof chatService.searchMessages === "function") {
        return chatService.searchMessages(conversationId, params);
    }

    throw new Error("chatService.searchConversationMessages is missing");
};

export default function IndividualChatProfile({ navigation, route }) {
    const { t, i18n } = useTranslation();
    const {
        colors: appColors,
        isDark,
        toggleTheme,
        setThemeMode,
        changeTheme,
    } = useAppTheme();

    const isArabic = i18n.language === "ar" || i18n.language?.startsWith("ar");
    const searchInputRef = useRef(null);
    const scrollRef = useRef(null);
    const addMemberSearchTimerRef = useRef(null);
    const conversationSearchTimerRef = useRef(null);
    const scrollY = useRef(new Animated.Value(0)).current;

    const [activeTab, setActiveTab] = useState("media");
    const [menuOpen, setMenuOpen] = useState(false);
    const [searchVisible, setSearchVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [currentUserId, setCurrentUserId] = useState(null);
    const [currentUserRole, setCurrentUserRole] = useState(null);
    const [groupConversation, setGroupConversation] = useState(null);
    const [groupParticipants, setGroupParticipants] = useState([]);
    const [isLoadingGroup, setIsLoadingGroup] = useState(false);
    const [isMutatingGroup, setIsMutatingGroup] = useState(false);
    const [addMembersVisible, setAddMembersVisible] = useState(false);
    const [addMemberSearch, setAddMemberSearch] = useState("");
    const [employeeCandidates, setEmployeeCandidates] = useState([]);
    const [customerCandidates, setCustomerCandidates] = useState([]);
    const [selectedNewMembers, setSelectedNewMembers] = useState([]);
    const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);
    const [isSearchingCustomers, setIsSearchingCustomers] = useState(false);
    const [addMemberError, setAddMemberError] = useState("");
    const [directConversation, setDirectConversation] = useState(null);
    const [isLoadingDirectProfile, setIsLoadingDirectProfile] = useState(false);
    const [directMediaItems, setDirectMediaItems] = useState([]);
    const [directFiles, setDirectFiles] = useState([]);
    const [directVoice, setDirectVoice] = useState([]);
    const [directQuotes, setDirectQuotes] = useState([]);
    const [isLoadingShared, setIsLoadingShared] = useState(false);
    const [sharedError, setSharedError] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [isSearchingMessages, setIsSearchingMessages] = useState(false);

    const profile = route?.params?.profile || {};

    const data = {
        conversationId: route?.params?.conversationId || profile.conversationId || null,
        targetUserId:
            route?.params?.targetUserId ||
            route?.params?.target_user_id ||
            profile.targetUserId ||
            profile.target_user_id ||
            null,
        initials: profile.initials || getInitials(profile.name || profile.full_name || ""),
        avatar: profile.avatar || profile.avatar_url || null,
        name: profile.name || profile.full_name || profile.display_name || "MAK Overseas User",
        department: profile.department || profile.role_label || "",
        isGroup: normalizeBoolean(
            profile.isGroup ??
            profile.is_group ??
            route?.params?.isGroup ??
            route?.params?.is_group,
            false
        ),
        participantCount: Number(profile.participantCount || profile.groupParticipantsCount || 0),
        isBlocked: !!profile.isBlocked,
        isOnline: profile.isOnline === true,
        isTyping: profile.isTyping === true,
        isRecordingVoice: profile.isRecordingVoice === true,
        presenceText: profile.presenceText || "",
        lastSeenAt: profile.lastSeenAt || null,
        phone: profile.phone || profile.phone_e164 || "",
    };

    const isGroupProfile = data.isGroup === true;

    const colors = useMemo(
        () => ({
            background: appColors.background,
            card: appColors.card,
            cardSoft: appColors.cardSoft,
            cardStrong: appColors.cardStrong,
            inputBackground: appColors.inputBackground,
            inputBorder: appColors.inputBorder,
            text: appColors.textPrimary,
            textSecondary: appColors.textSecondary,
            textMuted: appColors.textMuted,
            darkText: appColors.darkText,
            border: appColors.border,
            borderSoft: appColors.borderSoft,
            borderLight: appColors.borderLight,
            primary: appColors.primary,
            primarySoft: appColors.primarySoft,
            blue: appColors.blue,
            blueSoft: appColors.blueSoft,
            blueBorder: appColors.blueBorder,
            buttonSoft: appColors.buttonSoft,
            avatarBackground: appColors.avatarBackground,
            avatarBorder: appColors.avatarBorder,
            success: appColors.success,
            warning: appColors.warning,
            danger: appColors.danger,
            overlay: appColors.overlay,
        }),
        [appColors]
    );

    const styles = useMemo(() => createStyles(colors), [colors]);

    const groupTitle =
        groupConversation?.display_name ||
        groupConversation?.title ||
        groupConversation?.name ||
        data.name;

    const directParticipant = useMemo(
        () => getDirectParticipantFromConversation({
            conversation: directConversation || route?.params?.conversation || {},
            currentUserId,
            targetUserId: data.targetUserId,
        }),
        [currentUserId, data.targetUserId, directConversation, route?.params?.conversation]
    );

    const directProfile = useMemo(
        () => normalizeDirectProfile({
            conversation: directConversation || route?.params?.conversation || {},
            participant: directParticipant,
            routeProfile: profile,
            data,
            isArabic,
        }),
        [data, directConversation, directParticipant, isArabic, profile, route?.params?.conversation]
    );

    const profileTitle = isGroupProfile ? groupTitle : directProfile.name;
    const profileSubtitle = isGroupProfile
        ? t("chatProfile.groupChat", "Group chat")
        : directProfile.department;

    const displayedParticipantsCount = groupParticipants.length || data.participantCount || 0;

    const myGroupParticipant = useMemo(() => {
        if (!isGroupProfile) {
            return null;
        }

        return groupParticipants.find((participant) =>
            isParticipantCurrentUser(participant, currentUserId)
        ) || null;
    }, [currentUserId, groupParticipants, isGroupProfile]);

    const canManageGroup = useMemo(
        () =>
            isGroupProfile &&
            canCurrentUserManageGroup({
                conversation: groupConversation || route?.params?.conversation || {},
                participants: groupParticipants,
                currentUserId,
                currentUserRole,
            }),
        [currentUserId, currentUserRole, groupConversation, groupParticipants, isGroupProfile, route?.params?.conversation]
    );

    useEffect(() => {
        if (!isGroupProfile) {
            return;
        }

        console.log("[GROUP PROFILE PERMISSION DEBUG]", {
            conversationId: data.conversationId,
            currentUserId,
            currentUserRole,
            canManageGroup,
            myParticipant: myGroupParticipant
                ? {
                    id: myGroupParticipant?.id,
                    user_id: myGroupParticipant?.user_id,
                    userId: myGroupParticipant?.userId,
                    normalizedUserId: getParticipantUserId(myGroupParticipant),
                    role: myGroupParticipant?.role,
                    role_id: myGroupParticipant?.role_id,
                    roleId: myGroupParticipant?.roleId,
                    participant_role: myGroupParticipant?.participant_role,
                    participantRole: myGroupParticipant?.participantRole,
                    roleValue: getParticipantRoleValue(myGroupParticipant),
                    is_admin: myGroupParticipant?.is_admin,
                    is_owner: myGroupParticipant?.is_owner,
                    is_me: myGroupParticipant?.is_me,
                    isMe: myGroupParticipant?.isMe,
                    user: {
                        id: myGroupParticipant?.user?.id,
                        role: myGroupParticipant?.user?.role,
                        role_id: myGroupParticipant?.user?.role_id,
                        roleId: myGroupParticipant?.user?.roleId,
                        full_name: myGroupParticipant?.user?.full_name,
                        name: myGroupParticipant?.user?.name,
                    },
                }
                : null,
            participantsCount: groupParticipants.length,
        });
    }, [
        canManageGroup,
        currentUserId,
        currentUserRole,
        data.conversationId,
        groupParticipants.length,
        isGroupProfile,
        myGroupParticipant,
    ]);

    const statusText = isGroupProfile
        ? displayedParticipantsCount > 0
            ? isArabic
                ? `${displayedParticipantsCount} أعضاء`
                : `${displayedParticipantsCount} members`
            : t("chatProfile.groupChat", "Group chat")
        : data.isBlocked
            ? t("blocked", "Blocked")
            : data.isRecordingVoice
                ? t("recordingNow", "Recording...")
                : data.isTyping
                    ? t("typingNow", "Typing...")
                    : data.presenceText || (data.isOnline
                        ? t("onlineNow", "Online now")
                        : t("offline", "Offline"));

    const statusColor = data.isBlocked
        ? colors.danger
        : data.isOnline || data.isTyping || data.isRecordingVoice || isGroupProfile
            ? colors.primary
            : colors.textMuted;

    const headerTitleOpacity = scrollY.interpolate({
        inputRange: [80, 145],
        outputRange: [0, 1],
        extrapolate: "clamp",
    });

    const headerTitleTranslateY = scrollY.interpolate({
        inputRange: [80, 145],
        outputRange: [10, 0],
        extrapolate: "clamp",
    });

    const tabs = isGroupProfile
        ? [
            { key: "media", label: t("chatProfile.media", "Media") },
            { key: "files", label: t("chatProfile.files", "Files") },
            { key: "links", label: t("chatProfile.links", "Links") },
            { key: "voice", label: t("chatProfile.voice", "Voice") },
        ]
        : [
            { key: "media", label: t("chatProfile.media", "Media") },
            { key: "files", label: t("chatProfile.files", "Files") },
            { key: "voice", label: t("chatProfile.voice", "Voice") },
            { key: "quotes", label: isArabic ? "العروض" : "Quotes" },
        ];

    const fallbackGroupMediaItems = [
        {
            key: "ship",
            type: "image",
            image: appImages.homeShipSea,
        },
        {
            key: "document",
            type: "file",
            image: appImages.homeCargoMini || appImages.homeContainers,
        },
        {
            key: "chat",
            type: "chat",
        },
        {
            key: "truck",
            type: "video",
            image: appImages.homeAirTruck || appImages.homeContainers,
        },
    ];

    const fallbackGroupFiles = [
        {
            key: "file-1",
            icon: "file-text",
            title: "Shipping Document",
            subtitle: "MAK-2025-0614.pdf",
        },
        {
            key: "file-2",
            icon: "file",
            title: "Invoice File",
            subtitle: "invoice_0614.pdf",
        },
    ];

    const fallbackGroupLinks = [
        {
            key: "link-1",
            icon: "link",
            title: "mak-overseas.com",
            subtitle: "Company website",
        },
        {
            key: "link-2",
            icon: "external-link",
            title: "Shipment tracking",
            subtitle: "Tracking link",
        },
    ];

    const fallbackGroupVoice = [
        {
            key: "voice-1",
            icon: "mic",
            title: "Voice message",
            subtitle: "0:18",
        },
        {
            key: "voice-2",
            icon: "mic",
            title: "Voice message",
            subtitle: "0:34",
        },
    ];

    const mediaItems = isGroupProfile ? fallbackGroupMediaItems : directMediaItems;
    const files = isGroupProfile ? fallbackGroupFiles : directFiles;
    const links = isGroupProfile ? fallbackGroupLinks : [];
    const voice = isGroupProfile ? fallbackGroupVoice : directVoice;
    const quotes = directQuotes;
    const filteredSearchResults = searchResults;

    const memberCandidates = useMemo(() => {
        return filterOutExistingMembers({
            members: uniqueMembers([...employeeCandidates, ...customerCandidates]),
            participants: groupParticipants,
            currentUserId,
        });
    }, [currentUserId, employeeCandidates, customerCandidates, groupParticipants]);

    const selectedNewMemberIds = useMemo(
        () => new Set(selectedNewMembers.map((member) => String(member.userId))),
        [selectedNewMembers]
    );

    const refreshDirectConversation = async () => {
        if (isGroupProfile || !data.conversationId) {
            return;
        }

        try {
            setIsLoadingDirectProfile(true);

            const response = await chatService.showConversation(data.conversationId, {
                page: 1,
                per_page: 1,
            });
            const conversation = getConversationPayload(response);

            setDirectConversation(conversation || null);
        } catch (error) {
            console.log("Load direct profile conversation error:", error?.raw || error);
            setDirectConversation(null);
        } finally {
            setIsLoadingDirectProfile(false);
        }
    };

    const loadDirectSharedItems = async () => {
        const conversationId = normalizeId(data.conversationId);

        if (isGroupProfile || !conversationId) {
            return;
        }

        try {
            setIsLoadingShared(true);
            setSharedError("");

            const [mediaResponse, fileResponse, audioResponse, quoteResponse] = await Promise.all([
                callListConversationMedia(conversationId, { filter: "media", page: 1, per_page: 30 }),
                callListConversationMedia(conversationId, { filter: "file", page: 1, per_page: 30 }),
                callListConversationMedia(conversationId, { filter: "audio", page: 1, per_page: 30 }),
                callListConversationMedia(conversationId, { filter: "quote", page: 1, per_page: 30 }),
            ]);

            setDirectMediaItems(
                getResponseItems(mediaResponse).map((item, index) =>
                    normalizeGalleryMediaItem(item, index)
                )
            );
            setDirectFiles(
                getResponseItems(fileResponse).map((item, index) =>
                    normalizeListAttachmentItem(item, index, "file", isArabic)
                )
            );
            setDirectVoice(
                getResponseItems(audioResponse).map((item, index) =>
                    normalizeListAttachmentItem(item, index, "audio", isArabic)
                )
            );
            setDirectQuotes(
                getResponseItems(quoteResponse).map((item, index) =>
                    normalizeListAttachmentItem(item, index, "quote", isArabic)
                )
            );
        } catch (error) {
            console.log("Load direct shared items error:", error?.raw || error);
            setDirectMediaItems([]);
            setDirectFiles([]);
            setDirectVoice([]);
            setDirectQuotes([]);
            setSharedError(
                error?.userMessage ||
                (isArabic ? "تعذر تحميل الملفات المشتركة." : "Could not load shared items.")
            );
        } finally {
            setIsLoadingShared(false);
        }
    };

    const refreshGroupConversation = async () => {
        if (!isGroupProfile || !data.conversationId) {
            return;
        }

        try {
            setIsLoadingGroup(true);

            const response = await chatService.showConversation(data.conversationId, {
                page: 1,
                per_page: 1,
            });
            const conversation = getConversationPayload(response);
            const participants = getConversationParticipants(conversation);
            const debugCurrentParticipant = participants.find((participant) =>
                isParticipantCurrentUser(participant, currentUserId)
            ) || null;

            console.log("[GROUP PROFILE DEBUG] conversation loaded:", {
                conversationId: data.conversationId,
                currentUserId,
                currentUserRole,
                conversation: {
                    id: conversation?.id,
                    type: conversation?.type,
                    is_group: conversation?.is_group,
                    isGroup: conversation?.isGroup,
                    title: conversation?.title,
                    name: conversation?.name,
                    can_manage_group: conversation?.can_manage_group,
                    canManageGroup: conversation?.canManageGroup,
                    permissions: conversation?.permissions,
                    abilities: conversation?.abilities,
                    meta: conversation?.meta,
                },
                myParticipant: debugCurrentParticipant
                    ? {
                        id: debugCurrentParticipant?.id,
                        user_id: debugCurrentParticipant?.user_id,
                        userId: debugCurrentParticipant?.userId,
                        normalizedUserId: getParticipantUserId(debugCurrentParticipant),
                        role: debugCurrentParticipant?.role,
                        role_id: debugCurrentParticipant?.role_id,
                        roleId: debugCurrentParticipant?.roleId,
                        participant_role: debugCurrentParticipant?.participant_role,
                        participantRole: debugCurrentParticipant?.participantRole,
                        roleValue: getParticipantRoleValue(debugCurrentParticipant),
                        is_admin: debugCurrentParticipant?.is_admin,
                        is_owner: debugCurrentParticipant?.is_owner,
                        is_me: debugCurrentParticipant?.is_me,
                        isMe: debugCurrentParticipant?.isMe,
                        user: {
                            id: debugCurrentParticipant?.user?.id,
                            role: debugCurrentParticipant?.user?.role,
                            role_id: debugCurrentParticipant?.user?.role_id,
                            roleId: debugCurrentParticipant?.user?.roleId,
                            full_name: debugCurrentParticipant?.user?.full_name,
                            name: debugCurrentParticipant?.user?.name,
                        },
                    }
                    : null,
                participants: participants.map((item) => ({
                    id: item?.id,
                    user_id: item?.user_id,
                    userId: item?.userId,
                    normalizedUserId: getParticipantUserId(item),
                    role: item?.role,
                    role_id: item?.role_id,
                    roleId: item?.roleId,
                    participant_role: item?.participant_role,
                    participantRole: item?.participantRole,
                    roleValue: getParticipantRoleValue(item),
                    is_admin: item?.is_admin,
                    is_owner: item?.is_owner,
                    is_me: item?.is_me,
                    isMe: item?.isMe,
                    user: {
                        id: item?.user?.id,
                        role: item?.user?.role,
                        role_id: item?.user?.role_id,
                        roleId: item?.user?.roleId,
                        full_name: item?.user?.full_name,
                        name: item?.user?.name,
                    },
                })),
                rawResponse: response,
            });

            setGroupConversation(conversation || null);
            setGroupParticipants(participants);
        } catch (error) {
            console.log("Load group profile conversation error:", error?.raw || error);
        } finally {
            setIsLoadingGroup(false);
        }
    };

    useEffect(() => {
        let isMounted = true;

        const loadCurrentProfile = async () => {
            try {
                const response = await chatService.getProfile();
                const profilePayload = getProfilePayload(response);
                const profileUserId = getCurrentUserIdFromProfile(profilePayload);
                const profileRole = getCurrentUserRoleFromProfile(profilePayload);

                console.log("[GROUP PROFILE CURRENT USER DEBUG]", {
                    profileUserId,
                    profileRole,
                    profilePayload,
                });

                if (isMounted) {
                    setCurrentUserId(profileUserId);
                    setCurrentUserRole(profileRole);
                }
            } catch (error) {
                console.log("Load profile in chat profile error:", error?.raw || error);

                if (isMounted) {
                    setCurrentUserId(null);
                    setCurrentUserRole(null);
                }
            }
        };

        loadCurrentProfile();

        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        refreshGroupConversation();
        refreshDirectConversation();
    }, [isGroupProfile, data.conversationId, currentUserId]);

    useEffect(() => {
        loadDirectSharedItems();
    }, [isGroupProfile, data.conversationId, isArabic]);

    useEffect(() => {
        if (conversationSearchTimerRef.current) {
            clearTimeout(conversationSearchTimerRef.current);
            conversationSearchTimerRef.current = null;
        }

        if (!searchVisible || isGroupProfile || !data.conversationId) {
            setSearchResults([]);
            setIsSearchingMessages(false);
            return;
        }

        const cleanSearch = searchQuery.trim();
        const isValidSearch = cleanSearch.length >= 2 && cleanSearch.length <= 100;

        if (!isValidSearch) {
            setSearchResults([]);
            setIsSearchingMessages(false);
            return;
        }

        let isCancelled = false;
        setIsSearchingMessages(true);

        conversationSearchTimerRef.current = setTimeout(async () => {
            try {
                const response = await callSearchConversationMessages(data.conversationId, {
                    q: cleanSearch,
                    page: 1,
                    per_page: 20,
                });

                if (!isCancelled) {
                    setSearchResults(
                        getResponseItems(response).map((item, index) =>
                            normalizeSearchMessageItem(item, index, isArabic)
                        )
                    );
                }
            } catch (error) {
                console.log("Search direct conversation messages error:", error?.raw || error);

                if (!isCancelled) {
                    setSearchResults([]);
                }
            } finally {
                if (!isCancelled) {
                    setIsSearchingMessages(false);
                }
            }
        }, CONVERSATION_SEARCH_DEBOUNCE_MS);

        return () => {
            isCancelled = true;

            if (conversationSearchTimerRef.current) {
                clearTimeout(conversationSearchTimerRef.current);
                conversationSearchTimerRef.current = null;
            }
        };
    }, [data.conversationId, isArabic, isGroupProfile, searchQuery, searchVisible]);

    useEffect(() => {
        if (!addMembersVisible || !isGroupProfile) {
            return;
        }

        let isMounted = true;

        const loadEmployees = async () => {
            try {
                setIsLoadingEmployees(true);
                setAddMemberError("");

                const response = await employeeService.listEmployees();
                const employees = uniqueMembers(
                    getItemsFromResponse(response)
                        .map((item) => normalizeMemberCandidate(item, "employee", isArabic))
                        .filter(Boolean)
                );

                if (isMounted) {
                    setEmployeeCandidates(employees);
                }
            } catch (error) {
                console.log("Load profile add-member employees error:", error?.raw || error);

                if (isMounted) {
                    setEmployeeCandidates([]);
                    setAddMemberError(
                        error?.userMessage ||
                        (isArabic ? "تعذر تحميل الموظفين." : "Could not load employees.")
                    );
                }
            } finally {
                if (isMounted) {
                    setIsLoadingEmployees(false);
                }
            }
        };

        loadEmployees();

        return () => {
            isMounted = false;
        };
    }, [addMembersVisible, isArabic, isGroupProfile]);

    useEffect(() => {
        if (addMemberSearchTimerRef.current) {
            clearTimeout(addMemberSearchTimerRef.current);
            addMemberSearchTimerRef.current = null;
        }

        if (!addMembersVisible || !isGroupProfile) {
            setCustomerCandidates([]);
            setIsSearchingCustomers(false);
            return;
        }

        const cleanSearch = addMemberSearch.trim();
        const isValidSearch =
            cleanSearch.length >= CUSTOMER_SEARCH_MIN_LENGTH &&
            cleanSearch.length <= 60;

        if (!cleanSearch || !isValidSearch) {
            setCustomerCandidates([]);
            setIsSearchingCustomers(false);
            return;
        }

        let isCancelled = false;

        setIsSearchingCustomers(true);

        addMemberSearchTimerRef.current = setTimeout(async () => {
            try {
                const users = uniqueMembers(
                    (await searchUsersForGroupMembers(cleanSearch))
                        .map((item) => {
                            const roleValue = Number(
                                item?.role?.value ||
                                item?.role_id ||
                                item?.roleId ||
                                (item?.user_search_type === "admin" ? 3 : item?.user_search_type === "employee" ? 2 : 1)
                            );

                            return normalizeMemberCandidate(
                                {
                                    ...item,
                                    role: item?.role || { value: roleValue },
                                },
                                roleValue === 3 ? "admin" : roleValue === 2 ? "employee" : "customer",
                                isArabic
                            );
                        })
                        .filter(Boolean)
                );

                if (!isCancelled) {
                    setCustomerCandidates(users);
                }
            } catch (error) {
                console.log("Search profile add-member customers error:", error?.raw || error);

                if (!isCancelled) {
                    setCustomerCandidates([]);
                }
            } finally {
                if (!isCancelled) {
                    setIsSearchingCustomers(false);
                }
            }
        }, CUSTOMER_SEARCH_DEBOUNCE_MS);

        return () => {
            isCancelled = true;

            if (addMemberSearchTimerRef.current) {
                clearTimeout(addMemberSearchTimerRef.current);
                addMemberSearchTimerRef.current = null;
            }
        };
    }, [addMembersVisible, addMemberSearch, isArabic, isGroupProfile]);

    const handleSearchPress = () => {
        setMenuOpen(false);
        setSearchVisible(true);

        setTimeout(() => {
            searchInputRef.current?.focus?.();
            scrollRef.current?.scrollTo({
                y: 0,
                animated: true,
            });
        }, 80);
    };

    const handleMorePress = () => {
        setMenuOpen((value) => !value);
    };

    const handleChangeLanguage = async () => {
        const nextLanguage = isArabic ? "en" : "ar";

        setMenuOpen(false);

        await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
        await i18n.changeLanguage(nextLanguage);

        setTimeout(() => {
            scrollRef.current?.scrollTo({
                y: 0,
                animated: false,
            });
        }, 80);
    };

    const handleToggleTheme = () => {
        const nextTheme = isDark ? "light" : "dark";

        setMenuOpen(false);

        requestAnimationFrame(() => {
            if (typeof setThemeMode === "function") {
                setThemeMode(nextTheme);
                return;
            }

            if (typeof changeTheme === "function") {
                changeTheme(nextTheme);
                return;
            }

            if (typeof toggleTheme === "function") {
                toggleTheme();
            }
        });
    };

    const openAddMembersModal = () => {
        setMenuOpen(false);
        setAddMemberSearch("");
        setSelectedNewMembers([]);
        setAddMemberError("");
        setAddMembersVisible(true);
    };

    const closeAddMembersModal = () => {
        if (isMutatingGroup) {
            return;
        }

        Keyboard.dismiss();
        setAddMembersVisible(false);
        setAddMemberSearch("");
        setSelectedNewMembers([]);
        setAddMemberError("");
    };

    const toggleNewMember = (member) => {
        if (!member?.userId || isMutatingGroup) {
            return;
        }

        setSelectedNewMembers((currentMembers) => {
            const exists = currentMembers.some(
                (item) => String(item.userId) === String(member.userId)
            );

            if (exists) {
                return currentMembers.filter(
                    (item) => String(item.userId) !== String(member.userId)
                );
            }

            return [...currentMembers, member];
        });
    };

    const handleAddSelectedMembers = async () => {
        const conversationId = normalizeId(data.conversationId);
        const userIds = uniqueMembers(selectedNewMembers)
            .map((member) => Number(member.userId))
            .filter((id) => Number.isInteger(id) && id > 0)
            .filter((id) => !currentUserId || String(id) !== String(currentUserId));

        if (!conversationId || userIds.length === 0) {
            setAddMemberError(
                isArabic ? "اختر عضو واحد على الأقل." : "Choose at least one member."
            );
            return;
        }

        try {
            setIsMutatingGroup(true);
            setAddMemberError("");

            console.log("[ADD GROUP PARTICIPANTS DEBUG]", {
                conversationId,
                currentUserId,
                currentUserRole,
                canManageGroup,
                myParticipant: myGroupParticipant,
                userIds,
            });

            await chatService.addGroupParticipants(conversationId, userIds);
            await refreshGroupConversation();
            closeAddMembersModal();
        } catch (error) {
            console.log("Add group participants error:", error?.raw || error);
            setAddMemberError(
                error?.userMessage ||
                (isArabic ? "تعذر إضافة الأعضاء." : "Could not add members.")
            );
        } finally {
            setIsMutatingGroup(false);
        }
    };

    const handleRemoveParticipant = (participant) => {
        const conversationId = normalizeId(data.conversationId);
        const userId = getParticipantUserId(participant);
        const memberName = getParticipantDisplayName(participant, isArabic ? "عضو" : "Member");

        if (!conversationId || !userId || isMutatingGroup) {
            return;
        }

        console.log("[REMOVE PARTICIPANT DEBUG] before confirm:", {
            conversationId,
            currentUserId,
            currentUserRole,
            removedUserId: userId,
            canManageGroup,
            myParticipant: myGroupParticipant,
            removedParticipant: participant,
        });

        Alert.alert(
            isArabic ? "حذف عضو؟" : "Remove member?",
            isArabic
                ? `هل تريد حذف ${memberName} من الغروب؟`
                : `Remove ${memberName} from this group?`,
            [
                { text: isArabic ? "إلغاء" : "Cancel", style: "cancel" },
                {
                    text: isArabic ? "حذف" : "Remove",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            setIsMutatingGroup(true);

                            console.log("[REMOVE PARTICIPANT DEBUG] request:", {
                                conversationId,
                                currentUserId,
                                currentUserRole,
                                removedUserId: userId,
                                canManageGroup,
                                myParticipant: myGroupParticipant,
                                removedParticipant: participant,
                            });

                            await chatService.removeGroupParticipant(conversationId, userId);
                            await refreshGroupConversation();
                        } catch (error) {
                            console.log("Remove group participant error:", {
                                raw: error?.raw || error,
                                status: error?.status,
                                code: error?.code,
                                userMessage: error?.userMessage,
                                conversationId,
                                currentUserId,
                                currentUserRole,
                                removedUserId: userId,
                                canManageGroup,
                                myParticipant: myGroupParticipant,
                                removedParticipant: participant,
                            });
                            Alert.alert(
                                isArabic ? "حدث خطأ" : "Something went wrong",
                                error?.userMessage ||
                                (isArabic ? "تعذر حذف العضو." : "Could not remove this member.")
                            );
                        } finally {
                            setIsMutatingGroup(false);
                        }
                    },
                },
            ]
        );
    };

    const handleLeaveGroup = () => {
        const conversationId = normalizeId(data.conversationId);

        if (!conversationId || isMutatingGroup) {
            return;
        }

        setMenuOpen(false);

        Alert.alert(
            isArabic ? "مغادرة الغروب؟" : "Leave group?",
            isArabic
                ? "لن تتمكن من الوصول لهذه المحادثة بعد المغادرة."
                : "You will no longer have access to this conversation after leaving.",
            [
                { text: isArabic ? "إلغاء" : "Cancel", style: "cancel" },
                {
                    text: isArabic ? "مغادرة" : "Leave",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            setIsMutatingGroup(true);
                            await chatService.leaveGroup(conversationId);
                            navigation.goBack();
                        } catch (error) {
                            console.log("Leave group error:", error?.raw || error);
                            Alert.alert(
                                isArabic ? "حدث خطأ" : "Something went wrong",
                                error?.userMessage ||
                                (isArabic ? "تعذر مغادرة الغروب." : "Could not leave this group.")
                            );
                        } finally {
                            setIsMutatingGroup(false);
                        }
                    },
                },
            ]
        );
    };

    const handleDeleteGroup = () => {
        const conversationId = normalizeId(data.conversationId);

        if (!conversationId || !canManageGroup || isMutatingGroup) {
            return;
        }

        setMenuOpen(false);

        Alert.alert(
            isArabic ? "حذف الغروب؟" : "Delete group?",
            isArabic
                ? "سيتم حذف هذه المحادثة الجماعية للجميع."
                : "This group conversation will be deleted for everyone.",
            [
                { text: isArabic ? "إلغاء" : "Cancel", style: "cancel" },
                {
                    text: isArabic ? "حذف" : "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            setIsMutatingGroup(true);
                            await chatService.deleteConversation(conversationId);
                            navigation.goBack();
                        } catch (error) {
                            console.log("Delete group error:", error?.raw || error);
                            Alert.alert(
                                isArabic ? "حدث خطأ" : "Something went wrong",
                                error?.userMessage ||
                                (isArabic ? "تعذر حذف الغروب." : "Could not delete this group.")
                            );
                        } finally {
                            setIsMutatingGroup(false);
                        }
                    },
                },
            ]
        );
    };

    return (
        <View style={styles.root}>
            <StatusBar
                style={isDark ? "light" : "dark"}
                translucent
                backgroundColor="transparent"
            />

            <View style={styles.fixedHeader}>
                <TouchableOpacity
                    activeOpacity={0.85}
                    style={styles.roundButton}
                    onPress={() => navigation.goBack()}
                >
                    <Ionicons name="arrow-back" size={28} color={colors.text} />
                </TouchableOpacity>

                <Animated.View
                    pointerEvents="none"
                    style={[
                        styles.headerTitleWrapper,
                        {
                            opacity: headerTitleOpacity,
                            transform: [{ translateY: headerTitleTranslateY }],
                        },
                    ]}
                >
                    <Text style={styles.headerTitle} numberOfLines={1}>
                        {profileTitle}
                    </Text>

                    <Text style={styles.headerSubtitle} numberOfLines={1}>
                        {isGroupProfile ? statusText : profileSubtitle}
                    </Text>
                </Animated.View>

                <View style={styles.topSpacer} />

                {isGroupProfile ? (
                    <TouchableOpacity activeOpacity={0.85} style={styles.editButton}>
                        <Text style={styles.editText}>
                            {t("chatProfile.edit", "Edit")}
                        </Text>
                    </TouchableOpacity>
                ) : (
                    <View style={styles.editButtonPlaceholder} />
                )}
            </View>

            <Animated.ScrollView
                ref={scrollRef}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                scrollEventThrottle={16}
                onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                    { useNativeDriver: true }
                )}
            >
                <View style={styles.profileHeader}>
                    <View style={styles.avatar}>
                        {!isGroupProfile && directProfile.avatar ? (
                            <Image
                                source={{ uri: directProfile.avatar }}
                                style={styles.avatarImage}
                            />
                        ) : isGroupProfile ? (
                            <Ionicons name="people" size={64} color={colors.text} />
                        ) : (
                            <Text style={styles.avatarText}>{directProfile.initials}</Text>
                        )}
                    </View>

                    <View style={styles.nameWrapper}>
                        <Text style={styles.name} numberOfLines={2}>
                            {profileTitle}
                        </Text>
                    </View>

                    <View style={styles.departmentPill}>
                        <Text style={styles.departmentPillText}>
                            {isGroupProfile
                                ? t("chatProfile.groupChat", "Group chat")
                                : profileSubtitle}
                        </Text>
                    </View>

                    <View style={[styles.statusRow, getRowDirectionStyle(isArabic)]}>
                        <View
                            style={[
                                styles.onlineDot,
                                { backgroundColor: statusColor },
                            ]}
                        />

                        <Text
                            style={[
                                styles.statusText,
                                { color: statusColor },
                            ]}
                        >
                            {statusText}
                        </Text>
                    </View>
                </View>

                <View style={[styles.actionsRow, getRowDirectionStyle(isArabic)]}>
                    <ActionButton
                        icon={isGroupProfile ? "person-add-outline" : "call"}
                        label={isGroupProfile
                            ? t("chatProfile.add", "Add")
                            : t("chatProfile.call", "Call")}
                        colors={colors}
                        styles={styles}
                        disabled={isGroupProfile && !canManageGroup}
                        onPress={isGroupProfile ? openAddMembersModal : undefined}
                    />

                    <ActionButton
                        icon="chatbubble-ellipses-outline"
                        label={t("chatProfile.message", "Message")}
                        colors={colors}
                        styles={styles}
                        onPress={() => navigation.goBack()}
                    />

                    <ActionButton
                        icon="search-outline"
                        label={t("chatProfile.search", "Search")}
                        colors={colors}
                        styles={styles}
                        onPress={handleSearchPress}
                    />

                    <View style={styles.moreActionWrapper}>
                        <ActionButton
                            icon="ellipsis-horizontal"
                            label={t("chatProfile.more", "More")}
                            colors={colors}
                            styles={styles}
                            onPress={handleMorePress}
                        />

                        {menuOpen && (
                            <View
                                style={[
                                    styles.menuBoxUnderMore,
                                    isArabic
                                        ? styles.menuBoxUnderMoreArabic
                                        : styles.menuBoxUnderMoreEnglish,
                                ]}
                            >
                                <TouchableOpacity
                                    activeOpacity={0.85}
                                    style={[
                                        styles.menuItem,
                                        getRowDirectionStyle(isArabic),
                                    ]}
                                    onPress={handleChangeLanguage}
                                >
                                    <Feather
                                        name="globe"
                                        size={18}
                                        color={colors.blue}
                                    />

                                    <Text
                                        style={[
                                            styles.menuItemText,
                                            getTextDirectionStyle(isArabic),
                                        ]}
                                    >
                                        {isArabic ? "English" : "العربية"}
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    activeOpacity={0.85}
                                    style={[
                                        styles.menuItem,
                                        getRowDirectionStyle(isArabic),
                                    ]}
                                    onPress={handleToggleTheme}
                                >
                                    <Feather
                                        name={isDark ? "sun" : "moon"}
                                        size={18}
                                        color={colors.blue}
                                    />

                                    <Text
                                        style={[
                                            styles.menuItemText,
                                            getTextDirectionStyle(isArabic),
                                        ]}
                                    >
                                        {isDark
                                            ? t("chatProfile.lightMode", "Light mode")
                                            : t("chatProfile.darkMode", "Dark mode")}
                                    </Text>
                                </TouchableOpacity>

                                {isGroupProfile && canManageGroup && (
                                    <TouchableOpacity
                                        activeOpacity={0.85}
                                        style={[
                                            styles.menuItem,
                                            getRowDirectionStyle(isArabic),
                                        ]}
                                        onPress={openAddMembersModal}
                                    >
                                        <Feather name="user-plus" size={18} color={colors.primary} />
                                        <Text style={[styles.menuItemText, getTextDirectionStyle(isArabic)]}>
                                            {isArabic ? "إضافة أعضاء" : "Add members"}
                                        </Text>
                                    </TouchableOpacity>
                                )}

                                {isGroupProfile && (
                                    <TouchableOpacity
                                        activeOpacity={0.85}
                                        style={[
                                            styles.menuItem,
                                            getRowDirectionStyle(isArabic),
                                        ]}
                                        onPress={handleLeaveGroup}
                                    >
                                        <Feather name="log-out" size={18} color={colors.danger} />
                                        <Text style={[styles.menuItemText, { color: colors.danger }, getTextDirectionStyle(isArabic)]}>
                                            {isArabic ? "مغادرة الغروب" : "Leave group"}
                                        </Text>
                                    </TouchableOpacity>
                                )}

                                {isGroupProfile && canManageGroup && (
                                    <TouchableOpacity
                                        activeOpacity={0.85}
                                        style={[
                                            styles.menuItem,
                                            getRowDirectionStyle(isArabic),
                                        ]}
                                        onPress={handleDeleteGroup}
                                    >
                                        <Feather name="trash-2" size={18} color={colors.danger} />
                                        <Text style={[styles.menuItemText, { color: colors.danger }, getTextDirectionStyle(isArabic)]}>
                                            {isArabic ? "حذف الغروب" : "Delete group"}
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        )}
                    </View>
                </View>

                {searchVisible && (
                    <View style={[styles.searchBox, getRowDirectionStyle(isArabic)]}>
                        <Ionicons
                            name="search-outline"
                            size={21}
                            color={colors.blue}
                        />

                        <TextInput
                            ref={searchInputRef}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            placeholder={t(
                                "chatProfile.searchMessages",
                                "Search messages..."
                            )}
                            placeholderTextColor={colors.textMuted}
                            style={[
                                styles.searchInput,
                                getTextDirectionStyle(isArabic),
                            ]}
                            selectionColor={colors.blue}
                        />

                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => {
                                setSearchQuery("");
                                setSearchVisible(false);
                            }}
                        >
                            <Ionicons
                                name="close-circle"
                                size={22}
                                color={colors.textMuted}
                            />
                        </TouchableOpacity>
                    </View>
                )}

                {searchVisible && !isGroupProfile && (
                    <View style={styles.searchResultsCard}>
                        {isSearchingMessages ? (
                            <View style={styles.loadingGroupBox}>
                                <ActivityIndicator size="small" color={colors.primary} />
                                <Text style={styles.loadingGroupText}>
                                    {isArabic ? "جاري البحث..." : "Searching..."}
                                </Text>
                            </View>
                        ) : filteredSearchResults.length > 0 ? (
                            filteredSearchResults.map((item) => (
                                <SearchResultRow
                                    key={item.key}
                                    item={item}
                                    colors={colors}
                                    styles={styles}
                                    isArabic={isArabic}
                                />
                            ))
                        ) : (
                            <Text
                                style={[
                                    styles.emptySearchText,
                                    getTextDirectionStyle(isArabic),
                                ]}
                            >
                                {searchQuery.trim().length < 2
                                    ? (isArabic ? "اكتب حرفين على الأقل للبحث." : "Type at least 2 characters to search.")
                                    : t("chatProfile.noSearchResults", "No results found")}
                            </Text>
                        )}
                    </View>
                )}

                {isGroupProfile ? (
                    <View style={styles.infoCard}>
                        <View style={[styles.groupSectionHeader, getRowDirectionStyle(isArabic)]}>
                            <View style={styles.groupTitleBox}>
                                <Text style={[styles.groupSectionTitle, getTextDirectionStyle(isArabic)]}>
                                    {isArabic ? "أعضاء الغروب" : "Group members"}
                                </Text>
                                <Text style={[styles.groupSectionSubtitle, getTextDirectionStyle(isArabic)]}>
                                    {canManageGroup
                                        ? isArabic
                                            ? "يمكنك إدارة أعضاء هذه المحادثة."
                                            : "You can manage this group conversation."
                                        : isArabic
                                            ? "يمكنك مشاهدة أعضاء هذه المحادثة."
                                            : "You can view this group conversation members."}
                                </Text>
                            </View>

                            {canManageGroup && (
                                <TouchableOpacity
                                    style={styles.smallAddButton}
                                    activeOpacity={0.85}
                                    onPress={openAddMembersModal}
                                    disabled={isMutatingGroup}
                                >
                                    <Feather name="user-plus" size={18} color={colors.darkText} />
                                </TouchableOpacity>
                            )}
                        </View>

                        {isLoadingGroup ? (
                            <View style={styles.loadingGroupBox}>
                                <ActivityIndicator size="small" color={colors.primary} />
                                <Text style={styles.loadingGroupText}>
                                    {isArabic ? "جاري تحميل الأعضاء..." : "Loading members..."}
                                </Text>
                            </View>
                        ) : groupParticipants.length > 0 ? (
                            groupParticipants.map((participant, index) => (
                                <ParticipantRow
                                    key={`${getParticipantUserId(participant) || index}-${index}`}
                                    participant={participant}
                                    currentUserId={currentUserId}
                                    canManageGroup={canManageGroup}
                                    isMutatingGroup={isMutatingGroup}
                                    colors={colors}
                                    styles={styles}
                                    isArabic={isArabic}
                                    onRemove={handleRemoveParticipant}
                                />
                            ))
                        ) : (
                            <Text style={[styles.emptySearchText, getTextDirectionStyle(isArabic)]}>
                                {isArabic ? "لا يوجد أعضاء ظاهرون حالياً." : "No visible members right now."}
                            </Text>
                        )}
                    </View>
                ) : (
                    <View style={styles.infoCard}>
                        {isLoadingDirectProfile ? (
                            <View style={styles.loadingGroupBox}>
                                <ActivityIndicator size="small" color={colors.primary} />
                                <Text style={styles.loadingGroupText}>
                                    {isArabic ? "جاري تحميل البروفايل..." : "Loading profile..."}
                                </Text>
                            </View>
                        ) : (
                            <>
                                {!!directProfile.phone && (
                                    <InfoRow
                                        icon="phone-portrait-outline"
                                        label={t("chatProfile.mobile", "Mobile")}
                                        value={directProfile.phone}
                                        colors={colors}
                                        styles={styles}
                                        isArabic={isArabic}
                                    />
                                )}

                                <InfoRow
                                    icon="person-circle-outline"
                                    label={isArabic ? "الدور" : "Role"}
                                    value={directProfile.roleLabel}
                                    colors={colors}
                                    styles={styles}
                                    isArabic={isArabic}
                                />

                                {!!directProfile.statusLabel && (
                                    <InfoRow
                                        icon="shield-checkmark-outline"
                                        label={isArabic ? "الحالة" : "Status"}
                                        value={directProfile.statusLabel}
                                        colors={colors}
                                        styles={styles}
                                        isArabic={isArabic}
                                    />
                                )}

                                <InfoRow
                                    icon="briefcase-outline"
                                    label={t("chatProfile.department", "Department")}
                                    value={directProfile.department}
                                    colors={colors}
                                    styles={styles}
                                    isArabic={isArabic}
                                    isLast={!directProfile.approvedAt}
                                />

                                {!!directProfile.approvedAt && (
                                    <InfoRow
                                        icon="calendar-outline"
                                        label={isArabic ? "تاريخ الموافقة" : "Approved at"}
                                        value={directProfile.approvedAt}
                                        colors={colors}
                                        styles={styles}
                                        isArabic={isArabic}
                                        isLast
                                    />
                                )}
                            </>
                        )}
                    </View>
                )}

                <View style={styles.sharedCard}>
                    {!isGroupProfile && isLoadingShared && (
                        <View style={styles.loadingGroupBox}>
                            <ActivityIndicator size="small" color={colors.primary} />
                            <Text style={styles.loadingGroupText}>
                                {isArabic ? "جاري تحميل المرفقات..." : "Loading shared items..."}
                            </Text>
                        </View>
                    )}

                    {!isGroupProfile && !!sharedError && (
                        <Text style={[styles.emptySearchText, getTextDirectionStyle(isArabic)]}>
                            {sharedError}
                        </Text>
                    )}

                    <View style={[styles.tabsRow, getRowDirectionStyle(isArabic)]}>
                        {tabs.map((item) => {
                            const selected = activeTab === item.key;

                            return (
                                <TouchableOpacity
                                    key={item.key}
                                    activeOpacity={0.85}
                                    style={[
                                        styles.tabButton,
                                        selected && styles.tabButtonActive,
                                    ]}
                                    onPress={() => setActiveTab(item.key)}
                                >
                                    <Text
                                        style={[
                                            styles.tabText,
                                            selected && styles.tabTextActive,
                                        ]}
                                    >
                                        {item.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {activeTab === "media" && (
                        mediaItems.length > 0 ? (
                            <View style={styles.mediaGrid}>
                                {mediaItems.map((item) => (
                                    <MediaTile
                                        key={item.key}
                                        item={item}
                                        data={{ ...data, name: profileTitle, avatar: isGroupProfile ? data.avatar : directProfile.avatar }}
                                        colors={colors}
                                        styles={styles}
                                    />
                                ))}
                            </View>
                        ) : (
                            <Text style={[styles.emptySearchText, getTextDirectionStyle(isArabic)]}>
                                {isArabic ? "لا توجد وسائط." : "No media."}
                            </Text>
                        )
                    )}

                    {activeTab === "files" && (
                        <ListContent
                            data={files}
                            colors={colors}
                            styles={styles}
                            isArabic={isArabic}
                        />
                    )}

                    {activeTab === "links" && isGroupProfile && (
                        <ListContent
                            data={links}
                            colors={colors}
                            styles={styles}
                            isArabic={isArabic}
                            emptyText={isArabic ? "لا توجد روابط." : "No links."}
                        />
                    )}

                    {activeTab === "voice" && (
                        <ListContent
                            data={voice}
                            colors={colors}
                            styles={styles}
                            isArabic={isArabic}
                            emptyText={isArabic ? "لا توجد رسائل صوتية." : "No voice messages."}
                        />
                    )}

                    {activeTab === "quotes" && !isGroupProfile && (
                        <ListContent
                            data={quotes}
                            colors={colors}
                            styles={styles}
                            isArabic={isArabic}
                            emptyText={isArabic ? "لا توجد عروض سعر." : "No quotes."}
                        />
                    )}
                </View>
            </Animated.ScrollView>

            <AddMembersModal
                visible={addMembersVisible}
                colors={colors}
                styles={styles}
                isArabic={isArabic}
                searchValue={addMemberSearch}
                onChangeSearch={setAddMemberSearch}
                candidates={memberCandidates}
                selectedIds={selectedNewMemberIds}
                isLoadingEmployees={isLoadingEmployees}
                isSearchingCustomers={isSearchingCustomers}
                isSubmitting={isMutatingGroup}
                errorMessage={addMemberError}
                onToggleMember={toggleNewMember}
                onClose={closeAddMembersModal}
                onSubmit={handleAddSelectedMembers}
                t={t}
            />
        </View>
    );
}

function ActionButton({ icon, label, colors, styles, onPress, disabled = false }) {
    return (
        <TouchableOpacity
            activeOpacity={0.85}
            style={[styles.actionButton, disabled && styles.actionButtonDisabled]}
            onPress={onPress}
            disabled={disabled}
        >
            <Ionicons name={icon} size={34} color={disabled ? colors.textMuted : colors.blue} />
            <Text style={[styles.actionText, disabled && { color: colors.textMuted }]}>{label}</Text>
        </TouchableOpacity>
    );
}

function InfoRow({ icon, label, value, colors, styles, isArabic, isLast }) {
    return (
        <View
            style={[
                styles.infoRow,
                getRowDirectionStyle(isArabic),
                isLast && styles.infoRowLast,
            ]}
        >
            <View style={styles.infoIconBox}>
                <Ionicons name={icon} size={32} color={colors.blue} />
            </View>

            <View style={styles.infoTextBox}>
                <Text
                    style={[styles.infoLabel, getTextDirectionStyle(isArabic)]}
                    numberOfLines={1}
                >
                    {label}
                </Text>

                <Text
                    style={[styles.infoValue, getTextDirectionStyle(isArabic)]}
                    numberOfLines={2}
                >
                    {value}
                </Text>
            </View>
        </View>
    );
}

function ParticipantRow({
    participant,
    currentUserId,
    canManageGroup,
    isMutatingGroup,
    colors,
    styles,
    isArabic,
    onRemove,
}) {
    const participantUserId = getParticipantUserId(participant);
    const isMe = isParticipantCurrentUser(participant, currentUserId);
    const name = getParticipantDisplayName(participant, isArabic ? "عضو" : "Member");
    const subtitle = isMe
        ? isArabic
            ? `${getParticipantSubtitle(participant, isArabic)} · أنت`
            : `${getParticipantSubtitle(participant, isArabic)} · You`
        : getParticipantSubtitle(participant, isArabic);
    const avatar = getParticipantAvatar(participant);
    const roleValue = getParticipantRoleValue(participant);
    const canRemove = canManageGroup && !isMe && roleValue !== 3;

    return (
        <View style={[styles.participantRow, getRowDirectionStyle(isArabic)]}>
            <View style={styles.participantAvatar}>
                {avatar ? (
                    <Image source={{ uri: avatar }} style={styles.participantAvatarImage} />
                ) : (
                    <Text style={styles.participantAvatarText}>{getInitials(name)}</Text>
                )}
            </View>

            <View style={styles.participantInfo}>
                <Text
                    style={[styles.participantName, getTextDirectionStyle(isArabic)]}
                    numberOfLines={1}
                >
                    {name}
                </Text>

                <Text
                    style={[styles.participantSubtitle, getTextDirectionStyle(isArabic)]}
                    numberOfLines={1}
                >
                    {subtitle}
                </Text>
            </View>

            {canRemove && (
                <TouchableOpacity
                    style={styles.removeParticipantButton}
                    activeOpacity={0.85}
                    onPress={() => onRemove(participant)}
                    disabled={isMutatingGroup}
                >
                    <Feather name="user-minus" size={18} color={colors.danger} />
                </TouchableOpacity>
            )}
        </View>
    );
}

function AddMembersModal({
    visible,
    colors,
    styles,
    isArabic,
    searchValue,
    onChangeSearch,
    candidates,
    selectedIds,
    isLoadingEmployees,
    isSearchingCustomers,
    isSubmitting,
    errorMessage,
    onToggleMember,
    onClose,
    onSubmit,
    t,
}) {
    if (!visible) {
        return null;
    }

    const selectedCount = selectedIds.size;

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
            <KeyboardAvoidingView
                style={styles.addMembersKeyboardRoot}
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                keyboardVerticalOffset={0}
            >
                <Pressable
                    style={[styles.addMembersOverlay, { backgroundColor: colors.overlay }]}
                    onPress={onClose}
                >
                    <Pressable
                        style={[styles.addMembersCard, { backgroundColor: colors.cardStrong }]}
                        onPress={(event) => event.stopPropagation()}
                    >
                        <View style={[styles.addMembersHeader, getRowDirectionStyle(isArabic)]}>
                            <View style={styles.addMembersTitleBox}>
                                <Text style={[styles.addMembersTitle, getTextDirectionStyle(isArabic)]}>
                                    {isArabic ? "إضافة أعضاء" : "Add members"}
                                </Text>
                                <Text style={[styles.addMembersSubtitle, getTextDirectionStyle(isArabic)]}>
                                    {isArabic
                                        ? "اختر موظفين أو ابحث عن مستخدم بالاسم أو الهاتف."
                                        : "Choose employees or search users by name or phone."}
                                </Text>
                            </View>

                            <TouchableOpacity
                                style={styles.addMembersCloseButton}
                                activeOpacity={0.85}
                                onPress={onClose}
                                disabled={isSubmitting}
                            >
                                <Feather name="x" size={22} color={colors.text} />
                            </TouchableOpacity>
                        </View>

                        <View style={[styles.addMembersSearchBox, getRowDirectionStyle(isArabic)]}>
                            <Feather name="search" size={19} color={colors.blue} />
                            <TextInput
                                value={searchValue}
                                onChangeText={onChangeSearch}
                                placeholder={isArabic ? "بحث بالاسم أو الهاتف" : "Search by name or phone"}
                                placeholderTextColor={colors.textMuted}
                                style={[
                                    styles.addMembersSearchInput,
                                    getTextInputDirectionFromValue(searchValue, isArabic),
                                ]}
                                keyboardType="default"
                                autoCapitalize="none"
                                autoCorrect={false}
                                editable={!isSubmitting}
                            />
                        </View>

                        <ScrollView
                            style={styles.addMembersList}
                            contentContainerStyle={styles.addMembersListContent}
                            keyboardShouldPersistTaps="handled"
                            keyboardDismissMode="interactive"
                            nestedScrollEnabled
                            showsVerticalScrollIndicator
                        >
                            {(isLoadingEmployees || isSearchingCustomers) && (
                                <View style={styles.addMembersLoadingRow}>
                                    <ActivityIndicator size="small" color={colors.primary} />
                                    <Text style={styles.addMembersLoadingText}>
                                        {isArabic ? "جاري التحميل..." : "Loading..."}
                                    </Text>
                                </View>
                            )}

                            {!isLoadingEmployees && candidates.length === 0 && (
                                <Text style={[styles.emptySearchText, getTextDirectionStyle(isArabic)]}>
                                    {isArabic
                                        ? "لا يوجد أعضاء متاحون للإضافة حالياً."
                                        : "No members available to add right now."}
                                </Text>
                            )}

                            {candidates.map((member) => {
                                const selected = selectedIds.has(String(member.userId));

                                return (
                                    <TouchableOpacity
                                        key={member.key}
                                        style={[
                                            styles.addMemberRow,
                                            getRowDirectionStyle(isArabic),
                                            selected && styles.addMemberRowSelected,
                                        ]}
                                        activeOpacity={0.85}
                                        onPress={() => onToggleMember(member)}
                                        disabled={isSubmitting}
                                    >
                                        <View style={styles.participantAvatar}>
                                            {member.avatar ? (
                                                <Image source={{ uri: member.avatar }} style={styles.participantAvatarImage} />
                                            ) : (
                                                <Text style={styles.participantAvatarText}>{getInitials(member.name)}</Text>
                                            )}
                                        </View>

                                        <View style={styles.participantInfo}>
                                            <Text style={[styles.participantName, getTextDirectionStyle(isArabic)]} numberOfLines={1}>
                                                {member.name}
                                            </Text>
                                            <Text style={[styles.participantSubtitle, getTextDirectionStyle(isArabic)]} numberOfLines={1}>
                                                {member.subtitle}
                                            </Text>
                                        </View>

                                        <View style={[styles.addMemberCheckCircle, selected && styles.addMemberCheckCircleSelected]}>
                                            {selected && <Feather name="check" size={15} color={colors.darkText} />}
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}

                            {!!errorMessage && (
                                <View style={[styles.addMembersErrorBox, getRowDirectionStyle(isArabic)]}>
                                    <Feather name="alert-circle" size={17} color={colors.danger} />
                                    <Text style={[styles.addMembersErrorText, getTextDirectionStyle(isArabic)]}>
                                        {errorMessage}
                                    </Text>
                                </View>
                            )}
                        </ScrollView>

                        <View style={[styles.addMembersFooter, getRowDirectionStyle(isArabic)]}>
                            <TouchableOpacity
                                style={styles.addMembersCancelButton}
                                activeOpacity={0.85}
                                onPress={onClose}
                                disabled={isSubmitting}
                            >
                                <Text style={styles.addMembersCancelText}>
                                    {t("cancel", isArabic ? "إلغاء" : "Cancel")}
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[
                                    styles.addMembersSubmitButton,
                                    (selectedCount === 0 || isSubmitting) && styles.addMembersSubmitButtonDisabled,
                                ]}
                                activeOpacity={0.85}
                                onPress={onSubmit}
                                disabled={selectedCount === 0 || isSubmitting}
                            >
                                {isSubmitting ? (
                                    <ActivityIndicator size="small" color={colors.darkText} />
                                ) : (
                                    <Feather name="user-plus" size={17} color={colors.darkText} />
                                )}
                                <Text style={styles.addMembersSubmitText} numberOfLines={1}>
                                    {isArabic ? `إضافة (${selectedCount})` : `Add (${selectedCount})`}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </Pressable>
                </Pressable>
            </KeyboardAvoidingView>
        </Modal>
    );
}

function SearchResultRow({ item, colors, styles, isArabic }) {
    return (
        <View style={[styles.searchResultRow, getRowDirectionStyle(isArabic)]}>
            <View style={styles.searchResultIcon}>
                <Feather name={item.icon} size={20} color={colors.blue} />
            </View>

            <View style={styles.searchResultTextBox}>
                <Text
                    style={[
                        styles.searchResultTitle,
                        getTextDirectionStyle(isArabic),
                    ]}
                    numberOfLines={1}
                >
                    {item.title}
                </Text>

                <Text
                    style={[
                        styles.searchResultSubtitle,
                        getTextDirectionStyle(isArabic),
                    ]}
                    numberOfLines={1}
                >
                    {item.subtitle}
                </Text>
            </View>
        </View>
    );
}

function MediaTile({ item, data, colors, styles }) {
    const chatDotColor = data.isBlocked
        ? colors.danger
        : data.isOnline || data.isTyping
            ? colors.primary
            : colors.textMuted;
    if (item.type === "chat") {
        return (
            <View style={styles.chatTile}>
                <View style={styles.chatRow}>
                    <View style={styles.chatAvatar}>
                        {data.avatar ? (
                            <Image
                                source={{ uri: data.avatar }}
                                style={styles.chatAvatarImage}
                            />
                        ) : data.isGroup ? (
                            <Ionicons name="people-outline" size={26} color={colors.text} />
                        ) : (
                            <Ionicons name="person-outline" size={26} color={colors.text} />
                        )}
                        <View style={[styles.chatDot, { backgroundColor: chatDotColor }]} />
                    </View>

                    <View style={styles.chatTextBox}>
                        <View style={styles.chatTopRow}>
                            <Text style={styles.chatName} numberOfLines={1}>
                                {data.name}
                            </Text>
                            <Text style={styles.chatTime}>7:59 PM</Text>
                        </View>

                        <View style={styles.chatPill}>
                            <Text style={styles.chatPillText}>{data.department}</Text>
                        </View>

                        <Text style={styles.chatMessage} numberOfLines={1}>
                            IMG_6232.png
                        </Text>
                    </View>
                </View>

                <View style={styles.chatRow}>
                    <View style={styles.chatAvatar}>
                        <Ionicons name="person-outline" size={26} color={colors.text} />
                        <View style={[styles.chatDot, { backgroundColor: chatDotColor }]} />
                    </View>

                    <View style={styles.chatTextBox}>
                        <View style={styles.chatTopRow}>
                            <Text style={styles.chatName} numberOfLines={1}>
                                MAK Overseas Admin
                            </Text>
                            <Text style={styles.chatTime}>Jun 4</Text>
                        </View>

                        <Text style={styles.chatMessage} numberOfLines={1}>
                            No messages yet
                        </Text>
                    </View>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.mediaTile}>
            {item.image ? (
                <Image source={item.image} style={styles.mediaImage} resizeMode="cover" />
            ) : (
                <View style={styles.mediaPlaceholder}>
                    <Ionicons name={item.type === "video" ? "play-outline" : "image-outline"} size={34} color={colors.blue} />
                </View>
            )}

            <View style={styles.mediaBadge}>
                <Ionicons
                    name={
                        item.type === "video"
                            ? "play-outline"
                            : item.type === "file"
                                ? "document-text-outline"
                                : "image-outline"
                    }
                    size={21}
                    color="#FFFFFF"
                />
            </View>
        </View>
    );
}

function ListContent({ data, colors, styles, isArabic, emptyText }) {
    if (!data?.length) {
        return (
            <Text style={[styles.emptySearchText, getTextDirectionStyle(isArabic)]}>
                {emptyText || (isArabic ? "لا يوجد محتوى حالياً." : "No content yet.")}
            </Text>
        );
    }

    return (
        <View style={styles.listContent}>
            {data.map((item) => (
                <View
                    key={item.key}
                    style={[styles.listItem, getRowDirectionStyle(isArabic)]}
                >
                    <View style={styles.listIcon}>
                        <Feather name={item.icon} size={22} color={colors.blue} />
                    </View>

                    <View style={styles.listTextBox}>
                        <Text
                            style={[styles.listTitle, getTextDirectionStyle(isArabic)]}
                            numberOfLines={1}
                        >
                            {item.title}
                        </Text>

                        <Text
                            style={[
                                styles.listSubtitle,
                                getTextDirectionStyle(isArabic),
                            ]}
                            numberOfLines={1}
                        >
                            {item.subtitle}
                        </Text>
                    </View>
                </View>
            ))}
        </View>
    );
}

const createStyles = (colors) =>
    StyleSheet.create({
        root: {
            flex: 1,
            backgroundColor: colors.background,
        },

        fixedHeader: {
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 1000,
            elevation: 1000,
            minHeight: Platform.OS === "ios" ? 120 : 96,
            paddingTop: Platform.OS === "ios" ? 66 : 44,
            paddingHorizontal: 16,
            paddingBottom: 10,
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: colors.background,
            borderBottomWidth: 1,
            borderBottomColor: colors.borderSoft,
        },

        headerTitleWrapper: {
            position: "absolute",
            left: 116,
            right: 116,
            bottom: 18,
            alignItems: "center",
            justifyContent: "center",
        },

        headerTitle: {
            width: "100%",
            color: colors.text,
            fontSize: 17,
            lineHeight: 21,
            fontWeight: "900",
            textAlign: "center",
            writingDirection: "ltr",
        },

        headerSubtitle: {
            width: "100%",
            color: colors.textSecondary,
            fontSize: 12,
            lineHeight: 15,
            fontWeight: "700",
            textAlign: "center",
            marginTop: 1,
            writingDirection: "ltr",
        },

        scrollContent: {
            flexGrow: 1,
            paddingHorizontal: 16,
            paddingTop: Platform.OS === "ios" ? 136 : 112,
            paddingBottom: 34,
        },

        roundButton: {
            width: 54,
            height: 54,
            borderRadius: 27,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.buttonSoft,
            alignItems: "center",
            justifyContent: "center",
        },

        topSpacer: {
            flex: 1,
        },

        editButton: {
            minWidth: 86,
            height: 54,
            borderRadius: 27,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.buttonSoft,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 18,
        },

        editText: {
            color: colors.text,
            fontSize: 18,
            fontWeight: "800",
        },

        editButtonPlaceholder: {
            width: 54,
            height: 54,
        },

        profileHeader: {
            alignItems: "center",
            justifyContent: "center",
            marginTop: 4,
            marginBottom: 26,
            width: "100%",
        },

        avatar: {
            width: 148,
            height: 148,
            borderRadius: 74,
            borderWidth: 1,
            borderColor: colors.avatarBorder,
            backgroundColor: colors.avatarBackground,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 12,
            overflow: "hidden",
        },

        avatarImage: {
            width: "100%",
            height: "100%",
            borderRadius: 74,
        },

        avatarText: {
            color: colors.text,
            fontSize: 54,
            fontWeight: "900",
            textAlign: "center",
        },

        nameWrapper: {
            width: "100%",
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 8,
        },

        name: {
            width: "100%",
            color: colors.text,
            fontSize: 28,
            lineHeight: 35,
            fontWeight: "900",
            textAlign: "center",
            writingDirection: "ltr",
        },

        departmentPill: {
            marginTop: 10,
            minHeight: 34,
            borderRadius: 17,
            borderWidth: 1,
            borderColor: colors.blue,
            backgroundColor: colors.blueSoft,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 18,
        },

        departmentPillText: {
            color: colors.blue,
            fontSize: 19,
            fontWeight: "700",
            textAlign: "center",
        },

        statusRow: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 9,
            marginTop: 10,
        },

        onlineDot: {
            width: 15,
            height: 15,
            borderRadius: 8,
        },

        statusText: {
            fontSize: 22,
            fontWeight: "700",
        },

        actionsRow: {
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            marginBottom: 14,
            zIndex: 25,
            overflow: "visible",
        },

        moreActionWrapper: {
            flex: 1,
            position: "relative",
            zIndex: 100,
            overflow: "visible",
        },

        actionButton: {
            flex: 1,
            height: 92,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.buttonSoft,
            alignItems: "center",
            justifyContent: "center",
        },

        actionButtonDisabled: {
            opacity: 0.48,
        },

        actionText: {
            color: colors.text,
            fontSize: 18,
            fontWeight: "800",
            marginTop: 8,
            textAlign: "center",
        },

        menuBoxUnderMore: {
            position: "absolute",
            top: 102,
            width: 210,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: colors.borderSoft,
            backgroundColor: colors.cardStrong,
            paddingVertical: 8,
            zIndex: 999,
            elevation: 999,
        },

        menuBoxUnderMoreEnglish: {
            right: 0,
        },

        menuBoxUnderMoreArabic: {
            left: 0,
        },

        menuItem: {
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            paddingHorizontal: 14,
            paddingVertical: 13,
            minHeight: 48,
        },

        menuItemText: {
            flex: 1,
            color: colors.text,
            fontSize: 15,
            fontWeight: "800",
        },

        searchBox: {
            minHeight: 52,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: colors.inputBorder,
            backgroundColor: colors.inputBackground,
            paddingHorizontal: 14,
            marginBottom: 14,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
        },

        searchInput: {
            flex: 1,
            minHeight: 50,
            color: colors.text,
            fontSize: 16,
            fontWeight: "700",
            paddingVertical: 0,
        },

        searchResultsCard: {
            borderRadius: 20,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            padding: 10,
            marginBottom: 14,
        },

        searchResultRow: {
            flexDirection: "row",
            alignItems: "center",
            minHeight: 58,
            gap: 10,
        },

        searchResultIcon: {
            width: 40,
            height: 40,
            borderRadius: 14,
            backgroundColor: colors.buttonSoft,
            alignItems: "center",
            justifyContent: "center",
        },

        searchResultTextBox: {
            flex: 1,
            minWidth: 0,
        },

        searchResultTitle: {
            color: colors.text,
            fontSize: 15,
            fontWeight: "900",
        },

        searchResultSubtitle: {
            color: colors.textSecondary,
            fontSize: 13,
            fontWeight: "700",
            marginTop: 3,
        },

        emptySearchText: {
            color: colors.textSecondary,
            fontSize: 15,
            fontWeight: "800",
            padding: 10,
            textAlign: "center",
        },

        infoCard: {
            borderRadius: 24,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            paddingHorizontal: 16,
            paddingVertical: 8,
            marginBottom: 14,
        },

        infoRow: {
            flexDirection: "row",
            alignItems: "center",
            minHeight: 76,
            borderBottomWidth: 1,
            borderBottomColor: colors.borderSoft,
        },

        infoRowLast: {
            borderBottomWidth: 0,
        },

        infoIconBox: {
            width: 48,
            alignItems: "center",
            justifyContent: "center",
        },

        infoTextBox: {
            flex: 1,
            paddingHorizontal: 12,
        },

        infoLabel: {
            color: colors.textSecondary,
            fontSize: 16,
            fontWeight: "700",
            marginBottom: 3,
        },

        infoValue: {
            color: colors.text,
            fontSize: 20,
            lineHeight: 25,
            fontWeight: "600",
        },

        groupSectionHeader: {
            minHeight: 70,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.borderSoft,
            paddingVertical: 10,
        },

        groupTitleBox: {
            flex: 1,
            minWidth: 0,
        },

        groupSectionTitle: {
            color: colors.text,
            fontSize: 18,
            fontWeight: "900",
        },

        groupSectionSubtitle: {
            marginTop: 4,
            color: colors.textSecondary,
            fontSize: 13,
            lineHeight: 18,
            fontWeight: "700",
        },

        smallAddButton: {
            width: 42,
            height: 42,
            borderRadius: 14,
            backgroundColor: colors.primary,
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
        },

        loadingGroupBox: {
            minHeight: 72,
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "row",
            gap: 10,
        },

        loadingGroupText: {
            color: colors.textSecondary,
            fontSize: 14,
            fontWeight: "800",
        },

        participantRow: {
            minHeight: 72,
            flexDirection: "row",
            alignItems: "center",
            borderBottomWidth: 1,
            borderBottomColor: colors.borderSoft,
            gap: 12,
            paddingVertical: 10,
        },

        participantAvatar: {
            width: 48,
            height: 48,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: colors.avatarBorder,
            backgroundColor: colors.avatarBackground,
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            flexShrink: 0,
        },

        participantAvatarImage: {
            width: "100%",
            height: "100%",
            borderRadius: 24,
        },

        participantAvatarText: {
            color: colors.text,
            fontSize: 14,
            fontWeight: "900",
        },

        participantInfo: {
            flex: 1,
            minWidth: 0,
        },

        participantName: {
            color: colors.text,
            fontSize: 15,
            fontWeight: "900",
        },

        participantSubtitle: {
            color: colors.textSecondary,
            fontSize: 13,
            fontWeight: "700",
            marginTop: 4,
        },

        removeParticipantButton: {
            width: 42,
            height: 42,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.buttonSoft,
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
        },

        addMembersKeyboardRoot: {
            flex: 1,
        },

        addMembersOverlay: {
            flex: 1,
            justifyContent: "flex-end",
            paddingHorizontal: 14,
            paddingTop: Platform.OS === "ios" ? 64 : 34,
            paddingBottom: Platform.OS === "ios" ? 22 : 14,
        },

        addMembersCard: {
            width: "100%",
            height: Platform.OS === "ios" ? "86%" : "84%",
            maxHeight: Platform.OS === "ios" ? "86%" : "84%",
            borderRadius: 26,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: "hidden",
        },

        addMembersHeader: {
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 18,
            paddingTop: 18,
            paddingBottom: 14,
            borderBottomWidth: 1,
            borderBottomColor: colors.borderSoft,
            gap: 12,
        },

        addMembersTitleBox: {
            flex: 1,
            minWidth: 0,
        },

        addMembersTitle: {
            color: colors.text,
            fontSize: 20,
            fontWeight: "900",
        },

        addMembersSubtitle: {
            color: colors.textSecondary,
            fontSize: 13,
            lineHeight: 18,
            fontWeight: "700",
            marginTop: 4,
        },

        addMembersCloseButton: {
            width: 40,
            height: 40,
            borderRadius: 16,
            backgroundColor: colors.buttonSoft,
            alignItems: "center",
            justifyContent: "center",
        },

        addMembersSearchBox: {
            minHeight: 50,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.inputBorder,
            backgroundColor: colors.inputBackground,
            marginHorizontal: 18,
            marginTop: 14,
            paddingHorizontal: 14,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
        },

        addMembersSearchInput: {
            flex: 1,
            minHeight: 48,
            color: colors.text,
            fontSize: 15,
            fontWeight: "700",
            paddingVertical: 0,
        },

        addMembersList: {
            flex: 1,
            minHeight: 0,
        },

        addMembersListContent: {
            flexGrow: 1,
            paddingHorizontal: 18,
            paddingTop: 14,
            paddingBottom: Platform.OS === "ios" ? 120 : 140,
        },

        addMembersLoadingRow: {
            minHeight: 44,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 9,
        },

        addMembersLoadingText: {
            color: colors.textSecondary,
            fontSize: 13,
            fontWeight: "800",
        },

        addMemberRow: {
            minHeight: 66,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: colors.borderSoft,
            backgroundColor: colors.card,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            paddingHorizontal: 12,
            paddingVertical: 9,
            marginBottom: 9,
        },

        addMemberRowSelected: {
            borderColor: colors.primary,
            backgroundColor: colors.primarySoft,
        },

        addMemberCheckCircle: {
            width: 24,
            height: 24,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
        },

        addMemberCheckCircleSelected: {
            backgroundColor: colors.primary,
            borderColor: colors.primary,
        },

        addMembersErrorBox: {
            marginTop: 8,
            borderRadius: 15,
            borderWidth: 1,
            borderColor: colors.danger,
            backgroundColor: colors.cardSoft,
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 12,
            paddingVertical: 10,
            gap: 8,
        },

        addMembersErrorText: {
            flex: 1,
            minWidth: 0,
            color: colors.danger,
            fontSize: 13,
            lineHeight: 19,
            fontWeight: "800",
        },

        addMembersFooter: {
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            paddingHorizontal: 18,
            paddingTop: 14,
            paddingBottom: Platform.OS === "ios" ? 20 : 16,
            borderTopWidth: 1,
            borderTopColor: colors.borderSoft,
        },

        addMembersCancelButton: {
            flex: 1,
            minHeight: 48,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.buttonSoft,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 12,
        },

        addMembersCancelText: {
            color: colors.text,
            fontSize: 14,
            fontWeight: "900",
        },

        addMembersSubmitButton: {
            flex: 1.45,
            minHeight: 48,
            borderRadius: 16,
            backgroundColor: colors.primary,
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "row",
            gap: 8,
            paddingHorizontal: 12,
        },

        addMembersSubmitButtonDisabled: {
            opacity: 0.55,
        },

        addMembersSubmitText: {
            color: colors.darkText,
            fontSize: 14,
            fontWeight: "900",
        },

        sharedCard: {
            borderRadius: 24,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            padding: 12,
        },

        tabsRow: {
            flexDirection: "row",
            alignItems: "center",
            borderBottomWidth: 1,
            borderBottomColor: colors.borderSoft,
            paddingBottom: 8,
            marginBottom: 10,
        },

        tabButton: {
            flex: 1,
            height: 38,
            borderRadius: 19,
            alignItems: "center",
            justifyContent: "center",
        },

        tabButtonActive: {
            borderWidth: 1,
            borderColor: colors.primary,
            backgroundColor: colors.primarySoft,
        },

        tabText: {
            color: colors.text,
            fontSize: 17,
            fontWeight: "800",
            textAlign: "center",
        },

        tabTextActive: {
            color: colors.primary,
        },

        mediaGrid: {
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 12,
        },

        mediaTile: {
            width: "48%",
            height: 128,
            borderRadius: 16,
            overflow: "hidden",
            backgroundColor: colors.cardSoft,
            borderWidth: 1,
            borderColor: colors.borderSoft,
        },

        mediaImage: {
            width: "100%",
            height: "100%",
        },

        mediaPlaceholder: {
            width: "100%",
            height: "100%",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.cardSoft,
        },

        mediaBadge: {
            position: "absolute",
            left: 10,
            bottom: 10,
            width: 34,
            height: 34,
            borderRadius: 8,
            backgroundColor: "rgba(0,0,0,0.72)",
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.22)",
        },

        chatTile: {
            width: "48%",
            height: 128,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.borderSoft,
            backgroundColor: colors.cardStrong,
            padding: 8,
            justifyContent: "center",
        },

        chatRow: {
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
        },

        chatAvatar: {
            width: 45,
            height: 45,
            borderRadius: 23,
            backgroundColor: colors.avatarBackground,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 8,
            position: "relative",
            overflow: "hidden",
        },

        chatAvatarImage: {
            width: "100%",
            height: "100%",
            borderRadius: 23,
        },

        chatDot: {
            position: "absolute",
            right: 2,
            bottom: 5,
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: colors.textMuted,
            borderWidth: 1,
            borderColor: colors.cardStrong,
        },

        chatTextBox: {
            flex: 1,
            minWidth: 0,
        },

        chatTopRow: {
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
        },

        chatName: {
            flex: 1,
            color: colors.text,
            fontSize: 12.5,
            fontWeight: "900",
        },

        chatTime: {
            color: colors.textSecondary,
            fontSize: 10,
            fontWeight: "700",
        },

        chatPill: {
            alignSelf: "flex-start",
            marginTop: 3,
            marginBottom: 2,
            borderRadius: 8,
            backgroundColor: colors.blueSoft,
            paddingHorizontal: 7,
            paddingVertical: 2,
        },

        chatPillText: {
            color: colors.blue,
            fontSize: 10,
            fontWeight: "800",
        },

        chatMessage: {
            color: colors.text,
            fontSize: 11,
            fontWeight: "700",
        },

        listContent: {
            paddingVertical: 4,
        },

        listItem: {
            minHeight: 68,
            borderRadius: 16,
            backgroundColor: colors.cardStrong,
            borderWidth: 1,
            borderColor: colors.borderSoft,
            paddingHorizontal: 12,
            marginBottom: 10,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
        },

        listIcon: {
            width: 44,
            height: 44,
            borderRadius: 14,
            backgroundColor: colors.buttonSoft,
            alignItems: "center",
            justifyContent: "center",
        },

        listTextBox: {
            flex: 1,
            minWidth: 0,
        },

        listTitle: {
            color: colors.text,
            fontSize: 16,
            fontWeight: "900",
        },

        listSubtitle: {
            color: colors.textSecondary,
            fontSize: 13,
            fontWeight: "700",
            marginTop: 3,
        },
    });

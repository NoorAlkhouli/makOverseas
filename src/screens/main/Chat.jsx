import MainNavBar from "@/src/components/MainNavBar";
import CreateGroupChatModal from "@/src/components/CreateGroupChatModal";
import { BOTTOM_TAB_BADGE_EVENTS } from "@/src/components/BottomTabBar";
import { appImages } from "@/src/constants/images";
import { useAppRealtime } from "@/src/context/AppRealtimeProvider";
import chatService from "@/src/services/api/chatService";
import employeeService from "@/src/services/api/employeeService";
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
    DeviceEventEmitter,
    Image,
    ImageBackground,
    Keyboard,
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

const CHAT_LIST_PER_PAGE = 20;
const CUSTOMER_SEARCH_DEBOUNCE_MS = 450;
const CUSTOMER_PHONE_REGEX = /^[0-9+]+$/;

const filters = [
    "all",
    "groups",
    "sales",
    "airFreightSales",
    "seaFreightSales",
    "landFreightSales",
    "accounting",
    "employees",
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

const getCustomerItems = (response) => {
    if (Array.isArray(response)) return response;
    if (Array.isArray(response?.data)) return response.data;
    if (Array.isArray(response?.data?.data)) return response.data.data;
    if (Array.isArray(response?.items)) return response.items;
    if (Array.isArray(response?.customers)) return response.customers;
    if (Array.isArray(response?.data?.customers)) return response.data.customers;

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

const getAvatarFromPaths = (source, paths) => {
    for (const path of paths) {
        const value = String(path)
            .split(".")
            .reduce((current, key) => current?.[key], source);

        const avatar = normalizeAvatarUrl(value);

        if (avatar) {
            return avatar;
        }
    }

    return null;
};

const normalizePresenceBoolean = (value) => {
    if (value === true || value === 1) return true;
    if (value === false || value === 0) return false;

    if (typeof value === "string") {
        const cleanValue = value.trim().toLowerCase();

        if (["1", "true", "yes", "online", "active"].includes(cleanValue)) {
            return true;
        }

        if (["0", "false", "no", "offline", "away", "inactive", "null", "undefined"].includes(cleanValue)) {
            return false;
        }
    }

    return false;
};

const getPresenceBooleanFromPaths = (source, paths) => {
    for (const path of paths) {
        const value = String(path)
            .split(".")
            .reduce((current, key) => current?.[key], source);

        if (value !== undefined && value !== null && value !== "") {
            return normalizePresenceBoolean(value);
        }
    }

    return false;
};

const getPresenceValueFromPaths = (source, paths) => {
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

const getEmployeeLastSeenValue = (employee) => getPresenceValueFromPaths(employee, [
    "last_seen_at",
    "lastSeenAt",
    "last_seen",
    "lastSeen",
    "offline_at",
    "offlineAt",
    "disconnected_at",
    "disconnectedAt",
    "user.last_seen_at",
    "user.lastSeenAt",
    "user.last_seen",
    "user.lastSeen",
    "user.offline_at",
    "user.offlineAt",
    "profile.last_seen_at",
    "profile.lastSeenAt",
    "profile.last_seen",
    "profile.lastSeen",
]);

const getConversationLastSeenValue = (conversation) => getPresenceValueFromPaths(conversation, [
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
]);

const normalizeChatBoolean = (value, fallback = false) => {
    if (value === true || value === 1) return true;
    if (value === false || value === 0) return false;

    if (typeof value === "string") {
        const cleanValue = value.trim().toLowerCase();

        if (["1", "true", "yes", "active", "blocked", "forbidden"].includes(cleanValue)) {
            return true;
        }

        if (["0", "false", "no", "inactive", "null", "undefined", "allowed"].includes(cleanValue)) {
            return false;
        }
    }

    return fallback;
};

const getBooleanValueFromPaths = (source, paths, fallback = null) => {
    for (const path of paths) {
        const value = String(path)
            .split(".")
            .reduce((current, key) => current?.[key], source);

        if (value !== undefined && value !== null && value !== "") {
            return normalizeChatBoolean(value, fallback === true);
        }
    }

    return fallback;
};

const getConversationBlockedState = (conversation) => {
    return getBooleanValueFromPaths(conversation, [
        "is_blocked",
        "isBlocked",
        "blocked",
        "blocked_by_me",
        "blockedByMe",
        "is_blocked_for_me",
        "isBlockedForMe",
        "block.is_blocked",
        "block.isBlocked",
        "block.blocked_by_me",
        "block.blockedByMe",
        "block.status",
        "meta.is_blocked",
        "meta.isBlocked",
        "conversation_block.is_blocked",
        "conversationBlock.isBlocked",
    ], false) === true;
};

const getConversationCanSendMessage = (conversation) => {
    const blocked = getConversationBlockedState(conversation);

    if (blocked) {
        return false;
    }

    const canSendValue = getBooleanValueFromPaths(conversation, [
        "can_send_message",
        "canSendMessage",
        "can_send_messages",
        "canSendMessages",
        "permissions.can_send_message",
        "permissions.canSendMessage",
        "abilities.can_send_message",
        "abilities.canSendMessage",
        "meta.can_send_message",
        "meta.canSendMessage",
    ], null);

    return canSendValue === null ? true : canSendValue === true;
};

const getProfilePayload = (response) => {
    return (
        response?.data?.user ||
        response?.data?.profile ||
        response?.data ||
        response?.user ||
        response?.profile ||
        response
    );
};

const normalizeRoleValue = (role) => {
    if (role === undefined || role === null || role === "") {
        return null;
    }

    if (typeof role === "object") {
        return normalizeRoleValue(
            role.id ||
            role.value ||
            role.key ||
            role.name ||
            role.slug ||
            role.title
        );
    }

    const roleText = String(role).trim().toLowerCase();
    const roleNumber = Number(roleText);

    if (Number.isFinite(roleNumber)) {
        return roleNumber;
    }

    if (roleText.includes("customer")) {
        return 1;
    }

    if (roleText.includes("employee")) {
        return 2;
    }

    if (roleText.includes("admin")) {
        return 3;
    }

    return null;
};

const getUserRoleFromProfile = (response) => {
    const profile = getProfilePayload(response);

    const role = getNestedValue(profile, [
        "role_id",
        "roleId",
        "role",
        "user_role",
        "userRole",
        "type",
        "user.role_id",
        "user.roleId",
        "user.role",
        "profile.role_id",
        "profile.roleId",
        "profile.role",
    ], null);

    return normalizeRoleValue(role);
};

const canUserSearchCustomers = (response) => {
    const role = getUserRoleFromProfile(response);

    return role === 2 || role === 3;
};

const canUserCreateGroups = (response) => {
    const role = getUserRoleFromProfile(response);

    return role === 2 || role === 3;
};

const getEmployeeItems = (response) => {
    const data =
        response?.data?.data ||
        response?.data?.items ||
        response?.data?.employees ||
        response?.data ||
        response?.items ||
        response?.employees ||
        response;

    if (!Array.isArray(data)) {
        return [];
    }

    const flattenedEmployees = [];

    data.forEach((item) => {
        const employeesList =
            item?.employees ||
            item?.users ||
            item?.members ||
            item?.items ||
            item?.data ||
            null;

        if (Array.isArray(employeesList)) {
            employeesList.forEach((employee) => {
                flattenedEmployees.push({
                    ...employee,
                    department:
                        employee?.department ||
                        item?.department ||
                        {
                            id: item?.id,
                            name: item?.name || item?.title,
                            description: item?.description,
                        },
                });
            });
        } else {
            flattenedEmployees.push(item);
        }
    });

    return flattenedEmployees;
};

const getEmployeeDepartmentText = (employee) => {
    const department = getNestedValue(employee, [
        "department.name",
        "department.title",
        "department_name",
        "department",
        "user.department.name",
        "user.department.title",
        "user.department_name",
        "user.department",
        "profile.department.name",
        "profile.department.title",
        "profile.department",
    ]);

    return getSafeText(department);
};

const normalizeEmployee = (employee, isArabic) => {
    const targetUserId = normalizeId(
        employee?.user_id ||
        employee?.userId ||
        employee?.user?.id ||
        employee?.profile?.user_id ||
        employee?.profile?.id ||
        employee?.id
    );

    const name = getSafeText(
        getNestedValue(
            employee,
            [
                "full_name",
                "name",
                "display_name",
                "user.full_name",
                "user.name",
                "profile.full_name",
                "profile.name",
            ],
            isArabic ? "موظف" : "Employee"
        ),
        isArabic ? "موظف" : "Employee"
    );

    const department = getEmployeeDepartmentText(employee);

    const avatar = getAvatarFromPaths(employee, [
        "avatar",
        "image",
        "photo",
        "profile_photo",
        "profilePhoto",
        "avatar_url",
        "avatarUrl",
        "user.avatar",
        "user.image",
        "user.photo",
        "user.profile_photo",
        "user.profilePhoto",
        "user.avatar_url",
        "user.avatarUrl",
        "profile.avatar",
        "profile.image",
        "profile.photo",
        "profile.avatar_url",
        "profile.avatarUrl",
    ]);

    const isOnline = getPresenceBooleanFromPaths(employee, [
        "online_status",
        "onlineStatus",
        "is_online",
        "isOnline",
        "online",
        "status",
        "presence",
        "user.online_status",
        "user.onlineStatus",
        "user.is_online",
        "user.isOnline",
        "user.online",
        "user.status",
        "user.presence",
        "profile.online_status",
        "profile.onlineStatus",
        "profile.is_online",
        "profile.isOnline",
        "profile.online",
        "profile.status",
        "profile.presence",
    ]);

    const lastSeenAt = getEmployeeLastSeenValue(employee);

    return {
        id: `employee-${String(targetUserId || employee?.id || employee?.uuid || Date.now())}`,
        conversationId: null,
        targetUserId,
        name,
        department,
        avatar,
        message: isArabic ? "اضغط لبدء محادثة" : "Tap to start a conversation",
        time: "",
        unread: 0,
        status: isOnline ? "online" : "offline",
        isOnline,
        lastSeenAt,
        isGroup: false,
        isEmployee: true,
        raw: employee,
    };
};


const getConversationChatByTargetUserId = (conversationChats = []) => {
    const conversationsByTargetUserId = new Map();

    conversationChats.forEach((chat) => {
        const targetUserId = normalizeId(chat?.targetUserId);

        if (!targetUserId || chat?.isGroup) {
            return;
        }

        if (!conversationsByTargetUserId.has(targetUserId)) {
            conversationsByTargetUserId.set(targetUserId, chat);
        }
    });

    return conversationsByTargetUserId;
};

const mergeEmployeeWithConversationChat = (employeeChat, conversationChat = null) => {
    if (!conversationChat) {
        return employeeChat;
    }

    return {
        ...employeeChat,
        conversationId: conversationChat.conversationId,
        message: conversationChat.message || employeeChat.message,
        time: conversationChat.time || employeeChat.time,
        unread: conversationChat.unread || 0,
        status: conversationChat.status || employeeChat.status,
        isOnline: conversationChat.isOnline || employeeChat.isOnline,
        lastSeenAt: conversationChat.lastSeenAt || employeeChat.lastSeenAt,
        isBlocked: conversationChat.isBlocked === true,
        canSendMessage: conversationChat.canSendMessage !== false,
        isEmployee: true,
        isEmployeeDirectory: true,
        isEmployeeConversation: true,
        matchedConversation: conversationChat,
        raw: conversationChat.raw || employeeChat.raw,
        employeeRaw: employeeChat.raw,
    };
};

const buildEmployeeDirectoryChats = ({
    employeesResponse,
    conversationsResponse,
    isArabic,
}) => {
    const conversationChats = getConversationItems(conversationsResponse).map((conversation) =>
        normalizeConversation(conversation, isArabic)
    );
    const conversationsByTargetUserId = getConversationChatByTargetUserId(conversationChats);

    return getEmployeeItems(employeesResponse).map((employee) => {
        const employeeChat = normalizeEmployee(employee, isArabic);
        const targetUserId = normalizeId(employeeChat.targetUserId);
        const matchedConversation = targetUserId
            ? conversationsByTargetUserId.get(targetUserId)
            : null;

        return mergeEmployeeWithConversationChat(employeeChat, matchedConversation);
    });
};

const normalizeCustomer = (customer, isArabic) => {
    const targetUserId = normalizeId(
        customer?.id ||
        customer?.user_id ||
        customer?.userId ||
        customer?.user?.id ||
        customer?.profile?.id
    );

    const name = getSafeText(
        getNestedValue(
            customer,
            [
                "full_name",
                "name",
                "display_name",
                "user.full_name",
                "user.name",
                "profile.full_name",
                "profile.name",
            ],
            isArabic ? "عميل" : "Customer"
        ),
        isArabic ? "عميل" : "Customer"
    );

    const phone = getSafeText(
        getNestedValue(customer, [
            "phone",
            "phone_number",
            "phoneNumber",
            "mobile",
            "user.phone",
            "user.phone_number",
        ])
    );

    const avatar = getAvatarFromPaths(customer, [
        "avatar",
        "image",
        "photo",
        "profile_photo",
        "profilePhoto",
        "avatar_url",
        "avatarUrl",
        "user.avatar",
        "user.image",
        "user.photo",
        "user.profile_photo",
        "user.profilePhoto",
        "user.avatar_url",
        "user.avatarUrl",
        "profile.avatar",
        "profile.image",
        "profile.photo",
        "profile.avatar_url",
        "profile.avatarUrl",
    ]);

    return {
        id: `customer-search-${String(targetUserId || customer?.uuid || Date.now())}`,
        conversationId: null,
        targetUserId,
        name,
        department: isArabic ? "عميل" : "Customer",
        avatar,
        message: phone || (isArabic ? "اضغط لبدء محادثة" : "Tap to start a conversation"),
        time: "",
        unread: 0,
        status: "offline",
        isOnline: false,
        lastSeenAt: getEmployeeLastSeenValue(customer),
        isGroup: false,
        isCustomerSearchResult: true,
        raw: customer,
    };
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
        "target_user.id",
        "target_user.user_id",
        "targetUser.id",
        "targetUser.user_id",
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

const normalizeDateInput = (value) => {
    if (!value) return "";

    const cleanValue = String(value).trim();

    if (!cleanValue) return "";

    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(cleanValue)) {
        return `${cleanValue.replace(" ", "T")}Z`;
    }

    return cleanValue;
};

const getConversationTimeTimestamp = (value) => {
    const normalizedValue = normalizeDateInput(value);

    if (!normalizedValue) return 0;

    const date = new Date(normalizedValue);

    if (Number.isNaN(date.getTime())) {
        return 0;
    }

    return date.getTime();
};

const getConversationRawTimeValue = (conversation) => {
    return getNestedValue(conversation, [
        "latest_message_at",
        "last_message_at",
        "latest_message.created_at",
        "last_message.created_at",
        "updated_at",
        "created_at",
        "time",
    ]);
};

const getNewestConversationTimeValue = (firstValue, secondValue) => {
    const firstTimestamp = getConversationTimeTimestamp(firstValue);
    const secondTimestamp = getConversationTimeTimestamp(secondValue);

    if (firstTimestamp >= secondTimestamp) {
        return firstValue;
    }

    return secondValue;
};

const formatLastSeenText = (value, isArabic) => {
    if (!value) {
        return isArabic ? "غير متصل" : "Offline";
    }

    const date = new Date(normalizeDateInput(value));

    if (Number.isNaN(date.getTime())) {
        return isArabic
            ? `آخر ظهور ${String(value)}`
            : `Last seen ${String(value)}`;
    }

    const now = new Date();
    const diffMs = Math.max(0, now.getTime() - date.getTime());
    const diffMinutes = Math.floor(diffMs / 60000);

    if (diffMinutes < 1) {
        return isArabic ? "آخر ظهور الآن" : "Last seen now";
    }

    if (diffMinutes < 60) {
        return isArabic
            ? `آخر ظهور منذ ${diffMinutes} دقيقة`
            : `Last seen ${diffMinutes} min ago`;
    }

    const diffHours = Math.floor(diffMinutes / 60);

    if (diffHours < 24) {
        return isArabic
            ? `آخر ظهور منذ ${diffHours} ساعة`
            : `Last seen ${diffHours}h ago`;
    }

    return isArabic
        ? `آخر ظهور ${date.toLocaleDateString("ar")}`
        : `Last seen ${date.toLocaleDateString("en")}`;
};

const formatConversationTime = (value, isArabic) => {
    if (!value) return "";

    const date = new Date(normalizeDateInput(value));

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
        rawType === 8 ||
        ["8", "audio", "voice", "voice_message", "voice-message"].includes(normalizedType) ||
        mimeType.includes("audio") ||
        fileName.endsWith(".m4a") ||
        fileName.endsWith(".mp3") ||
        fileName.endsWith(".aac") ||
        fileName.endsWith(".wav") ||
        fileName.endsWith(".ogg") ||
        fileName.endsWith(".oga") ||
        fileName.endsWith(".amr")
    ) {
        return "audio";
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

        if (
            mimeType.includes("audio") ||
            fileName.endsWith(".m4a") ||
            fileName.endsWith(".mp3") ||
            fileName.endsWith(".aac") ||
            fileName.endsWith(".wav") ||
            fileName.endsWith(".ogg") ||
            fileName.endsWith(".oga") ||
            fileName.endsWith(".amr")
        ) {
            return "audio";
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

    if (messageType === "audio") {
        return isArabic ? "رسالة صوتية" : "Voice message";
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
    const time = getConversationRawTimeValue(conversation);

    const unread = Number(
        getNestedValue(conversation, ["unread_count", "unread", "unread_messages_count"], 0) || 0
    );

    const isOnline = getPresenceBooleanFromPaths(conversation, [
        "online_status",
        "onlineStatus",
        "is_online",
        "isOnline",
        "online",
        "status",
        "presence",
        "target_user.online_status",
        "target_user.onlineStatus",
        "target_user.is_online",
        "target_user.isOnline",
        "targetUser.online_status",
        "targetUser.onlineStatus",
        "targetUser.is_online",
        "targetUser.isOnline",
        "employee.online_status",
        "employee.onlineStatus",
        "employee.is_online",
        "employee.isOnline",
        "employee.online",
        "employee.status",
        "employee.presence",
        "customer.online_status",
        "customer.onlineStatus",
        "customer.is_online",
        "customer.isOnline",
        "customer.online",
        "customer.status",
        "customer.presence",
        "participant.online_status",
        "participant.onlineStatus",
        "participant.is_online",
        "participant.isOnline",
        "participant.online",
        "participant.status",
        "participant.presence",
        "other_participant.online_status",
        "other_participant.onlineStatus",
        "other_participant.is_online",
        "other_participant.isOnline",
        "other_participant.online",
        "other_participant.status",
        "other_participant.presence",
        "user.online_status",
        "user.onlineStatus",
        "user.is_online",
        "user.isOnline",
        "user.online",
        "user.status",
        "user.presence",
    ]);

    const lastSeenAt = getConversationLastSeenValue(conversation);

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

    const avatar = getAvatarFromPaths(conversation, [
        "avatar",
        "image",
        "photo",
        "profile_photo",
        "profilePhoto",
        "avatar_url",
        "avatarUrl",

        "target_user.avatar",
        "target_user.image",
        "target_user.photo",
        "target_user.profile_photo",
        "target_user.profilePhoto",
        "target_user.avatar_url",
        "target_user.avatarUrl",

        "targetUser.avatar",
        "targetUser.image",
        "targetUser.photo",
        "targetUser.profile_photo",
        "targetUser.profilePhoto",
        "targetUser.avatar_url",
        "targetUser.avatarUrl",

        "other_participant.avatar",
        "other_participant.image",
        "other_participant.photo",
        "other_participant.profile_photo",
        "other_participant.profilePhoto",
        "other_participant.avatar_url",
        "other_participant.avatarUrl",
        "other_participant.user.avatar",
        "other_participant.user.image",
        "other_participant.user.photo",
        "other_participant.user.profile_photo",
        "other_participant.user.profilePhoto",
        "other_participant.user.avatar_url",
        "other_participant.user.avatarUrl",

        "participant.avatar",
        "participant.image",
        "participant.photo",
        "participant.profile_photo",
        "participant.profilePhoto",
        "participant.avatar_url",
        "participant.avatarUrl",
        "participant.user.avatar",
        "participant.user.image",
        "participant.user.photo",
        "participant.user.profile_photo",
        "participant.user.profilePhoto",
        "participant.user.avatar_url",
        "participant.user.avatarUrl",

        "employee.avatar",
        "employee.image",
        "employee.photo",
        "employee.profile_photo",
        "employee.profilePhoto",
        "employee.avatar_url",
        "employee.avatarUrl",
        "employee.user.avatar",
        "employee.user.image",
        "employee.user.photo",
        "employee.user.profile_photo",
        "employee.user.profilePhoto",
        "employee.user.avatar_url",
        "employee.user.avatarUrl",

        "customer.avatar",
        "customer.image",
        "customer.photo",
        "customer.profile_photo",
        "customer.profilePhoto",
        "customer.avatar_url",
        "customer.avatarUrl",
        "customer.user.avatar",
        "customer.user.image",
        "customer.user.photo",
        "customer.user.profile_photo",
        "customer.user.profilePhoto",
        "customer.user.avatar_url",
        "customer.user.avatarUrl",

        "user.avatar",
        "user.image",
        "user.photo",
        "user.profile_photo",
        "user.profilePhoto",
        "user.avatar_url",
        "user.avatarUrl",
    ]);

    const isBlocked = getConversationBlockedState(conversation);
    const canSendMessage = getConversationCanSendMessage(conversation);

    return {
        id: String(id || conversation?.uuid || conversation?.key || Date.now()),
        conversationId: id,
        targetUserId,
        name: String(name || (isArabic ? "محادثة" : "Conversation")),
        department: getDepartmentText(conversation),
        avatar,
        message: String(message || ""),
        time: formatConversationTime(time, isArabic),
        unread: Number.isFinite(unread) ? unread : 0,
        status: isBlocked ? "blocked" : isOnline ? "online" : "offline",
        isOnline: isBlocked ? false : isOnline,
        lastSeenAt,
        isGroup,
        isBlocked,
        canSendMessage,
        raw: conversation,
    };
};

const isFallbackConversationName = (name, isArabic) => {
    const cleanName = String(name || "").trim().toLowerCase();

    if (!cleanName) {
        return true;
    }

    return (
        cleanName === "conversation" ||
        cleanName === "محادثة" ||
        cleanName === String(isArabic ? "محادثة" : "conversation").toLowerCase()
    );
};

const getRealtimeConversationPayload = (payload) => {
    return (
        payload?.conversation ||
        payload?.data?.conversation ||
        payload?.conversation_data ||
        payload?.data?.conversation_data ||
        payload?.item?.conversation ||
        payload?.data?.item?.conversation ||
        payload?.data ||
        payload
    );
};

const getRealtimeMessagePayload = (payload, conversationPayload) => {
    return (
        payload?.message ||
        payload?.data?.message ||
        payload?.item ||
        payload?.data?.item ||
        payload?.latest_message ||
        payload?.data?.latest_message ||
        conversationPayload?.latest_message ||
        conversationPayload?.last_message ||
        conversationPayload?.message ||
        null
    );
};

const getRealtimeConversationId = (payload, conversationPayload) => {
    return normalizeId(
        getNestedValue(conversationPayload, [
            "id",
            "conversation_id",
            "conversationId",
        ], null) ||
        getNestedValue(payload, [
            "conversation_id",
            "conversationId",
            "conversation.id",
            "conversation.conversation_id",
            "data.conversation_id",
            "data.conversationId",
            "data.conversation.id",
            "message.conversation_id",
            "message.conversationId",
            "data.message.conversation_id",
            "data.message.conversationId",
        ], null)
    );
};

const getRealtimeSenderId = (payload, conversationPayload) => {
    const message = getRealtimeMessagePayload(payload, conversationPayload);

    return normalizeId(
        getNestedValue(message, [
            "sender_id",
            "senderId",
            "user_id",
            "userId",
            "sender.id",
            "user.id",
        ], null) ||
        getNestedValue(payload, [
            "sender_id",
            "senderId",
            "user_id",
            "userId",
            "sender.id",
            "user.id",
            "data.sender_id",
            "data.senderId",
            "data.sender.id",
            "data.user_id",
            "data.userId",
        ], null)
    );
};

const getRealtimeUnreadValue = (payload, conversationPayload) => {
    const unreadValue =
        getNestedValue(conversationPayload, [
            "unread_count",
            "unread",
            "unread_messages_count",
        ], null) ||
        getNestedValue(payload, [
            "unread_count",
            "unread",
            "unread_messages_count",
            "data.unread_count",
            "data.unread",
            "data.unread_messages_count",
        ], null);

    if (unreadValue === undefined || unreadValue === null || unreadValue === "") {
        return null;
    }

    const numericValue = Number(unreadValue);

    return Number.isFinite(numericValue) ? numericValue : null;
};

const mergeChatKeepingNewestTime = (existingChat, nextChat, isArabic) => {
    if (!existingChat) {
        return nextChat;
    }

    const existingTimeValue = getConversationRawTimeValue(existingChat?.raw || {});
    const nextTimeValue = getConversationRawTimeValue(nextChat?.raw || {});
    const newestTimeValue = getNewestConversationTimeValue(existingTimeValue, nextTimeValue);

    const existingTimestamp = getConversationTimeTimestamp(existingTimeValue);
    const nextTimestamp = getConversationTimeTimestamp(nextTimeValue);
    const shouldKeepExistingLatestData =
        existingTimestamp > nextTimestamp &&
        (existingChat?.message || existingChat?.raw?.latest_message_preview);

    const mergedRaw = {
        ...(nextChat?.raw || {}),
        latest_message_at: newestTimeValue || nextChat?.raw?.latest_message_at || existingChat?.raw?.latest_message_at,
    };

    if (shouldKeepExistingLatestData) {
        mergedRaw.latest_message = existingChat?.raw?.latest_message || mergedRaw.latest_message;
        mergedRaw.latest_message_preview =
            existingChat?.raw?.latest_message_preview ||
            existingChat?.message ||
            mergedRaw.latest_message_preview;
    }

    return {
        ...nextChat,
        avatar: nextChat.avatar || existingChat.avatar || null,
        message: shouldKeepExistingLatestData
            ? existingChat.message
            : nextChat.message,
        time: formatConversationTime(newestTimeValue, isArabic),
        raw: mergedRaw,
    };
};



const mergePreparedChatsWithCurrent = (currentChats, preparedChats, isArabic) => {
    return preparedChats.map((preparedChat) => {
        const existingChat = currentChats.find((chat) => {
            return (
                String(chat.conversationId || "") === String(preparedChat.conversationId || "") ||
                String(chat.id || "") === String(preparedChat.id || "")
            );
        });

        return mergeChatKeepingNewestTime(existingChat, preparedChat, isArabic);
    });
};

export default function Chat({ navigation }) {
    const { height: screenHeight } = useWindowDimensions();
    const { t, i18n } = useTranslation();
    const isArabic = i18n.language === "ar";

    const {
        currentUserId,
        latestConversationEvent,
        latestConversationBlockEvent,
        isUserOnline,
        onlineUserIds = [],
        presenceVersion,
    } = useAppRealtime();

    const { colors, isDark, setThemeMode, changeTheme, toggleTheme } = useAppTheme();
    const [currentIsDark, setCurrentIsDark] = useState(isDark);

    useEffect(() => {
        setCurrentIsDark(isDark);
    }, [isDark]);

    const styles = useMemo(() => createStyles(colors), [colors]);

    const [chats, setChats] = useState([]);
    const [search, setSearch] = useState("");
    const [activeFilter, setActiveFilter] = useState("all");
    const [showNavTitle, setShowNavTitle] = useState(false);
    const [selectMode, setSelectMode] = useState(false);
    const [selectedConversationIds, setSelectedConversationIds] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [paginationMeta, setPaginationMeta] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [errorMessage, setErrorMessage] = useState("");
    const [canSearchCustomers, setCanSearchCustomers] = useState(false);
    const [canCreateGroups, setCanCreateGroups] = useState(false);
    const [customerSearchResults, setCustomerSearchResults] = useState([]);
    const [isSearchingCustomers, setIsSearchingCustomers] = useState(false);
    const [customerSearchError, setCustomerSearchError] = useState("");
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [keyboardHeight, setKeyboardHeight] = useState(0);
    const [createGroupVisible, setCreateGroupVisible] = useState(false);

    const imageSource = isDark ? appImages.splashDark : appImages.splashLight;
    const filtersScrollRef = useRef(null);
    const hasLoadedInitialConversationsRef = useRef(false);
    const lastHandledConversationEventRef = useRef(null);
    const lastHandledConversationBlockEventRef = useRef(null);

    useEffect(() => {
        console.log("[CHAT ONLINE DEBUG] AppRealtime context changed:", {
            currentUserId,
            onlineUserIds,
            presenceVersion,
            hasIsUserOnline: typeof isUserOnline === "function",
        });
    }, [currentUserId, onlineUserIds, presenceVersion, isUserOnline]);

    const cleanSearch = search.trim();
    const isCustomerSearchMode = canSearchCustomers && cleanSearch.length > 0;
    const isValidCustomerPhoneSearch =
        cleanSearch.length >= 3 &&
        cleanSearch.length <= 20 &&
        CUSTOMER_PHONE_REGEX.test(cleanSearch);

    const chatListBottomPadding = useMemo(() => {
        if (!isSearchFocused) {
            return 8;
        }

        const fallbackKeyboardHeight = Math.round(screenHeight * 0.42);
        const currentKeyboardHeight = keyboardHeight > 0 ? keyboardHeight : fallbackKeyboardHeight;
        const bottomSafeSpace = Platform.OS === "android" ? 130 : 145;
        const maxPadding = Math.round(screenHeight * 0.72);

        return Math.min(currentKeyboardHeight + bottomSafeSpace, maxPadding);
    }, [isSearchFocused, keyboardHeight, screenHeight]);

    const unreadTotal = useMemo(() => {
        return chats.reduce((total, chat) => total + Number(chat.unread || 0), 0);
    }, [chats]);

    useEffect(() => {
        let isMounted = true;

        const loadProfilePermissions = async () => {
            try {
                const response = await chatService.getProfile();

                if (!isMounted) {
                    return;
                }

                setCanSearchCustomers(canUserSearchCustomers(response));
                setCanCreateGroups(canUserCreateGroups(response));
            } catch (error) {
                console.log("Load profile permissions error:", error?.raw || error);

                if (isMounted) {
                    setCanSearchCustomers(false);
                    setCanCreateGroups(false);
                }
            }
        };

        loadProfilePermissions();

        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        if (!canCreateGroups && createGroupVisible) {
            setCreateGroupVisible(false);
        }
    }, [canCreateGroups, createGroupVisible]);

    useEffect(() => {
        let isCancelled = false;
        let timeoutId = null;

        const runCustomerSearch = async () => {
            if (!canSearchCustomers || !cleanSearch) {
                setCustomerSearchResults([]);
                setCustomerSearchError("");
                setIsSearchingCustomers(false);
                return;
            }

            if (!isValidCustomerPhoneSearch) {
                setCustomerSearchResults([]);
                setCustomerSearchError("");
                setIsSearchingCustomers(false);
                return;
            }

            setIsSearchingCustomers(true);
            setCustomerSearchError("");

            timeoutId = setTimeout(async () => {
                try {
                    const response = await chatService.searchCustomers(cleanSearch);

                    if (isCancelled) {
                        return;
                    }

                    const preparedCustomers = getCustomerItems(response).map((customer) =>
                        normalizeCustomer(customer, isArabic)
                    );

                    setCustomerSearchResults(preparedCustomers);
                } catch (error) {
                    console.log("Search customers error:", error?.raw || error);

                    if (!isCancelled) {
                        setCustomerSearchResults([]);
                        setCustomerSearchError(
                            error?.userMessage ||
                            (isArabic
                                ? "صار خطأ أثناء البحث عن العملاء."
                                : "Something went wrong while searching customers.")
                        );
                    }
                } finally {
                    if (!isCancelled) {
                        setIsSearchingCustomers(false);
                    }
                }
            }, CUSTOMER_SEARCH_DEBOUNCE_MS);
        };

        runCustomerSearch();

        return () => {
            isCancelled = true;

            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        };
    }, [canSearchCustomers, cleanSearch, isArabic, isValidCustomerPhoneSearch]);

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

                let preparedChats = [];

                if (activeFilter === "employees") {
                    const [conversationsResponse, employeesResponse] = await Promise.all([
                        chatService.listConversations({
                            page: 1,
                            perPage: CHAT_LIST_PER_PAGE,
                        }),
                        employeeService.listEmployees(),
                    ]);

                    preparedChats = buildEmployeeDirectoryChats({
                        employeesResponse,
                        conversationsResponse,
                        isArabic,
                    });

                    setPaginationMeta(null);
                } else {
                    const response = await chatService.listConversations({
                        page,
                        perPage: CHAT_LIST_PER_PAGE,
                    });

                    preparedChats = getConversationItems(response).map((conversation) =>
                        normalizeConversation(conversation, isArabic)
                    );
                    setPaginationMeta(getPaginationMeta(response));
                }

                console.log("[CHAT ONLINE DEBUG] Prepared chats after API normalize:", preparedChats.map((chat) => ({
                    name: chat.name,
                    id: chat.id,
                    conversationId: chat.conversationId,
                    targetUserId: chat.targetUserId,
                    avatar: chat.avatar,
                    isGroup: chat.isGroup,
                    isEmployee: chat.isEmployee,
                    apiIsOnline: chat.isOnline,
                    rawOnlineStatus: chat.raw?.online_status,
                    status: chat.status,
                    lastSeenAt: chat.lastSeenAt,
                })));

                setChats((currentChats) => {
                    if (page === 1) {
                        return mergePreparedChatsWithCurrent(currentChats, preparedChats, isArabic);
                    }

                    const existingIds = new Set(currentChats.map((chat) => String(chat.id)));
                    const uniqueNewChats = preparedChats.filter(
                        (chat) => !existingIds.has(String(chat.id))
                    );

                    return [...currentChats, ...uniqueNewChats];
                });
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
        [activeFilter, isArabic]
    );

    const applyRealtimeConversationUpdate = useCallback((payload) => {
        console.log(
            "[Chat Realtime] ConversationUpdated RAW PAYLOAD:",
            JSON.stringify(payload, null, 2)
        );

        const conversationPayload = getRealtimeConversationPayload(payload);
        const conversationId = getRealtimeConversationId(payload, conversationPayload);
        const messagePayload = getRealtimeMessagePayload(payload, conversationPayload);

        console.log(
            "[Chat Realtime] Conversation payload:",
            JSON.stringify(conversationPayload, null, 2)
        );

        console.log(
            "[Chat Realtime] Message payload:",
            JSON.stringify(messagePayload, null, 2)
        );

        console.log("[Chat Realtime] Parsed values:", {
            conversationId,
            currentUserId,
            senderId: getRealtimeSenderId(payload, conversationPayload),
            unread: getRealtimeUnreadValue(payload, conversationPayload),
        });

        if (!conversationPayload || typeof conversationPayload !== "object" || !conversationId) {
            console.log("[Chat Realtime] Missing conversation payload or id. Fetching first page.");

            fetchConversations({ page: 1 }).catch((error) => {
                console.log("Realtime conversation fallback fetch error:", error?.raw || error);
            });

            return;
        }

        const normalizedConversation = normalizeConversation(conversationPayload, isArabic);
        const senderId = getRealtimeSenderId(payload, conversationPayload);
        const unreadFromPayload = getRealtimeUnreadValue(payload, conversationPayload);
        const hasUnreadFromPayload = unreadFromPayload !== null;
        const isOwnMessage =
            currentUserId &&
            senderId &&
            String(senderId) === String(currentUserId);

        setChats((currentChats) => {
            const existingIndex = currentChats.findIndex((chat) => {
                return (
                    String(chat.conversationId || "") === String(conversationId) ||
                    String(chat.id || "") === String(conversationId)
                );
            });

            const existingChat = existingIndex >= 0 ? currentChats[existingIndex] : null;

            if (existingIndex === -1) {
                console.log(
                    "[Chat Realtime] Conversation does not exist locally. Fetching first page instead of adding fallback chat:",
                    conversationId
                );

                setTimeout(() => {
                    fetchConversations({ page: 1 }).catch((error) => {
                        console.log("Realtime new conversation fetch error:", error?.raw || error);
                    });
                }, 50);

                return currentChats;
            }

            const previousUnread = Number(existingChat?.unread || 0);

            const nextUnread = hasUnreadFromPayload
                ? unreadFromPayload
                : isOwnMessage
                    ? previousUnread
                    : previousUnread;

            const shouldKeepExistingName =
                existingChat?.name &&
                isFallbackConversationName(normalizedConversation.name, isArabic);

            const shouldKeepExistingDepartment =
                existingChat?.department &&
                !normalizedConversation.department;

            const shouldKeepExistingTargetUserId =
                existingChat?.targetUserId &&
                !normalizedConversation.targetUserId;

            const shouldKeepExistingAvatar =
                existingChat?.avatar &&
                !normalizedConversation.avatar;

            const shouldKeepExistingRawLatestMessage =
                existingChat?.raw?.latest_message &&
                !conversationPayload?.latest_message &&
                !conversationPayload?.last_message &&
                !conversationPayload?.message;

            const existingTimeValue = getConversationRawTimeValue(existingChat?.raw || {});
            const incomingTimeValue = getConversationRawTimeValue(conversationPayload);
            const newestTimeValue = getNewestConversationTimeValue(
                existingTimeValue,
                incomingTimeValue
            );

            const nextRaw = {
                ...(existingChat?.raw || {}),
                ...conversationPayload,
                latest_message_at:
                    newestTimeValue ||
                    conversationPayload?.latest_message_at ||
                    existingChat?.raw?.latest_message_at,
            };

            if (shouldKeepExistingRawLatestMessage) {
                nextRaw.latest_message = existingChat.raw.latest_message;
            }

            const nextChat = {
                ...(existingChat || {}),
                ...normalizedConversation,
                id: String(normalizedConversation.id || conversationId),
                conversationId: normalizedConversation.conversationId || conversationId,

                name: shouldKeepExistingName
                    ? existingChat.name
                    : normalizedConversation.name,

                department: shouldKeepExistingDepartment
                    ? existingChat.department
                    : normalizedConversation.department,

                targetUserId: shouldKeepExistingTargetUserId
                    ? existingChat.targetUserId
                    : normalizedConversation.targetUserId,

                avatar: shouldKeepExistingAvatar
                    ? existingChat.avatar
                    : normalizedConversation.avatar,

                unread: Number.isFinite(nextUnread) ? nextUnread : previousUnread,
                time: formatConversationTime(newestTimeValue, isArabic),

                raw: nextRaw,
            };

            console.log("[Chat Realtime] Existing chat:", existingChat);
            console.log("[Chat Realtime] Next chat:", nextChat);

            const remainingChats = currentChats.filter((_, index) => index !== existingIndex);

            return [nextChat, ...remainingChats];
        });
    }, [currentUserId, fetchConversations, isArabic]);

    useEffect(() => {
        if (!latestConversationEvent) {
            return;
        }

        if (lastHandledConversationEventRef.current === latestConversationEvent) {
            return;
        }

        lastHandledConversationEventRef.current = latestConversationEvent;
        applyRealtimeConversationUpdate(latestConversationEvent);
    }, [applyRealtimeConversationUpdate, latestConversationEvent]);

    useEffect(() => {
        if (!latestConversationBlockEvent) {
            return;
        }

        if (lastHandledConversationBlockEventRef.current === latestConversationBlockEvent) {
            return;
        }

        lastHandledConversationBlockEventRef.current = latestConversationBlockEvent;

        fetchConversations({ page: 1 }).catch((error) => {
            console.log("Conversation block realtime refresh error:", error?.raw || error);
        });
    }, [fetchConversations, latestConversationBlockEvent]);

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
        if (isCustomerSearchMode) {
            return customerSearchResults.map((customerResult) => {
                const matchedChat = chats.find((chat) => {
                    const sameTargetUser =
                        customerResult.targetUserId &&
                        chat.targetUserId &&
                        String(customerResult.targetUserId) === String(chat.targetUserId);

                    const sameName =
                        customerResult.name &&
                        chat.name &&
                        String(customerResult.name).trim().toLowerCase() ===
                        String(chat.name).trim().toLowerCase();

                    return sameTargetUser || sameName;
                });

                if (!matchedChat) {
                    return customerResult;
                }

                return {
                    ...customerResult,
                    ...matchedChat,

                    id: customerResult.id,
                    name: customerResult.name || matchedChat.name,
                    targetUserId: customerResult.targetUserId || matchedChat.targetUserId,
                    conversationId: matchedChat.conversationId,
                    unread: matchedChat.unread,
                    message: matchedChat.message,
                    time: matchedChat.time,
                    department: matchedChat.department || customerResult.department,
                    avatar: matchedChat.avatar || customerResult.avatar,
                    status: matchedChat.status,
                    isOnline: matchedChat.isOnline || customerResult.isOnline,
                    lastSeenAt: matchedChat.lastSeenAt || customerResult.lastSeenAt,
                    raw: matchedChat.raw || customerResult.raw,

                    isCustomerSearchResult: true,
                };
            });
        }

        console.log("[CHAT ONLINE DEBUG] Building visible chats:", chats.map((chat) => ({
            name: chat.name,
            id: chat.id,
            conversationId: chat.conversationId,
            targetUserId: chat.targetUserId,
            avatar: chat.avatar,
            isGroup: chat.isGroup,
            isEmployee: chat.isEmployee,
            isOnline: chat.isOnline,
            status: chat.status,
        })));

        return chats.filter((chat) => {
            const chatDepartment = String(chat.department || "").toLowerCase();

            const matchesFilter =
                activeFilter === "all" ||
                (activeFilter === "employees" && chat.isEmployee === true) ||
                (activeFilter === "groups" && chat.isGroup === true) ||
                (activeFilter === "sales" && chatDepartment.includes("sales")) ||
                (activeFilter === "airFreightSales" && chatDepartment.includes("air")) ||
                (activeFilter === "seaFreightSales" && chatDepartment.includes("sea")) ||
                (activeFilter === "landFreightSales" && chatDepartment.includes("land")) ||
                (activeFilter === "accounting" && chatDepartment.includes("accounting"));

            return matchesFilter;
        });
    }, [activeFilter, chats, customerSearchResults, isCustomerSearchMode]);

    const canLoadMore = useMemo(() => {
        if (isCustomerSearchMode) {
            return false;
        }

        if (activeFilter === "employees") {
            return false;
        }

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
    }, [activeFilter, currentPage, isCustomerSearchMode, paginationMeta]);

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

    useEffect(() => {
        const keyboardShowSubscription = Keyboard.addListener("keyboardDidShow", (event) => {
            setKeyboardHeight(event?.endCoordinates?.height || 0);
        });

        const keyboardHideSubscription = Keyboard.addListener("keyboardDidHide", () => {
            setKeyboardHeight(0);
            setIsSearchFocused(false);
        });

        return () => {
            keyboardShowSubscription.remove();
            keyboardHideSubscription.remove();
        };
    }, []);

    const toggleLanguage = () => {
        const nextLanguage = isArabic ? "en" : "ar";
        requestAnimationFrame(() => {
            i18n.changeLanguage(nextLanguage);
        });
    };

    const handleSelectChats = () => {
        setSelectMode((prev) => {
            const nextValue = !prev;

            if (!nextValue) {
                setSelectedConversationIds([]);
            }

            return nextValue;
        });
    };

    const toggleSelectedConversation = (chat) => {
        const selectableConversationId = normalizeId(chat?.conversationId);

        if (!selectableConversationId) {
            return;
        }

        setSelectedConversationIds((currentIds) => {
            const isAlreadySelected = currentIds.some(
                (id) => String(id) === String(selectableConversationId)
            );

            if (isAlreadySelected) {
                return currentIds.filter(
                    (id) => String(id) !== String(selectableConversationId)
                );
            }

            return [...currentIds, selectableConversationId];
        });
    };

    const handleReadAll = async () => {
        const previousChats = chats;
        const selectedIds = selectedConversationIds
            .map((id) => normalizeId(id))
            .filter(Boolean);
        const shouldReadSelectedOnly = selectMode && selectedIds.length > 0;

        setChats((currentChats) =>
            currentChats.map((chat) => {
                const chatConversationId = normalizeId(chat.conversationId);

                if (shouldReadSelectedOnly) {
                    const isSelected = selectedIds.some(
                        (id) => String(id) === String(chatConversationId)
                    );

                    return isSelected
                        ? {
                            ...chat,
                            unread: 0,
                        }
                        : chat;
                }

                return {
                    ...chat,
                    unread: 0,
                };
            })
        );

        try {
            if (shouldReadSelectedOnly) {
                await chatService.markConversationsRead(selectedIds);

                selectedIds.forEach((conversationId) => {
                    DeviceEventEmitter.emit(BOTTOM_TAB_BADGE_EVENTS.CLEAR_CHAT_CONVERSATION, {
                        conversationId,
                    });
                });

                setSelectedConversationIds([]);
                setSelectMode(false);
                return;
            }

            await chatService.markAllConversationsRead();

            DeviceEventEmitter.emit(BOTTOM_TAB_BADGE_EVENTS.CLEAR_ALL_CHAT);
            setSelectedConversationIds([]);
            setSelectMode(false);
        } catch (error) {
            console.log(
                shouldReadSelectedOnly
                    ? "Mark selected conversations read error:"
                    : "Mark all conversations read error:",
                error?.raw || error
            );
            setChats(previousChats);
        }
    };

    const handleChatPress = (selectedChat) => {
        if (selectMode) {
            toggleSelectedConversation(selectedChat);
            return;
        }

        Keyboard.dismiss();
        setIsSearchFocused(false);

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

            DeviceEventEmitter.emit(BOTTOM_TAB_BADGE_EVENTS.CLEAR_CHAT_CONVERSATION, {
                conversationId: selectedChat.conversationId,
            });
        }

        const selectedChatTargetUserId = normalizeId(selectedChat.targetUserId);
        const selectedChatLiveIsOnline = !!(
            selectedChatTargetUserId &&
            typeof isUserOnline === "function" &&
            isUserOnline(selectedChatTargetUserId)
        );
        const selectedChatIsBlocked =
            selectedChat.isBlocked === true || selectedChat.canSendMessage === false;
        const selectedChatIsOnline = !selectedChatIsBlocked && !selectedChat.isGroup && (
            selectedChatLiveIsOnline ||
            (!selectedChatTargetUserId && selectedChat.isOnline === true)
        );

        const selectedChatAvatar =
            selectedChat.avatar ||
            selectedChat.raw?.avatar ||
            selectedChat.raw?.target_user?.avatar ||
            selectedChat.raw?.targetUser?.avatar ||
            selectedChat.raw?.other_participant?.avatar ||
            selectedChat.raw?.other_participant?.user?.avatar ||
            selectedChat.raw?.participant?.avatar ||
            selectedChat.raw?.participant?.user?.avatar ||
            selectedChat.raw?.employee?.avatar ||
            selectedChat.raw?.employee?.user?.avatar ||
            selectedChat.raw?.customer?.avatar ||
            selectedChat.raw?.customer?.user?.avatar ||
            null;

        console.log("[CHAT ONLINE DEBUG] Open chat press:", {
            name: selectedChat.name,
            id: selectedChat.id,
            conversationId: selectedChat.conversationId,
            targetUserId: selectedChat.targetUserId,
            selectedChatTargetUserId,
            avatar: selectedChatAvatar,
            isGroup: selectedChat.isGroup,
            apiIsOnline: selectedChat.isOnline,
            selectedChatLiveIsOnline,
            selectedChatIsOnline,
            onlineUserIds,
        });

        navigation.navigate("IndividualChat", {
            conversationId: selectedChat.conversationId,
            conversation: selectedChat.raw,
            targetUserId: selectedChat.targetUserId,
            target_user_id: selectedChat.targetUserId,
            isGroup: selectedChat.isGroup,
            is_group: selectedChat.isGroup,
            isBlocked: selectedChatIsBlocked,
            is_blocked: selectedChatIsBlocked,
            canSendMessage: selectedChat.canSendMessage !== false,
            can_send_message: selectedChat.canSendMessage !== false,
            customer: selectedChat.isCustomerSearchResult
                ? {
                    id: selectedChat.targetUserId,
                    user_id: selectedChat.targetUserId,
                    target_user_id: selectedChat.targetUserId,
                    name: selectedChat.name,
                    full_name: selectedChat.name,
                    avatar: selectedChatAvatar,
                }
                : undefined,
            employee: {
                id: selectedChat.targetUserId,
                user_id: selectedChat.targetUserId,
                target_user_id: selectedChat.targetUserId,
                name: selectedChat.name,
                department: selectedChat.department,
                avatar: selectedChatAvatar,
                status: selectedChatIsOnline ? "online" : "offline",
                is_online: selectedChatIsOnline,
                isOnline: selectedChatIsOnline,
                is_blocked: selectedChatIsBlocked,
                isBlocked: selectedChatIsBlocked,
                can_send_message: selectedChat.canSendMessage !== false,
                canSendMessage: selectedChat.canSendMessage !== false,
                last_seen_at: selectedChat.lastSeenAt,
                lastSeenAt: selectedChat.lastSeenAt,
                conversation_id: selectedChat.conversationId,
                is_group: selectedChat.isGroup,
            },
        });
    };

    const handleChatListScroll = (event) => {
        const y = event.nativeEvent.contentOffset.y;
        setShowNavTitle(y > 45);

        const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
        const distanceFromBottom =
            contentSize.height - (layoutMeasurement.height + contentOffset.y);

        if (distanceFromBottom < 80) {
            handleLoadMore();
        }
    };

    const handleRetryCustomerSearch = () => {
        const currentSearch = cleanSearch;
        setSearch("");
        requestAnimationFrame(() => {
            setSearch(currentSearch);
        });
    };

    const getCreatedGroupConversation = (response) => {
        return (
            response?.data?.conversation ||
            response?.data?.data?.conversation ||
            response?.data?.item ||
            response?.data?.data ||
            response?.conversation ||
            response?.item ||
            response?.data ||
            response ||
            null
        );
    };

    const handleGroupCreated = async (response) => {
        const createdConversation = getCreatedGroupConversation(response);
        const createdConversationId = normalizeId(
            createdConversation?.id ||
            createdConversation?.conversation_id ||
            createdConversation?.conversationId
        );

        setCreateGroupVisible(false);

        await fetchConversations({
            page: 1,
            refreshLoading: false,
        });

        if (!createdConversationId) {
            setActiveFilter("groups");
            return;
        }

        navigation.navigate("IndividualChat", {
            conversationId: createdConversationId,
            conversation: createdConversation,
            isGroup: true,
            is_group: true,
            employee: {
                id: createdConversationId,
                name:
                    createdConversation?.display_name ||
                    createdConversation?.title ||
                    createdConversation?.name ||
                    (isArabic ? "مجموعة" : "Group"),
                department: isArabic ? "مجموعة" : "Group",
                conversation_id: createdConversationId,
                is_group: true,
                isGroup: true,
            },
        });
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
            label:
                selectMode && selectedConversationIds.length > 0
                    ? `${t("chat.menuReadAll")} (${selectedConversationIds.length})`
                    : t("chat.menuReadAll"),
            iconType: "feather",
            iconName: "check-circle",
            onPress: handleReadAll,
        },
    ];

    const renderChatCards = () => {
        if (isCustomerSearchMode && !isValidCustomerPhoneSearch) {
            return (
                <View style={styles.loadingBox}>
                    <Feather name="search" size={30} color={colors.textMuted} />
                    <Text style={[styles.stateText, getTextDirectionStyle(isArabic)]}>
                        {isArabic
                            ? "اكتبي 3 أرقام على الأقل للبحث عن عميل."
                            : "Enter at least 3 digits to search for a customer."}
                    </Text>
                </View>
            );
        }

        if (isCustomerSearchMode && isSearchingCustomers) {
            return (
                <View style={styles.loadingBox}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={[styles.stateText, getTextDirectionStyle(isArabic)]}>
                        {isArabic ? "جاري البحث عن العملاء..." : "Searching customers..."}
                    </Text>
                </View>
            );
        }

        if (isCustomerSearchMode && customerSearchError) {
            return (
                <View style={styles.loadingBox}>
                    <Feather name="alert-circle" size={30} color={colors.danger} />
                    <Text style={[styles.stateText, getTextDirectionStyle(isArabic)]}>
                        {customerSearchError}
                    </Text>
                    <TouchableOpacity
                        activeOpacity={0.85}
                        style={styles.retryButton}
                        onPress={handleRetryCustomerSearch}
                    >
                        <Text style={styles.retryButtonText}>
                            {isArabic ? "إعادة المحاولة" : "Try again"}
                        </Text>
                    </TouchableOpacity>
                </View>
            );
        }

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
                        {isCustomerSearchMode
                            ? isArabic
                                ? "لا يوجد عملاء بهذا الرقم."
                                : "No customers found for this phone."
                            : isArabic
                                ? "لا توجد محادثات حالياً."
                                : "No conversations yet."}
                    </Text>
                </View>
            );
        }

        return (
            <>
                {visibleChats.map((chat) => {
                    const normalizedTargetUserId = normalizeId(chat.targetUserId);
                    const selectableConversationId = normalizeId(chat.conversationId);
                    const isSelectedConversation = !!(
                        selectableConversationId &&
                        selectedConversationIds.some(
                            (id) => String(id) === String(selectableConversationId)
                        )
                    );
                    const liveIsOnline = !!(
                        !chat.isGroup &&
                        normalizedTargetUserId &&
                        typeof isUserOnline === "function" &&
                        isUserOnline(normalizedTargetUserId)
                    );
                    const chatIsBlocked = chat.isBlocked === true || chat.canSendMessage === false;
                    const chatIsOnline = !chatIsBlocked && !chat.isGroup && (
                        liveIsOnline ||
                        (!normalizedTargetUserId && chat.isOnline === true)
                    );
                    const statusText = chatIsBlocked
                        ? (isArabic ? "محظور" : "Blocked")
                        : chatIsOnline
                            ? (isArabic ? "متصل الآن" : "Online")
                            : formatLastSeenText(chat.lastSeenAt, isArabic);
                    const statusColor = chatIsBlocked
                        ? colors.danger
                        : chatIsOnline
                            ? colors.primary
                            : colors.textMuted;

                    console.log("[CHAT ONLINE DEBUG] Render chat row:", {
                        name: chat.name,
                        id: chat.id,
                        conversationId: chat.conversationId,
                        targetUserId: chat.targetUserId,
                        normalizedTargetUserId,
                        avatar: chat.avatar,
                        isGroup: chat.isGroup,
                        apiIsOnline: chat.isOnline,
                        rawOnlineStatus: chat.raw?.online_status,
                        rawOnlineStatusCamel: chat.raw?.onlineStatus,
                        liveIsOnline,
                        chatIsOnline,
                        chatIsBlocked,
                        canSendMessage: chat.canSendMessage,
                        onlineUserIds,
                        status: chat.status,
                        statusText,
                    });

                    return (
                        <TouchableOpacity
                            key={chat.id}
                            activeOpacity={0.88}
                            style={[styles.chatCard, getRowDirectionStyle(isArabic)]}
                            onPress={() => handleChatPress(chat)}
                        >
                            {selectMode && (
                                <View
                                    style={[
                                        styles.selectCircle,
                                        isSelectedConversation && styles.selectCircleSelected,
                                    ]}
                                >
                                    <Feather
                                        name={isSelectedConversation ? "check" : "circle"}
                                        size={isSelectedConversation ? 17 : 20}
                                        color={
                                            isSelectedConversation
                                                ? colors.darkText
                                                : colors.textSecondary
                                        }
                                    />
                                </View>
                            )}

                            <View style={styles.avatarBox}>
                                <View style={styles.avatarCircle}>
                                    {chat.avatar ? (
                                        <Image
                                            source={{ uri: chat.avatar }}
                                            style={styles.avatarImage}
                                        />
                                    ) : (
                                        <Feather
                                            name="user"
                                            size={28}
                                            color={colors.textPrimary}
                                        />
                                    )}
                                </View>

                                <View
                                    style={[
                                        styles.statusDot,
                                        !chatIsOnline && !chatIsBlocked && styles.statusDotOffline,
                                        chatIsBlocked && { backgroundColor: colors.danger, opacity: 1 },
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

                                {!chat.isGroup && (
                                    <Text
                                        style={[
                                            styles.presenceText,
                                            { color: statusColor },
                                            getTextDirectionStyle(isArabic),
                                        ]}
                                        numberOfLines={1}
                                    >
                                        {statusText}
                                    </Text>
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
                    );
                })}

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
                        onCreateGroupPress={
                            canCreateGroups
                                ? () => setCreateGroupVisible(true)
                                : null
                        }
                        menuItems={chatMenuItems}
                    />

                    {canCreateGroups && (
                        <CreateGroupChatModal
                            visible={createGroupVisible}
                            colors={colors}
                            isArabic={isArabic}
                            onClose={() => setCreateGroupVisible(false)}
                            onCreated={handleGroupCreated}
                        />
                    )}

                    <View style={styles.content}>
                        <View style={styles.headerBox}>
                            <Text style={[styles.title, getTextDirectionStyle(isArabic)]}>
                                {t("chat.title")}
                            </Text>

                            <Text style={[styles.subtitle, getTextDirectionStyle(isArabic)]}>
                                {t("chat.subtitle")}
                            </Text>
                        </View>

                        {canSearchCustomers && (
                            <View style={[styles.searchBox, getRowDirectionStyle(isArabic)]}>
                                <Feather name="search" size={21} color={colors.textMuted} />

                                <TextInput
                                    value={search}
                                    onFocus={() => setIsSearchFocused(true)}
                                    onBlur={() => {
                                        if (!keyboardHeight) {
                                            setIsSearchFocused(false);
                                        }
                                    }}
                                    onChangeText={setSearch}
                                    placeholder={
                                        isArabic
                                            ? "ابحثي عن عميل برقم الهاتف..."
                                            : "Search customers by phone..."
                                    }
                                    placeholderTextColor={colors.textMuted}
                                    style={[
                                        styles.searchInput,
                                        getTextInputDirectionFromValue(search, isArabic),
                                    ]}
                                    autoCorrect={false}
                                    autoCapitalize="none"
                                    keyboardType="phone-pad"
                                />

                                {!!search && (
                                    <TouchableOpacity
                                        activeOpacity={0.85}
                                        style={styles.filterButton}
                                        onPress={() => setSearch("")}
                                    >
                                        <Feather name="x" size={20} color={colors.textPrimary} />
                                    </TouchableOpacity>
                                )}

                                {!search && (
                                    <View style={styles.filterButton}>
                                        <Feather name="sliders" size={20} color={colors.textPrimary} />
                                    </View>
                                )}
                            </View>
                        )}

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
                                            {filter === "employees"
                                                ? isArabic
                                                    ? "الموظفون"
                                                    : "Employees"
                                                : t(`chat.filters.${filter}`)}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>

                        <ScrollView
                            style={styles.chatListScroll}
                            contentContainerStyle={[
                                styles.chatListContent,
                                { paddingBottom: chatListBottomPadding },
                            ]}
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                            keyboardDismissMode="on-drag"
                            onScrollBeginDrag={() => {
                                Keyboard.dismiss();
                                setIsSearchFocused(false);
                            }}
                            onScroll={handleChatListScroll}
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
                            <View style={styles.chatCardsWrapper}>
                                {renderChatCards()}
                            </View>
                        </ScrollView>
                    </View>
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

        content: {
            flex: 1,
            paddingHorizontal: 20,
            paddingTop: Platform.OS === "android" ? 130 : 150,
            paddingBottom: Platform.OS === "android" ? 120 : 135,
        },

        selectCircle: {
            width: 28,
            height: 28,
            borderRadius: 14,
            alignItems: "center",
            justifyContent: "center",
        },

        selectCircleSelected: {
            backgroundColor: colors.primary,
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
            flexGrow: 0,
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

        chatListScroll: {
            flex: 1,
        },

        chatListContent: {
            flexGrow: 1,
            paddingBottom: 8,
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
            overflow: "hidden",
        },

        avatarImage: {
            width: "100%",
            height: "100%",
            borderRadius: 29,
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

        statusDotOffline: {
            backgroundColor: colors.textMuted,
            opacity: 0.72,
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

        presenceText: {
            marginBottom: 4,
            fontSize: 12,
            lineHeight: 16,
            fontWeight: "800",
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
import apiClient, { API_BASE_URL } from "./apiClient";

const CONVERSATIONS_ENDPOINT = "/api/v1/conversations";

const getResponseData = (response) => response?.data ?? null;

const normalizeAvatarUrl = (value) => {
    if (!value || typeof value !== "string") {
        return null;
    }

    const cleanValue = value.trim();

    if (!cleanValue) {
        return null;
    }

    if (cleanValue.startsWith("http://") || cleanValue.startsWith("https://")) {
        return cleanValue;
    }

    if (cleanValue.startsWith("/")) {
        return `${API_BASE_URL}${cleanValue}`;
    }

    return `${API_BASE_URL}/${cleanValue}`;
};

const normalizeCallableContact = (conversation) => {
    if (!conversation || typeof conversation !== "object") {
        return null;
    }

    const conversationId = Number(conversation.id);
    const userId = Number(
        conversation.target_user_id ??
        conversation.targetUserId ??
        conversation.other_user?.id ??
        conversation.otherUser?.id,
    );

    if (
        !Number.isInteger(conversationId) ||
        conversationId <= 0 ||
        !Number.isInteger(userId) ||
        userId <= 0
    ) {
        return null;
    }

    const isGroup = Boolean(
        conversation.is_group ??
        conversation.isGroup ??
        Number(conversation.type) === 2,
    );

    if (isGroup || conversation.can_call === false) {
        return null;
    }

    const name =
        conversation.display_name ||
        conversation.displayName ||
        conversation.other_user?.full_name ||
        conversation.otherUser?.fullName ||
        "";

    return {
        id: String(conversationId),
        conversationId,
        userId,
        name,
        subtitle:
            conversation.display_subtitle ||
            conversation.displaySubtitle ||
            conversation.department?.name ||
            "",
        avatar: normalizeAvatarUrl(
            conversation.avatar ||
            conversation.other_user?.avatar ||
            conversation.otherUser?.avatar ||
            null,
        ),
        initials:
            conversation.initials ||
            name
                .trim()
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((word) => word.charAt(0).toUpperCase())
                .join("") ||
            "?",
        isOnline: Boolean(conversation.online_status ?? conversation.onlineStatus),
        canCall: conversation.can_call !== false,
        raw: conversation,
    };
};

export const searchCallableContacts = async ({
    query = "",
    page = 1,
    perPage = 100,
} = {}) => {
    const normalizedQuery = typeof query === "string" ? query.trim() : "";

    const response = await apiClient.get(CONVERSATIONS_ENDPOINT, {
        page,
        per_page: perPage,
        filter: "all",
        ...(normalizedQuery ? { q: normalizedQuery } : {}),
    });

    const data = getResponseData(response);
    const rawItems = Array.isArray(data?.items) ? data.items : [];

    return {
        items: rawItems.map(normalizeCallableContact).filter(Boolean),
        meta: data?.meta ?? null,
    };
};

const searchService = {
    searchCallableContacts,
};

export default searchService;
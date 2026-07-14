import AsyncStorage from "@react-native-async-storage/async-storage";
import apiClient, { API_BASE_URL, STORAGE_KEYS } from "./apiClient";

const normalizeParams = (params = {}) => {
    const normalized = {};

    if (params.q !== undefined && params.q !== null && params.q !== "") {
        normalized.q = params.q;
    }

    if (params.search !== undefined && params.search !== null && params.search !== "") {
        normalized.search = params.search;
    }

    if (params.filter !== undefined && params.filter !== null && params.filter !== "") {
        normalized.filter = params.filter;
    }

    if (
        params.department !== undefined &&
        params.department !== null &&
        params.department !== ""
    ) {
        normalized.department = params.department;
    }

    if (params.page !== undefined && params.page !== null && params.page !== "") {
        normalized.page = params.page;
    }

    if (
        params.perPage !== undefined &&
        params.perPage !== null &&
        params.perPage !== ""
    ) {
        normalized.per_page = params.perPage;
    }

    if (
        params.per_page !== undefined &&
        params.per_page !== null &&
        params.per_page !== ""
    ) {
        normalized.per_page = params.per_page;
    }

    return normalized;
};

const normalizeUserIds = (userIds = []) => {
    const ids = Array.isArray(userIds) ? userIds : [userIds];

    return Array.from(
        new Set(
            ids
                .map((id) => Number(id))
                .filter((id) => Number.isInteger(id) && id > 0)
        )
    );
};

const getFileExtension = (fileName = "", uri = "") => {
    const source = String(fileName || uri || "").split("?")[0];
    const dotIndex = source.lastIndexOf(".");

    if (dotIndex === -1 || dotIndex >= source.length - 1) {
        return "";
    }

    return source.slice(dotIndex + 1).toLowerCase();
};

const normalizeUploadUri = (uri = "") => {
    const cleanUri = String(uri || "").trim();

    if (!cleanUri) {
        return "";
    }

    if (cleanUri.startsWith("file://") || cleanUri.startsWith("content://")) {
        return cleanUri;
    }

    return `file://${cleanUri}`;
};

const ensureFileNameExtension = (fileName = "", fallbackExtension = "") => {
    const cleanFileName = String(fileName || "").trim();

    if (!cleanFileName) {
        return "";
    }

    if (!fallbackExtension || getFileExtension(cleanFileName)) {
        return cleanFileName;
    }

    return `${cleanFileName}.${fallbackExtension}`;
};

const normalizeDurationSeconds = (duration, attachment = {}) => {
    const explicitDuration = Number(duration);

    if (Number.isFinite(explicitDuration) && explicitDuration > 0) {
        return Number(explicitDuration.toFixed(3));
    }

    const durationMillis = Number(
        attachment.durationMillis ??
        attachment.duration_millis ??
        attachment.audioDurationMillis ??
        attachment.audio_duration_millis ??
        0
    );

    if (Number.isFinite(durationMillis) && durationMillis > 0) {
        return Number((durationMillis / 1000).toFixed(3));
    }

    const attachmentDurationSeconds = Number(attachment.duration || 0);

    if (
        Number.isFinite(attachmentDurationSeconds) &&
        attachmentDurationSeconds > 0
    ) {
        return Number(attachmentDurationSeconds.toFixed(3));
    }

    return 0;
};

const normalizeAttachmentMimeType = (attachment = {}, messageType = 1) => {
    const normalizedMessageType = Number(messageType);

    const rawType = String(
        attachment.mimeType ||
        attachment.mime_type ||
        attachment.type ||
        ""
    )
        .trim()
        .toLowerCase();

    const fileName = String(
        attachment.name ||
        attachment.fileName ||
        attachment.filename ||
        ""
    );

    const extension = getFileExtension(fileName, attachment.uri);

    if (normalizedMessageType === 8) {
        if (extension === "m4a") return "audio/mp4";
        if (extension === "mp3") return "audio/mpeg";
        if (extension === "aac") return "audio/aac";
        if (extension === "wav") return "audio/wav";
        if (extension === "ogg" || extension === "oga") return "audio/ogg";
        if (extension === "webm") return "audio/webm";
        if (extension === "amr") return "audio/amr";
        if (extension === "awb") return "audio/amr-wb";
        if (extension === "opus") return "audio/opus";
        if (extension === "3gp" || extension === "3gpp") return "audio/3gpp";
        if (extension === "caf") return "audio/x-caf";
        if (extension === "aif" || extension === "aiff") return "audio/aiff";
        if (extension === "flac") return "audio/flac";
        if (extension === "mka") return "audio/x-matroska";

        if (rawType === "audio/x-m4a") return "audio/mp4";
        if (rawType === "audio/mpeg") return "audio/mpeg";
        if (rawType === "audio/mp4") return "audio/mp4";
        if (rawType === "audio/aac") return "audio/aac";
        if (rawType === "audio/wav") return "audio/wav";
        if (rawType === "audio/x-wav") return "audio/x-wav";
        if (rawType === "audio/webm") return "audio/webm";
        if (rawType === "audio/ogg") return "audio/ogg";

        if (rawType.startsWith("audio/")) {
            return rawType;
        }

        return "audio/mp4";
    }

    if (
        rawType &&
        rawType !== "video" &&
        rawType !== "image" &&
        rawType !== "audio" &&
        rawType !== "document"
    ) {
        if (extension === "m4a") {
            return "audio/mp4";
        }

        return rawType;
    }

    if (extension === "mp4") return normalizedMessageType === 8 ? "audio/mp4" : "video/mp4";
    if (extension === "mov") return "video/quicktime";
    if (extension === "m4v") return "video/x-m4v";
    if (extension === "avi") return "video/x-msvideo";
    if (extension === "webm" && rawType === "video") return "video/webm";

    if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
    if (extension === "png") return "image/png";
    if (extension === "webp") return "image/webp";
    if (extension === "gif") return "image/gif";

    if (extension === "m4a") return "audio/mp4";
    if (extension === "mp3") return "audio/mpeg";
    if (extension === "aac") return "audio/aac";
    if (extension === "wav") return "audio/wav";
    if (extension === "ogg" || extension === "oga") return "audio/ogg";
    if (extension === "amr") return "audio/amr";
    if (extension === "webm" && rawType === "audio") return "audio/webm";

    if (extension === "pdf") return "application/pdf";
    if (extension === "doc") return "application/msword";
    if (extension === "docx") {
        return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    }
    if (extension === "xls") return "application/vnd.ms-excel";
    if (extension === "xlsx") {
        return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    }
    if (extension === "csv") return "text/csv";
    if (extension === "txt") return "text/plain";

    if (rawType === "video") return "video/mp4";
    if (rawType === "image") return "image/jpeg";
    if (rawType === "audio") return "audio/mp4";

    return "application/octet-stream";
};

const isFilledValue = (value) => {
    return value !== undefined && value !== null && String(value).trim() !== "";
};

const normalizeQuoteNumber = (value) => {
    if (!isFilledValue(value)) {
        return null;
    }

    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) {
        return null;
    }

    return numericValue;
};

const normalizeQuoteInteger = (value) => {
    if (!isFilledValue(value)) {
        return null;
    }

    const numericValue = Number(value);

    if (!Number.isInteger(numericValue)) {
        return null;
    }

    return numericValue;
};

const normalizeQuoteString = (value) => {
    if (!isFilledValue(value)) {
        return null;
    }

    return String(value).trim();
};

const normalizeQuoteDate = (value) => {
    const cleanValue = normalizeQuoteString(value);

    if (!cleanValue) {
        return null;
    }

    if (/^\d{4}-\d{2}-\d{2}/.test(cleanValue)) {
        return cleanValue.slice(0, 10);
    }

    return cleanValue;
};

const normalizeQuoteIncludes = (includes) => {
    if (Array.isArray(includes)) {
        return includes
            .map((item) => normalizeQuoteString(item))
            .filter(Boolean);
    }

    if (typeof includes === "string") {
        return includes
            .split(/\r?\n|,/)
            .map((item) => normalizeQuoteString(item))
            .filter(Boolean);
    }

    return [];
};

const appendIfFilled = (payload, key, value) => {
    if (value !== undefined && value !== null && value !== "") {
        payload[key] = value;
    }
};

const buildQuotePayload = (quote = {}) => {
    const payload = {};

    appendIfFilled(payload, "risk_level", normalizeQuoteInteger(quote.risk_level ?? quote.riskLevel));
    appendIfFilled(payload, "origin_city", normalizeQuoteString(quote.origin_city ?? quote.originCity));
    appendIfFilled(payload, "origin_country", normalizeQuoteString(quote.origin_country ?? quote.originCountry)?.toUpperCase());
    appendIfFilled(payload, "destination_city", normalizeQuoteString(quote.destination_city ?? quote.destinationCity));
    appendIfFilled(payload, "destination_country", normalizeQuoteString(quote.destination_country ?? quote.destinationCountry)?.toUpperCase());
    appendIfFilled(payload, "cargo_type", normalizeQuoteString(quote.cargo_type ?? quote.cargoType));
    appendIfFilled(payload, "container_type", normalizeQuoteString(quote.container_type ?? quote.containerType));
    appendIfFilled(payload, "volume_cbm", normalizeQuoteNumber(quote.volume_cbm ?? quote.volumeCbm));
    appendIfFilled(payload, "weight_kg", normalizeQuoteNumber(quote.weight_kg ?? quote.weightKg));
    appendIfFilled(payload, "etd_date", normalizeQuoteDate(quote.etd_date ?? quote.etdDate));
    appendIfFilled(payload, "eta_date", normalizeQuoteDate(quote.eta_date ?? quote.etaDate));
    appendIfFilled(payload, "currency", normalizeQuoteString(quote.currency)?.toUpperCase());
    appendIfFilled(payload, "total_price", normalizeQuoteNumber(quote.total_price ?? quote.totalPrice));
    appendIfFilled(payload, "valid_until", normalizeQuoteDate(quote.valid_until ?? quote.validUntil));
    appendIfFilled(payload, "notes", normalizeQuoteString(quote.notes));
    appendIfFilled(payload, "employee_id", normalizeQuoteInteger(quote.employee_id ?? quote.employeeId));

    const includes = normalizeQuoteIncludes(quote.includes);

    if (includes.length > 0) {
        payload.includes = includes;
    }

    return payload;
};

const validateRequiredQuotePayload = (payload = {}) => {
    const requiredKeys = [
        "risk_level",
        "origin_city",
        "origin_country",
        "destination_city",
        "destination_country",
        "cargo_type",
        "currency",
        "total_price",
    ];

    const missingKeys = requiredKeys.filter((key) => !isFilledValue(payload[key]));

    if (missingKeys.length > 0) {
        throw new Error(`Missing required quote fields: ${missingKeys.join(", ")}.`);
    }
};

const buildAttachmentPayload = (attachment = {}, messageType = 1) => {
    if (!attachment?.uri) {
        return null;
    }

    const normalizedMessageType = Number(messageType);
    const mimeType = normalizeAttachmentMimeType(attachment, normalizedMessageType);
    const fallbackExtension = normalizedMessageType === 8
        ? "m4a"
        : getFileExtension(attachment.name || attachment.fileName || attachment.filename || "", attachment.uri);
    const fallbackName = normalizedMessageType === 8
        ? `voice-message-${Date.now()}.m4a`
        : `attachment-${Date.now()}${fallbackExtension ? `.${fallbackExtension}` : ""}`;
    const rawFileName =
        attachment.name ||
        attachment.fileName ||
        attachment.filename ||
        fallbackName;
    const fileName = normalizedMessageType === 8
        ? ensureFileNameExtension(rawFileName, "m4a") || fallbackName
        : rawFileName;

    const payload = {
        uri: normalizeUploadUri(attachment.uri),
        name: String(fileName),
        type: mimeType,
    };

    console.log("[Chat Upload] Attachment payload:", {
        ...payload,
        messageType: normalizedMessageType,
        size: attachment.size || attachment.fileSize || attachment.file_size || 0,
        durationSeconds: normalizeDurationSeconds(undefined, attachment),
    });

    return payload;
};

const buildMessageFormData = ({
    type = 1,
    body = "",
    attachment,
    duration,
    replyToMessageId,
    targetUserId,
} = {}) => {
    const formData = new FormData();
    const messageType = Number(type);
    const allowedMessageTypes = [1, 2, 3, 4, 8];

    if (!allowedMessageTypes.includes(messageType)) {
        throw new Error("A valid message type is required.");
    }

    if (targetUserId) {
        formData.append("target_user_id", String(targetUserId));
    }

    formData.append("type", String(messageType));

    const cleanBody = String(body || "").trim();

    if (messageType === 1 && !cleanBody) {
        throw new Error("Message body is required for text messages.");
    }

    if (cleanBody) {
        formData.append("body", cleanBody);
    }

    if (replyToMessageId) {
        formData.append("reply_to_message_id", String(replyToMessageId));
    }

    const attachmentPayload = buildAttachmentPayload(attachment, messageType);

    if ([2, 3, 4, 8].includes(messageType) && !attachmentPayload) {
        throw new Error("Attachment is required for this message type.");
    }

    if (attachmentPayload) {
        formData.append("attachment", attachmentPayload);
    }

    if (messageType === 8) {
        const durationSeconds = normalizeDurationSeconds(duration, attachment);

        if (durationSeconds <= 0 || durationSeconds > 3600) {
            throw new Error(
                "Audio duration must be greater than 0 and no more than 3600 seconds."
            );
        }

        formData.append("duration", String(durationSeconds));
    }

    return formData;
};

const buildFetchHeaders = async () => {
    const token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    const deviceId = await AsyncStorage.getItem(STORAGE_KEYS.DEVICE_ID);
    const language = await AsyncStorage.getItem(STORAGE_KEYS.APP_LANGUAGE);
    const socketId =
        typeof apiClient.getSocketId === "function"
            ? apiClient.getSocketId()
            : null;

    return {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(deviceId ? { "X-Device-ID": deviceId } : {}),
        ...(language ? { "Accept-Language": language } : {}),
        ...(socketId ? { "X-Socket-ID": socketId } : {}),
    };
};

const parseFetchResponse = async (response) => {
    const responseText = await response.text();

    if (!responseText) {
        return null;
    }

    try {
        return JSON.parse(responseText);
    } catch {
        return responseText;
    }
};

const sendFormDataWithFetch = async (endpoint, formData) => {
    const headers = await buildFetchHeaders();

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: "POST",
            headers,
            body: formData,
        });

        const responseBody = await parseFetchResponse(response);

        console.log("[CHAT SEND DEBUG] status:", response.status);
        console.log("[CHAT SEND DEBUG] response:", responseBody);

        if (!response.ok) {
            const message =
                responseBody?.message ||
                responseBody?.error ||
                "Failed to send message.";

            const error = new Error(message);
            error.raw = responseBody;
            error.userMessage = message;

            throw error;
        }

        return responseBody;
    } catch (error) {
        console.log("[CHAT SEND DEBUG] fetch error:", error?.raw || error);

        if (error?.userMessage) {
            throw error;
        }

        const nextError = new Error("Failed to send message.");
        nextError.raw = error;
        nextError.userMessage = "Failed to send message.";

        throw nextError;
    }
};

export const chatService = {
    async getProfile() {
        return apiClient.get("/api/v1/profile");
    },

    async searchCustomers(phone) {
        const cleanPhone = String(phone || "").trim();

        if (!cleanPhone) {
            return {
                success: true,
                data: [],
            };
        }

        const response = await apiClient.get("/api/v1/customers/search", {
            phone: cleanPhone,
        });

        console.log("[Customers Search] Response:", response);

        return response;
    },

    async searchUsers(query, params = {}) {
        const cleanQuery = String(query || "").trim();

        if (!cleanQuery) {
            return {
                success: true,
                data: {
                    admins: { items: [], has_more: false },
                    employees: { items: [], has_more: false },
                    customers: { items: [], has_more: false },
                },
            };
        }

        return apiClient.get("/api/v1/users/search", {
            q: cleanQuery,
            per_group: params?.per_group || params?.perGroup || 10,
        });
    },

    async listConversations(params = {}) {
        return apiClient.get("/api/v1/conversations", normalizeParams(params));
    },

    async createConversation(payload) {
        return apiClient.post("/api/v1/conversations", payload);
    },

    async showConversation(conversationId, params = {}) {
        if (!conversationId) {
            throw new Error("conversationId is required to show conversation.");
        }

        return apiClient.get(
            `/api/v1/conversations/${conversationId}`,
            normalizeParams(params)
        );
    },

    async clearConversation(conversationId) {
        if (!conversationId) {
            throw new Error("conversationId is required to clear conversation.");
        }

        return apiClient.post(`/api/v1/conversations/${conversationId}/clear`);
    },

    async deleteConversation(conversationId) {
        if (!conversationId) {
            throw new Error("conversationId is required to delete conversation.");
        }

        return apiClient.delete(`/api/v1/conversations/${conversationId}`);
    },

    async addGroupParticipants(conversationId, userIds = []) {
        if (!conversationId) {
            throw new Error("conversationId is required to add group participants.");
        }

        const normalizedUserIds = normalizeUserIds(userIds);

        if (normalizedUserIds.length === 0) {
            throw new Error("At least one user id is required to add group participants.");
        }

        return apiClient.post(`/api/v1/conversations/${conversationId}/participants`, {
            user_ids: normalizedUserIds,
        });
    },

    async removeGroupParticipant(conversationId, userId) {
        if (!conversationId) {
            throw new Error("conversationId is required to remove group participant.");
        }

        const normalizedUserId = Number(userId);

        if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
            throw new Error("A valid userId is required to remove group participant.");
        }

        return apiClient.delete(
            `/api/v1/conversations/${conversationId}/participants/${normalizedUserId}`
        );
    },

    async leaveGroup(conversationId) {
        if (!conversationId) {
            throw new Error("conversationId is required to leave group.");
        }

        return apiClient.post(`/api/v1/conversations/${conversationId}/leave`);
    },

    async blockConversationCustomer(conversationId) {
        if (!conversationId) {
            throw new Error("conversationId is required to block conversation customer.");
        }

        return apiClient.post(`/api/v1/conversations/${conversationId}/block`);
    },

    async unblockConversationCustomer(conversationId) {
        if (!conversationId) {
            throw new Error("conversationId is required to unblock conversation customer.");
        }

        return apiClient.delete(`/api/v1/conversations/${conversationId}/block`);
    },

    async markConversationRead(conversationId, lastMessageId) {
        if (!conversationId) {
            throw new Error("conversationId is required to mark conversation read.");
        }

        const payload = lastMessageId ? { last_message_id: lastMessageId } : {};

        return apiClient.post(`/api/v1/conversations/${conversationId}/read`, payload);
    },

    async markConversationsRead(conversationIds = []) {
        return apiClient.post("/api/v1/conversations/read", {
            conversation_ids: conversationIds,
        });
    },

    async markAllConversationsRead() {
        return apiClient.post("/api/v1/conversations/read-all");
    },

    async sendMessage(
        conversationId,
        {
            type = 1,
            body = "",
            attachment,
            duration,
            replyToMessageId,
        } = {}
    ) {
        if (!conversationId) {
            throw new Error("conversationId is required to send message.");
        }

        const formData = buildMessageFormData({
            type,
            body,
            attachment,
            duration,
            replyToMessageId,
        });

        return sendFormDataWithFetch(
            `/api/v1/conversations/${conversationId}/messages`,
            formData
        );
    },

    async startDirectMessage(
        targetUserId,
        {
            type = 1,
            body = "",
            attachment,
            duration,
        } = {}
    ) {
        if (!targetUserId) {
            throw new Error("targetUserId is required to start direct message.");
        }

        const formData = buildMessageFormData({
            type,
            body,
            attachment,
            duration,
            targetUserId,
        });

        return sendFormDataWithFetch("/api/v1/messages/start-direct", formData);
    },

    async createQuote(conversationId, quote = {}) {
        if (!conversationId) {
            throw new Error("conversationId is required to create quote.");
        }

        const payload = buildQuotePayload(quote);

        validateRequiredQuotePayload(payload);

        return apiClient.post(
            `/api/v1/conversations/${conversationId}/quotes`,
            payload
        );
    },

    async showQuote(quoteId) {
        if (!quoteId) {
            throw new Error("quoteId is required to show quote.");
        }

        return apiClient.get(`/api/v1/quotes/${quoteId}`);
    },

    async approveQuote(quoteId) {
        if (!quoteId) {
            throw new Error("quoteId is required to approve quote.");
        }

        return apiClient.patch(`/api/v1/quotes/${quoteId}/approve`);
    },

    async rejectQuote(quoteId) {
        if (!quoteId) {
            throw new Error("quoteId is required to reject quote.");
        }

        return apiClient.patch(`/api/v1/quotes/${quoteId}/reject`);
    },

    async cancelQuote(quoteId) {
        if (!quoteId) {
            throw new Error("quoteId is required to cancel quote.");
        }

        return apiClient.patch(`/api/v1/quotes/${quoteId}/cancel`);
    },

    async listConversationMedia(conversationId, params = {}) {
        if (!conversationId) {
            throw new Error("conversationId is required to list conversation media.");
        }

        return apiClient.get(
            `/api/v1/conversations/${conversationId}/media`,
            normalizeParams(params)
        );
    },

    async getConversationMedia(conversationId, params = {}) {
        return this.listConversationMedia(conversationId, params);
    },

    async listMedia(conversationId, params = {}) {
        return this.listConversationMedia(conversationId, params);
    },

    async searchConversationMessages(conversationId, params = {}) {
        if (!conversationId) {
            throw new Error("conversationId is required to search conversation messages.");
        }

        const cleanQuery = String(params?.q || params?.search || "").trim();

        if (cleanQuery.length < 2) {
            return {
                success: true,
                data: [],
            };
        }

        return apiClient.get(
            `/api/v1/conversations/${conversationId}/messages/search`,
            normalizeParams({
                ...params,
                q: cleanQuery,
            })
        );
    },

    async searchMessages(conversationId, params = {}) {
        return this.searchConversationMessages(conversationId, params);
    },

    async deleteMessage(messageId) {
        if (!messageId) {
            throw new Error("messageId is required to delete message.");
        }

        return apiClient.delete(`/api/v1/messages/${messageId}`);
    },
};

export default chatService;
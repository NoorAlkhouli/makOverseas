import apiClient from "./apiClient";

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

const getFileExtension = (fileName = "", uri = "") => {
    const source = String(fileName || uri || "").split("?")[0];
    const dotIndex = source.lastIndexOf(".");

    if (dotIndex === -1 || dotIndex >= source.length - 1) {
        return "";
    }

    return source.slice(dotIndex + 1).toLowerCase();
};

const normalizeAttachmentMimeType = (attachment = {}) => {
    const rawType = String(
        attachment.type ||
        attachment.mimeType ||
        attachment.mime_type ||
        ""
    ).toLowerCase();

    const fileName = String(
        attachment.name ||
        attachment.fileName ||
        attachment.filename ||
        ""
    );

    const extension = getFileExtension(fileName, attachment.uri);

    if (
        rawType &&
        rawType !== "video" &&
        rawType !== "image" &&
        rawType !== "audio" &&
        rawType !== "document"
    ) {
        return rawType;
    }

    if (extension === "mp4") return "video/mp4";
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

const buildAttachmentPayload = (attachment = {}) => {
    if (!attachment?.uri) {
        return null;
    }

    const payload = {
        uri: attachment.uri,
        name:
            attachment.name ||
            attachment.fileName ||
            attachment.filename ||
            `attachment-${Date.now()}`,
        type: normalizeAttachmentMimeType(attachment),
    };

    console.log("[Chat Upload] Attachment payload:", payload);

    return payload;
};

export const chatService = {
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
            replyToMessageId,
        } = {}
    ) {
        if (!conversationId) {
            throw new Error("conversationId is required to send message.");
        }

        const formData = new FormData();
        const messageType = Number(type);

        formData.append("type", String(messageType));

        const cleanBody = String(body || "").trim();

        if (cleanBody) {
            formData.append("body", cleanBody);
        }

        if (replyToMessageId) {
            formData.append("reply_to_message_id", String(replyToMessageId));
        }

        const attachmentPayload = buildAttachmentPayload(attachment);

        if (attachmentPayload) {
            formData.append("attachment", attachmentPayload);
        }

        return apiClient.upload(
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
            replyToMessageId,
        } = {}
    ) {
        if (!targetUserId) {
            throw new Error("targetUserId is required to start direct message.");
        }

        const formData = new FormData();
        const messageType = Number(type);

        formData.append("target_user_id", String(targetUserId));
        formData.append("type", String(messageType));

        const cleanBody = String(body || "").trim();

        if (cleanBody) {
            formData.append("body", cleanBody);
        }

        if (replyToMessageId) {
            formData.append("reply_to_message_id", String(replyToMessageId));
        }

        const attachmentPayload = buildAttachmentPayload(attachment);

        if (attachmentPayload) {
            formData.append("attachment", attachmentPayload);
        }

        return apiClient.upload("/api/v1/messages/start-direct", formData);
    },

    async deleteMessage(messageId) {
        if (!messageId) {
            throw new Error("messageId is required to delete message.");
        }

        return apiClient.delete(`/api/v1/messages/${messageId}`);
    },
};

export default chatService;

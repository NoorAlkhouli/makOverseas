/**
 * MAK Overseas - API Enums Reference
 * واجهة الكود: مرجع أرقام الـ Enums القادمة من Laravel API
 *
 * مكان الملف المقترح:
 * src/constants/apiEnums.js
 *
 * لماذا هذا الملف مهم؟
 * - يمنع استخدام أرقام عشوائية داخل الشاشات.
 * - يجعل كود React Native أوضح وأسهل للتعديل.
 * - يحافظ على تطابق الموبايل مع Laravel Enums.
 */

/**
 * MessageType
 * يستخدم في رسائل المحادثة:
 * message.type
 */
export const MESSAGE_TYPES = Object.freeze({
    TEXT: 1,
    IMAGE: 2,
    FILE: 3,
    VIDEO: 4,
    SYSTEM: 5,
    CALL: 6,
    QUOTE: 7,
});

export const MESSAGE_TYPE_LABELS = Object.freeze({
    [MESSAGE_TYPES.TEXT]: "text",
    [MESSAGE_TYPES.IMAGE]: "image",
    [MESSAGE_TYPES.FILE]: "file",
    [MESSAGE_TYPES.VIDEO]: "video",
    [MESSAGE_TYPES.SYSTEM]: "system",
    [MESSAGE_TYPES.CALL]: "call",
    [MESSAGE_TYPES.QUOTE]: "quote",
});

/**
 * NotificationType
 * يستخدم في notifications:
 * notification.type
 */
export const NOTIFICATION_TYPES = Object.freeze({
    ACTIVATION_CODE: 1,
    NEW_MESSAGE: 2,
    INCOMING_CALL: 3,
    MISSED_CALL: 4,
    CHANNEL_UPDATE: 5,
    ADMIN_APPROVAL: 6,
    ACCOUNT_BLOCKED: 7,
});

export const NOTIFICATION_TYPE_LABELS = Object.freeze({
    [NOTIFICATION_TYPES.ACTIVATION_CODE]: "activation_code",
    [NOTIFICATION_TYPES.NEW_MESSAGE]: "new_message",
    [NOTIFICATION_TYPES.INCOMING_CALL]: "incoming_call",
    [NOTIFICATION_TYPES.MISSED_CALL]: "missed_call",
    [NOTIFICATION_TYPES.CHANNEL_UPDATE]: "channel_update",
    [NOTIFICATION_TYPES.ADMIN_APPROVAL]: "admin_approval",
    [NOTIFICATION_TYPES.ACCOUNT_BLOCKED]: "account_blocked",
});

/**
 * CallStatus
 * يستخدم في:
 * call.status
 * call.status_updated.status
 */
export const CALL_STATUSES = Object.freeze({
    RINGING: 1,
    ACCEPTED: 2,
    REJECTED: 3,
    MISSED: 4,
    ENDED: 5,
    FAILED: 6,
    CANCELLED: 7,
});

export const CALL_STATUS_LABELS = Object.freeze({
    [CALL_STATUSES.RINGING]: "ringing",
    [CALL_STATUSES.ACCEPTED]: "accepted",
    [CALL_STATUSES.REJECTED]: "rejected",
    [CALL_STATUSES.MISSED]: "missed",
    [CALL_STATUSES.ENDED]: "ended",
    [CALL_STATUSES.FAILED]: "failed",
    [CALL_STATUSES.CANCELLED]: "cancelled",
});

/**
 * هذه الحالات نهائية، يعني لازم تسكري شاشة الرنين أو المكالمة عند وصولها.
 */
export const TERMINAL_CALL_STATUSES = Object.freeze([
    CALL_STATUSES.REJECTED,
    CALL_STATUSES.MISSED,
    CALL_STATUSES.ENDED,
    CALL_STATUSES.FAILED,
    CALL_STATUSES.CANCELLED,
]);

/**
 * CallEndReason
 * يستخدم في:
 * call.end_reason
 * call.status_updated.end_reason
 */
export const CALL_END_REASONS = Object.freeze({
    CALLER_ENDED: 1,
    RECEIVER_ENDED: 2,
    TIMEOUT: 3,
    NETWORK_ERROR: 4,
    REJECTED: 5,
    MISSED: 6,
});

export const CALL_END_REASON_LABELS = Object.freeze({
    [CALL_END_REASONS.CALLER_ENDED]: "caller_ended",
    [CALL_END_REASONS.RECEIVER_ENDED]: "receiver_ended",
    [CALL_END_REASONS.TIMEOUT]: "timeout",
    [CALL_END_REASONS.NETWORK_ERROR]: "network_error",
    [CALL_END_REASONS.REJECTED]: "rejected",
    [CALL_END_REASONS.MISSED]: "missed",
});

/**
 * Helpers
 */

export const getMessageTypeLabel = (type) => {
    return MESSAGE_TYPE_LABELS[type] || "unknown";
};

export const getNotificationTypeLabel = (type) => {
    return NOTIFICATION_TYPE_LABELS[type] || "unknown";
};

export const getCallStatusLabel = (status) => {
    return CALL_STATUS_LABELS[status] || "unknown";
};

export const getCallEndReasonLabel = (reason) => {
    if (reason === null || reason === undefined) return null;

    return CALL_END_REASON_LABELS[reason] || "unknown";
};

export const isTerminalCallStatus = (status) => {
    return TERMINAL_CALL_STATUSES.includes(status);
};

export const isMessageType = (message, type) => {
    return Number(message?.type) === type;
};

export const isNotificationType = (notification, type) => {
    return Number(notification?.type) === type;
};

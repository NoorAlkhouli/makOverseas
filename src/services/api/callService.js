import apiClient from "./apiClient";

const CALLS_ENDPOINT = "/api/v1/calls";

export const CALL_STATUSES = {
    RINGING: 1,
    ACCEPTED: 2,
    REJECTED: 3,
    MISSED: 4,
    ENDED: 5,
    FAILED: 6,
    CANCELLED: 7,
};

export const CALL_END_REASONS = {
    CALLER_ENDED: 1,
    RECEIVER_ENDED: 2,
    TIMEOUT: 3,
    NETWORK_ERROR: 4,
    REJECTED: 5,
    MISSED: 6,
};

const TERMINAL_CALL_STATUSES = new Set([
    CALL_STATUSES.REJECTED,
    CALL_STATUSES.ENDED,
    CALL_STATUSES.FAILED,
    CALL_STATUSES.CANCELLED,
]);

const SUBMITTABLE_CALL_STATUSES = new Set([
    CALL_STATUSES.ACCEPTED,
    CALL_STATUSES.REJECTED,
    CALL_STATUSES.ENDED,
    CALL_STATUSES.FAILED,
    CALL_STATUSES.CANCELLED,
]);

const getResponseData = (response) => {
    return response?.data ?? null;
};

const requirePositiveId = (value, fieldName) => {
    const id = Number(value);

    if (!Number.isInteger(id) || id <= 0) {
        throw new Error(
            `${fieldName} must be a positive integer.`
        );
    }

    return id;
};

export const normalizeCall = (call) => {
    if (!call || typeof call !== "object") {
        return null;
    }

    return {
        id: call.id ?? null,

        conversationId:
            call.conversation_id ?? null,

        callerId:
            call.caller_id ??
            call.caller?.id ??
            null,

        caller:
            call.caller ?? null,

        receiverId:
            call.receiver_id ??
            call.receiver?.id ??
            null,

        receiver:
            call.receiver ?? null,

        status:
            Number(call.status),

        endReason:
            call.end_reason === null ||
                call.end_reason === undefined
                ? null
                : Number(call.end_reason),

        startedAt:
            call.started_at ?? null,

        acceptedAt:
            call.accepted_at ?? null,

        endedAt:
            call.ended_at ?? null,

        duration:
            call.duration === null ||
                call.duration === undefined
                ? null
                : Number(call.duration),

        raw: call,
    };
};

export const initiateCall = async (receiverId) => {
    const normalizedReceiverId = requirePositiveId(
        receiverId,
        "receiverId"
    );

    const response = await apiClient.post(
        CALLS_ENDPOINT,
        {
            receiver_id: normalizedReceiverId,
        }
    );

    return normalizeCall(
        getResponseData(response)
    );
};

export const getCallCredentials = async () => {
    const response = await apiClient.get(
        `${CALLS_ENDPOINT}/credentials`
    );

    const data = getResponseData(response);

    return {
        urls: Array.isArray(data?.urls)
            ? data.urls
            : [],

        username:
            data?.username ?? "",

        credential:
            data?.credential ?? "",

        ttl:
            Number(data?.ttl ?? 0),
    };
};

export const updateCallStatus = async (
    callId,
    {
        status,
        endReason = null,
    } = {}
) => {
    const normalizedCallId = requirePositiveId(
        callId,
        "callId"
    );

    const normalizedStatus = Number(status);

    if (
        !SUBMITTABLE_CALL_STATUSES.has(
            normalizedStatus
        )
    ) {
        throw new Error("status is invalid.");
    }

    const body = {
        status: normalizedStatus,
    };

    if (
        TERMINAL_CALL_STATUSES.has(
            normalizedStatus
        )
    ) {
        const normalizedEndReason =
            Number(endReason);

        if (
            !Object.values(
                CALL_END_REASONS
            ).includes(normalizedEndReason)
        ) {
            throw new Error(
                "endReason is required for terminal statuses."
            );
        }

        body.end_reason =
            normalizedEndReason;
    }

    const response = await apiClient.patch(
        `${CALLS_ENDPOINT}/${normalizedCallId}/status`,
        body
    );

    return normalizeCall(
        getResponseData(response)
    );
};

export const acceptCall = (callId) => {
    return updateCallStatus(callId, {
        status: CALL_STATUSES.ACCEPTED,
    });
};

export const rejectCall = (callId) => {
    return updateCallStatus(callId, {
        status: CALL_STATUSES.REJECTED,
        endReason:
            CALL_END_REASONS.REJECTED,
    });
};

export const endCall = (
    callId,
    endReason =
        CALL_END_REASONS.CALLER_ENDED
) => {
    return updateCallStatus(callId, {
        status: CALL_STATUSES.ENDED,
        endReason,
    });
};

export const failCall = (
    callId,
    endReason =
        CALL_END_REASONS.NETWORK_ERROR
) => {
    return updateCallStatus(callId, {
        status: CALL_STATUSES.FAILED,
        endReason,
    });
};

export const cancelCall = (
    callId,
    endReason =
        CALL_END_REASONS.CALLER_ENDED
) => {
    return updateCallStatus(callId, {
        status: CALL_STATUSES.CANCELLED,
        endReason,
    });
};

const callService = {
    initiate: initiateCall,
    credentials: getCallCredentials,
    updateStatus: updateCallStatus,
    accept: acceptCall,
    reject: rejectCall,
    end: endCall,
    fail: failCall,
    cancel: cancelCall,
};

export default callService;
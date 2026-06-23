import { getEcho } from './echoClient';

const conversationChannels = new Map();

const isPlainObject = (value) => {
    return !!value && typeof value === 'object' && !Array.isArray(value);
};

const safeStringify = (value) => {
    try {
        return JSON.stringify(value, null, 2);
    } catch (error) {
        return String(value);
    }
};

const getMessageFromPayload = (payload) => {
    if (!payload) return null;

    const candidates = [
        payload?.message,
        payload?.data?.message,
        payload?.item,
        payload?.data?.item,
        payload?.data,
        payload,
    ];

    return candidates.find(isPlainObject) || null;
};

const getMessageDebugInfo = (message) => {
    if (!message) {
        return {
            hasMessage: false,
        };
    }

    const attachments = Array.isArray(message?.attachments)
        ? message.attachments
        : [];

    return {
        hasMessage: true,
        id: message?.id,
        message_id: message?.message_id,
        messageId: message?.messageId,
        conversation_id: message?.conversation_id,
        conversationId: message?.conversationId,
        type: message?.type,
        body: message?.body,
        is_mine: message?.is_mine,
        is_deleted: message?.is_deleted,
        deleted_at: message?.deleted_at,
        attachmentsCount: attachments.length,
        firstAttachment: attachments[0] || null,
    };
};

const getDeletePayloadDebugInfo = (payload) => {
    const message = getMessageFromPayload(payload);

    return {
        message: getMessageDebugInfo(message),
        payload_id: payload?.id,
        payload_message_id: payload?.message_id,
        payload_messageId: payload?.messageId,
        data_id: payload?.data?.id,
        data_message_id: payload?.data?.message_id,
        data_messageId: payload?.data?.messageId,
    };
};

const getTypingUserId = (event) => {
    const userId =
        event?.user_id ||
        event?.userId ||
        event?.sender_id ||
        event?.senderId ||
        event?.id ||
        event?.user?.id ||
        event?.user?.user_id ||
        event?.user?.userId ||
        null;

    if (userId === undefined || userId === null || userId === '') {
        return null;
    }

    return String(userId);
};

const normalizeTypingEvent = (event = {}, conversationId = null) => {
    const userId = getTypingUserId(event);
    const now = new Date().toISOString();

    const isTyping =
        event?.is_typing !== undefined
            ? event.is_typing
            : event?.isTyping !== undefined
                ? event.isTyping
                : true;

    const isRecording =
        event?.is_recording !== undefined
            ? event.is_recording
            : event?.isRecording !== undefined
                ? event.isRecording
                : event?.recording !== undefined
                    ? event.recording
                    : false;

    const userName =
        event?.user_name ||
        event?.userName ||
        event?.name ||
        event?.user?.name ||
        event?.user?.full_name ||
        '';

    const activityType =
        event?.activity_type ||
        event?.activityType ||
        (isRecording ? 'recording' : isTyping ? 'typing' : 'idle');

    return {
        ...event,

        conversation_id:
            event?.conversation_id ||
            event?.conversationId ||
            conversationId ||
            null,

        conversationId:
            event?.conversationId ||
            event?.conversation_id ||
            conversationId ||
            null,

        user_id: userId,
        userId,

        user_name: userName,
        userName,

        target_user_id:
            event?.target_user_id ||
            event?.targetUserId ||
            event?.receiver_id ||
            event?.receiverId ||
            null,

        targetUserId:
            event?.targetUserId ||
            event?.target_user_id ||
            event?.receiverId ||
            event?.receiver_id ||
            null,

        is_typing: !!isTyping,
        isTyping: !!isTyping,

        is_recording: !!isRecording,
        isRecording: !!isRecording,

        activity_type: activityType,
        activityType,

        typed_at:
            event?.typed_at ||
            event?.typedAt ||
            now,

        typedAt:
            event?.typedAt ||
            event?.typed_at ||
            now,
    };
};

const bindMessageEvent = (channelState, eventName, logName, handlerKey) => {
    channelState.channel.listen(eventName, (payload) => {
        const message = getMessageFromPayload(payload);

        console.log(
            `[Conversation Realtime] ${logName} RAW PAYLOAD:`,
            safeStringify(payload)
        );

        console.log(
            `[Conversation Realtime] ${logName} NORMALIZED MESSAGE:`,
            safeStringify(message)
        );

        console.log(
            `[Conversation Realtime] ${logName} MESSAGE CHECK:`,
            getMessageDebugInfo(message)
        );

        if (!message) {
            console.log(
                `[Conversation Realtime] ${logName} ignored: message payload is missing.`
            );
            return;
        }

        channelState.handlers?.[handlerKey]?.(message, payload);
    });
};

const bindDeleteMessageEvent = (channelState, eventName, logName, handlerKey) => {
    channelState.channel.listen(eventName, (payload) => {
        const message = getMessageFromPayload(payload);
        const deletePayload = message || payload;

        console.log(
            `[Conversation Realtime] ${logName} RAW PAYLOAD:`,
            safeStringify(payload)
        );

        console.log(
            `[Conversation Realtime] ${logName} DELETE CHECK:`,
            getDeletePayloadDebugInfo(payload)
        );

        // Delete events can arrive as a full message object OR only { id/message_id }.
        // Do not ignore the event just because a nested message object is missing.
        channelState.handlers?.[handlerKey]?.(deletePayload, payload);
    });
};

const bindTypingWhisperEvent = (channelState) => {
    if (typeof channelState?.channel?.listenForWhisper !== 'function') {
        console.log(
            '[Conversation Realtime] listenForWhisper is not available on this channel.'
        );
        return;
    }

    channelState.channel.listenForWhisper('typing', (event) => {
        const normalizedTypingEvent = normalizeTypingEvent(
            event,
            channelState.conversationId
        );

        console.log(
            '[Conversation Realtime] Typing whisper received:',
            normalizedTypingEvent
        );

        channelState.handlers?.onTyping?.(normalizedTypingEvent, event);
    });
};

const buildHandlers = ({
    onMessageSent,
    onMessageUpdated,
    onMessageDeleted,
    onMessageRemoved,
    onMessageDeletedForEveryone,
    onTyping,
}) => ({
    onMessageSent,
    onMessageUpdated,
    onMessageDeleted,
    onMessageRemoved,
    onMessageDeletedForEveryone,
    onTyping,
});

export function subscribeToConversationChannel({
    conversationId,
    onMessageSent,
    onMessageUpdated,
    onMessageDeleted,
    onMessageRemoved,
    onMessageDeletedForEveryone,
    onTyping,
}) {
    const echo = getEcho();

    if (!echo) {
        console.log('[Conversation Realtime] Echo is not initialized.');
        return null;
    }

    if (!conversationId) {
        console.log('[Conversation Realtime] conversationId is missing.');
        return null;
    }

    const normalizedConversationId = String(conversationId);
    const existingChannelState = conversationChannels.get(normalizedConversationId);

    if (existingChannelState) {
        existingChannelState.handlers = buildHandlers({
            onMessageSent,
            onMessageUpdated,
            onMessageDeleted,
            onMessageRemoved,
            onMessageDeletedForEveryone,
            onTyping,
        });

        console.log(
            '[Conversation Realtime] Already subscribed to conversation channel, handlers updated:',
            {
                conversationId: normalizedConversationId,
                isSubscribed: existingChannelState.isSubscribed === true,
                hasSubscriptionError: existingChannelState.hasSubscriptionError === true,
            }
        );

        return existingChannelState.channel;
    }

    const channelName = `conversation.${normalizedConversationId}`;

    console.log('[Conversation Realtime] Subscribing to:', channelName);

    const channel = echo.private(channelName);

    const channelState = {
        channel,
        channelName,
        conversationId: normalizedConversationId,
        isSubscribed: false,
        hasSubscriptionError: false,
        handlers: buildHandlers({
            onMessageSent,
            onMessageUpdated,
            onMessageDeleted,
            onMessageRemoved,
            onMessageDeletedForEveryone,
            onTyping,
        }),
    };

    conversationChannels.set(normalizedConversationId, channelState);

    channel
        .subscribed(() => {
            channelState.isSubscribed = true;
            channelState.hasSubscriptionError = false;

            console.log(
                '[Conversation Realtime] Subscribed successfully ✅',
                channelName
            );
        })
        .error((error) => {
            channelState.isSubscribed = false;
            channelState.hasSubscriptionError = true;

            console.log('[Conversation Realtime] Subscription error ❌', {
                channel: channelName,
                error,
            });
        });

    bindMessageEvent(channelState, '.MessageSent', 'MessageSent', 'onMessageSent');
    bindMessageEvent(channelState, 'MessageSent', 'MessageSent(no-dot)', 'onMessageSent');
    bindMessageEvent(channelState, '.message.sent', 'message.sent', 'onMessageSent');
    bindMessageEvent(channelState, 'message.sent', 'message.sent(no-dot)', 'onMessageSent');

    bindMessageEvent(channelState, '.MessageUpdated', 'MessageUpdated', 'onMessageUpdated');
    bindMessageEvent(channelState, 'MessageUpdated', 'MessageUpdated(no-dot)', 'onMessageUpdated');
    bindMessageEvent(channelState, '.message.updated', 'message.updated', 'onMessageUpdated');
    bindMessageEvent(channelState, 'message.updated', 'message.updated(no-dot)', 'onMessageUpdated');

    bindDeleteMessageEvent(channelState, '.MessageDeleted', 'MessageDeleted', 'onMessageDeleted');
    bindDeleteMessageEvent(channelState, 'MessageDeleted', 'MessageDeleted(no-dot)', 'onMessageDeleted');
    bindDeleteMessageEvent(channelState, '.message.deleted', 'message.deleted', 'onMessageDeleted');
    bindDeleteMessageEvent(channelState, 'message.deleted', 'message.deleted(no-dot)', 'onMessageDeleted');

    bindDeleteMessageEvent(channelState, '.MessageRemoved', 'MessageRemoved', 'onMessageRemoved');
    bindDeleteMessageEvent(channelState, 'MessageRemoved', 'MessageRemoved(no-dot)', 'onMessageRemoved');
    bindDeleteMessageEvent(channelState, '.message.removed', 'message.removed', 'onMessageRemoved');
    bindDeleteMessageEvent(channelState, 'message.removed', 'message.removed(no-dot)', 'onMessageRemoved');

    bindDeleteMessageEvent(channelState, '.MessageDeletedForEveryone', 'MessageDeletedForEveryone', 'onMessageDeletedForEveryone');
    bindDeleteMessageEvent(channelState, 'MessageDeletedForEveryone', 'MessageDeletedForEveryone(no-dot)', 'onMessageDeletedForEveryone');
    bindDeleteMessageEvent(channelState, '.message.deleted_for_everyone', 'message.deleted_for_everyone', 'onMessageDeletedForEveryone');
    bindDeleteMessageEvent(channelState, 'message.deleted_for_everyone', 'message.deleted_for_everyone(no-dot)', 'onMessageDeletedForEveryone');
    bindDeleteMessageEvent(channelState, '.message.deleted.for.everyone', 'message.deleted.for.everyone', 'onMessageDeletedForEveryone');
    bindDeleteMessageEvent(channelState, 'message.deleted.for.everyone', 'message.deleted.for.everyone(no-dot)', 'onMessageDeletedForEveryone');

    bindTypingWhisperEvent(channelState);

    return channel;
}

export function sendConversationTypingWhisper({
    conversationId,
    userId,
    userName,
    targetUserId,
    isTyping = true,
    isRecording = false,
    activityType,
} = {}) {
    if (!conversationId) {
        console.log(
            '[Conversation Realtime] Cannot send typing whisper: conversationId is missing.'
        );
        return false;
    }

    const normalizedConversationId = String(conversationId);
    const channelState = conversationChannels.get(normalizedConversationId);
    const channel = channelState?.channel;

    if (!channel) {
        console.log(
            '[Conversation Realtime] Cannot send typing whisper: channel is not subscribed.',
            normalizedConversationId
        );
        return false;
    }

    if (channelState?.isSubscribed !== true) {
        console.log(
            '[Conversation Realtime] Cannot send typing whisper yet: channel auth/subscription is not ready.',
            {
                conversationId: normalizedConversationId,
                isSubscribed: channelState?.isSubscribed === true,
                hasSubscriptionError: channelState?.hasSubscriptionError === true,
            }
        );
        return false;
    }

    if (typeof channel.whisper !== 'function') {
        console.log(
            '[Conversation Realtime] Cannot send typing whisper: whisper is not available.'
        );
        return false;
    }

    const now = new Date().toISOString();
    const normalizedIsTyping = !!isTyping;
    const normalizedIsRecording = !!isRecording;

    const normalizedActivityType =
        activityType ||
        (normalizedIsRecording
            ? 'recording'
            : normalizedIsTyping
                ? 'typing'
                : 'idle');

    const payload = {
        conversation_id: normalizedConversationId,
        conversationId: normalizedConversationId,

        user_id: userId ? String(userId) : null,
        userId: userId ? String(userId) : null,

        user_name: userName || '',
        userName: userName || '',

        target_user_id: targetUserId ? String(targetUserId) : null,
        targetUserId: targetUserId ? String(targetUserId) : null,

        is_typing: normalizedIsTyping,
        isTyping: normalizedIsTyping,

        is_recording: normalizedIsRecording,
        isRecording: normalizedIsRecording,

        activity_type: normalizedActivityType,
        activityType: normalizedActivityType,

        typed_at: now,
        typedAt: now,
    };

    try {
        console.log('[Conversation Realtime] Sending typing whisper:', payload);

        channel.whisper('typing', payload);

        return true;
    } catch (error) {
        console.log('[Conversation Realtime] Failed to send typing whisper:', {
            conversationId: normalizedConversationId,
            error,
        });

        return false;
    }
}

export function getConversationChannel(conversationId) {
    if (!conversationId) {
        return null;
    }

    const normalizedConversationId = String(conversationId);

    return conversationChannels.get(normalizedConversationId)?.channel || null;
}

export function leaveConversationChannel(conversationId) {
    if (!conversationId) {
        return;
    }

    const normalizedConversationId = String(conversationId);
    const channelName = `conversation.${normalizedConversationId}`;

    const echo = getEcho({ silent: true });

    if (!echo) {
        conversationChannels.delete(normalizedConversationId);
        return;
    }

    console.log('[Conversation Realtime] Leaving:', channelName);

    echo.leave(channelName);
    conversationChannels.delete(normalizedConversationId);
}
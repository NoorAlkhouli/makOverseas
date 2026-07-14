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

const getGroupEventPayload = (payload) => {
    if (!payload) return null;

    const candidates = [
        payload?.conversation,
        payload?.data?.conversation,
        payload?.group,
        payload?.data?.group,
        payload?.participant,
        payload?.data?.participant,
        payload?.item,
        payload?.data?.item,
        payload?.data,
        payload,
    ];

    return candidates.find(isPlainObject) || payload;
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

const normalizeMessagesReadEvent = (payload = {}, conversationId = null) => {
    const data = isPlainObject(payload?.data) ? payload.data : payload;

    const rawConversationId =
        data?.conversation_id ||
        data?.conversationId ||
        payload?.conversation_id ||
        payload?.conversationId ||
        conversationId ||
        null;

    const rawReaderId =
        data?.reader_id ||
        data?.readerId ||
        data?.user_id ||
        data?.userId ||
        data?.read_by_id ||
        data?.readById ||
        payload?.reader_id ||
        payload?.readerId ||
        payload?.user_id ||
        payload?.userId ||
        null;

    const messageIds =
        data?.message_ids ||
        data?.messageIds ||
        data?.messages_ids ||
        data?.messagesIds ||
        payload?.message_ids ||
        payload?.messageIds ||
        [];

    const lastReadMessageId =
        data?.last_read_message_id ||
        data?.lastReadMessageId ||
        data?.last_message_id ||
        data?.lastMessageId ||
        payload?.last_read_message_id ||
        payload?.lastReadMessageId ||
        payload?.last_message_id ||
        payload?.lastMessageId ||
        null;

    const readAt =
        data?.read_at ||
        data?.readAt ||
        data?.seen_at ||
        data?.seenAt ||
        payload?.read_at ||
        payload?.readAt ||
        payload?.seen_at ||
        payload?.seenAt ||
        new Date().toISOString();

    return {
        ...payload,
        ...data,

        conversation_id: rawConversationId ? String(rawConversationId) : null,
        conversationId: rawConversationId ? String(rawConversationId) : null,

        reader_id: rawReaderId ? String(rawReaderId) : null,
        readerId: rawReaderId ? String(rawReaderId) : null,

        user_id: rawReaderId ? String(rawReaderId) : null,
        userId: rawReaderId ? String(rawReaderId) : null,

        message_ids: Array.isArray(messageIds) ? messageIds : [],
        messageIds: Array.isArray(messageIds) ? messageIds : [],

        last_read_message_id: lastReadMessageId,
        lastReadMessageId: lastReadMessageId,

        read_at: readAt,
        readAt: readAt,
    };
};

const normalizeGroupEvent = (payload = {}, conversationId = null) => {
    const data = isPlainObject(payload?.data) ? payload.data : payload;
    const groupPayload = getGroupEventPayload(payload) || {};

    const rawConversationId =
        data?.conversation_id ||
        data?.conversationId ||
        data?.conversation?.id ||
        groupPayload?.conversation_id ||
        groupPayload?.conversationId ||
        groupPayload?.conversation?.id ||
        payload?.conversation_id ||
        payload?.conversationId ||
        payload?.conversation?.id ||
        conversationId ||
        null;

    const rawUserId =
        data?.user_id ||
        data?.userId ||
        data?.participant_user_id ||
        data?.participantUserId ||
        data?.participant?.user_id ||
        data?.participant?.userId ||
        data?.participant?.user?.id ||
        data?.user?.id ||
        groupPayload?.user_id ||
        groupPayload?.userId ||
        groupPayload?.participant_user_id ||
        groupPayload?.participantUserId ||
        groupPayload?.participant?.user_id ||
        groupPayload?.participant?.userId ||
        groupPayload?.participant?.user?.id ||
        groupPayload?.user?.id ||
        payload?.user_id ||
        payload?.userId ||
        payload?.participant_user_id ||
        payload?.participantUserId ||
        null;

    const rawActorId =
        data?.actor_id ||
        data?.actorId ||
        data?.performed_by_id ||
        data?.performedById ||
        data?.admin_id ||
        data?.adminId ||
        data?.actor?.id ||
        groupPayload?.actor_id ||
        groupPayload?.actorId ||
        groupPayload?.performed_by_id ||
        groupPayload?.performedById ||
        groupPayload?.admin_id ||
        groupPayload?.adminId ||
        groupPayload?.actor?.id ||
        payload?.actor_id ||
        payload?.actorId ||
        null;

    return {
        ...payload,
        ...data,

        conversation_id: rawConversationId ? String(rawConversationId) : null,
        conversationId: rawConversationId ? String(rawConversationId) : null,

        user_id: rawUserId ? String(rawUserId) : null,
        userId: rawUserId ? String(rawUserId) : null,

        actor_id: rawActorId ? String(rawActorId) : null,
        actorId: rawActorId ? String(rawActorId) : null,

        conversation:
            data?.conversation ||
            groupPayload?.conversation ||
            payload?.conversation ||
            null,

        participant:
            data?.participant ||
            groupPayload?.participant ||
            payload?.participant ||
            null,

        user:
            data?.user ||
            groupPayload?.user ||
            payload?.user ||
            null,

        rawPayload: payload,
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

        channelState.handlers?.[handlerKey]?.(deletePayload, payload);
    });
};

const bindMessagesReadEvent = (channelState, eventName, logName) => {
    channelState.channel.listen(eventName, (payload) => {
        const normalizedReadEvent = normalizeMessagesReadEvent(
            payload,
            channelState.conversationId
        );

        console.log(
            `[Conversation Realtime] ${logName} RAW PAYLOAD:`,
            safeStringify(payload)
        );

        console.log(
            `[Conversation Realtime] ${logName} NORMALIZED:`,
            normalizedReadEvent
        );

        channelState.handlers?.onMessagesRead?.(normalizedReadEvent, payload);
    });
};

const bindGroupEvent = (channelState, eventName, logName, handlerKey) => {
    channelState.channel.listen(eventName, (payload) => {
        const normalizedGroupEvent = normalizeGroupEvent(
            payload,
            channelState.conversationId
        );

        console.log(
            `[Conversation Realtime] ${logName} RAW PAYLOAD:`,
            safeStringify(payload)
        );

        console.log(
            `[Conversation Realtime] ${logName} NORMALIZED:`,
            normalizedGroupEvent
        );

        channelState.handlers?.[handlerKey]?.(normalizedGroupEvent, payload);
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
    onMessagesRead,
    onTyping,

    onGroupParticipantAdded,
    onGroupParticipantRemoved,
    onGroupParticipantLeft,
    onGroupDeleted,
    onGroupOwnershipTransferred,
    onConversationRemoved,
    onConversationUpdated,
}) => ({
    onMessageSent,
    onMessageUpdated,
    onMessageDeleted,
    onMessageRemoved,
    onMessageDeletedForEveryone,
    onMessagesRead,
    onTyping,

    onGroupParticipantAdded,
    onGroupParticipantRemoved,
    onGroupParticipantLeft,
    onGroupDeleted,
    onGroupOwnershipTransferred,
    onConversationRemoved,
    onConversationUpdated,
});

export function subscribeToConversationChannel({
    conversationId,
    onMessageSent,
    onMessageUpdated,
    onMessageDeleted,
    onMessageRemoved,
    onMessageDeletedForEveryone,
    onMessagesRead,
    onTyping,

    onGroupParticipantAdded,
    onGroupParticipantRemoved,
    onGroupParticipantLeft,
    onGroupDeleted,
    onGroupOwnershipTransferred,
    onConversationRemoved,
    onConversationUpdated,
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
            onMessagesRead,
            onTyping,

            onGroupParticipantAdded,
            onGroupParticipantRemoved,
            onGroupParticipantLeft,
            onGroupDeleted,
            onGroupOwnershipTransferred,
            onConversationRemoved,
            onConversationUpdated,
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
            onMessagesRead,
            onTyping,

            onGroupParticipantAdded,
            onGroupParticipantRemoved,
            onGroupParticipantLeft,
            onGroupDeleted,
            onGroupOwnershipTransferred,
            onConversationRemoved,
            onConversationUpdated,
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

    bindMessagesReadEvent(channelState, '.MessagesRead', 'MessagesRead');
    bindMessagesReadEvent(channelState, 'MessagesRead', 'MessagesRead(no-dot)');
    bindMessagesReadEvent(channelState, '.messages.read', 'messages.read');
    bindMessagesReadEvent(channelState, 'messages.read', 'messages.read(no-dot)');

    bindGroupEvent(channelState, '.GroupParticipantAdded', 'GroupParticipantAdded', 'onGroupParticipantAdded');
    bindGroupEvent(channelState, 'GroupParticipantAdded', 'GroupParticipantAdded(no-dot)', 'onGroupParticipantAdded');
    bindGroupEvent(channelState, '.group.participant.added', 'group.participant.added', 'onGroupParticipantAdded');
    bindGroupEvent(channelState, 'group.participant.added', 'group.participant.added(no-dot)', 'onGroupParticipantAdded');
    bindGroupEvent(channelState, '.group_participant_added', 'group_participant_added', 'onGroupParticipantAdded');
    bindGroupEvent(channelState, 'group_participant_added', 'group_participant_added(no-dot)', 'onGroupParticipantAdded');

    bindGroupEvent(channelState, '.GroupParticipantRemoved', 'GroupParticipantRemoved', 'onGroupParticipantRemoved');
    bindGroupEvent(channelState, 'GroupParticipantRemoved', 'GroupParticipantRemoved(no-dot)', 'onGroupParticipantRemoved');
    bindGroupEvent(channelState, '.group.participant.removed', 'group.participant.removed', 'onGroupParticipantRemoved');
    bindGroupEvent(channelState, 'group.participant.removed', 'group.participant.removed(no-dot)', 'onGroupParticipantRemoved');
    bindGroupEvent(channelState, '.group_participant_removed', 'group_participant_removed', 'onGroupParticipantRemoved');
    bindGroupEvent(channelState, 'group_participant_removed', 'group_participant_removed(no-dot)', 'onGroupParticipantRemoved');

    bindGroupEvent(channelState, '.GroupParticipantLeft', 'GroupParticipantLeft', 'onGroupParticipantLeft');
    bindGroupEvent(channelState, 'GroupParticipantLeft', 'GroupParticipantLeft(no-dot)', 'onGroupParticipantLeft');
    bindGroupEvent(channelState, '.group.participant.left', 'group.participant.left', 'onGroupParticipantLeft');
    bindGroupEvent(channelState, 'group.participant.left', 'group.participant.left(no-dot)', 'onGroupParticipantLeft');
    bindGroupEvent(channelState, '.group_participant_left', 'group_participant_left', 'onGroupParticipantLeft');
    bindGroupEvent(channelState, 'group_participant_left', 'group_participant_left(no-dot)', 'onGroupParticipantLeft');

    bindGroupEvent(channelState, '.GroupDeleted', 'GroupDeleted', 'onGroupDeleted');
    bindGroupEvent(channelState, 'GroupDeleted', 'GroupDeleted(no-dot)', 'onGroupDeleted');
    bindGroupEvent(channelState, '.group.deleted', 'group.deleted', 'onGroupDeleted');
    bindGroupEvent(channelState, 'group.deleted', 'group.deleted(no-dot)', 'onGroupDeleted');
    bindGroupEvent(channelState, '.group_deleted', 'group_deleted', 'onGroupDeleted');
    bindGroupEvent(channelState, 'group_deleted', 'group_deleted(no-dot)', 'onGroupDeleted');

    bindGroupEvent(channelState, '.GroupOwnershipTransferred', 'GroupOwnershipTransferred', 'onGroupOwnershipTransferred');
    bindGroupEvent(channelState, 'GroupOwnershipTransferred', 'GroupOwnershipTransferred(no-dot)', 'onGroupOwnershipTransferred');
    bindGroupEvent(channelState, '.group.ownership.transferred', 'group.ownership.transferred', 'onGroupOwnershipTransferred');
    bindGroupEvent(channelState, 'group.ownership.transferred', 'group.ownership.transferred(no-dot)', 'onGroupOwnershipTransferred');
    bindGroupEvent(channelState, '.group_ownership_transferred', 'group_ownership_transferred', 'onGroupOwnershipTransferred');
    bindGroupEvent(channelState, 'group_ownership_transferred', 'group_ownership_transferred(no-dot)', 'onGroupOwnershipTransferred');

    bindGroupEvent(channelState, '.ConversationRemoved', 'ConversationRemoved', 'onConversationRemoved');
    bindGroupEvent(channelState, 'ConversationRemoved', 'ConversationRemoved(no-dot)', 'onConversationRemoved');
    bindGroupEvent(channelState, '.conversation.removed', 'conversation.removed', 'onConversationRemoved');
    bindGroupEvent(channelState, 'conversation.removed', 'conversation.removed(no-dot)', 'onConversationRemoved');
    bindGroupEvent(channelState, '.conversation_removed', 'conversation_removed', 'onConversationRemoved');
    bindGroupEvent(channelState, 'conversation_removed', 'conversation_removed(no-dot)', 'onConversationRemoved');

    bindGroupEvent(channelState, '.ConversationUpdated', 'ConversationUpdated', 'onConversationUpdated');
    bindGroupEvent(channelState, 'ConversationUpdated', 'ConversationUpdated(no-dot)', 'onConversationUpdated');
    bindGroupEvent(channelState, '.conversation.updated', 'conversation.updated', 'onConversationUpdated');
    bindGroupEvent(channelState, 'conversation.updated', 'conversation.updated(no-dot)', 'onConversationUpdated');
    bindGroupEvent(channelState, '.conversation_updated', 'conversation_updated', 'onConversationUpdated');
    bindGroupEvent(channelState, 'conversation_updated', 'conversation_updated(no-dot)', 'onConversationUpdated');

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

    try {
        echo.leave(channelName);
    } catch (error) {
        console.log('[Conversation Realtime] Leave ignored after error:', {
            channelName,
            error,
        });
    }

    conversationChannels.delete(normalizedConversationId);
}

export function leaveAllConversationChannels() {
    const echo = getEcho({ silent: true });

    if (!echo) {
        conversationChannels.clear();
        return;
    }

    conversationChannels.forEach((channelState, conversationId) => {
        try {
            echo.leave(channelState.channelName);
        } catch (error) {
            console.log('[Conversation Realtime] Leave all ignored after error:', {
                conversationId,
                channelName: channelState.channelName,
                error,
            });
        }
    });

    conversationChannels.clear();
}
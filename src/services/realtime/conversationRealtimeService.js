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

export function subscribeToConversationChannel({
    conversationId,
    onMessageSent,
    onMessageUpdated,
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
        existingChannelState.handlers = {
            onMessageSent,
            onMessageUpdated,
        };

        console.log(
            '[Conversation Realtime] Already subscribed to conversation channel, handlers updated:',
            normalizedConversationId
        );

        return existingChannelState.channel;
    }

    const channelName = `conversation.${normalizedConversationId}`;

    console.log('[Conversation Realtime] Subscribing to:', channelName);

    const channel = echo.private(channelName);
    const channelState = {
        channel,
        handlers: {
            onMessageSent,
            onMessageUpdated,
        },
    };

    channel
        .subscribed(() => {
            console.log('[Conversation Realtime] Subscribed successfully ✅', channelName);
        })
        .error((error) => {
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

    conversationChannels.set(normalizedConversationId, channelState);

    return channel;
}

export function leaveConversationChannel(conversationId) {
    const echo = getEcho();

    if (!echo || !conversationId) {
        return;
    }

    const normalizedConversationId = String(conversationId);
    const channelName = `conversation.${normalizedConversationId}`;

    console.log('[Conversation Realtime] Leaving:', channelName);

    echo.leave(channelName);
    conversationChannels.delete(normalizedConversationId);
}
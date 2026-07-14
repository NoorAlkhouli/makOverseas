import { getEcho } from './echoClient';

let userChannel = null;
let subscribedUserId = null;

// كل listener محفوظ في Map حسب مفتاح فريد
const userListeners = new Map();

const REALTIME_DEBUG = __DEV__;

function logUserRealtime(...args) {
    if (REALTIME_DEBUG) {
        console.log('[User Realtime]', ...args);
    }
}

function getListenerKey(listenerKey) {
    return listenerKey || `listener-${Date.now()}-${Math.random()}`;
}

function normalizeId(value) {
    if (value === undefined || value === null || value === '') {
        return null;
    }

    return String(value);
}

function safeNotify(callback, payload, callbackName) {
    if (typeof callback !== 'function') {
        return;
    }

    try {
        callback(payload);
    } catch (error) {
        console.log('[User Realtime] Listener callback failed:', {
            callbackName,
            error,
        });
    }
}

// تسجيل listener جديد
function registerUserChannelListener({
    listenerKey,
    onConversationUpdated,
    onConversationBlockUpdated,
    onNotificationReceived,
    onNotificationReadStateChanged,
    onCallInitiated,
    onCallStatusUpdated,
}) {
    const key = getListenerKey(listenerKey);

    userListeners.set(key, {
        onConversationUpdated,
        onConversationBlockUpdated,
        onNotificationReceived,
        onNotificationReadStateChanged,
        onCallInitiated,
        onCallStatusUpdated,
    });

    return key;
}

// توجيه payload لكل listeners
function notifyUserListeners(callbackName, payload) {
    userListeners.forEach((listener) => {
        const callback = listener?.[callbackName];
        safeNotify(callback, payload, callbackName);
    });
}

function bindUserEvent(channel, eventNames, logName, callbackName) {
    eventNames.forEach((eventName) => {
        channel.listen(eventName, (payload) => {
            logUserRealtime(`${logName} received:`, payload);
            notifyUserListeners(callbackName, payload);
        });
    });
}

function bindUserChannelEvents(channel) {
    bindUserEvent(
        channel,
        [
            '.ConversationUpdated',
            'ConversationUpdated',
            '.conversation.updated',
            'conversation.updated',
        ],
        'ConversationUpdated',
        'onConversationUpdated'
    );

    bindUserEvent(
        channel,
        [
            '.ConversationBlockUpdated',
            'ConversationBlockUpdated',
            '.conversation.block_updated',
            'conversation.block_updated',
            '.conversation.block.updated',
            'conversation.block.updated',
        ],
        'ConversationBlockUpdated',
        'onConversationBlockUpdated'
    );

    bindUserEvent(
        channel,
        [
            '.notification.received',
            'notification.received',
            '.NotificationReceived',
            'NotificationReceived',
        ],
        'NotificationReceived',
        'onNotificationReceived'
    );

    bindUserEvent(
        channel,
        [
            '.notification.read_state_changed',
            'notification.read_state_changed',
            '.notification.read.state.changed',
            'notification.read.state.changed',
            '.NotificationReadStateChanged',
            'NotificationReadStateChanged',
        ],
        'NotificationReadStateChanged',
        'onNotificationReadStateChanged'
    );

    bindUserEvent(
        channel,
        [
            '.call.initiated',
            'call.initiated',
            '.CallInitiated',
            'CallInitiated',
        ],
        'CallInitiated',
        'onCallInitiated'
    );

    bindUserEvent(
        channel,
        [
            '.call.status_updated',
            'call.status_updated',
            '.call.status.updated',
            'call.status.updated',
            '.CallStatusUpdated',
            'CallStatusUpdated',
        ],
        'CallStatusUpdated',
        'onCallStatusUpdated'
    );
}

export function subscribeToUserChannel({
    userId,
    listenerKey,
    onConversationUpdated,
    onConversationBlockUpdated,
    onNotificationReceived,
    onNotificationReadStateChanged,
    onCallInitiated,
    onCallStatusUpdated,
}) {
    const echo = getEcho();

    if (!echo) {
        console.log('[User Realtime] Echo is not initialized.');
        return null;
    }

    const normalizedUserId = normalizeId(userId);

    if (!normalizedUserId) {
        console.log('[User Realtime] userId is missing.');
        return null;
    }

    const registeredListenerKey = registerUserChannelListener({
        listenerKey,
        onConversationUpdated,
        onConversationBlockUpdated,
        onNotificationReceived,
        onNotificationReadStateChanged,
        onCallInitiated,
        onCallStatusUpdated,
    });

    if (subscribedUserId === normalizedUserId && userChannel) {
        logUserRealtime('Already subscribed to user channel:', normalizedUserId);

        return {
            channel: userChannel,
            listenerKey: registeredListenerKey,
        };
    }

    if (subscribedUserId && subscribedUserId !== normalizedUserId) {
        leaveUserChannel(subscribedUserId);
    }

    const channelName = `user.${normalizedUserId}`;

    logUserRealtime('Subscribing to:', channelName);

    userChannel = echo.private(channelName);

    userChannel
        .subscribed(() => {
            logUserRealtime('Subscribed successfully ✅', channelName);
        })
        .error((error) => {
            console.log('[User Realtime] Subscription error ❌', {
                channel: channelName,
                error,
            });
        });

    bindUserChannelEvents(userChannel);

    subscribedUserId = normalizedUserId;

    return {
        channel: userChannel,
        listenerKey: registeredListenerKey,
    };
}

// إزالة listener فقط
export function unsubscribeUserChannelListener(listenerKey) {
    if (!listenerKey) {
        return;
    }

    userListeners.delete(listenerKey);
}

export function clearUserRealtimeListeners() {
    userListeners.clear();
}

// ترك القناة الحالية بالكامل
export function leaveCurrentUserChannel() {
    if (!subscribedUserId) {
        userChannel = null;
        userListeners.clear();
        return;
    }

    leaveUserChannel(subscribedUserId);
}

// ترك القناة بالكامل
export function leaveUserChannel(userId) {
    const normalizedUserId = normalizeId(userId);

    if (!normalizedUserId) {
        return;
    }

    const echo = getEcho({ silent: true });

    if (!echo) {
        if (subscribedUserId === normalizedUserId) {
            subscribedUserId = null;
            userChannel = null;
            userListeners.clear();
        }

        return;
    }

    const channelName = `user.${normalizedUserId}`;

    logUserRealtime('Leaving:', channelName);

    try {
        echo.leave(channelName);
    } catch (error) {
        console.log('[User Realtime] Leave ignored after error:', {
            channel: channelName,
            error,
        });
    }

    if (subscribedUserId === normalizedUserId) {
        subscribedUserId = null;
        userChannel = null;
        userListeners.clear();
    }
}

export function getCurrentUserChannel() {
    return userChannel;
}

export function getSubscribedUserId() {
    return subscribedUserId;
}
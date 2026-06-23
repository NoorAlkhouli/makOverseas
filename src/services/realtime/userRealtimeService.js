import { getEcho } from './echoClient';

let userChannel = null;
let subscribedUserId = null;

// جديد: كل listener محفوظ في Map حسب مفتاح فريد
const userListeners = new Map();

function getListenerKey(listenerKey) {
    return listenerKey || `listener-${Date.now()}-${Math.random()}`;
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

        if (typeof callback === 'function') {
            callback(payload);
        }
    });
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

    if (!userId) {
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

    if (subscribedUserId === userId && userChannel) {
        console.log('[User Realtime] Already subscribed to user channel:', userId);
        return {
            channel: userChannel,
            listenerKey: registeredListenerKey,
        };
    }

    if (subscribedUserId && subscribedUserId !== userId) {
        leaveUserChannel(subscribedUserId);
    }

    const channelName = `user.${userId}`;

    console.log('[User Realtime] Subscribing to:', channelName);

    userChannel = echo.private(channelName);

    userChannel
        .subscribed(() => {
            console.log('[User Realtime] Subscribed successfully ✅', channelName);
        })
        .error(error => {
            console.log('[User Realtime] Subscription error ❌', {
                channel: channelName,
                error,
            });
        })
        .listen('.ConversationUpdated', payload => {
            notifyUserListeners('onConversationUpdated', payload);
        })
        .listen('.ConversationBlockUpdated', payload => {
            notifyUserListeners('onConversationBlockUpdated', payload);
        })
        .listen('.notification.received', payload => {
            notifyUserListeners('onNotificationReceived', payload);
        })
        .listen('.notification.read_state_changed', payload => {
            notifyUserListeners('onNotificationReadStateChanged', payload);
        })
        .listen('.call.initiated', payload => {
            notifyUserListeners('onCallInitiated', payload);
        })
        .listen('.call.status_updated', payload => {
            notifyUserListeners('onCallStatusUpdated', payload);
        });

    subscribedUserId = userId;

    return {
        channel: userChannel,
        listenerKey: registeredListenerKey,
    };
}

// إزالة listener فقط
export function unsubscribeUserChannelListener(listenerKey) {
    if (!listenerKey) return;

    userListeners.delete(listenerKey);
}

// ترك القناة بالكامل
export function leaveUserChannel(userId) {
    const echo = getEcho({ silent: true });

    if (!userId) {
        return;
    }

    if (!echo) {
        if (subscribedUserId === userId) {
            subscribedUserId = null;
            userChannel = null;
            userListeners.clear();
        }

        return;
    }

    const channelName = `user.${userId}`;

    console.log('[User Realtime] Leaving:', channelName);

    echo.leave(channelName);

    if (subscribedUserId === userId) {
        subscribedUserId = null;
        userChannel = null;
        userListeners.clear();
    }
}
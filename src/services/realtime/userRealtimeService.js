import { getEcho } from './echoClient';

let userChannel = null;
let subscribedUserId = null;

export function subscribeToUserChannel({
    userId,
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

    if (subscribedUserId === userId && userChannel) {
        console.log('[User Realtime] Already subscribed to user channel:', userId);
        return userChannel;
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
            console.log('[User Realtime] ConversationUpdated:', payload);
            onConversationUpdated?.(payload);
        })
        .listen('.ConversationBlockUpdated', payload => {
            console.log('[User Realtime] ConversationBlockUpdated:', payload);
            onConversationBlockUpdated?.(payload);
        })
        .listen('.notification.received', payload => {
            console.log('[User Realtime] notification.received:', payload);
            onNotificationReceived?.(payload);
        })
        .listen('.notification.read_state_changed', payload => {
            console.log('[User Realtime] notification.read_state_changed:', payload);
            onNotificationReadStateChanged?.(payload);
        })
        .listen('.call.initiated', payload => {
            console.log('[User Realtime] call.initiated:', payload);
            onCallInitiated?.(payload);
        })
        .listen('.call.status_updated', payload => {
            console.log('[User Realtime] call.status_updated:', payload);
            onCallStatusUpdated?.(payload);
        });

    subscribedUserId = userId;

    return userChannel;
}

export function leaveUserChannel(userId) {
    const echo = getEcho();

    if (!echo || !userId) {
        return;
    }

    const channelName = `user.${userId}`;

    console.log('[User Realtime] Leaving:', channelName);

    echo.leave(channelName);

    if (subscribedUserId === userId) {
        subscribedUserId = null;
        userChannel = null;
    }
}

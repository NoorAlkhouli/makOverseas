import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';

import { apiClient } from '../services/api/apiClient';
import { initEcho } from '../services/realtime/echoClient';
import {
    leaveLivePresenceChannel,
    subscribeToLivePresenceChannel,
    unsubscribeLivePresenceListener,
} from '../services/realtime/livePresenceService';
import {
    leaveCurrentUserChannel,
    subscribeToUserChannel,
    unsubscribeUserChannelListener,
} from '../services/realtime/userRealtimeService';

const AppRealtimeContext = createContext(null);

const MAX_STORED_EVENTS = 50;

const getProfilePayload = (response) => {
    return (
        response?.data?.user ||
        response?.data?.profile ||
        response?.data ||
        response?.user ||
        response?.profile ||
        response ||
        null
    );
};

const getUserIdFromProfile = (response) => {
    const profile = getProfilePayload(response);

    return (
        profile?.id ||
        profile?.user_id ||
        profile?.userId ||
        profile?.user?.id ||
        profile?.profile?.id ||
        null
    );
};

const prependLimited = (items = [], item) => {
    return [item, ...items].slice(0, MAX_STORED_EVENTS);
};

const normalizeRealtimeUserId = (value) => {
    if (value === undefined || value === null || value === '') {
        return null;
    }

    return String(value);
};

const getRealtimeUserId = (user) => {
    return normalizeRealtimeUserId(
        user?.id ||
        user?.user_id ||
        user?.userId ||
        user?.member_id ||
        user?.memberId ||
        null
    );
};

const normalizeRealtimeUser = (user) => {
    if (!user || typeof user !== 'object') {
        return null;
    }

    const id = getRealtimeUserId(user);

    if (!id) {
        return null;
    }

    return {
        ...user,
        id,
        user_id: id,
        userId: id,
        full_name:
            user.full_name ||
            user.fullName ||
            user.name ||
            user.display_name ||
            user.displayName ||
            '',
    };
};

const normalizeRealtimeUsers = (users = []) => {
    if (!Array.isArray(users)) {
        return [];
    }

    return users
        .map(normalizeRealtimeUser)
        .filter(Boolean);
};

const buildOnlineUserIds = (users = []) => {
    return normalizeRealtimeUsers(users)
        .map((user) => user.id)
        .filter(Boolean);
};

const INITIAL_REALTIME_STATE = {
    isReady: false,
    currentUserId: null,

    onlineUsers: [],
    onlineUserIds: [],

    conversationEvents: [],
    notificationEvents: [],
    callEvents: [],

    latestConversationEvent: null,
    latestConversationBlockEvent: null,
    latestNotificationEvent: null,
    latestNotificationReadStateEvent: null,
    latestCallInitiatedEvent: null,
    latestCallStatusEvent: null,

    conversationVersion: 0,
    notificationVersion: 0,
    callVersion: 0,
    presenceVersion: 0,
};

export function AppRealtimeProvider({ children }) {
    const [state, setState] = useState(INITIAL_REALTIME_STATE);

    const listenerKeyRef = useRef(`app-realtime-${Date.now()}-${Math.random()}`);
    const livePresenceListenerKeyRef = useRef(`live-presence-${Date.now()}-${Math.random()}`);

    const isMountedRef = useRef(false);
    const subscribedUserIdRef = useRef(null);

    const updateState = useCallback((updater) => {
        if (!isMountedRef.current) {
            return;
        }

        setState(updater);
    }, []);

    useEffect(() => {
        isMountedRef.current = true;

        return () => {
            isMountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        let isCancelled = false;

        const cleanupRealtime = () => {
            try {
                if (listenerKeyRef.current) {
                    unsubscribeUserChannelListener(listenerKeyRef.current);
                }

                if (livePresenceListenerKeyRef.current) {
                    unsubscribeLivePresenceListener(livePresenceListenerKeyRef.current);
                }

                leaveLivePresenceChannel();
                leaveCurrentUserChannel();
            } catch (error) {
                console.log('[AppRealtime] Cleanup ignored after error:', error);
            } finally {
                subscribedUserIdRef.current = null;

                updateState(() => INITIAL_REALTIME_STATE);
            }
        };

        const initializeRealtime = async () => {
            try {
                console.log('[REALTIME DEBUG 01] AppRealtimeProvider initializeRealtime STARTED');

                const [token, deviceId, language] = await Promise.all([
                    apiClient.getToken(),
                    apiClient.getDeviceId(),
                    typeof apiClient.getLanguage === 'function'
                        ? apiClient.getLanguage()
                        : Promise.resolve('en'),
                ]);

                console.log('[REALTIME DEBUG 02] Token / DeviceId loaded:', {
                    hasToken: Boolean(token),
                    tokenLength: token ? String(token).length : 0,
                    hasDeviceId: Boolean(deviceId),
                    deviceId,
                    language,
                });

                if (isCancelled) {
                    return;
                }

                if (!token || !deviceId) {
                    console.log('[AppRealtime] Skipped: token or deviceId missing.', {
                        hasToken: Boolean(token),
                        hasDeviceId: Boolean(deviceId),
                    });

                    updateState(() => INITIAL_REALTIME_STATE);
                    return;
                }

                console.log('[REALTIME DEBUG 03] Fetching profile before Echo init...');

                const profileResponse = await apiClient.get('/api/v1/profile');

                console.log('[REALTIME DEBUG 04] Profile response:', profileResponse);

                if (isCancelled) {
                    return;
                }

                const userId = getUserIdFromProfile(profileResponse);

                console.log('[REALTIME DEBUG 05] Parsed current userId:', {
                    userId,
                    profilePayload: getProfilePayload(profileResponse),
                });

                if (!userId) {
                    console.log('[AppRealtime] Skipped: userId missing from profile.');
                    updateState(() => INITIAL_REALTIME_STATE);
                    return;
                }

                const normalizedUserId = String(userId);

                console.log('[REALTIME DEBUG 06] Calling initEcho...');

                const echo = initEcho({
                    token,
                    deviceId,
                    language: language || 'en',
                });

                console.log('[REALTIME DEBUG 07] Echo initialized:', {
                    hasEcho: Boolean(echo),
                    hasConnector: Boolean(echo?.connector),
                    hasPusher: Boolean(echo?.connector?.pusher),
                    socketId: echo?.socketId?.(),
                });

                if (isCancelled) {
                    return;
                }

                subscribedUserIdRef.current = normalizedUserId;

                updateState((currentState) => ({
                    ...currentState,
                    isReady: true,
                    currentUserId: normalizedUserId,
                }));

                console.log('[REALTIME DEBUG 08] Subscribing to LIVE presence channel...', {
                    listenerKey: livePresenceListenerKeyRef.current,
                });

                const livePresenceSubscription = subscribeToLivePresenceChannel({
                    listenerKey: livePresenceListenerKeyRef.current,

                    onHere: (users) => {
                        if (isCancelled) {
                            return;
                        }

                        console.log('[REALTIME DEBUG 09] LIVE .here raw users:', users);

                        const normalizedUsers = normalizeRealtimeUsers(users);
                        const nextOnlineUserIds = buildOnlineUserIds(normalizedUsers);

                        console.log('[REALTIME DEBUG 10] LIVE .here normalized:', {
                            normalizedUsers,
                            nextOnlineUserIds,
                        });

                        console.log('[AppRealtime] Live presence here:', {
                            count: normalizedUsers.length,
                            onlineUserIds: nextOnlineUserIds,
                        });

                        updateState((currentState) => ({
                            ...currentState,
                            onlineUsers: normalizedUsers,
                            onlineUserIds: nextOnlineUserIds,
                            presenceVersion: currentState.presenceVersion + 1,
                        }));
                    },

                    onJoining: (user) => {
                        if (isCancelled) {
                            return;
                        }

                        console.log('[REALTIME DEBUG 11] LIVE .joining raw user:', user);

                        const normalizedUser = normalizeRealtimeUser(user);

                        console.log('[REALTIME DEBUG 12] LIVE .joining normalized user:', normalizedUser);

                        if (!normalizedUser) {
                            return;
                        }

                        console.log('[AppRealtime] Live presence joining:', normalizedUser);

                        updateState((currentState) => {
                            const userIdValue = String(normalizedUser.id);
                            const currentOnlineUserIds = currentState.onlineUserIds || [];
                            const currentOnlineUsers = currentState.onlineUsers || [];

                            const nextOnlineUserIds = currentOnlineUserIds.includes(userIdValue)
                                ? currentOnlineUserIds
                                : [...currentOnlineUserIds, userIdValue];

                            const existingUserIndex = currentOnlineUsers.findIndex(
                                (item) => String(item?.id) === userIdValue
                            );

                            const nextOnlineUsers = existingUserIndex === -1
                                ? [...currentOnlineUsers, normalizedUser]
                                : currentOnlineUsers.map((item, index) =>
                                    index === existingUserIndex
                                        ? {
                                            ...item,
                                            ...normalizedUser,
                                        }
                                        : item
                                );

                            return {
                                ...currentState,
                                onlineUsers: nextOnlineUsers,
                                onlineUserIds: nextOnlineUserIds,
                                presenceVersion: currentState.presenceVersion + 1,
                            };
                        });
                    },

                    onLeaving: (user) => {
                        if (isCancelled) {
                            return;
                        }

                        console.log('[REALTIME DEBUG 13] LIVE .leaving raw user:', user);

                        const normalizedUser = normalizeRealtimeUser(user);

                        console.log('[REALTIME DEBUG 14] LIVE .leaving normalized user:', normalizedUser);

                        if (!normalizedUser) {
                            return;
                        }

                        console.log('[AppRealtime] Live presence leaving:', normalizedUser);

                        updateState((currentState) => {
                            const userIdValue = String(normalizedUser.id);

                            return {
                                ...currentState,
                                onlineUsers: (currentState.onlineUsers || []).filter(
                                    (item) => String(item?.id) !== userIdValue
                                ),
                                onlineUserIds: (currentState.onlineUserIds || []).filter(
                                    (id) => String(id) !== userIdValue
                                ),
                                presenceVersion: currentState.presenceVersion + 1,
                            };
                        });
                    },

                    onError: (error) => {
                        console.log('[REALTIME DEBUG 15] LIVE presence error:', error);
                        console.log('[AppRealtime] Live presence error:', error);
                    },
                });

                console.log('[REALTIME DEBUG 16] Live presence subscription result:', {
                    hasSubscription: Boolean(livePresenceSubscription),
                    hasChannel: Boolean(livePresenceSubscription?.channel),
                    listenerKey: livePresenceSubscription?.listenerKey,
                });

                if (livePresenceSubscription?.listenerKey) {
                    livePresenceListenerKeyRef.current = livePresenceSubscription.listenerKey;
                }

                console.log('[REALTIME DEBUG 17] Subscribing to USER private channel...', {
                    userId: normalizedUserId,
                    listenerKey: listenerKeyRef.current,
                });

                const subscription = subscribeToUserChannel({
                    userId: normalizedUserId,
                    listenerKey: listenerKeyRef.current,

                    onConversationUpdated: (payload) => {
                        if (isCancelled) {
                            return;
                        }

                        console.log('[AppRealtime] ConversationUpdated:', payload);

                        updateState((currentState) => ({
                            ...currentState,
                            latestConversationEvent: payload,
                            conversationEvents: prependLimited(
                                currentState.conversationEvents,
                                payload
                            ),
                            conversationVersion: currentState.conversationVersion + 1,
                        }));
                    },

                    onConversationBlockUpdated: (payload) => {
                        if (isCancelled) {
                            return;
                        }

                        console.log('[AppRealtime] ConversationBlockUpdated:', payload);

                        updateState((currentState) => ({
                            ...currentState,
                            latestConversationBlockEvent: payload,
                            conversationVersion: currentState.conversationVersion + 1,
                        }));
                    },

                    onNotificationReceived: (payload) => {
                        if (isCancelled) {
                            return;
                        }

                        console.log('[AppRealtime] notification.received:', payload);

                        updateState((currentState) => ({
                            ...currentState,
                            latestNotificationEvent: payload,
                            notificationEvents: prependLimited(
                                currentState.notificationEvents,
                                payload
                            ),
                            notificationVersion: currentState.notificationVersion + 1,
                        }));
                    },

                    onNotificationReadStateChanged: (payload) => {
                        if (isCancelled) {
                            return;
                        }

                        console.log('[AppRealtime] notification.read_state_changed:', payload);

                        updateState((currentState) => ({
                            ...currentState,
                            latestNotificationReadStateEvent: payload,
                            notificationVersion: currentState.notificationVersion + 1,
                        }));
                    },

                    onCallInitiated: (payload) => {
                        if (isCancelled) {
                            return;
                        }

                        console.log('[AppRealtime] call.initiated:', payload);

                        updateState((currentState) => ({
                            ...currentState,
                            latestCallInitiatedEvent: payload,
                            callEvents: prependLimited(
                                currentState.callEvents,
                                payload
                            ),
                            callVersion: currentState.callVersion + 1,
                        }));
                    },

                    onCallStatusUpdated: (payload) => {
                        if (isCancelled) {
                            return;
                        }

                        console.log('[AppRealtime] call.status_updated:', payload);

                        updateState((currentState) => ({
                            ...currentState,
                            latestCallStatusEvent: payload,
                            callVersion: currentState.callVersion + 1,
                        }));
                    },
                });

                console.log('[REALTIME DEBUG 18] User channel subscription result:', {
                    hasSubscription: Boolean(subscription),
                    hasChannel: Boolean(subscription?.channel),
                    listenerKey: subscription?.listenerKey,
                });

                if (subscription?.listenerKey) {
                    listenerKeyRef.current = subscription.listenerKey;
                }
            } catch (error) {
                if (isCancelled) {
                    return;
                }

                console.log('[AppRealtime] Init failed:', {
                    message: error?.message,
                    userMessage: error?.userMessage,
                    status: error?.status,
                    code: error?.code,
                    raw: error?.raw,
                    error,
                });

                updateState(() => INITIAL_REALTIME_STATE);
            }
        };

        initializeRealtime();

        return () => {
            isCancelled = true;
            cleanupRealtime();
        };
    }, [updateState]);

    const clearRealtimeEvents = useCallback(() => {
        updateState((currentState) => ({
            ...currentState,
            conversationEvents: [],
            notificationEvents: [],
            callEvents: [],
            latestConversationEvent: null,
            latestConversationBlockEvent: null,
            latestNotificationEvent: null,
            latestNotificationReadStateEvent: null,
            latestCallInitiatedEvent: null,
            latestCallStatusEvent: null,
        }));
    }, [updateState]);

    const isUserOnline = useCallback(
        (userId) => {
            const normalizedUserId = normalizeRealtimeUserId(userId);

            if (!normalizedUserId) {
                console.log('[REALTIME DEBUG 19] isUserOnline called with empty userId:', userId);
                return false;
            }

            const result = (state.onlineUserIds || []).some(
                (onlineUserId) => String(onlineUserId) === normalizedUserId
            );

            console.log('[REALTIME DEBUG 20] isUserOnline check:', {
                userId,
                normalizedUserId,
                onlineUserIds: state.onlineUserIds || [],
                result,
            });

            return result;
        },
        [state.onlineUserIds]
    );

    const value = useMemo(
        () => ({
            ...state,
            isUserOnline,
            clearRealtimeEvents,
        }),
        [clearRealtimeEvents, isUserOnline, state]
    );

    return (
        <AppRealtimeContext.Provider value={value}>
            {children}
        </AppRealtimeContext.Provider>
    );
}

export function useAppRealtime() {
    const context = useContext(AppRealtimeContext);

    if (!context) {
        return {
            ...INITIAL_REALTIME_STATE,
            isUserOnline: () => false,
            clearRealtimeEvents: () => { },
        };
    }

    return context;
}

export default AppRealtimeProvider;
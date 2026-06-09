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
import { disconnectEcho, initEcho } from '../services/realtime/echoClient';
import {
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

const prependLimited = (items, item) => {
    return [item, ...items].slice(0, MAX_STORED_EVENTS);
};

const INITIAL_REALTIME_STATE = {
    isReady: false,
    currentUserId: null,

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
};

export function AppRealtimeProvider({ children }) {
    const [state, setState] = useState(INITIAL_REALTIME_STATE);

    const listenerKeyRef = useRef(`app-realtime-${Date.now()}-${Math.random()}`);
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

        const initializeRealtime = async () => {
            try {
                const [token, deviceId] = await Promise.all([
                    apiClient.getToken(),
                    apiClient.getDeviceId(),
                ]);

                if (isCancelled) {
                    return;
                }

                if (!token || !deviceId) {
                    console.log('[AppRealtime] Skipped: token or deviceId missing.', {
                        hasToken: Boolean(token),
                        hasDeviceId: Boolean(deviceId),
                    });
                    return;
                }

                const profileResponse = await apiClient.get('/api/v1/profile');

                if (isCancelled) {
                    return;
                }

                const userId = getUserIdFromProfile(profileResponse);

                if (!userId) {
                    console.log('[AppRealtime] Skipped: userId missing from profile.');
                    return;
                }

                initEcho({
                    token,
                    deviceId,
                    language: 'en',
                });

                const normalizedUserId = String(userId);

                subscribedUserIdRef.current = normalizedUserId;

                updateState((currentState) => ({
                    ...currentState,
                    isReady: true,
                    currentUserId: normalizedUserId,
                }));

                const subscription = subscribeToUserChannel({
                    userId: normalizedUserId,
                    listenerKey: listenerKeyRef.current,

                    onConversationUpdated: (payload) => {
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
                        console.log('[AppRealtime] ConversationBlockUpdated:', payload);

                        updateState((currentState) => ({
                            ...currentState,
                            latestConversationBlockEvent: payload,
                            conversationVersion: currentState.conversationVersion + 1,
                        }));
                    },

                    onNotificationReceived: (payload) => {
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
                        console.log('[AppRealtime] notification.read_state_changed:', payload);

                        updateState((currentState) => ({
                            ...currentState,
                            latestNotificationReadStateEvent: payload,
                            notificationVersion: currentState.notificationVersion + 1,
                        }));
                    },

                    onCallInitiated: (payload) => {
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
                        console.log('[AppRealtime] call.status_updated:', payload);

                        updateState((currentState) => ({
                            ...currentState,
                            latestCallStatusEvent: payload,
                            callVersion: currentState.callVersion + 1,
                        }));
                    },
                });

                if (subscription?.listenerKey) {
                    listenerKeyRef.current = subscription.listenerKey;
                }
            } catch (error) {
                console.log('[AppRealtime] Init failed:', {
                    message: error?.message,
                    userMessage: error?.userMessage,
                    status: error?.status,
                    code: error?.code,
                    raw: error?.raw,
                    error,
                });
            }
        };

        initializeRealtime();

        return () => {
            isCancelled = true;

            if (listenerKeyRef.current) {
                unsubscribeUserChannelListener(listenerKeyRef.current);
            }

            subscribedUserIdRef.current = null;

            updateState(() => INITIAL_REALTIME_STATE);
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

    const value = useMemo(
        () => ({
            ...state,
            clearRealtimeEvents,
        }),
        [clearRealtimeEvents, state]
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
            clearRealtimeEvents: () => { },
        };
    }

    return context;
}

export default AppRealtimeProvider;
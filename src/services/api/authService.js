import { apiClient } from './apiClient';
import { initEcho, disconnectEcho } from '../realtime/echoClient';
import {
    subscribeToUserChannel
} from '../realtime/userRealtimeService';

export const authService = {
    initiate: payload => {
        return apiClient.post('/api/v1/auth/initiate', payload);
    },

    verify: async payload => {
        const response = await apiClient.post('/api/v1/auth/verify', payload);

        const token = response?.data?.token;
        const user = response?.data?.user;

        const deviceId = payload?.device_id || payload?.deviceId;

        console.log('[Auth] Verify success:', {
            hasToken: Boolean(token),
            userId: user?.id,
            hasDeviceId: Boolean(deviceId),
        });

        if (token && deviceId && user?.id) {
            try {
                initEcho({
                    token,
                    deviceId,
                    language: 'en',
                });

                subscribeToUserChannel({
                    userId: user.id,

                    onConversationUpdated: payload => {
                        console.log('[Auth Realtime] Conversation updated:', payload);
                    },

                    onConversationBlockUpdated: payload => {
                        console.log('[Auth Realtime] Conversation block updated:', payload);
                    },

                    onNotificationReceived: payload => {
                        console.log('[Auth Realtime] Notification received:', payload);
                    },

                    onNotificationReadStateChanged: payload => {
                        console.log('[Auth Realtime] Notification read state changed:', payload);
                    },

                    onCallInitiated: payload => {
                        console.log('[Auth Realtime] Incoming call:', payload);
                    },

                    onCallStatusUpdated: payload => {
                        console.log('[Auth Realtime] Call status updated:', payload);
                    },
                });
            } catch (realtimeError) {
                console.log('[Auth] Realtime init failed but auth succeeded:', {
                    message: realtimeError?.message,
                    error: realtimeError,
                });
            }
        } else {
            console.log('[Auth] Echo/User channel skipped:', {
                hasToken: Boolean(token),
                hasDeviceId: Boolean(deviceId),
                hasUserId: Boolean(user?.id),
            });
        }

        return response;
    },

    logout: async () => {
        try {
            const response = await apiClient.delete('/api/v1/auth/session');

            disconnectEcho();

            return response;
        } catch (error) {
            disconnectEcho();
            throw error;
        }
    },
};
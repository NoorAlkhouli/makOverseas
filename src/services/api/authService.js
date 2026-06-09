import { apiClient } from './apiClient';
import { disconnectEcho } from '../realtime/echoClient';

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

        return response;
    },

    logout: async () => {
        try {
            const response = await apiClient.delete('/api/v1/auth/session');

            disconnectEcho();
            await apiClient.clearToken();
            await apiClient.setDeviceId(null);

            return response;
        } catch (error) {
            disconnectEcho();
            await apiClient.clearToken();
            await apiClient.setDeviceId(null);

            throw error;
        }
    },
};
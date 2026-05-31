import { apiClient } from '../api/apiClient';

export const authService = {
    initiate: payload => {
        return apiClient.post('/api/v1/auth/initiate', payload);
    },

    verify: payload => {
        return apiClient.post('/api/v1/auth/verify', payload);
    },

    logout: () => {
        return apiClient.delete('/api/v1/auth/session');
    },
};
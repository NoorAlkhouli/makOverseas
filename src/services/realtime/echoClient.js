// src/services/realtime/echoClient.js

import Echo from 'laravel-echo';
import * as PusherPackage from 'pusher-js/react-native';
import { API_BASE_URL, REVERB } from '../../constants/config/apiConfig';

let echoInstance = null;

const REALTIME_DEBUG = __DEV__;
const BROADCASTING_AUTH_ENDPOINT = `${API_BASE_URL}/api/v1/broadcasting/auth`;

function logRealtime(...args) {
    if (REALTIME_DEBUG) {
        console.log('[Realtime]', ...args);
    }
}

function warnRealtime(...args) {
    if (REALTIME_DEBUG) {
        console.warn('[Realtime]', ...args);
    }
}

function errorRealtime(...args) {
    if (REALTIME_DEBUG) {
        console.error('[Realtime]', ...args);
    }
}

function resolvePusherClient() {
    const candidates = [
        PusherPackage?.default,
        PusherPackage?.Pusher,
        PusherPackage?.default?.default,
        PusherPackage?.default?.Pusher,
        PusherPackage,
    ];

    const client = candidates.find(candidate => typeof candidate === 'function');

    if (!client) {
        console.log('[Realtime] Pusher package type:', typeof PusherPackage);
        console.log('[Realtime] Pusher package keys:', Object.keys(PusherPackage || {}));
        console.log(
            '[Realtime] Pusher default keys:',
            PusherPackage?.default ? Object.keys(PusherPackage.default) : null
        );

        throw new Error('Pusher constructor was not found.');
    }

    return client;
}

function buildAuthHeaders({ token, deviceId, language = 'en' }) {
    return {
        Authorization: `Bearer ${token}`,
        'X-Device-ID': deviceId,
        Accept: 'application/json',
        'Accept-Language': language,
    };
}

function getCluster() {
    return REVERB.CLUSTER || REVERB.APP_CLUSTER || 'mt1';
}

function buildPusherOptions({ token, deviceId, language = 'en' }) {
    const authHeaders = buildAuthHeaders({
        token,
        deviceId,
        language,
    });

    return {
        cluster: getCluster(),

        wsHost: REVERB.HOST,
        wsPort: REVERB.WS_PORT,
        wssPort: REVERB.WSS_PORT,
        forceTLS: REVERB.FORCE_TLS,

        enabledTransports: ['ws', 'wss'],
        disableStats: true,

        authEndpoint: BROADCASTING_AUTH_ENDPOINT,

        auth: {
            headers: authHeaders,
        },

        channelAuthorization: {
            endpoint: BROADCASTING_AUTH_ENDPOINT,
            headers: authHeaders,
            transport: 'ajax',
        },
    };
}

function attachConnectionLogs(echo) {
    const pusherConnection = echo?.connector?.pusher?.connection;

    if (!pusherConnection) {
        warnRealtime('Pusher connection object not found.');
        return;
    }

    pusherConnection.bind('initialized', () => {
        logRealtime('Socket initialized');
    });

    pusherConnection.bind('connecting', () => {
        logRealtime('Socket connecting...');
    });

    pusherConnection.bind('connected', () => {
        logRealtime('Socket connected ✅');
        logRealtime('Socket ID:', echo.socketId?.());
    });

    pusherConnection.bind('unavailable', () => {
        warnRealtime('Socket unavailable ⚠️');
    });

    pusherConnection.bind('failed', () => {
        errorRealtime('Socket connection failed ❌');
    });

    pusherConnection.bind('disconnected', () => {
        warnRealtime('Socket disconnected');
    });

    pusherConnection.bind('error', error => {
        errorRealtime('Socket error:', error);
    });

    pusherConnection.bind('state_change', states => {
        logRealtime('Socket state changed:', states);
    });
}

export function initEcho({ token, deviceId, language = 'en' }) {
    if (!token) {
        throw new Error('initEcho failed: token is required.');
    }

    if (!deviceId) {
        throw new Error('initEcho failed: deviceId is required.');
    }

    if (echoInstance) {
        logRealtime('Echo already initialized. Current socket id:', getSocketId());
        return echoInstance;
    }

    logRealtime('Initializing Echo...');
    logRealtime('Host:', REVERB.HOST);
    logRealtime('Cluster:', getCluster());
    logRealtime('Auth endpoint:', BROADCASTING_AUTH_ENDPOINT);
    logRealtime('Device ID:', deviceId);

    try {
        const PusherClient = resolvePusherClient();

        logRealtime('Pusher client type:', typeof PusherClient);

        const pusherOptions = buildPusherOptions({
            token,
            deviceId,
            language,
        });

        const pusherInstance = new PusherClient(REVERB.APP_KEY, pusherOptions);

        logRealtime('Pusher instance created:', {
            hasSubscribe: typeof pusherInstance?.subscribe === 'function',
            hasConnection: Boolean(pusherInstance?.connection),
        });

        echoInstance = new Echo({
            broadcaster: 'reverb',

            key: REVERB.APP_KEY,
            cluster: getCluster(),

            wsHost: REVERB.HOST,
            wsPort: REVERB.WS_PORT,
            wssPort: REVERB.WSS_PORT,
            forceTLS: REVERB.FORCE_TLS,

            enabledTransports: ['ws', 'wss'],
            disableStats: true,

            authEndpoint: BROADCASTING_AUTH_ENDPOINT,

            auth: {
                headers: buildAuthHeaders({
                    token,
                    deviceId,
                    language,
                }),
            },

            client: pusherInstance,
        });

        attachConnectionLogs(echoInstance);

        logRealtime('Echo initialized ✅');

        return echoInstance;
    } catch (error) {
        echoInstance = null;

        errorRealtime('Echo initialization failed ❌', {
            message: error?.message,
            name: error?.name,
            error,
        });

        throw error;
    }
}

export function getEcho() {
    if (!echoInstance) {
        warnRealtime('getEcho called before initEcho.');
    }

    return echoInstance;
}

export function getSocketId() {
    return echoInstance?.socketId?.() || null;
}

export function leaveChannel(channelName) {
    if (!echoInstance || !channelName) {
        return;
    }

    try {
        logRealtime('Leaving channel:', channelName);
        echoInstance.leave(channelName);
    } catch (error) {
        warnRealtime('Leaving channel failed and was ignored:', channelName, error);
    }
}

export function disconnectEcho() {
    if (!echoInstance) {
        return;
    }

    logRealtime('Disconnecting Echo...');

    try {
        echoInstance.disconnect?.();
    } catch (error) {
        warnRealtime('Echo disconnect failed and was ignored:', error);
    } finally {
        echoInstance = null;
        logRealtime('Echo disconnected and cleared.');
    }
}

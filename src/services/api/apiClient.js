import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'https://mak-overseas-api.wazaaly.net';

const STORAGE_KEYS = {
    AUTH_TOKEN: 'MAK_AUTH_TOKEN',
    DEVICE_ID: 'MAK_DEVICE_ID',
    APP_LANGUAGE: 'MAK_APP_LANGUAGE',
};

const DEFAULT_TIMEOUT = 30000;

class ApiError extends Error {
    constructor({
        message,
        userMessage,
        status,
        code,
        errors,
        raw,
        isNetworkError = false,
    }) {
        super(message);

        this.name = 'ApiError';
        this.userMessage = userMessage;
        this.status = status;
        this.code = code;
        this.errors = errors;
        this.raw = raw;
        this.isNetworkError = isNetworkError;
    }
}

const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: DEFAULT_TIMEOUT,
    headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
    },
});

const getStoredToken = async () => {
    return AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
};

const getStoredDeviceId = async () => {
    return AsyncStorage.getItem(STORAGE_KEYS.DEVICE_ID);
};

const getStoredLanguage = async () => {
    const language = await AsyncStorage.getItem(STORAGE_KEYS.APP_LANGUAGE);
    return language || 'en';
};

/**
 * هون منحوّل أخطاء السيرفر لرسائل مفهومة للمستخدم
 * مهم: ما منرمي رسالة تقنية للمستخدم
 */
const buildUserMessage = ({ status, code, serverMessage, isNetworkError }) => {
    if (isNetworkError) {
        return 'تأكدي من اتصال الإنترنت وحاولي مرة ثانية.';
    }

    // Auth / Activation errors
    if (code === 'INVALID_CODE') {
        return 'كود التفعيل غير صحيح.';
    }

    if (code === 'EXPIRED_CODE') {
        return 'انتهت صلاحية كود التفعيل. يرجى طلب كود جديد.';
    }

    if (code === 'PENDING_APPROVAL') {
        return 'حسابك بانتظار موافقة الإدارة.';
    }

    if (code === 'ACCOUNT_BLOCKED') {
        return 'تم إيقاف الحساب. يرجى التواصل مع الإدارة.';
    }

    if (code === 'DEVICE_NOT_AUTHORIZED') {
        return 'هذا الحساب مرتبط بجهاز آخر. يرجى طلب تفعيل جديد.';
    }

    // Chat / message errors
    if (code === 'MESSAGE_NOT_DELETABLE') {
        return 'لا يمكن حذف هذا النوع من الرسائل.';
    }

    if (code === 'CONVERSATION_BLOCK_FORBIDDEN') {
        return 'لا تملكين صلاحية حظر أو إلغاء حظر هذه المحادثة.';
    }

    // Channel errors
    if (code === 'ALREADY_FOLLOWING') {
        return 'أنتِ تتابعين هذه القناة مسبقاً.';
    }

    if (code === 'NOT_FOLLOWING') {
        return 'أنتِ لا تتابعين هذه القناة حالياً.';
    }

    if (code === 'CHANNEL_ADMIN_FOLLOW') {
        return 'أدمن القناة لا يمكنه متابعة قناته.';
    }

    // General HTTP errors
    if (status === 401) {
        return 'انتهت الجلسة. يرجى تسجيل الدخول مرة ثانية.';
    }

    if (status === 403) {
        return 'لا تملكين صلاحية لتنفيذ هذا الإجراء.';
    }

    if (status === 404) {
        return 'العنصر المطلوب غير موجود.';
    }

    if (status === 422) {
        return serverMessage || 'يرجى التأكد من البيانات المدخلة.';
    }

    if (status >= 500) {
        return 'حدث خطأ في الخادم. يرجى المحاولة لاحقاً.';
    }

    return serverMessage || 'حدث خطأ غير متوقع. يرجى المحاولة مرة ثانية.';
};

/**
 * توحيد شكل الخطأ
 * بدل ما كل شاشة تفتش داخل error.response.data
 * كل شاشة بتقرأ:
 * error.code
 * error.userMessage
 * error.status
 */
const normalizeApiError = error => {
    if (!error.response) {
        return new ApiError({
            message: error.message || 'Network error',
            userMessage: buildUserMessage({ isNetworkError: true }),
            status: null,
            code: 'NETWORK_ERROR',
            errors: null,
            raw: error,
            isNetworkError: true,
        });
    }

    const status = error.response.status;
    const data = error.response.data || {};

    const serverMessage =
        data.message ||
        data.error ||
        data.title ||
        error.message ||
        'API error';

    const code = data.code || data.error_code || null;
    const errors = data.errors || null;

    return new ApiError({
        message: serverMessage,
        userMessage: buildUserMessage({
            status,
            code,
            serverMessage,
            isNetworkError: false,
        }),
        status,
        code,
        errors,
        raw: data,
    });
};

api.interceptors.request.use(
    async config => {
        const token = await getStoredToken();
        const deviceId = await getStoredDeviceId();
        const language = await getStoredLanguage();

        config.headers.Accept = 'application/json';
        config.headers['Accept-Language'] = language;

        /**
         * إذا الطلب FormData يعني upload image/file
         * غير هيك JSON عادي
         */
        if (!(config.data instanceof FormData)) {
            config.headers['Content-Type'] = 'application/json';
        } else {
            config.headers['Content-Type'] = 'multipart/form-data';
        }

        /**
         * التوكن مطلوب للطلبات المحمية
         */
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        /**
         * مهم جداً بمشروع MAK
         * السيرفر يحتاج يعرف الجهاز الحالي
         */
        if (deviceId) {
            config.headers['X-Device-ID'] = deviceId;
        }

        return config;
    },
    error => Promise.reject(normalizeApiError(error)),
);

api.interceptors.response.use(
    response => response,
    error => Promise.reject(normalizeApiError(error)),
);

/**
 * هذه function ترجع response.data مباشرة
 * يعني الخدمات لا لازم تعمل response.data.data
 * بل تقرأ من response.data حسب شكل Response API
 */
const request = async config => {
    try {
        const response = await api.request(config);
        return response.data;
    } catch (error) {
        throw error instanceof ApiError ? error : normalizeApiError(error);
    }
};

export const apiClient = {
    get: (url, params = {}, config = {}) =>
        request({
            method: 'GET',
            url,
            params,
            ...config,
        }),

    post: (url, data = {}, config = {}) =>
        request({
            method: 'POST',
            url,
            data,
            ...config,
        }),

    put: (url, data = {}, config = {}) =>
        request({
            method: 'PUT',
            url,
            data,
            ...config,
        }),

    patch: (url, data = {}, config = {}) =>
        request({
            method: 'PATCH',
            url,
            data,
            ...config,
        }),

    delete: (url, data = {}, config = {}) =>
        request({
            method: 'DELETE',
            url,
            data,
            ...config,
        }),

    upload: (url, formData, config = {}) =>
        request({
            method: 'POST',
            url,
            data: formData,
            ...config,
        }),

    setToken: async token => {
        if (!token) {
            await AsyncStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
            return;
        }

        await AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
    },

    getToken: getStoredToken,

    clearToken: async () => {
        await AsyncStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
    },

    setDeviceId: async deviceId => {
        if (!deviceId) {
            await AsyncStorage.removeItem(STORAGE_KEYS.DEVICE_ID);
            return;
        }

        await AsyncStorage.setItem(STORAGE_KEYS.DEVICE_ID, deviceId);
    },

    getDeviceId: getStoredDeviceId,

    setLanguage: async language => {
        await AsyncStorage.setItem(STORAGE_KEYS.APP_LANGUAGE, language || 'en');
    },
};

export { API_BASE_URL, STORAGE_KEYS, ApiError };

// ضفت default export حتى تقدري تستورديه بسهولة بأي service
export default apiClient;
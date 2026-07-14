import apiClient from './apiClient';

const NOTIFICATIONS_ENDPOINT = '/api/v1/notifications';

const getResponseData = (response) => response?.data ?? null;

export const getNotifications = async ({
    page = 1,
    perPage = 100,
} = {}) => {
    const response = await apiClient.get(NOTIFICATIONS_ENDPOINT, {
        page,
        per_page: perPage,
    });

    const data = getResponseData(response);

    return {
        items: Array.isArray(data?.items) ? data.items : [],
        meta: data?.meta ?? null,
        unreadCount: Number(data?.unread_count ?? 0),
    };
};

export const markAllNotificationsAsRead = async () => {
    const response = await apiClient.patch(
        `${NOTIFICATIONS_ENDPOINT}/read-all`,
    );

    const data = getResponseData(response);

    return {
        affected: Number(data?.affected ?? 0),
        unreadCount: Number(data?.unread_count ?? 0),
    };
};

export const markNotificationAsRead = async (notificationId) => {
    const response = await apiClient.patch(
        `${NOTIFICATIONS_ENDPOINT}/${notificationId}/read`,
    );

    return getResponseData(response);
};

export const clickNotification = async (notificationId) => {
    const response = await apiClient.post(
        `${NOTIFICATIONS_ENDPOINT}/${notificationId}/click`,
    );

    return getResponseData(response);
};

const notificationService = {
    getNotifications,
    markAllAsRead: markAllNotificationsAsRead,
    markAsRead: markNotificationAsRead,
    click: clickNotification,
};

export default notificationService;
import apiClient from "./apiClient";

const asArray = (value) => (Array.isArray(value) ? value : []);

export const getHome = async () => {
    const response = await apiClient.get("/api/v1/app/home");
    const data = response?.data || {};

    return {
        companyInfo: data.company_info || null,
        banners: asArray(data.banners),
        services: asArray(data.services),
        channels: asArray(data.channels),
        contacts: asArray(data.contacts),
        branches: asArray(data.branches),
        exchangeRates: asArray(data.exchange_rates),
        unreadNotificationsCount: Math.max(
            0,
            Number(data.unread_notifications_count || 0),
        ),
    };
};

const homeService = {
    getHome,
};

export default homeService;
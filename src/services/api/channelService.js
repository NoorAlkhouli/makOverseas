import apiClient from "./apiClient";

const requireSlug = (slug) => {
    const normalizedSlug = String(slug || "").trim();

    if (!normalizedSlug) {
        throw new Error("Channel slug is required");
    }

    return encodeURIComponent(normalizedSlug);
};

const channelService = {
    async listChannels({ isFollowed } = {}) {
        const params = {};

        if (typeof isFollowed === "boolean") {
            params.is_followed = isFollowed ? 1 : 0;
        }

        const response = await apiClient.get("/api/v1/channels", params);

        return Array.isArray(response?.data) ? response.data : [];
    },

    async showChannel(slug) {
        const safeSlug = requireSlug(slug);
        const response = await apiClient.get(`/api/v1/channels/${safeSlug}`);

        return response?.data || null;
    },

    async listChannelPosts(slug, { page = 1, perPage = 20 } = {}) {
        const safeSlug = requireSlug(slug);
        const response = await apiClient.get(`/api/v1/channels/${safeSlug}/posts`, {
            page,
            per_page: perPage,
        });

        return {
            items: Array.isArray(response?.data?.items) ? response.data.items : [],
            meta: response?.data?.meta || null,
        };
    },

    async followChannel(slug) {
        const safeSlug = requireSlug(slug);

        return apiClient.post(`/api/v1/channels/${safeSlug}/follow`);
    },

    async unfollowChannel(slug) {
        const safeSlug = requireSlug(slug);

        return apiClient.delete(`/api/v1/channels/${safeSlug}/follow`);
    },
};

export default channelService;
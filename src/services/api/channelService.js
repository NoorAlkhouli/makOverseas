import apiClient from './apiClient';

/**
 * Channel Service
 * كل طلبات الـ Channels تكون هون فقط
 * حتى الشاشات تضل مرتبة وما نحط روابط API داخل الواجهة
 */
const channelService = {
    /**
     * جلب كل القنوات
     * GET /api/v1/channels
     */
    async listChannels() {
        const response = await apiClient.get('/api/v1/channels');

        return response?.data || [];
    },

    /**
     * جلب منشورات قناة معيّنة
     * GET /api/v1/channels/{slug}/posts?page=1&per_page=20
     */
    async listChannelPosts(slug, { page = 1, perPage = 20 } = {}) {
        if (!slug) {
            throw new Error('Channel slug is required');
        }

        const response = await apiClient.get(
            `/api/v1/channels/${slug}/posts`,
            {
                page,
                per_page: perPage,
            },
        );

        /**
         * حسب الـ API، response.data يكون غالباً:
         * {
         *   items: [...],
         *   meta: {...}
         * }
         */
        return {
            items: response?.data?.items || [],
            meta: response?.data?.meta || null,
        };
    },

    /**
     * متابعة قناة
     * POST /api/v1/channels/{slug}/follow
     */
    async followChannel(slug) {
        if (!slug) {
            throw new Error('Channel slug is required');
        }

        return apiClient.post(`/api/v1/channels/${slug}/follow`);
    },

    /**
     * إلغاء متابعة قناة
     * DELETE /api/v1/channels/{slug}/follow
     */
    async unfollowChannel(slug) {
        if (!slug) {
            throw new Error('Channel slug is required');
        }

        return apiClient.delete(`/api/v1/channels/${slug}/follow`);
    },
};

export default channelService;
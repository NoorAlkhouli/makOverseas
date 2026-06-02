// src/services/api/channelEvents.js

/**
 * Channel Events
 * ملف صغير لمشاركة تغييرات القنوات بين الصفحات
 * مثال:
 * إذا عملنا follow/unfollow من صفحة ChannelChat
 * صفحة Channels تسمع التغيير وتحدّث الداتا المحلية فوراً بدون refresh
 */

const listeners = new Set();

const channelEvents = {
    /**
     * الاشتراك بأي تغيير يصير على follow/unfollow
     */
    subscribe(listener) {
        listeners.add(listener);

        // مهم حتى نلغي الاشتراك لما الصفحة تتسكر
        return () => {
            listeners.delete(listener);
        };
    },

    /**
     * إرسال تحديث follow/unfollow لكل الصفحات المشتركة
     */
    emitFollowChanged(payload) {
        listeners.forEach((listener) => {
            listener(payload);
        });
    },
};

export default channelEvents;
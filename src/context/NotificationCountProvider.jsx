import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { AppState } from "react-native";

import notificationService from "@/src/services/api/notificationService";
import { useAppRealtime } from "@/src/context/AppRealtimeProvider";

const HIDDEN_NOTIFICATION_TYPES = new Set([1, 7]);

const NotificationCountContext = createContext(null);

const normalizeCount = (value) => {
    const count = Number(value);

    return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
};

const getRealtimeNotification = (payload) => {
    if (!payload || typeof payload !== "object") {
        return null;
    }

    if (payload.notification?.id) {
        return payload.notification;
    }

    if (payload.data?.notification?.id) {
        return payload.data.notification;
    }

    if (payload.id && (payload.title || payload.type)) {
        return payload;
    }

    if (payload.data?.id && (payload.data?.title || payload.data?.type)) {
        return payload.data;
    }

    return null;
};

const getRealtimeReadState = (payload) => {
    if (!payload || typeof payload !== "object") {
        return null;
    }

    if (
        payload.all !== undefined ||
        Array.isArray(payload.ids) ||
        payload.unread_count !== undefined
    ) {
        return payload;
    }

    if (
        payload.data?.all !== undefined ||
        Array.isArray(payload.data?.ids) ||
        payload.data?.unread_count !== undefined
    ) {
        return payload.data;
    }

    return null;
};

const isTrueValue = (value) => {
    return value === true || value === 1 || value === "1";
};

export function NotificationCountProvider({ children }) {
    const {
        latestNotificationEvent,
        latestNotificationReadStateEvent,
    } = useAppRealtime();

    const [notificationCount, setNotificationCountState] = useState(0);

    const knownNotificationIdsRef = useRef(new Set());
    const handledNotificationEventRef = useRef(null);
    const handledReadStateEventRef = useRef(null);
    const lastReadAllAtRef = useRef(null);
    const appStateRef = useRef(AppState.currentState);

    const setNotificationCount = useCallback((value) => {
        setNotificationCountState(normalizeCount(value));
    }, []);

    const decrementNotificationCount = useCallback((notificationId) => {
        if (notificationId !== undefined && notificationId !== null) {
            knownNotificationIdsRef.current.add(String(notificationId));
        }

        setNotificationCountState((currentCount) =>
            Math.max(0, currentCount - 1)
        );
    }, []);

    const markAllNotificationsReadLocally = useCallback((nextCount = 0) => {
        lastReadAllAtRef.current = Date.now();
        setNotificationCountState(normalizeCount(nextCount));
    }, []);

    const refreshNotificationCount = useCallback(async () => {
        try {
            const result = await notificationService.getNotifications({
                page: 1,
                perPage: 100,
            });

            result.items.forEach((notification) => {
                if (notification?.id !== undefined && notification?.id !== null) {
                    knownNotificationIdsRef.current.add(String(notification.id));
                }
            });

            const nextCount = normalizeCount(result.unreadCount);
            setNotificationCountState(nextCount);

            return nextCount;
        } catch (error) {
            if (__DEV__) {
                console.log(
                    "[NOTIFICATION COUNT] Failed to refresh:",
                    error?.raw || error
                );
            }

            return null;
        }
    }, []);

    useEffect(() => {
        refreshNotificationCount();
    }, [refreshNotificationCount]);

    useEffect(() => {
        const subscription = AppState.addEventListener("change", (nextState) => {
            const previousState = appStateRef.current;
            appStateRef.current = nextState;

            if (previousState !== "active" && nextState === "active") {
                refreshNotificationCount();
            }
        });

        return () => {
            subscription.remove();
        };
    }, [refreshNotificationCount]);

    useEffect(() => {
        if (
            !latestNotificationEvent ||
            handledNotificationEventRef.current === latestNotificationEvent
        ) {
            return;
        }

        handledNotificationEventRef.current = latestNotificationEvent;

        const notification = getRealtimeNotification(latestNotificationEvent);

        if (!notification?.id) {
            return;
        }

        const notificationId = String(notification.id);

        if (knownNotificationIdsRef.current.has(notificationId)) {
            return;
        }

        knownNotificationIdsRef.current.add(notificationId);

        const notificationType = Number(notification.type);

        if (
            HIDDEN_NOTIFICATION_TYPES.has(notificationType) ||
            Boolean(notification.read_at)
        ) {
            return;
        }

        const createdAt = new Date(notification.created_at).getTime();

        if (
            lastReadAllAtRef.current &&
            Number.isFinite(createdAt) &&
            createdAt <= lastReadAllAtRef.current
        ) {
            return;
        }

        setNotificationCountState((currentCount) => currentCount + 1);
    }, [latestNotificationEvent]);

    useEffect(() => {
        if (
            !latestNotificationReadStateEvent ||
            handledReadStateEventRef.current === latestNotificationReadStateEvent
        ) {
            return;
        }

        handledReadStateEventRef.current = latestNotificationReadStateEvent;

        const readState = getRealtimeReadState(
            latestNotificationReadStateEvent
        );

        if (!readState) {
            return;
        }

        const readIds = Array.isArray(readState.ids) ? readState.ids : [];

        readIds.forEach((notificationId) => {
            knownNotificationIdsRef.current.add(String(notificationId));
        });

        if (isTrueValue(readState.all)) {
            const readAt = new Date(readState.read_at).getTime();
            lastReadAllAtRef.current = Number.isFinite(readAt)
                ? readAt
                : Date.now();
        }

        const nextCount = Number(readState.unread_count);

        if (Number.isFinite(nextCount)) {
            setNotificationCountState(normalizeCount(nextCount));
        }
    }, [latestNotificationReadStateEvent]);

    const value = useMemo(
        () => ({
            notificationCount,
            setNotificationCount,
            decrementNotificationCount,
            markAllNotificationsReadLocally,
            refreshNotificationCount,
        }),
        [
            decrementNotificationCount,
            markAllNotificationsReadLocally,
            notificationCount,
            refreshNotificationCount,
            setNotificationCount,
        ]
    );

    return (
        <NotificationCountContext.Provider value={value}>
            {children}
        </NotificationCountContext.Provider>
    );
}

export function useNotificationCount() {
    const context = useContext(NotificationCountContext);

    if (!context) {
        throw new Error(
            "useNotificationCount must be used inside NotificationCountProvider."
        );
    }

    return context;
}

export default NotificationCountProvider;
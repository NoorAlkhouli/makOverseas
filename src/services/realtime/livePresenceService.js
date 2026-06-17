import { getEcho } from "./echoClient";

let livePresenceChannel = null;
let isSubscribedToLivePresence = false;

const livePresenceListeners = new Map();

const getListenerKey = (listenerKey) => {
    return listenerKey || `live-presence-${Date.now()}-${Math.random()}`;
};

const normalizeUserId = (user) => {
    const userId =
        user?.id ||
        user?.user_id ||
        user?.userId ||
        user?.member_id ||
        user?.memberId ||
        null;

    if (userId === undefined || userId === null || userId === "") {
        return null;
    }

    return String(userId);
};

const normalizePresenceUser = (user) => {
    if (!user || typeof user !== "object") {
        return null;
    }

    const id = normalizeUserId(user);

    if (!id) {
        return null;
    }

    return {
        ...user,
        id,
        user_id: id,
        userId: id,
        full_name:
            user.full_name ||
            user.fullName ||
            user.name ||
            user.display_name ||
            user.displayName ||
            "",
    };
};

const normalizePresenceUsers = (users = []) => {
    if (!Array.isArray(users)) {
        return [];
    }

    return users
        .map(normalizePresenceUser)
        .filter(Boolean);
};

const registerLivePresenceListener = ({
    listenerKey,
    onHere,
    onJoining,
    onLeaving,
    onError,
}) => {
    const key = getListenerKey(listenerKey);

    livePresenceListeners.set(key, {
        onHere,
        onJoining,
        onLeaving,
        onError,
    });

    return key;
};

const notifyLivePresenceListeners = (callbackName, payload) => {
    livePresenceListeners.forEach((listener) => {
        const callback = listener?.[callbackName];

        if (typeof callback === "function") {
            callback(payload);
        }
    });
};

export function subscribeToLivePresenceChannel({
    listenerKey,
    onHere,
    onJoining,
    onLeaving,
    onError,
} = {}) {
    const echo = getEcho();

    if (!echo) {
        console.log("[Live Presence] Echo is not initialized.");
        return null;
    }

    const registeredListenerKey = registerLivePresenceListener({
        listenerKey,
        onHere,
        onJoining,
        onLeaving,
        onError,
    });

    if (livePresenceChannel && isSubscribedToLivePresence) {
        console.log("[Live Presence] Already subscribed to live channel.");

        return {
            channel: livePresenceChannel,
            listenerKey: registeredListenerKey,
        };
    }

    console.log("[Live Presence] Joining presence channel: live");

    livePresenceChannel = echo.join("live");

    livePresenceChannel
        .here((users) => {
            const normalizedUsers = normalizePresenceUsers(users);

            console.log("[Live Presence] Currently online users:", normalizedUsers);

            notifyLivePresenceListeners("onHere", normalizedUsers);
        })
        .joining((user) => {
            const normalizedUser = normalizePresenceUser(user);

            if (!normalizedUser) {
                return;
            }

            console.log("[Live Presence] User joined:", normalizedUser);

            notifyLivePresenceListeners("onJoining", normalizedUser);
        })
        .leaving((user) => {
            const normalizedUser = normalizePresenceUser(user);

            if (!normalizedUser) {
                return;
            }

            console.log("[Live Presence] User left:", normalizedUser);

            notifyLivePresenceListeners("onLeaving", normalizedUser);
        })
        .error((error) => {
            console.log("[Live Presence] Presence channel error:", error);

            notifyLivePresenceListeners("onError", error);
        });

    isSubscribedToLivePresence = true;

    return {
        channel: livePresenceChannel,
        listenerKey: registeredListenerKey,
    };
}

export function unsubscribeLivePresenceListener(listenerKey) {
    if (!listenerKey) {
        return;
    }

    livePresenceListeners.delete(listenerKey);
}

export function leaveLivePresenceChannel() {
    const echo = getEcho();

    if (!echo) {
        livePresenceChannel = null;
        isSubscribedToLivePresence = false;
        livePresenceListeners.clear();
        return;
    }

    console.log("[Live Presence] Leaving presence channel: live");

    echo.leave("live");

    livePresenceChannel = null;
    isSubscribedToLivePresence = false;
    livePresenceListeners.clear();
}

export function getLivePresenceChannel() {
    return livePresenceChannel;
}

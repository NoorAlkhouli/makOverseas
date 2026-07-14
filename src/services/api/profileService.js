import apiClient, { API_BASE_URL } from "./apiClient";

export const USER_ROLES = {
    CUSTOMER: 1,
    EMPLOYEE: 2,
    ADMIN: 3,
};

export const USER_STATUSES = {
    PENDING: 1,
    APPROVED: 2,
    BLOCKED: 3,
    DELETED: 4,
};

const ROLE_LABELS = {
    [USER_ROLES.CUSTOMER]: "Customer",
    [USER_ROLES.EMPLOYEE]: "Employee",
    [USER_ROLES.ADMIN]: "Admin",
};

const STATUS_LABELS = {
    [USER_STATUSES.PENDING]: "Pending",
    [USER_STATUSES.APPROVED]: "Approved",
    [USER_STATUSES.BLOCKED]: "Blocked",
    [USER_STATUSES.DELETED]: "Deleted",
};

const normalizeNumber = (value) => {
    const numberValue = Number(value);

    return Number.isFinite(numberValue) ? numberValue : null;
};

const normalizeAvatarUrl = (value) => {
    if (!value) return null;

    let avatarValue = value;

    if (typeof avatarValue === "object") {
        avatarValue =
            avatarValue.url ||
            avatarValue.full_url ||
            avatarValue.fullUrl ||
            avatarValue.path ||
            avatarValue.src ||
            avatarValue.preview_url ||
            avatarValue.previewUrl ||
            null;
    }

    if (!avatarValue || typeof avatarValue !== "string") {
        return null;
    }

    const cleanValue = avatarValue.trim();

    if (!cleanValue) return null;

    if (
        cleanValue.startsWith("http://") ||
        cleanValue.startsWith("https://")
    ) {
        return cleanValue;
    }

    if (cleanValue.startsWith("/")) {
        return `${API_BASE_URL}${cleanValue}`;
    }

    return `${API_BASE_URL}/${cleanValue}`;
};

const getProfileAvatar = (profile) => {
    return normalizeAvatarUrl(
        profile.avatar ||
        profile.avatar_url ||
        profile.avatarUrl ||
        profile.image ||
        profile.photo ||
        profile.profile_photo ||
        profile.profilePhoto ||
        profile.media?.url ||
        profile.media?.path ||
        null
    );
};

export const normalizeProfile = (profile) => {
    if (!profile || typeof profile !== "object") {
        return null;
    }

    const role = normalizeNumber(profile.role);
    const status = normalizeNumber(profile.status);

    return {
        id: profile.id ?? null,

        fullName:
            profile.full_name ||
            profile.fullName ||
            profile.name ||
            "",

        phoneE164:
            profile.phone_e164 ||
            profile.phoneE164 ||
            profile.phone ||
            "",

        role,
        roleLabel: ROLE_LABELS[role] || "User",

        status,
        statusLabel: STATUS_LABELS[status] || "Unknown",

        avatar: getProfileAvatar(profile),

        approvedAt:
            profile.approved_at ||
            profile.approvedAt ||
            null,

        raw: profile,
    };
};

const buildProfileFormData = ({ fullName, avatar } = {}) => {
    const formData = new FormData();

    // apiClient.upload يرسل POST
    // وLaravel يحوله إلى PATCH
    formData.append("_method", "PATCH");

    const normalizedName =
        typeof fullName === "string"
            ? fullName.trim()
            : "";

    if (normalizedName.length > 0) {
        formData.append("full_name", normalizedName);
    }

    if (avatar?.uri) {
        formData.append("avatar", {
            uri: avatar.uri,
            type: avatar.type || "image/jpeg",
            name:
                avatar.name ||
                `avatar-${Date.now()}.jpg`,
        });
    }

    return formData;
};

export const updateProfile = async ({
    fullName,
    avatar,
} = {}) => {
    const hasName =
        typeof fullName === "string" &&
        fullName.trim().length > 0;

    const hasAvatar = Boolean(avatar?.uri);

    if (!hasName && !hasAvatar) {
        throw new Error(
            "fullName or avatar is required."
        );
    }

    const formData = buildProfileFormData({
        fullName,
        avatar,
    });

    const response = await apiClient.upload(
        "/api/v1/profile",
        formData,
        {
            headers: {
                "Content-Type": "multipart/form-data",
            },
        }
    );

    return normalizeProfile(response?.data);
};

export const getProfile = async () => {
    const response = await apiClient.get(
        "/api/v1/profile"
    );

    if (__DEV__) {
        console.log(
            "[PROFILE DEBUG] GET succeeded."
        );
    }

    return normalizeProfile(response?.data);
};

export const logoutSession = () => {
    return apiClient.delete(
        "/api/v1/auth/session"
    );
};

export default {
    getProfile,
    updateProfile,
    logoutSession,
    normalizeProfile,
};
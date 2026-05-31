import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Application from "expo-application";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "@/src/services/api/apiClient";

const FALLBACK_DEVICE_ID_KEY = "MAK_FALLBACK_DEVICE_ID";

const createFallbackDeviceId = () => {
    return `mak-${Platform.OS}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 10)}`;
};

export const getOrCreateDeviceInfo = async () => {
    let deviceId = await AsyncStorage.getItem(STORAGE_KEYS.DEVICE_ID);

    if (!deviceId) {
        if (Platform.OS === "ios") {
            deviceId = await Application.getIosIdForVendorAsync();
        }

        if (Platform.OS === "android") {
            deviceId = Application.getAndroidId();
        }

        if (!deviceId) {
            deviceId = await AsyncStorage.getItem(FALLBACK_DEVICE_ID_KEY);

            if (!deviceId) {
                deviceId = createFallbackDeviceId();
                await AsyncStorage.setItem(FALLBACK_DEVICE_ID_KEY, deviceId);
            }
        }

        await AsyncStorage.setItem(STORAGE_KEYS.DEVICE_ID, deviceId);
    }

    return {
        device_id: deviceId,
        platform: Platform.OS === "ios" ? 1 : 2,
        device_name:
            Device.deviceName ||
            Device.modelName ||
            `${Platform.OS} device`,
        os_version: `${Platform.OS} ${Device.osVersion || ""}`.trim(),
        app_version: Application.nativeApplicationVersion || "1.0.0",
    };
};
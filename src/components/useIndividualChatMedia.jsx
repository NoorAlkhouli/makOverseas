import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useEvent } from "expo";
import { CameraView, useCameraPermissions, useMicrophonePermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";
import * as FileSystem from "expo-file-system/legacy";
import * as VideoThumbnails from "expo-video-thumbnails";
import { useVideoPlayer, VideoView } from "expo-video";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useRef, useState } from "react";
import {
    Alert,
    ActivityIndicator,
    Image,
    Modal,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ImageMediaEditor from "./ImageMediaEditor";

const VIDEO_DEBUG_ENABLED = true;

const videoDebugLog = (label, payload = {}) => {
    if (!VIDEO_DEBUG_ENABLED) return;

    try {
        console.log(`[VIDEO_DEBUG] ${label}`, payload);
    } catch (error) {
        console.log(`[VIDEO_DEBUG] ${label}`, error);
    }
};

const getUriInfo = (uri = "") => {
    const cleanUri = String(uri || "");

    if (!cleanUri) {
        return {
            hasUri: false,
            scheme: null,
            extension: null,
            preview: null,
        };
    }

    const schemeMatch = cleanUri.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);
    const cleanPath = cleanUri.split("?")[0];
    const dotIndex = cleanPath.lastIndexOf(".");
    const extension =
        dotIndex !== -1 && dotIndex < cleanPath.length - 1
            ? cleanPath.slice(dotIndex + 1).toLowerCase()
            : null;

    return {
        hasUri: true,
        scheme: schemeMatch?.[1] || null,
        extension,
        preview:
            cleanUri.length > 140
                ? `${cleanUri.slice(0, 90)}...${cleanUri.slice(-35)}`
                : cleanUri,
    };
};


const isRemoteVideoUri = (uri = "") => {
    const cleanUri = String(uri || "").trim().toLowerCase();

    return cleanUri.startsWith("http://") || cleanUri.startsWith("https://");
};

const getSafeCachedVideoFileName = (uri = "") => {
    const cleanUri = String(uri || "").split("?")[0];
    const lastPart = cleanUri.split("/").filter(Boolean).pop() || `video-${Date.now()}.mp4`;
    const decodedName = (() => {
        try {
            return decodeURIComponent(lastPart);
        } catch {
            return lastPart;
        }
    })();

    const safeName = decodedName
        .replace(/[^a-zA-Z0-9._-]+/g, "_")
        .replace(/^_+|_+$/g, "");

    if (safeName.includes(".")) {
        return safeName;
    }

    return `${safeName || `video-${Date.now()}`}.mp4`;
};

const getPlayableVideoUri = async (uri = "") => {
    const cleanUri = String(uri || "").trim();

    if (!cleanUri) {
        return null;
    }

    if (!isRemoteVideoUri(cleanUri)) {
        return cleanUri;
    }

    const cacheDirectory = FileSystem.cacheDirectory;

    if (!cacheDirectory) {
        return cleanUri;
    }

    const targetUri = `${cacheDirectory}${getSafeCachedVideoFileName(cleanUri)}`;

    try {
        const cachedInfo = await FileSystem.getInfoAsync(targetUri);

        if (cachedInfo.exists) {
            return targetUri;
        }

        const downloadResult = await FileSystem.downloadAsync(cleanUri, targetUri);

        return downloadResult?.uri || targetUri;
    } catch (error) {
        console.log("[VIDEO_DEBUG] Remote video cache failed", {
            sourceUriInfo: getUriInfo(cleanUri),
            message: error?.message,
            error,
        });

        return cleanUri;
    }
};


const isRemoteMediaUri = (uri = "") => {
    const cleanUri = String(uri || "").trim().toLowerCase();

    return cleanUri.startsWith("http://") || cleanUri.startsWith("https://");
};

const getMediaSaveExtension = (mediaItem = {}, mediaUri = "") => {
    const possibleName = String(
        mediaItem.fileName ||
        mediaItem.name ||
        mediaItem.filename ||
        mediaItem.caption ||
        mediaUri ||
        ""
    ).split("?")[0];

    const dotIndex = possibleName.lastIndexOf(".");

    if (dotIndex !== -1 && dotIndex < possibleName.length - 1) {
        return possibleName.slice(dotIndex + 1).toLowerCase();
    }

    if (mediaItem?.type === "video") {
        return "mp4";
    }

    return "jpg";
};

const getSafeMediaCacheName = (mediaItem = {}, mediaUri = "") => {
    const extension = getMediaSaveExtension(mediaItem, mediaUri);
    const rawName = String(
        mediaItem.fileName ||
        mediaItem.name ||
        mediaItem.filename ||
        `chat-media-${Date.now()}.${extension}`
    );

    const cleanName = rawName
        .split("?")[0]
        .replace(/[^a-zA-Z0-9._() -]+/g, "_")
        .replace(/\s+/g, "_")
        .replace(/^_+|_+$/g, "");

    if (cleanName.toLowerCase().endsWith(`.${extension}`)) {
        return cleanName;
    }

    return `${cleanName || `chat-media-${Date.now()}`}.${extension}`;
};

const ensureLocalMediaUriForSaving = async (mediaItem = {}) => {
    const mediaUri = getMediaUri(mediaItem);

    if (!mediaUri) {
        return null;
    }

    if (!isRemoteMediaUri(mediaUri)) {
        return mediaUri;
    }

    const cacheDirectory = FileSystem.cacheDirectory;

    if (!cacheDirectory) {
        return mediaUri;
    }

    const safeName = getSafeMediaCacheName(mediaItem, mediaUri);
    const targetUri = `${cacheDirectory}${safeName}`;

    try {
        const fileInfo = await FileSystem.getInfoAsync(targetUri);

        if (fileInfo.exists) {
            videoDebugLog("SaveMediaUsingCachedFile", {
                sourceUriInfo: getUriInfo(mediaUri),
                targetUriInfo: getUriInfo(targetUri),
            });

            return targetUri;
        }

        videoDebugLog("SaveMediaDownloadStart", {
            sourceUriInfo: getUriInfo(mediaUri),
            targetUriInfo: getUriInfo(targetUri),
        });

        const downloadResult = await FileSystem.downloadAsync(mediaUri, targetUri);

        videoDebugLog("SaveMediaDownloadDone", {
            downloadedUriInfo: getUriInfo(downloadResult?.uri),
        });

        return downloadResult?.uri || targetUri;
    } catch (error) {
        console.log("Save media download error:", error);
        throw error;
    }
};

const getAssetMediaType = (asset) => {
    const assetType = String(asset?.type || "").toLowerCase();
    const mimeType = String(asset?.mimeType || "").toLowerCase();

    if (assetType.includes("video") || mimeType.includes("video")) {
        return "video";
    }

    return "image";
};

const getMediaUri = (mediaItem) => {
    if (!mediaItem) return null;
    if (mediaItem.uri) return mediaItem.uri;
    if (mediaItem.image?.uri) return mediaItem.image.uri;
    if (mediaItem.video?.uri) return mediaItem.video.uri;
    return null;
};

const getVideoSource = (mediaItem, video) => {
    const resolvedSource = video
        ? video
        : mediaItem?.video?.uri
            ? { uri: mediaItem.video.uri }
            : mediaItem?.uri
                ? { uri: mediaItem.uri }
                : null;

    videoDebugLog("getVideoSource", {
        mediaItemType: mediaItem?.type,
        hasExternalVideoProp: !!video,
        externalVideoUriInfo: getUriInfo(video?.uri),
        mediaItemUriInfo: getUriInfo(mediaItem?.uri),
        mediaItemVideoUriInfo: getUriInfo(mediaItem?.video?.uri),
        resolvedSourceUriInfo: getUriInfo(resolvedSource?.uri),
        mediaItemKeys: mediaItem ? Object.keys(mediaItem) : [],
    });

    return resolvedSource;
};

const getVideoThumbnailCandidate = (source = {}) => {
    const candidates = [
        source?.thumbnail,
        source?.thumbnail_uri,
        source?.thumbnailUri,
        source?.thumbnail_url,
        source?.thumbnailUrl,
        source?.poster,
        source?.poster_uri,
        source?.posterUri,
        source?.poster_url,
        source?.posterUrl,
        source?.preview,
        source?.preview_uri,
        source?.previewUri,
        source?.preview_url,
        source?.previewUrl,
        source?.image?.uri,
        source?.image?.url,
    ];

    return candidates.find((candidate) => !!String(candidate || "").trim()) || null;
};

const formatVideoTime = (seconds = 0) => {
    const totalSeconds = Math.max(0, Math.floor(seconds || 0));
    const minutes = Math.floor(totalSeconds / 60);
    const remainingSeconds = totalSeconds % 60;

    return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
};

const formatRecordingTime = (seconds = 0) => {
    const totalSeconds = Math.max(0, Math.floor(seconds || 0));
    const minutes = Math.floor(totalSeconds / 60);
    const remainingSeconds = totalSeconds % 60;

    return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
};

const getImagePickerMediaTypes = (kind = "all") => {
    const modernMediaType = ImagePicker.MediaType;

    const mediaTypeMap = {
        image: modernMediaType?.Images || "images",
        video: modernMediaType?.Videos || "videos",
    };

    if (kind === "image") {
        return [mediaTypeMap.image];
    }

    if (kind === "video") {
        return [mediaTypeMap.video];
    }

    return [mediaTypeMap.image, mediaTypeMap.video];
};

const getVideoQuality = () => {
    return (
        ImagePicker.UIImagePickerControllerQualityType?.Medium ||
        ImagePicker.UIImagePickerControllerQualityType?.High ||
        1
    );
};

const getCompatibleVideoExportPreset = () =>
    ImagePicker.VideoExportPreset?.H264_1280x720 ||
    ImagePicker.VideoExportPreset?.MediumQuality ||
    ImagePicker.VideoExportPreset?.HighestQuality ||
    undefined;

const getCameraVideoRecordingOptions = () => {
    const options = {
        maxDuration: 60,
        quality: "720p",
        mute: false,
    };

    if (Platform.OS === "ios") {
        options.codec = "avc1";
        options.videoBitrate = 6_000_000;
    }

    return options;
};


const createMediaMessageFromAsset = ({ asset, tr, source }) => {
    const mediaType = getAssetMediaType(asset);
    const isVideo = mediaType === "video";
    const fallbackName = isVideo
        ? source === "camera"
            ? `camera-video-${Date.now()}.mp4`
            : `video-${Date.now()}.mp4`
        : source === "camera"
            ? `camera-photo-${Date.now()}.jpg`
            : `image-${Date.now()}.jpg`;
    const fileName = asset.fileName || fallbackName;

    videoDebugLog("createMediaMessageFromAsset", {
        source,
        detectedMediaType: mediaType,
        isVideo,
        fileName,
        mimeType: asset.mimeType,
        width: asset.width,
        height: asset.height,
        duration: asset.duration,
        uriInfo: getUriInfo(asset.uri),
        rawAssetKeys: Object.keys(asset || {}),
    });

    return {
        id: `${Date.now()}-${isVideo ? "video" : source === "camera" ? "camera" : "image"}`,
        side: "me",
        type: isVideo ? "video" : "image",
        image: isVideo ? undefined : { uri: asset.uri },
        video: isVideo ? { uri: asset.uri } : undefined,
        uri: asset.uri,
        fileName,
        mimeType: asset.mimeType || (isVideo ? "video/mp4" : "image/jpeg"),
        width: asset.width,
        height: asset.height,
        durationMillis: asset.duration,
        caption: isVideo
            ? source === "camera"
                ? tr("cameraVideo", "Camera video")
                : fileName || tr("selectedVideo", "Selected video")
            : source === "camera"
                ? tr("cameraPhoto", "Camera photo")
                : fileName || tr("selectedImage", "Selected image"),
        time: tr("now", "Now"),
    };
};

export function useIndividualChatMedia({
    tr,
    addMessages,
    cancelVoiceRecordingIfActive,
    onSendMedia,
}) {
    const [previewMedia, setPreviewMedia] = useState(null);
    const [selectedMediaToSend, setSelectedMediaToSend] = useState(null);
    const [cameraCaptureVisible, setCameraCaptureVisible] = useState(false);
    const [isSendingMedia, setIsSendingMedia] = useState(false);

    const pickMediaFromLibrary = async () => {
        try {
            await cancelVoiceRecordingIfActive();

            const permissionResult =
                await ImagePicker.requestMediaLibraryPermissionsAsync();

            if (!permissionResult.granted) {
                Alert.alert(
                    tr("permissionNeeded", "Permission needed"),
                    tr(
                        "mediaPermissionMessage",
                        "Please allow access to your photos and videos to attach media."
                    )
                );
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: getImagePickerMediaTypes("all"),
                quality: 0.85,
                videoQuality: getVideoQuality(),
                videoExportPreset: getCompatibleVideoExportPreset(),
            });

            videoDebugLog("libraryPickerResult", {
                canceled: result.canceled,
                assetCount: result.assets?.length || 0,
                firstAsset: result.assets?.[0]
                    ? {
                        type: result.assets[0].type,
                        mimeType: result.assets[0].mimeType,
                        fileName: result.assets[0].fileName,
                        width: result.assets[0].width,
                        height: result.assets[0].height,
                        duration: result.assets[0].duration,
                        uriInfo: getUriInfo(result.assets[0].uri),
                        keys: Object.keys(result.assets[0] || {}),
                    }
                    : null,
            });

            if (result.canceled || !result.assets?.length) {
                return;
            }

            const asset = result.assets[0];
            const nextMediaMessage = createMediaMessageFromAsset({
                asset,
                tr,
                source: "library",
            });

            videoDebugLog("selectedMediaPreparedFromLibrary", {
                type: nextMediaMessage.type,
                fileName: nextMediaMessage.fileName,
                mimeType: nextMediaMessage.mimeType,
                uriInfo: getUriInfo(nextMediaMessage.uri),
                videoUriInfo: getUriInfo(nextMediaMessage.video?.uri),
                hasImage: !!nextMediaMessage.image,
                hasVideo: !!nextMediaMessage.video,
            });

            setSelectedMediaToSend(nextMediaMessage);
        } catch (error) {
            console.log("Media picker error:", error);

            Alert.alert(
                tr("errorTitle", "Something went wrong"),
                tr("mediaPickerError", "Could not select the media. Please try again.")
            );
        }
    };

    const takePhotoWithCamera = async () => {
        try {
            await cancelVoiceRecordingIfActive();
            setCameraCaptureVisible(true);
        } catch (error) {
            console.log("Open custom camera error:", error);
            Alert.alert(
                tr("errorTitle", "Something went wrong"),
                tr("cameraPickerError", "Could not open the camera. Please try again.")
            );
        }
    };

    const handleCloseCameraCapture = () => {
        setCameraCaptureVisible(false);
    };

    const handleCameraCaptured = (asset) => {
        videoDebugLog("handleCameraCapturedRawAsset", {
            hasAsset: !!asset,
            type: asset?.type,
            mimeType: asset?.mimeType,
            fileName: asset?.fileName,
            width: asset?.width,
            height: asset?.height,
            duration: asset?.duration,
            codec: asset?.codec,
            uriInfo: getUriInfo(asset?.uri),
            keys: asset ? Object.keys(asset) : [],
        });

        if (!asset?.uri) return;

        const nextMediaMessage = createMediaMessageFromAsset({
            asset,
            tr,
            source: "camera",
        });

        videoDebugLog("selectedMediaPreparedFromCamera", {
            type: nextMediaMessage.type,
            fileName: nextMediaMessage.fileName,
            mimeType: nextMediaMessage.mimeType,
            uriInfo: getUriInfo(nextMediaMessage.uri),
            videoUriInfo: getUriInfo(nextMediaMessage.video?.uri),
            hasImage: !!nextMediaMessage.image,
            hasVideo: !!nextMediaMessage.video,
        });

        setSelectedMediaToSend(nextMediaMessage);
        setCameraCaptureVisible(false);
    };

    const handleConfirmSendMedia = async (finalMedia) => {
        const mediaToSend = finalMedia || selectedMediaToSend;

        videoDebugLog("handleConfirmSendMedia", {
            hasFinalMedia: !!finalMedia,
            hasSelectedMedia: !!selectedMediaToSend,
            type: mediaToSend?.type,
            fileName: mediaToSend?.fileName,
            mimeType: mediaToSend?.mimeType,
            uriInfo: getUriInfo(mediaToSend?.uri),
            imageUriInfo: getUriInfo(mediaToSend?.image?.uri),
            videoUriInfo: getUriInfo(mediaToSend?.video?.uri),
            keys: mediaToSend ? Object.keys(mediaToSend) : [],
        });

        if (!mediaToSend || isSendingMedia) return;

        const nextMediaMessage = {
            ...mediaToSend,
            id:
                mediaToSend.id ||
                `${Date.now()}-${mediaToSend.type || "media"}`,
            time: tr("now", "Now"),
        };

        setIsSendingMedia(true);

        // Close the confirm modal immediately so the chat shows the outgoing
        // message in sending state while the upload continues in the background.
        setSelectedMediaToSend(null);

        try {
            if (typeof onSendMedia === "function") {
                await onSendMedia(nextMediaMessage);
            } else {
                addMessages([nextMediaMessage]);
            }
        } catch (error) {
            console.log("Send media message error:", error);

            Alert.alert(
                tr("errorTitle", "Something went wrong"),
                error?.userMessage ||
                tr("sendMediaError", "Could not send this media. Please try again.")
            );
        } finally {
            setIsSendingMedia(false);
        }
    };

    const handleCancelSelectedMedia = () => {
        setSelectedMediaToSend(null);
    };

    const handleSaveMediaToDevice = async (mediaItem) => {
        try {
            const mediaUri = getMediaUri(mediaItem);
            const isVideo = mediaItem?.type === "video";

            if (!mediaUri) {
                Alert.alert(
                    tr("saveUnavailableTitle", "Save unavailable"),
                    tr(
                        "saveUnavailableMessage",
                        "This media cannot be saved because the file link is missing."
                    )
                );
                return;
            }

            const permissionResult = await MediaLibrary.requestPermissionsAsync();

            if (!permissionResult.granted) {
                Alert.alert(
                    tr("permissionNeeded", "Permission needed"),
                    tr(
                        "mediaLibraryPermissionMessage",
                        "Please allow access to save media to your device."
                    )
                );
                return;
            }

            const localMediaUri = await ensureLocalMediaUriForSaving(mediaItem);

            if (!localMediaUri) {
                Alert.alert(
                    tr("saveUnavailableTitle", "Save unavailable"),
                    tr(
                        "saveUnavailableMessage",
                        "This media cannot be saved because the local file could not be prepared."
                    )
                );
                return;
            }

            videoDebugLog("SaveMediaToLibrary", {
                isVideo,
                originalUriInfo: getUriInfo(mediaUri),
                localUriInfo: getUriInfo(localMediaUri),
            });

            await MediaLibrary.saveToLibraryAsync(localMediaUri);

            Alert.alert(
                tr("saved", "Saved"),
                isVideo
                    ? tr("videoSavedMessage", "Video saved to your device.")
                    : tr("imageSavedMessage", "Image saved to your device.")
            );
        } catch (error) {
            console.log("Save media error:", error);

            Alert.alert(
                tr("errorTitle", "Something went wrong"),
                tr("saveMediaError", "Could not save the media. Please try again.")
            );
        }
    };

    return {
        previewMedia,
        setPreviewMedia,
        selectedMediaToSend,
        cameraCaptureVisible,
        pickMediaFromLibrary,
        takePhotoWithCamera,
        handleCloseCameraCapture,
        handleCameraCaptured,
        handleConfirmSendMedia,
        handleCancelSelectedMedia,
        handleSaveMediaToDevice,
        isSendingMedia,
    };
}


export function ChatCameraCaptureModal({
    visible,
    colors,
    tr,
    onClose,
    onCaptured,
    onOpenLibrary,
}) {
    const insets = useSafeAreaInsets();
    const cameraRef = useRef(null);
    const [cameraPermission, requestCameraPermission] = useCameraPermissions();
    const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();
    const [mode, setMode] = useState("picture");
    const [facing, setFacing] = useState("back");
    const [flash, setFlash] = useState("off");
    const [isReady, setIsReady] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingSeconds, setRecordingSeconds] = useState(0);
    const [isBusy, setIsBusy] = useState(false);

    const themeColors = getMediaThemeColors(colors);
    const hasCameraPermission = !!cameraPermission?.granted;
    const hasMicrophonePermission = !!microphonePermission?.granted;
    const recordingTimeText = formatRecordingTime(recordingSeconds);

    useEffect(() => {
        if (!isRecording) {
            setRecordingSeconds(0);
            return undefined;
        }

        setRecordingSeconds(0);

        const intervalId = setInterval(() => {
            setRecordingSeconds((prev) => Math.min(prev + 1, 60));
        }, 1000);

        return () => clearInterval(intervalId);
    }, [isRecording]);

    const ensurePermissions = async (nextMode = mode) => {
        let cameraGranted = hasCameraPermission;
        let microphoneGranted = hasMicrophonePermission;

        if (!cameraGranted) {
            const result = await requestCameraPermission();
            cameraGranted = !!result?.granted;
        }

        if (nextMode === "video" && !microphoneGranted) {
            const result = await requestMicrophonePermission();
            microphoneGranted = !!result?.granted;
        }

        if (!cameraGranted || (nextMode === "video" && !microphoneGranted)) {
            Alert.alert(
                tr("permissionNeeded", "Permission needed"),
                tr(
                    "cameraPermissionMessage",
                    "Please allow camera and microphone access to take photos and record videos."
                )
            );
            return false;
        }

        return true;
    };

    const handleChangeMode = async (nextMode) => {
        if (isRecording || isBusy) return;

        const canUseMode = await ensurePermissions(nextMode);
        if (!canUseMode) return;

        setMode(nextMode);
    };

    const handleCapture = async () => {
        if (!cameraRef.current || !isReady || isBusy) return;

        const canUseMode = await ensurePermissions(mode);
        if (!canUseMode) return;

        if (mode === "video") {
            if (isRecording) {
                cameraRef.current.stopRecording();
                return;
            }

            try {
                setRecordingSeconds(0);
                setIsRecording(true);
                const video = await cameraRef.current.recordAsync(
                    getCameraVideoRecordingOptions()
                );

                videoDebugLog("cameraRecordAsyncResult", {
                    hasVideo: !!video,
                    uriInfo: getUriInfo(video?.uri),
                    width: video?.width,
                    height: video?.height,
                    duration: video?.duration,
                    codec: video?.codec,
                    keys: video ? Object.keys(video) : [],
                });

                if (video?.uri) {
                    onCaptured?.({
                        ...video,
                        type: "video",
                        mimeType: "video/mp4",
                        fileName: `camera-video-${Date.now()}.mp4`,
                        codec: video.codec,
                    });
                }
            } catch (error) {
                console.log("Record video error:", error);

                Alert.alert(
                    tr("errorTitle", "Something went wrong"),
                    tr("recordVideoError", "Could not record the video. Please try again.")
                );
            } finally {
                setIsRecording(false);
                setRecordingSeconds(0);
            }

            return;
        }

        try {
            setIsBusy(true);
            const photo = await cameraRef.current.takePictureAsync({
                quality: 0.92,
                skipProcessing: false,
            });

            if (photo?.uri) {
                onCaptured?.({
                    ...photo,
                    type: "image",
                    mimeType: "image/jpeg",
                    fileName: `camera-photo-${Date.now()}.jpg`,
                });
            }
        } catch (error) {
            console.log("Take photo error:", error);

            Alert.alert(
                tr("errorTitle", "Something went wrong"),
                tr("takePhotoError", "Could not take the photo. Please try again.")
            );
        } finally {
            setIsBusy(false);
        }
    };

    const handleClose = () => {
        if (isRecording) {
            cameraRef.current?.stopRecording();
            setIsRecording(false);
            setRecordingSeconds(0);
            return;
        }

        onClose?.();
    };

    const handleOpenLibraryPress = () => {
        console.log("[CameraLibrary] side library button onPress", {
            isRecording,
            isBusy,
            isReady,
        });

        if (isRecording || isBusy) {
            return;
        }

        try {
            onOpenLibrary?.();
        } catch (error) {
            console.log("[CameraLibrary] onOpenLibrary callback error:", error);

            Alert.alert(
                tr("errorTitle", "Something went wrong"),
                tr("mediaPickerError", "Could not select the media. Please try again.")
            );
        }
    };

    if (!visible) return null;

    return (
        <Modal
            visible={visible}
            transparent={false}
            animationType="fade"
            onRequestClose={handleClose}
            statusBarTranslucent
            navigationBarTranslucent
            presentationStyle="fullScreen"
        >
            <View style={styles.cameraRoot}>
                <StatusBar style="light" translucent backgroundColor="transparent" />

                <CameraView
                    ref={cameraRef}
                    style={styles.cameraPreview}
                    facing={facing}
                    flash={flash}
                    mode={mode}
                    videoQuality="1080p"
                    onCameraReady={() => setIsReady(true)}
                />

                {!hasCameraPermission && (
                    <View style={styles.cameraPermissionLayer}>
                        <Text style={styles.cameraPermissionTitle}>
                            {tr("permissionNeeded", "Permission needed")}
                        </Text>
                        <Text style={styles.cameraPermissionText}>
                            {tr(
                                "cameraPermissionMessage",
                                "Please allow camera access to take photos and record videos."
                            )}
                        </Text>
                        <TouchableOpacity
                            style={styles.cameraPermissionButton}
                            activeOpacity={0.85}
                            onPress={() => ensurePermissions(mode)}
                        >
                            <Text style={styles.cameraPermissionButtonText}>
                                {tr("allow", "Allow")}
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}

                <View style={[styles.cameraTopBar, { paddingTop: insets.top + 12 }]}>
                    <TouchableOpacity
                        style={styles.cameraTopButton}
                        activeOpacity={0.85}
                        onPress={handleClose}
                    >
                        <Ionicons name="close" size={32} color="#FFFFFF" />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.cameraTopButton}
                        activeOpacity={0.85}
                        onPress={() => setFlash((prev) => (prev === "off" ? "on" : "off"))}
                    >
                        <Ionicons
                            name={flash === "off" ? "flash-off" : "flash"}
                            size={26}
                            color="#FFFFFF"
                        />
                    </TouchableOpacity>
                </View>

                {isRecording && (
                    <View style={[styles.recordingPill, { top: insets.top + 18 }]}>
                        <View style={styles.recordingDot} />
                        <Text style={styles.recordingText}>{tr("recording", "Recording")}</Text>
                        <Text style={styles.recordingTimerText}>{recordingTimeText}</Text>
                    </View>
                )}

                <View style={[styles.cameraBottomArea, { paddingBottom: Math.max(insets.bottom, 14) + 12 }]}>
                    <View style={styles.cameraModeTabs}>
                        <TouchableOpacity
                            activeOpacity={0.85}
                            disabled={isRecording || isBusy}
                            onPress={() => handleChangeMode("video")}
                        >
                            <Text style={[styles.cameraModeText, mode === "video" && styles.cameraModeTextActive]}>
                                {tr("video", "VIDEO")}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            activeOpacity={0.85}
                            disabled={isRecording || isBusy}
                            onPress={() => handleChangeMode("picture")}
                        >
                            <Text style={[styles.cameraModeText, mode === "picture" && styles.cameraModeTextActive]}>
                                {tr("photo", "PHOTO")}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.cameraActionsRow}>
                        <TouchableOpacity
                            style={styles.cameraSideButton}
                            activeOpacity={0.85}
                            disabled={isRecording || isBusy}
                            onPress={handleOpenLibraryPress}
                        >
                            <Ionicons name="images" size={27} color="#FFFFFF" />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.cameraCaptureButtonOuter,
                                mode === "video" && styles.cameraCaptureButtonOuterVideo,
                                isRecording && styles.cameraCaptureButtonOuterRecording,
                            ]}
                            activeOpacity={0.9}
                            onPress={handleCapture}
                            disabled={!isReady || isBusy}
                        >
                            {isBusy ? (
                                <ActivityIndicator color="#FFFFFF" />
                            ) : (
                                <View
                                    style={[
                                        styles.cameraCaptureButtonInner,
                                        mode === "video" && styles.cameraCaptureButtonInnerVideo,
                                        isRecording && styles.cameraCaptureButtonInnerRecording,
                                    ]}
                                />
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.cameraSideButton}
                            activeOpacity={0.85}
                            disabled={isRecording || isBusy}
                            onPress={() => setFacing((prev) => (prev === "back" ? "front" : "back"))}
                        >
                            <Ionicons name="camera-reverse" size={31} color="#FFFFFF" />
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.cameraHintText}>
                        {isRecording
                            ? `${tr("tapToStopRecording", "Tap to stop recording")} • ${recordingTimeText}`
                            : mode === "video"
                                ? tr("tapToRecord", "Tap to record video")
                                : tr("tapToPhoto", "Tap to take photo")}
                    </Text>
                </View>
            </View>
        </Modal>
    );
}


const getMediaThemeColors = (colors = {}, isDark = true) => ({
    rootBackground: colors.background,
    mediaBackground: colors.background,
    barBackground: colors.cardStrong,
    cardBackground: colors.cardSoft,
    buttonBackground: colors.buttonSoft || colors.cardSoft,
    buttonBorder: colors.borderLight || colors.border,
    text: colors.textPrimary,
    muted: colors.textMuted,
    border: colors.border,
    inputBackground: colors.inputBackground,
    primary: colors.primary,
    primaryText: colors.darkText,
    progressTrack: colors.borderSoft || colors.border,
    progressFill: colors.textPrimary,
    overlayButton: colors.cardSoft,
});

function CircleButton({ icon, onPress, children, style, colors }) {
    const themeColors = getMediaThemeColors(colors);

    return (
        <TouchableOpacity
            style={[
                styles.circleButton,
                {
                    backgroundColor: themeColors.buttonBackground,
                    borderColor: themeColors.buttonBorder,
                },
                style,
            ]}
            activeOpacity={0.85}
            onPress={onPress}
        >
            {icon ? (
                <Ionicons name={icon} size={26} color={themeColors.text} />
            ) : (
                children
            )}
        </TouchableOpacity>
    );
}

function VideoLayer({ source, previewMode, colors }) {
    const themeColors = getMediaThemeColors(colors);
    const sourceUri = source?.uri || "";
    const [playableSource, setPlayableSource] = useState(null);
    const [isPreparingVideo, setIsPreparingVideo] = useState(false);
    const [isReplacingSource, setIsReplacingSource] = useState(false);
    const [videoPrepareFailed, setVideoPrepareFailed] = useState(false);
    const [loadedDuration, setLoadedDuration] = useState(0);
    const [controlsVisible, setControlsVisible] = useState(true);
    const [thumbnailUri, setThumbnailUri] = useState(() => getVideoThumbnailCandidate(source));
    const hideControlsTimeoutRef = useRef(null);

    const player = useVideoPlayer(null, (playerInstance) => {
        playerInstance.loop = false;
        playerInstance.muted = false;
        playerInstance.timeUpdateEventInterval = 0.25;
    });

    const replacePlayerSource = async (nextSource) => {
        if (typeof player.replaceAsync === "function") {
            await player.replaceAsync(nextSource);
            return;
        }

        if (typeof player.replace === "function") {
            player.replace(nextSource, true);
        }
    };

    const clearHideControlsTimeout = () => {
        if (hideControlsTimeoutRef.current) {
            clearTimeout(hideControlsTimeoutRef.current);
            hideControlsTimeoutRef.current = null;
        }
    };

    const scheduleHideControls = () => {
        clearHideControlsTimeout();

        if (!player.playing) {
            return;
        }

        hideControlsTimeoutRef.current = setTimeout(() => {
            setControlsVisible(false);
        }, 2200);
    };

    useEffect(() => {
        return () => {
            clearHideControlsTimeout();

            try {
                player.pause();

                const cleanupResult = typeof player.replaceAsync === "function"
                    ? player.replaceAsync(null)
                    : typeof player.replace === "function"
                        ? player.replace(null, true)
                        : null;

                if (cleanupResult && typeof cleanupResult.catch === "function") {
                    cleanupResult.catch((error) => {
                        console.log("Video player cleanup error:", error);
                    });
                }
            } catch (error) {
                console.log("Video player cleanup error:", error);
            }
        };
    }, [player]);

    useEffect(() => {
        let isMounted = true;

        const preparePlayableSource = async () => {
            if (!sourceUri) {
                setPlayableSource(null);
                setIsPreparingVideo(false);
                setVideoPrepareFailed(false);
                setLoadedDuration(0);
                setThumbnailUri(null);
                return;
            }

            setIsPreparingVideo(true);
            setVideoPrepareFailed(false);
            setPlayableSource(null);
            setLoadedDuration(0);
            setControlsVisible(true);
            setThumbnailUri(getVideoThumbnailCandidate(source));

            videoDebugLog("VideoLayerPrepareSourceStart", {
                sourceUriInfo: getUriInfo(sourceUri),
                isRemote: isRemoteVideoUri(sourceUri),
                previewMode,
            });

            try {
                const playableUri = await getPlayableVideoUri(sourceUri);

                if (!isMounted) {
                    return;
                }

                const nextSource = playableUri
                    ? {
                        ...(source || {}),
                        uri: playableUri,
                        contentType: "auto",
                    }
                    : source;

                videoDebugLog("VideoLayerPrepareSourceDone", {
                    originalSourceUriInfo: getUriInfo(sourceUri),
                    playableSourceUriInfo: getUriInfo(nextSource?.uri),
                    usedCachedLocalFile: !!nextSource?.uri && nextSource.uri !== sourceUri,
                });

                setPlayableSource(nextSource || null);
            } catch (error) {
                console.log("Prepare playable video error:", error);

                if (isMounted) {
                    setVideoPrepareFailed(true);
                    setPlayableSource(source || null);
                }
            } finally {
                if (isMounted) {
                    setIsPreparingVideo(false);
                }
            }
        };

        preparePlayableSource();

        return () => {
            isMounted = false;
        };
    }, [sourceUri, previewMode]);

    useEffect(() => {
        let isMounted = true;

        const prepareThumbnail = async () => {
            const explicitThumbnail = getVideoThumbnailCandidate(playableSource || source);

            if (explicitThumbnail) {
                setThumbnailUri(explicitThumbnail);
                return;
            }

            if (!playableSource?.uri || typeof VideoThumbnails?.getThumbnailAsync !== "function") {
                return;
            }

            try {
                const thumbnail = await VideoThumbnails.getThumbnailAsync(playableSource.uri, {
                    time: 1000,
                    quality: 0.72,
                });

                if (isMounted && thumbnail?.uri) {
                    videoDebugLog("VideoLayerThumbnailReady", {
                        videoUriInfo: getUriInfo(playableSource.uri),
                        thumbnailUriInfo: getUriInfo(thumbnail.uri),
                    });

                    setThumbnailUri(thumbnail.uri);
                }
            } catch (error) {
                videoDebugLog("VideoLayerThumbnailFailed", {
                    videoUriInfo: getUriInfo(playableSource?.uri),
                    message: error?.message,
                });
            }
        };

        prepareThumbnail();

        return () => {
            isMounted = false;
        };
    }, [playableSource?.uri, sourceUri]);

    useEffect(() => {
        let isMounted = true;

        const loadSourceIntoPlayer = async () => {
            try {
                player.pause();
                setLoadedDuration(0);

                if (!playableSource?.uri) {
                    setIsReplacingSource(false);
                    await replacePlayerSource(null);
                    return;
                }

                setIsReplacingSource(true);
                setVideoPrepareFailed(false);

                videoDebugLog("VideoLayerReplaceSourceStart", {
                    playableSourceUriInfo: getUriInfo(playableSource.uri),
                    originalSourceUriInfo: getUriInfo(source?.uri),
                    playerStatus: player.status,
                    usingReplaceAsync: typeof player.replaceAsync === "function",
                });

                await replacePlayerSource(playableSource);

                if (!isMounted) {
                    return;
                }

                try {
                    player.currentTime = 0;
                } catch (seekError) {
                    console.log("Video player reset time error:", seekError);
                }

                videoDebugLog("VideoLayerReplaceSourceDone", {
                    playableSourceUriInfo: getUriInfo(playableSource.uri),
                    originalSourceUriInfo: getUriInfo(source?.uri),
                    playerStatus: player.status,
                    playerDuration: player.duration,
                    playerCurrentTime: player.currentTime,
                });
            } catch (error) {
                console.log("Video player replace source error:", error);

                if (isMounted) {
                    setVideoPrepareFailed(true);
                }
            } finally {
                if (isMounted) {
                    setIsReplacingSource(false);
                }
            }
        };

        loadSourceIntoPlayer();

        return () => {
            isMounted = false;
        };
    }, [player, playableSource?.uri]);

    const { isPlaying } = useEvent(player, "playingChange", {
        isPlaying: player.playing,
    });

    const { currentTime } = useEvent(player, "timeUpdate", {
        currentTime: player.currentTime || 0,
    });

    const sourceLoadEvent = useEvent(player, "sourceLoad", {
        duration: player.duration || 0,
        videoSource: null,
    });

    const statusEvent = useEvent(player, "statusChange", {
        status: player.status || "idle",
        error: null,
    });

    useEffect(() => {
        const nextDuration = Number(sourceLoadEvent?.duration || player.duration || 0);

        if (nextDuration > 0) {
            setLoadedDuration(nextDuration);
        }

        if (sourceLoadEvent?.videoSource) {
            videoDebugLog("VideoLayerSourceLoaded", {
                sourceUriInfo: getUriInfo(playableSource?.uri),
                eventSourceUriInfo: getUriInfo(sourceLoadEvent.videoSource?.uri || sourceLoadEvent.videoSource),
                duration: nextDuration,
                playerStatus: player.status,
            });
        }
    }, [sourceLoadEvent?.duration, sourceLoadEvent?.videoSource, playableSource?.uri]);

    useEffect(() => {
        if (statusEvent?.status === "error") {
            setVideoPrepareFailed(true);
            setControlsVisible(true);
            clearHideControlsTimeout();

            videoDebugLog("VideoLayerStatusError", {
                sourceUriInfo: getUriInfo(playableSource?.uri),
                originalSourceUriInfo: getUriInfo(source?.uri),
                error: statusEvent?.error,
            });
        }
    }, [statusEvent?.status, statusEvent?.error, playableSource?.uri, source?.uri]);

    const duration = Number(loadedDuration || sourceLoadEvent?.duration || player.duration || 0);
    const progress = duration > 0 ? Math.min((currentTime || 0) / duration, 1) : 0;
    const isVideoBusy = isPreparingVideo || isReplacingSource || statusEvent?.status === "loading";
    const shouldShowThumbnail = !!thumbnailUri && !isPlaying && Number(currentTime || 0) <= 0.25;

    useEffect(() => {
        if (!isPlaying) {
            setControlsVisible(true);
            clearHideControlsTimeout();
            return;
        }

        if (controlsVisible) {
            scheduleHideControls();
        }
    }, [isPlaying, controlsVisible]);

    useEffect(() => {
        videoDebugLog("VideoLayerMountedOrSourceChanged", {
            sourceUriInfo: getUriInfo(playableSource?.uri),
            originalSourceUriInfo: getUriInfo(source?.uri),
            thumbnailUriInfo: getUriInfo(thumbnailUri),
            previewMode,
            isPreparingVideo,
            isReplacingSource,
            videoPrepareFailed,
            playerStatus: player.status,
            statusEvent: statusEvent?.status,
            playerDuration: player.duration,
            loadedDuration,
            playerCurrentTime: player.currentTime,
            playerPlaying: player.playing,
        });
    }, [source?.uri, playableSource?.uri, thumbnailUri, previewMode, isPreparingVideo, isReplacingSource, videoPrepareFailed, statusEvent?.status, loadedDuration]);

    useEffect(() => {
        if (duration > 0 || currentTime > 0 || isPlaying) {
            videoDebugLog("VideoLayerPlayerState", {
                sourceUriInfo: getUriInfo(playableSource?.uri),
                originalSourceUriInfo: getUriInfo(source?.uri),
                isPlaying,
                currentTime,
                duration,
                progress,
                playerStatus: player.status,
                statusEvent: statusEvent?.status,
            });
        }
    }, [isPlaying, currentTime, duration, statusEvent?.status]);

    const handleVideoSurfacePress = () => {
        if (videoPrepareFailed) {
            return;
        }

        setControlsVisible((currentValue) => {
            const nextValue = !currentValue;

            if (nextValue && player.playing) {
                setTimeout(scheduleHideControls, 0);
            }

            return nextValue;
        });
    };

    const togglePlayback = async () => {
        videoDebugLog("VideoLayerTogglePlayback", {
            sourceUriInfo: getUriInfo(playableSource?.uri),
            originalSourceUriInfo: getUriInfo(source?.uri),
            isPreparingVideo,
            isReplacingSource,
            videoPrepareFailed,
            isPlaying,
            currentTime: player.currentTime,
            duration,
            playerStatus: player.status,
            statusEvent: statusEvent?.status,
        });

        if (!playableSource?.uri || isVideoBusy) {
            return;
        }

        if (isPlaying) {
            player.pause();
            setControlsVisible(true);
            clearHideControlsTimeout();
            return;
        }

        if (statusEvent?.status === "error" || player.status === "error") {
            setVideoPrepareFailed(true);
            setControlsVisible(true);
            return;
        }

        const current = Number(player.currentTime || 0);
        const isAtEnd = duration > 0 && current >= duration - 0.25;

        if (isAtEnd) {
            try {
                if (typeof player.replay === "function") {
                    player.replay();
                    setControlsVisible(false);
                    return;
                }

                player.currentTime = 0;
            } catch (error) {
                console.log("Video replay error:", error);
            }
        }

        try {
            player.play();
            setControlsVisible(false);
            clearHideControlsTimeout();
        } catch (error) {
            console.log("Video play error:", error);
            setVideoPrepareFailed(true);
            setControlsVisible(true);
        }
    };

    const seekBy = (offsetSeconds) => {
        if (!playableSource?.uri || isVideoBusy) {
            return;
        }

        try {
            if (typeof player.seekBy === "function") {
                player.seekBy(offsetSeconds);
            } else {
                const nextPosition = Math.max(
                    0,
                    Math.min((player.currentTime || 0) + offsetSeconds, duration || player.currentTime || 0)
                );

                player.currentTime = nextPosition;
            }

            setControlsVisible(true);
            scheduleHideControls();
        } catch (error) {
            console.log("Video seek error:", error);
        }
    };

    return (
        <View style={styles.videoLayer}>
            {isVideoBusy && !playableSource?.uri ? (
                <ActivityIndicator color={themeColors.text} />
            ) : (
                <VideoView
                    key={playableSource?.uri || sourceUri || "video"}
                    player={player}
                    style={styles.fullMedia}
                    nativeControls={false}
                    contentFit="contain"
                    fullscreenOptions={{ enable: false }}
                    allowsPictureInPicture={false}
                    surfaceType="textureView"
                />
            )}

            {shouldShowThumbnail && (
                <Image
                    source={{ uri: thumbnailUri }}
                    style={[styles.fullMedia, styles.videoThumbnailOverlay]}
                    resizeMode="contain"
                />
            )}

            <TouchableOpacity
                activeOpacity={1}
                style={styles.videoTapLayer}
                onPress={handleVideoSurfacePress}
            />

            {controlsVisible && (
                <>
                    <View style={styles.videoControlsCenter} pointerEvents="box-none">
                        <TouchableOpacity
                            style={[
                                styles.seekButton,
                                previewMode && styles.seekButtonPreview,
                                { backgroundColor: themeColors.overlayButton },
                            ]}
                            activeOpacity={0.85}
                            disabled={isVideoBusy || videoPrepareFailed}
                            onPress={() => seekBy(-10)}
                        >
                            <MaterialCommunityIcons name="rewind-10" size={34} color={themeColors.text} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.playButton,
                                previewMode && styles.playButtonPreview,
                                { backgroundColor: themeColors.overlayButton },
                            ]}
                            activeOpacity={0.9}
                            onPress={togglePlayback}
                            disabled={isVideoBusy || videoPrepareFailed}
                        >
                            {isVideoBusy ? (
                                <ActivityIndicator color={themeColors.text} />
                            ) : videoPrepareFailed ? (
                                <Ionicons
                                    name="alert-circle-outline"
                                    size={previewMode ? 34 : 42}
                                    color={themeColors.text}
                                />
                            ) : (
                                <Ionicons
                                    name={isPlaying ? "pause" : "play"}
                                    size={previewMode ? 34 : 42}
                                    color={themeColors.text}
                                    style={!isPlaying && styles.playIconOffset}
                                />
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.seekButton,
                                previewMode && styles.seekButtonPreview,
                                { backgroundColor: themeColors.overlayButton },
                            ]}
                            activeOpacity={0.85}
                            disabled={isVideoBusy || videoPrepareFailed}
                            onPress={() => seekBy(10)}
                        >
                            <MaterialCommunityIcons name="fast-forward-10" size={34} color={themeColors.text} />
                        </TouchableOpacity>
                    </View>

                    {duration > 0 && (
                        <View
                            style={[
                                styles.videoProgressPill,
                                { backgroundColor: themeColors.cardBackground },
                            ]}
                        >
                            <Text style={[styles.videoProgressText, { color: themeColors.muted }]}>
                                {formatVideoTime(currentTime)}
                            </Text>
                            <View style={[styles.progressTrack, { backgroundColor: themeColors.progressTrack }]}>
                                <View
                                    style={[
                                        styles.progressFill,
                                        {
                                            width: `${progress * 100}%`,
                                            backgroundColor: themeColors.progressFill,
                                        },
                                    ]}
                                />
                            </View>
                            <Text style={[styles.videoProgressText, { color: themeColors.muted }]}>
                                -{formatVideoTime(Math.max(0, duration - currentTime))}
                            </Text>
                        </View>
                    )}
                </>
            )}
        </View>
    );
}

function MediaViewer({ mediaItem, image, video, previewMode = false, colors }) {
    const isVideo = mediaItem?.type === "video";
    const videoSource = getVideoSource(mediaItem, video);

    videoDebugLog("MediaViewerRender", {
        mediaItemType: mediaItem?.type,
        isVideo,
        previewMode,
        hasImageProp: !!image,
        hasVideoProp: !!video,
        mediaItemUriInfo: getUriInfo(mediaItem?.uri),
        mediaItemVideoUriInfo: getUriInfo(mediaItem?.video?.uri),
        resolvedVideoSourceUriInfo: getUriInfo(videoSource?.uri),
        mediaItemKeys: mediaItem ? Object.keys(mediaItem) : [],
    });

    if (isVideo && videoSource) {
        return (
            <VideoLayer
                source={videoSource}
                previewMode={previewMode}
                colors={colors}
            />
        );
    }

    return (
        <Image
            source={image || (mediaItem?.uri ? { uri: mediaItem.uri } : null)}
            style={styles.fullMedia}
            resizeMode="contain"
        />
    );
}

export function MediaPreviewModal({
    visible,
    mediaItem,
    image,
    video,
    caption,
    time,
    colors,
    isDark,
    tr,
    onClose,
    onSave,
}) {
    const insets = useSafeAreaInsets();
    const isVideo = mediaItem?.type === "video";
    const themeColors = getMediaThemeColors(colors, isDark);

    useEffect(() => {
        if (!visible) return;

        videoDebugLog("MediaPreviewModalVisible", {
            isVideo,
            mediaItemType: mediaItem?.type,
            caption,
            time,
            mediaItemUriInfo: getUriInfo(mediaItem?.uri),
            mediaItemVideoUriInfo: getUriInfo(mediaItem?.video?.uri),
            videoPropUriInfo: getUriInfo(video?.uri),
            imagePropUriInfo: getUriInfo(image?.uri),
            mediaItemKeys: mediaItem ? Object.keys(mediaItem) : [],
        });
    }, [visible, mediaItem?.id, mediaItem?.uri, mediaItem?.video?.uri, video?.uri]);

    if (!visible) {
        return null;
    }

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
            statusBarTranslucent
            navigationBarTranslucent
            presentationStyle="overFullScreen"
        >
            <View style={[styles.viewerRoot, { backgroundColor: themeColors.rootBackground }]}>
                <StatusBar
                    style={isDark ? "light" : "dark"}
                    translucent
                    backgroundColor="transparent"
                />

                <View
                    style={[
                        styles.previewTopBar,
                        {
                            paddingTop: insets.top + 8,
                            backgroundColor: themeColors.barBackground,
                            borderBottomColor: themeColors.border,
                        },
                    ]}
                >
                    <CircleButton icon="close" onPress={onClose} colors={colors} />

                    <View style={styles.previewTitleWrapper}>
                        <Text
                            style={[styles.previewTitle, { color: themeColors.text }]}
                            numberOfLines={1}
                        >
                            {isVideo
                                ? tr("video", "Video")
                                : tr("photo", "Photo")}
                        </Text>
                        {!!time && (
                            <Text
                                style={[styles.previewSubtitle, { color: themeColors.muted }]}
                                numberOfLines={1}
                            >
                                {time}
                            </Text>
                        )}
                    </View>

                    {!!mediaItem ? (
                        <TouchableOpacity
                            style={[
                                styles.savePill,
                                {
                                    backgroundColor: themeColors.buttonBackground,
                                    borderColor: themeColors.buttonBorder,
                                },
                            ]}
                            activeOpacity={0.85}
                            onPress={onSave}
                        >
                            <Ionicons name="download-outline" size={22} color={themeColors.text} />
                            <Text style={[styles.savePillText, { color: themeColors.text }]}>
                                {tr("save", "Save")}
                            </Text>
                        </TouchableOpacity>
                    ) : (
                        <View style={styles.savePillPlaceholder} />
                    )}
                </View>

                <View style={[styles.viewerMediaArea, { backgroundColor: themeColors.mediaBackground }]}>
                    <MediaViewer
                        mediaItem={mediaItem}
                        image={image}
                        video={video}
                        previewMode
                        colors={colors}
                    />
                </View>

                {!!caption && (
                    <View
                        style={[
                            styles.previewCaptionBar,
                            {
                                paddingBottom: Math.max(insets.bottom, 12) + 8,
                                backgroundColor: themeColors.barBackground,
                                borderTopColor: themeColors.border,
                            },
                        ]}
                    >
                        <Text
                            style={[styles.previewCaptionText, { color: themeColors.text }]}
                            numberOfLines={2}
                        >
                            {caption}
                        </Text>
                    </View>
                )}
            </View>
        </Modal>
    );
}

export function MediaConfirmModal({
    visible,
    mediaItem,
    image,
    video,
    caption,
    colors,
    isDark,
    tr,
    onCancel,
    onSend,
}) {
    const insets = useSafeAreaInsets();
    const themeColors = getMediaThemeColors(colors, isDark);

    useEffect(() => {
        if (!visible) return;

        videoDebugLog("MediaConfirmModalVisible", {
            mediaItemType: mediaItem?.type,
            caption,
            mediaItemUriInfo: getUriInfo(mediaItem?.uri),
            mediaItemVideoUriInfo: getUriInfo(mediaItem?.video?.uri),
            videoPropUriInfo: getUriInfo(video?.uri),
            imagePropUriInfo: getUriInfo(image?.uri),
            mediaItemKeys: mediaItem ? Object.keys(mediaItem) : [],
        });
    }, [visible, mediaItem?.id, mediaItem?.uri, mediaItem?.video?.uri, video?.uri]);

    if (!visible) {
        return null;
    }

    if (mediaItem?.type === "image") {
        return (
            <Modal
                visible={visible}
                transparent
                animationType="fade"
                onRequestClose={onCancel}
                statusBarTranslucent
                navigationBarTranslucent
                presentationStyle="overFullScreen"
            >
                <ImageMediaEditor
                    visible={visible}
                    mediaItem={mediaItem}
                    image={image}
                    caption={caption}
                    colors={colors}
                    tr={tr}
                    onCancel={onCancel}
                    onSend={onSend}
                />
            </Modal>
        );
    }

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onCancel}
            statusBarTranslucent
            navigationBarTranslucent
            presentationStyle="overFullScreen"
        >
            <View style={[styles.confirmRoot, { backgroundColor: themeColors.rootBackground }]}>
                <StatusBar
                    style={isDark ? "light" : "dark"}
                    translucent
                    backgroundColor="transparent"
                />

                <View
                    style={[
                        styles.confirmTopBar,
                        {
                            paddingTop: insets.top + 8,
                            backgroundColor: themeColors.barBackground,
                            borderBottomColor: themeColors.border,
                        },
                    ]}
                >
                    <CircleButton icon="close" onPress={onCancel} colors={colors} />

                    <View style={styles.confirmTopActions}>
                        <CircleButton style={styles.smallCircleButton} colors={colors}>
                            <Ionicons name="download-outline" size={24} color={themeColors.text} />
                        </CircleButton>
                        <CircleButton style={styles.smallCircleButton} colors={colors}>
                            <Text
                                style={[
                                    styles.hdText,
                                    {
                                        color: themeColors.text,
                                        borderColor: themeColors.text,
                                    },
                                ]}
                            >
                                HD
                            </Text>
                        </CircleButton>
                        <CircleButton icon="crop-outline" style={styles.smallCircleButton} colors={colors} />
                        <CircleButton icon="create-outline" style={styles.smallCircleButton} colors={colors} />
                    </View>
                </View>

                <View style={[styles.confirmMediaArea, { backgroundColor: themeColors.mediaBackground }]}>
                    <MediaViewer
                        mediaItem={mediaItem}
                        image={image}
                        video={video}
                        colors={colors}
                    />
                </View>

                <View
                    style={[
                        styles.confirmBottomArea,
                        {
                            paddingBottom: Math.max(insets.bottom, 12) + 10,
                            backgroundColor: themeColors.barBackground,
                            borderTopColor: themeColors.border,
                        },
                    ]}
                >
                    <View
                        style={[
                            styles.captionInputRow,
                            {
                                borderColor: themeColors.border,
                                backgroundColor: themeColors.inputBackground,
                            },
                        ]}
                    >
                        <Ionicons name="image-outline" size={24} color={themeColors.muted} />
                        <TextInput
                            style={[styles.captionInput, { color: themeColors.text }]}
                            placeholder={tr("addCaption", "Add a caption...")}
                            placeholderTextColor={themeColors.muted}
                            value={caption || ""}
                            editable={false}
                            multiline={false}
                        />
                    </View>

                    <View style={styles.sendRow}>
                        <View
                            style={[
                                styles.recipientPill,
                                { backgroundColor: themeColors.buttonBackground },
                            ]}
                        >
                            <Text style={[styles.recipientText, { color: themeColors.text }]}>
                                {tr("you", "You")}
                            </Text>
                        </View>

                        <TouchableOpacity
                            style={[
                                styles.sendCircle,
                                { backgroundColor: themeColors.primary },
                            ]}
                            activeOpacity={0.9}
                            onPress={onSend}
                        >
                            <Ionicons name="send" size={25} color={themeColors.primaryText} />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    cameraRoot: {
        flex: 1,
        backgroundColor: "#000000",
    },

    cameraPreview: {
        ...StyleSheet.absoluteFillObject,
    },

    cameraPermissionLayer: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 40,
        backgroundColor: "rgba(0, 0, 0, 0.88)",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 26,
    },

    cameraPermissionTitle: {
        color: "#FFFFFF",
        fontSize: 20,
        fontWeight: "900",
        textAlign: "center",
    },

    cameraPermissionText: {
        color: "rgba(255, 255, 255, 0.78)",
        marginTop: 10,
        fontSize: 14,
        fontWeight: "700",
        textAlign: "center",
        lineHeight: 21,
    },

    cameraPermissionButton: {
        marginTop: 18,
        minHeight: 46,
        borderRadius: 23,
        paddingHorizontal: 22,
        backgroundColor: "#FFFFFF",
        alignItems: "center",
        justifyContent: "center",
    },

    cameraPermissionButtonText: {
        color: "#000000",
        fontSize: 15,
        fontWeight: "900",
    },

    cameraTopBar: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 20,
        paddingHorizontal: 18,
        paddingBottom: 12,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },

    cameraTopButton: {
        width: 54,
        height: 54,
        borderRadius: 27,
        backgroundColor: "rgba(0, 0, 0, 0.38)",
        alignItems: "center",
        justifyContent: "center",
    },

    recordingPill: {
        position: "absolute",
        alignSelf: "center",
        zIndex: 21,
        minHeight: 34,
        borderRadius: 17,
        paddingHorizontal: 14,
        backgroundColor: "rgba(0, 0, 0, 0.56)",
        flexDirection: "row",
        alignItems: "center",
        gap: 7,
    },

    recordingDot: {
        width: 9,
        height: 9,
        borderRadius: 5,
        backgroundColor: "#EF4444",
    },

    recordingText: {
        color: "#FFFFFF",
        fontSize: 12,
        fontWeight: "900",
    },

    recordingTimerText: {
        color: "#FFFFFF",
        fontSize: 13,
        fontWeight: "900",
        letterSpacing: 0.4,
        fontVariant: ["tabular-nums"],
    },

    cameraBottomArea: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 20,
        paddingTop: 18,
        paddingHorizontal: 22,
        backgroundColor: "rgba(0, 0, 0, 0.88)",
        alignItems: "center",
    },

    cameraModeTabs: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 34,
        marginBottom: 17,
    },

    cameraModeText: {
        color: "rgba(255, 255, 255, 0.86)",
        fontSize: 16,
        fontWeight: "800",
        letterSpacing: 0.8,
    },

    cameraModeTextActive: {
        color: "#FACC15",
        fontWeight: "900",
    },

    cameraActionsRow: {
        width: "100%",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },

    cameraSideButton: {
        width: 58,
        height: 58,
        borderRadius: 29,
        backgroundColor: "rgba(255, 255, 255, 0.14)",
        alignItems: "center",
        justifyContent: "center",
    },

    cameraCaptureButtonOuter: {
        width: 86,
        height: 86,
        borderRadius: 43,
        borderWidth: 4,
        borderColor: "#FFFFFF",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(255, 255, 255, 0.10)",
    },

    cameraCaptureButtonOuterVideo: {
        borderColor: "#EF4444",
    },

    cameraCaptureButtonOuterRecording: {
        borderColor: "#EF4444",
        backgroundColor: "rgba(239, 68, 68, 0.18)",
    },

    cameraCaptureButtonInner: {
        width: 66,
        height: 66,
        borderRadius: 33,
        backgroundColor: "#FFFFFF",
    },

    cameraCaptureButtonInnerVideo: {
        backgroundColor: "#EF4444",
    },

    cameraCaptureButtonInnerRecording: {
        width: 34,
        height: 34,
        borderRadius: 8,
        backgroundColor: "#EF4444",
    },

    cameraHintText: {
        marginTop: 10,
        color: "rgba(255, 255, 255, 0.58)",
        fontSize: 12,
        fontWeight: "700",
    },

    viewerRoot: {
        flex: 1,
    },

    previewTopBar: {
        minHeight: 86,
        paddingHorizontal: 18,
        paddingBottom: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        borderBottomWidth: 1,
        zIndex: 20,
    },

    previewTitleWrapper: {
        flex: 1,
        minWidth: 0,
        alignItems: "center",
    },

    previewTitle: {
        fontSize: 16,
        fontWeight: "800",
    },

    previewSubtitle: {
        marginTop: 2,
        fontSize: 12,
        fontWeight: "600",
    },

    savePill: {
        height: 46,
        minWidth: 92,
        borderRadius: 23,
        paddingHorizontal: 14,
        borderWidth: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 7,
    },

    savePillPlaceholder: {
        width: 92,
        height: 46,
    },

    savePillText: {
        fontSize: 14,
        fontWeight: "900",
    },

    viewerMediaArea: {
        flex: 1,
        width: "100%",
        alignItems: "center",
        justifyContent: "center",
    },

    previewCaptionBar: {
        paddingHorizontal: 18,
        paddingTop: 12,
        borderTopWidth: 1,
    },

    previewCaptionText: {
        fontSize: 15,
        fontWeight: "700",
        lineHeight: 21,
    },

    confirmRoot: {
        flex: 1,
    },

    confirmTopBar: {
        minHeight: 90,
        paddingHorizontal: 14,
        paddingBottom: 12,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        borderBottomWidth: 1,
        zIndex: 20,
    },

    confirmTopActions: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 10,
        flexShrink: 1,
    },

    circleButton: {
        width: 46,
        height: 46,
        borderRadius: 23,
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
    },

    smallCircleButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
    },

    hdText: {
        fontSize: 12,
        fontWeight: "900",
        borderWidth: 1,
        borderRadius: 4,
        paddingHorizontal: 4,
        paddingVertical: 1,
    },

    confirmMediaArea: {
        flex: 1,
        width: "100%",
        alignItems: "center",
        justifyContent: "center",
    },

    fullMedia: {
        width: "100%",
        height: "100%",
    },

    videoLayer: {
        width: "100%",
        height: "100%",
        alignItems: "center",
        justifyContent: "center",
    },

    videoThumbnailOverlay: {
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        zIndex: 2,
    },

    videoTapLayer: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 4,
    },

    videoControlsCenter: {
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        zIndex: 8,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 42,
        paddingHorizontal: 24,
    },

    playButton: {
        width: 82,
        height: 82,
        borderRadius: 41,
        alignItems: "center",
        justifyContent: "center",
    },

    playButtonPreview: {
        width: 68,
        height: 68,
        borderRadius: 34,
    },

    playIconOffset: {
        marginLeft: 4,
    },

    seekButton: {
        width: 58,
        height: 58,
        borderRadius: 29,
        alignItems: "center",
        justifyContent: "center",
    },

    seekButtonPreview: {
        width: 52,
        height: 52,
        borderRadius: 26,
    },

    videoProgressPill: {
        position: "absolute",
        left: 24,
        right: 24,
        bottom: 16,
        zIndex: 8,
        minHeight: 38,
        borderRadius: 19,
        paddingHorizontal: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },

    videoProgressText: {
        fontSize: 12,
        fontWeight: "700",
    },

    progressTrack: {
        flex: 1,
        height: 4,
        borderRadius: 2,
        overflow: "hidden",
    },

    progressFill: {
        height: "100%",
        borderRadius: 2,
    },

    confirmBottomArea: {
        paddingHorizontal: 14,
        paddingTop: 12,
        borderTopWidth: 1,
        gap: 12,
    },

    captionInputRow: {
        minHeight: 54,
        borderRadius: 27,
        borderWidth: 1,
        paddingHorizontal: 16,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },

    captionInput: {
        flex: 1,
        minWidth: 0,
        fontSize: 16,
        fontWeight: "600",
        paddingVertical: Platform.OS === "ios" ? 12 : 8,
    },

    sendRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },

    recipientPill: {
        minHeight: 42,
        borderRadius: 15,
        paddingHorizontal: 18,
        alignItems: "center",
        justifyContent: "center",
    },

    recipientText: {
        fontSize: 15,
        fontWeight: "800",
    },

    sendCircle: {
        width: 54,
        height: 54,
        borderRadius: 27,
        alignItems: "center",
        justifyContent: "center",
        paddingLeft: 3,
    },
});

import {
    getRowDirectionStyle,
    getTextDirectionStyle,
    getWritingDirectionStyle,
} from "@/src/styles/globalStyles";
import { useAppTheme } from "@/src/theme/ThemeProvider";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import * as IntentLauncher from "expo-intent-launcher";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
import {
    AudioModule,
    RecordingPresets,
    setAudioModeAsync,
    useAudioPlayer,
    useAudioPlayerStatus,
    useAudioRecorder,
    useAudioRecorderState,
} from "expo-audio";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    Alert,
    Image,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

import { appImages } from "@/src/constants/images";

const chatSampleImage = appImages.homeShipSea;

const INITIAL_MESSAGES = [
    {
        id: "1",
        side: "me",
        type: "text",
        text: "Hello Ahmed, I need a quote for shipping a 20ft container from Shanghai, China to Dubai, UAE.",
        time: "10:02 AM",
    },
    {
        id: "2",
        side: "employee",
        type: "text",
        text: "Hello! Thank you for reaching out. I'd be happy to assist you with that.",
        time: "10:03 AM",
    },
    {
        id: "3",
        side: "employee",
        type: "image",
        image: chatSampleImage,
        caption: "Container vessel example",
        time: "10:03 AM",
    },
    {
        id: "4",
        side: "employee",
        type: "text",
        text: "Could you please share the type of cargo, weight, and if it's FCL or LCL?",
        time: "10:03 AM",
    },
    {
        id: "5",
        side: "me",
        type: "image",
        image: chatSampleImage,
        caption: "This is the shipment reference photo.",
        time: "10:04 AM",
    },
    {
        id: "6",
        side: "me",
        type: "text",
        text: "It's FCL, general cargo. Approx. 12 CBM and 8,000 kg.",
        time: "10:04 AM",
    },
    {
        id: "7",
        side: "employee",
        type: "text",
        text: "Thanks! Here's a quick estimate for your shipment from Shanghai to Dubai.",
        time: "10:05 AM",
    },
    {
        id: "8",
        side: "employee",
        type: "quote",
        time: "10:05 AM",
    },
    {
        id: "9",
        side: "employee",
        type: "text",
        text: "Let me know if you need any changes or additional services.",
        time: "10:06 AM",
    },
    {
        id: "10",
        side: "me",
        type: "text",
        text: "Looks good 👍 Please proceed. Also share the booking process.",
        time: "10:07 AM",
    },
];

const formatFileSize = (bytes) => {
    if (!bytes && bytes !== 0) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatAudioDuration = (milliseconds = 0) => {
    const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

const getFileIconName = (mimeType = "", fileName = "") => {
    const lowerName = fileName.toLowerCase();
    const lowerType = mimeType.toLowerCase();

    if (lowerType.includes("pdf") || lowerName.endsWith(".pdf")) {
        return "file-pdf-box";
    }

    if (
        lowerType.includes("word") ||
        lowerName.endsWith(".doc") ||
        lowerName.endsWith(".docx")
    ) {
        return "file-word-box";
    }

    if (
        lowerType.includes("excel") ||
        lowerType.includes("spreadsheet") ||
        lowerName.endsWith(".xls") ||
        lowerName.endsWith(".xlsx") ||
        lowerName.endsWith(".csv")
    ) {
        return "file-excel-box";
    }

    if (
        lowerType.includes("image") ||
        lowerName.endsWith(".png") ||
        lowerName.endsWith(".jpg") ||
        lowerName.endsWith(".jpeg") ||
        lowerName.endsWith(".webp")
    ) {
        return "file-image";
    }

    if (
        lowerType.includes("video") ||
        lowerName.endsWith(".mp4") ||
        lowerName.endsWith(".mov")
    ) {
        return "file-video";
    }

    if (
        lowerType.includes("zip") ||
        lowerName.endsWith(".zip") ||
        lowerName.endsWith(".rar")
    ) {
        return "folder-zip";
    }

    return "file-document";
};



const getFileExtension = (fileName = "", mimeType = "") => {
    const cleanName = String(fileName || "").split("?")[0];
    const dotIndex = cleanName.lastIndexOf(".");

    if (dotIndex !== -1 && dotIndex < cleanName.length - 1) {
        return cleanName.slice(dotIndex + 1).toLowerCase();
    }

    const cleanMimeType = String(mimeType || "").toLowerCase();

    if (cleanMimeType.includes("pdf")) return "pdf";
    if (cleanMimeType.includes("png")) return "png";
    if (cleanMimeType.includes("jpeg") || cleanMimeType.includes("jpg")) return "jpg";
    if (cleanMimeType.includes("webp")) return "webp";
    if (cleanMimeType.includes("gif")) return "gif";

    return "";
};

const isPdfDocument = (documentItem) => {
    const extension = getFileExtension(documentItem?.fileName, documentItem?.mimeType);
    const mimeType = String(documentItem?.mimeType || "").toLowerCase();

    return extension === "pdf" || mimeType.includes("pdf");
};

const isImageDocument = (documentItem) => {
    const extension = getFileExtension(documentItem?.fileName, documentItem?.mimeType);
    const mimeType = String(documentItem?.mimeType || "").toLowerCase();

    return (
        mimeType.includes("image") ||
        ["jpg", "jpeg", "png", "webp", "gif"].includes(extension)
    );
};

const sanitizeFileName = (fileName = "attached-file") => {
    const safeName = String(fileName || "attached-file")
        .replace(/[^\w.\-() ]+/g, "_")
        .replace(/\s+/g, "_");

    return safeName || `attached-file-${Date.now()}`;
};

const ensureLocalDocumentUri = async (documentItem) => {
    if (!documentItem?.uri) return null;

    const safeName = sanitizeFileName(documentItem.fileName || `attached-file-${Date.now()}`);
    const targetUri = `${FileSystem.cacheDirectory}${safeName}`;

    if (documentItem.uri === targetUri) {
        return targetUri;
    }

    try {
        const targetInfo = await FileSystem.getInfoAsync(targetUri);

        if (!targetInfo.exists) {
            await FileSystem.copyAsync({
                from: documentItem.uri,
                to: targetUri,
            });
        }

        return targetUri;
    } catch (error) {
        console.log("Prepare document file error:", error);
        return documentItem.uri;
    }
};

export default function IndividualChatScreen({ navigation, route }) {
    const { t, i18n } = useTranslation();
    const insets = useSafeAreaInsets();
    const { width, height } = useWindowDimensions();
    const messagesScrollRef = useRef(null);
    const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
    const recorderState = useAudioRecorderState(audioRecorder, 250);
    const isRecordingRef = useRef(false);
    const isCancellingRecordingRef = useRef(false);

    const {
        colors: appColors,
        isDark,
        setThemeMode,
        changeTheme,
        toggleTheme,
    } = useAppTheme();

    const employee = route?.params?.employee;
    const employeeName = employee?.name || "Ahmed Hassan";
    const employeeDepartment = employee?.department || null;

    const employeeInitials = employeeName
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();

    const [menuVisible, setMenuVisible] = useState(false);
    const [attachMenuVisible, setAttachMenuVisible] = useState(false);
    const [messageText, setMessageText] = useState("");
    const [messages, setMessages] = useState(INITIAL_MESSAGES);
    const [isBlocked, setIsBlocked] = useState(false);
    const [keyboardHeight, setKeyboardHeight] = useState(0);
    const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
    const [previewImage, setPreviewImage] = useState(null);
    const [previewDocument, setPreviewDocument] = useState(null);
    const [selectedImageToSend, setSelectedImageToSend] = useState(null);

    const tr = (key, fallback) =>
        t(`individualChat.${key}`, {
            defaultValue: fallback || key,
        });

    const language = i18n.language?.startsWith("ar") ? "ar" : "en";
    const isArabic = language === "ar";
    const hasMessage = messageText.trim().length > 0;
    const isRecordingVoice = !!recorderState?.isRecording;
    const recordingDurationText = formatAudioDuration(recorderState?.durationMillis || 0);

    const isCompactScreen = width < 390;
    const isVeryCompactScreen = width < 350;
    const isShortScreen = height < 720;

    const imageMessageWidth = Math.min(width * 0.68, 285);
    const imageMessageHeight = Math.min(height * 0.28, 250);

    const colors = useMemo(() => {
        const headerSurface = isDark
            ? appColors.background
            : appColors.cardStrong;

        return {
            ...appColors,

            screen: appColors.background,

            statusHeader: headerSurface,
            header: headerSurface,
            transparentHeader: headerSurface,

            text: appColors.textPrimary,
            muted: appColors.textMuted,
            input: appColors.inputBackground,

            myBubble: appColors.blueSoft,
            employeeBubble: appColors.card,

            modalCard: appColors.cardStrong,
            modalOverlay: appColors.overlay,
            modalStatusBar: headerSurface,
            previewBackground: isDark ? appColors.background : "#000000",
        };
    }, [appColors, isDark]);

    const scrollToBottom = (animated = true) => {
        requestAnimationFrame(() => {
            messagesScrollRef.current?.scrollToEnd({ animated });
        });
    };

    useEffect(() => {
        setTimeout(() => {
            scrollToBottom(false);
        }, 120);
    }, []);

    useEffect(() => {
        setTimeout(() => {
            scrollToBottom(true);
        }, 100);
    }, [messages.length]);

    useEffect(() => {
        const showEvent =
            Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
        const hideEvent =
            Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

        const keyboardShowListener = Keyboard.addListener(showEvent, (event) => {
            const nextKeyboardHeight = event?.endCoordinates?.height || 0;

            setIsKeyboardVisible(true);
            setKeyboardHeight(nextKeyboardHeight);

            setTimeout(() => {
                scrollToBottom(true);
            }, Platform.OS === "ios" ? 160 : 280);
        });

        const keyboardHideListener = Keyboard.addListener(hideEvent, () => {
            setIsKeyboardVisible(false);
            setKeyboardHeight(0);

            setTimeout(() => {
                scrollToBottom(true);
            }, 80);
        });

        return () => {
            keyboardShowListener.remove();
            keyboardHideListener.remove();
        };
    }, []);

    const handleChangeLanguage = (value) => {
        i18n.changeLanguage(value);
    };

    const handleChangeTheme = (value) => {
        if (typeof setThemeMode === "function") {
            setThemeMode(value);
            return;
        }

        if (typeof changeTheme === "function") {
            changeTheme(value);
            return;
        }

        if (typeof toggleTheme === "function") {
            const nextShouldBeDark = value === "dark";

            if (nextShouldBeDark !== isDark) {
                toggleTheme();
            }
        }
    };

    const addMessages = (nextMessages) => {
        setMessages((prev) => [...prev, ...nextMessages]);

        setTimeout(() => {
            scrollToBottom(true);
        }, 120);
    };

    const handleSend = () => {
        const cleanText = messageText.trim();
        if (!cleanText) return;

        const newMessage = {
            id: Date.now().toString(),
            side: "me",
            type: "text",
            text: cleanText,
            time: tr("now", "Now"),
        };

        setMessages((prev) => [...prev, newMessage]);
        setMessageText("");

        setTimeout(() => {
            scrollToBottom(true);
        }, 100);
    };

    const startVoiceRecording = async () => {
        try {
            Keyboard.dismiss();

            const permissionResult =
                await AudioModule.requestRecordingPermissionsAsync();

            if (!permissionResult.granted) {
                Alert.alert(
                    tr("permissionNeeded", "Permission needed"),
                    tr(
                        "microphonePermissionMessage",
                        "Please allow microphone access to record voice messages."
                    )
                );
                return;
            }

            await setAudioModeAsync({
                allowsRecording: true,
                playsInSilentMode: true,
            });

            await audioRecorder.prepareToRecordAsync();
            audioRecorder.record();
            isRecordingRef.current = true;
        } catch (error) {
            console.log("Voice recording start error:", error);

            Alert.alert(
                tr("errorTitle", "Something went wrong"),
                tr("voiceRecordStartError", "Could not start recording. Please try again.")
            );
        }
    };

    const stopVoiceRecording = async () => {
        try {
            const durationMillis = recorderState?.durationMillis || 0;

            await audioRecorder.stop();
            isRecordingRef.current = false;

            const voiceUri = audioRecorder.uri || recorderState?.url;

            await setAudioModeAsync({
                allowsRecording: false,
                playsInSilentMode: true,
            });

            if (!voiceUri) {
                Alert.alert(
                    tr("errorTitle", "Something went wrong"),
                    tr("voiceRecordUriError", "The voice message was not saved correctly.")
                );
                return;
            }

            const newAudioMessage = {
                id: `${Date.now()}-audio`,
                side: "me",
                type: "audio",
                uri: voiceUri,
                durationMillis,
                time: tr("now", "Now"),
            };

            addMessages([newAudioMessage]);
        } catch (error) {
            isRecordingRef.current = false;
            console.log("Voice recording stop error:", error);

            Alert.alert(
                tr("errorTitle", "Something went wrong"),
                tr("voiceRecordStopError", "Could not send the voice message. Please try again.")
            );
        }
    };

    const cancelVoiceRecordingIfActive = async () => {
        const isActuallyRecording = isRecordingRef.current || !!recorderState?.isRecording;

        if (!isActuallyRecording || isCancellingRecordingRef.current) {
            return;
        }

        isCancellingRecordingRef.current = true;

        try {
            await audioRecorder.stop();
        } catch (error) {
            console.log("Voice recording cancel error:", error);
        } finally {
            isRecordingRef.current = false;
            isCancellingRecordingRef.current = false;

            try {
                await setAudioModeAsync({
                    allowsRecording: false,
                    playsInSilentMode: true,
                });
            } catch (audioModeError) {
                console.log("Audio mode reset error:", audioModeError);
            }
        }
    };

    const handleMicPress = async () => {
        if (isRecordingVoice) {
            await stopVoiceRecording();
            return;
        }

        await startVoiceRecording();
    };

    const openAttachMenu = async () => {
        Keyboard.dismiss();
        await cancelVoiceRecordingIfActive();

        setTimeout(() => {
            setAttachMenuVisible(true);
        }, Platform.OS === "android" ? 90 : 40);
    };

    const openChatMenu = () => {
        Keyboard.dismiss();

        setTimeout(() => {
            setMenuVisible(true);
        }, Platform.OS === "android" ? 90 : 40);
    };

    const pickImagesFromLibrary = async () => {
        try {
            await cancelVoiceRecordingIfActive();
            console.log("Opening image library...");

            const permissionResult =
                await ImagePicker.requestMediaLibraryPermissionsAsync();

            console.log("Photo permission:", permissionResult);

            if (!permissionResult.granted) {
                Alert.alert(
                    tr("permissionNeeded", "Permission needed"),
                    tr(
                        "photosPermissionMessage",
                        "Please allow access to your photos to attach images."
                    )
                );
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ["images"],
                quality: 0.85,
            });

            console.log("Gallery picker result:", result);

            if (result.canceled || !result.assets?.length) {
                return;
            }

            const asset = result.assets[0];

            const nextImageMessage = {
                id: `${Date.now()}-image`,
                side: "me",
                type: "image",
                image: { uri: asset.uri },
                uri: asset.uri,
                fileName: asset.fileName || `image-${Date.now()}.jpg`,
                mimeType: asset.mimeType || "image/jpeg",
                width: asset.width,
                height: asset.height,
                caption: asset.fileName || tr("selectedImage", "Selected image"),
                time: tr("now", "Now"),
            };

            setSelectedImageToSend(nextImageMessage);
        } catch (error) {
            console.log("Image picker error:", error);

            Alert.alert(
                tr("errorTitle", "Something went wrong"),
                tr("imagePickerError", "Could not select the image. Please try again.")
            );
        }
    };

    const takePhotoWithCamera = async () => {
        try {
            await cancelVoiceRecordingIfActive();

            const permissionResult =
                await ImagePicker.requestCameraPermissionsAsync();

            if (!permissionResult.granted) {
                Alert.alert(
                    tr("permissionNeeded", "Permission needed"),
                    tr(
                        "cameraPermissionMessage",
                        "Please allow camera access to take a photo."
                    )
                );
                return;
            }

            const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ["images"],
                quality: 0.85,
            });

            if (result.canceled || !result.assets?.length) {
                return;
            }

            const asset = result.assets[0];

            const nextImageMessage = {
                id: `${Date.now()}-camera`,
                side: "me",
                type: "image",
                image: { uri: asset.uri },
                uri: asset.uri,
                fileName: asset.fileName || `camera-photo-${Date.now()}.jpg`,
                mimeType: asset.mimeType || "image/jpeg",
                width: asset.width,
                height: asset.height,
                caption: tr("cameraPhoto", "Camera photo"),
                time: tr("now", "Now"),
            };

            setSelectedImageToSend(nextImageMessage);
        } catch (error) {
            console.log("Camera picker error:", error);

            Alert.alert(
                tr("errorTitle", "Something went wrong"),
                tr("cameraPickerError", "Could not take a photo. Please try again.")
            );
        }
    };
    const pickDocumentsFromDevice = async () => {
        try {
            await cancelVoiceRecordingIfActive();
            console.log("Opening document picker...");

            const result = await DocumentPicker.getDocumentAsync({
                type: "*/*",
                copyToCacheDirectory: true,
            });

            console.log("Document picker result:", result);

            if (result.canceled || !result.assets?.length) {
                return;
            }

            const asset = result.assets[0];

            const newDocumentMessage = {
                id: `${Date.now()}-document`,
                side: "me",
                type: "document",
                uri: asset.uri,
                fileName: asset.name || `file-${Date.now()}`,
                mimeType: asset.mimeType || "application/octet-stream",
                size: asset.size,
                time: tr("now", "Now"),
            };

            addMessages([newDocumentMessage]);
        } catch (error) {
            console.log("Document picker error:", error);

            Alert.alert(
                tr("errorTitle", "Something went wrong"),
                tr("documentPickerError", "Could not select the file. Please try again.")
            );
        }
    };

    const handleAttachmentPress = async (type) => {
        setAttachMenuVisible(false);

        if (type === "camera") {
            await takePhotoWithCamera();
            return;
        }

        if (type === "photos") {
            await pickImagesFromLibrary();
            return;
        }

        if (type === "document") {
            await pickDocumentsFromDevice();
        }
    };


    const handleConfirmSendImage = () => {
        if (!selectedImageToSend) return;

        addMessages([
            {
                ...selectedImageToSend,
                id: selectedImageToSend.id || `${Date.now()}-image`,
                time: tr("now", "Now"),
            },
        ]);
        setSelectedImageToSend(null);
    };

    const handleCancelSelectedImage = () => {
        setSelectedImageToSend(null);
    };

    const getImageUriForSaving = (imageItem) => {
        if (!imageItem) return null;
        if (imageItem.uri) return imageItem.uri;
        if (imageItem.image?.uri) return imageItem.image.uri;
        return null;
    };

    const handleSaveImageToDevice = async (imageItem) => {
        try {
            const imageUri = getImageUriForSaving(imageItem);

            if (!imageUri) {
                Alert.alert(
                    tr("saveUnavailableTitle", "Save unavailable"),
                    tr("saveUnavailableMessage", "This image cannot be saved from the local demo sample.")
                );
                return;
            }

            const permissionResult = await MediaLibrary.requestPermissionsAsync();

            if (!permissionResult.granted) {
                Alert.alert(
                    tr("permissionNeeded", "Permission needed"),
                    tr("mediaLibraryPermissionMessage", "Please allow access to save images to your device.")
                );
                return;
            }

            await MediaLibrary.saveToLibraryAsync(imageUri);

            Alert.alert(
                tr("saved", "Saved"),
                tr("imageSavedMessage", "Image saved to your device.")
            );
        } catch (error) {
            console.log("Save image error:", error);

            Alert.alert(
                tr("errorTitle", "Something went wrong"),
                tr("saveImageError", "Could not save the image. Please try again.")
            );
        }
    };

    const handleOpenDocument = async (documentItem) => {
        try {
            if (!documentItem?.uri) return;

            const isPdf = isPdfDocument(documentItem);
            const mimeType = isPdf
                ? "application/pdf"
                : documentItem.mimeType || "application/octet-stream";
            const localUri = await ensureLocalDocumentUri(documentItem);

            if (!localUri) return;

            const canShare = await Sharing.isAvailableAsync();

            // Most stable cross-platform behavior for local PDFs:
            // iPhone: opens the iOS sheet so the user can choose Files, Google Drive, Books, Adobe, etc.
            // Android: opens the app chooser/share sheet where Google Drive/PDF readers can appear.
            if (canShare) {
                await Sharing.shareAsync(localUri, {
                    mimeType,
                    UTI: isPdf ? "com.adobe.pdf" : undefined,
                    dialogTitle: isPdf
                        ? tr("openPdfWithApp", "Open PDF with Google Drive or another app")
                        : documentItem.fileName || tr("openFile", "Open file"),
                });
                return;
            }

            // Android fallback only, in case Sharing is not available.
            if (Platform.OS === "android") {
                const androidUri = localUri.startsWith("content://")
                    ? localUri
                    : await FileSystem.getContentUriAsync(localUri);

                await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
                    data: androidUri,
                    type: mimeType,
                    flags: 1,
                });

                return;
            }

            Alert.alert(
                tr("openUnavailableTitle", "Open unavailable"),
                tr("openUnavailableMessage", "No app is available to open this file on this device.")
            );
        } catch (error) {
            console.log("Open document error:", error);

            try {
                const isPdf = isPdfDocument(documentItem);
                const localUri = await ensureLocalDocumentUri(documentItem);
                const canShare = await Sharing.isAvailableAsync();

                if (canShare && localUri) {
                    await Sharing.shareAsync(localUri, {
                        mimeType: isPdf
                            ? "application/pdf"
                            : documentItem?.mimeType || "application/octet-stream",
                        UTI: isPdf ? "com.adobe.pdf" : undefined,
                        dialogTitle: isPdf
                            ? tr("openPdfWithApp", "Open PDF with Google Drive or another app")
                            : documentItem?.fileName || tr("openFile", "Open file"),
                    });
                    return;
                }
            } catch (fallbackError) {
                console.log("Open document fallback error:", fallbackError);
            }

            Alert.alert(
                tr("errorTitle", "Something went wrong"),
                tr("openDocumentError", "Could not open the file. Please try again.")
            );
        }
    };

    const handleSaveDocumentToDevice = async (documentItem) => {
        try {
            if (!documentItem?.uri) return;

            const localUri = await ensureLocalDocumentUri(documentItem);
            const canShare = await Sharing.isAvailableAsync();

            if (!canShare || !localUri) {
                Alert.alert(
                    tr("saveUnavailableTitle", "Save unavailable"),
                    tr("saveDocumentUnavailableMessage", "Saving this file is not available on this device.")
                );
                return;
            }

            await Sharing.shareAsync(localUri, {
                mimeType: documentItem.mimeType || "application/octet-stream",
                UTI: isPdfDocument(documentItem) ? "com.adobe.pdf" : undefined,
                dialogTitle: documentItem.fileName || tr("saveFile", "Save file"),
            });
        } catch (error) {
            console.log("Save document error:", error);

            Alert.alert(
                tr("errorTitle", "Something went wrong"),
                tr("saveDocumentError", "Could not save the file. Please try again.")
            );
        }
    };

    const handleToggleBlockContact = () => {
        setMenuVisible(false);

        if (isBlocked) {
            Alert.alert(
                tr("confirmUnblockTitle", "Unblock contact?"),
                tr(
                    "confirmUnblockMessage",
                    "You will be able to receive messages from this contact again."
                ),
                [
                    { text: tr("cancel", "Cancel"), style: "cancel" },
                    {
                        text: tr("unblock", "Unblock Contact"),
                        onPress: () => setIsBlocked(false),
                    },
                ]
            );

            return;
        }

        Alert.alert(
            tr("confirmBlockTitle", "Block contact?"),
            tr("confirmBlockMessage", "You will no longer receive messages from this contact."),
            [
                { text: tr("cancel", "Cancel"), style: "cancel" },
                {
                    text: tr("block", "Block Contact"),
                    style: "destructive",
                    onPress: () => setIsBlocked(true),
                },
            ]
        );
    };

    const handleDeleteConversation = () => {
        setMenuVisible(false);

        Alert.alert(
            tr("confirmDeleteTitle", "Delete conversation?"),
            tr("confirmDeleteMessage", "This will remove the conversation from this device."),
            [
                { text: tr("cancel", "Cancel"), style: "cancel" },
                {
                    text: tr("deleteChat", "Delete Conversation"),
                    style: "destructive",
                    onPress: () => setMessages([]),
                },
            ]
        );
    };

    const androidKeyboardSpace =
        Platform.OS === "android" && isKeyboardVisible
            ? Math.max(keyboardHeight - insets.bottom, 0)
            : 0;

    return (
        <SafeAreaView
            edges={["top"]}
            style={[styles.safeArea, { backgroundColor: colors.statusHeader }]}
        >
            <StatusBar
                style={isDark ? "light" : "dark"}
                translucent={false}
                backgroundColor={colors.statusHeader}
            />

            <KeyboardAvoidingView
                style={[styles.flex, { backgroundColor: colors.screen }]}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                keyboardVerticalOffset={0}
            >
                <View style={[styles.container, { backgroundColor: colors.screen }]}>
                    <View
                        style={[
                            styles.header,
                            isCompactScreen && styles.headerCompact,
                            isShortScreen && styles.headerShort,
                            {
                                backgroundColor: colors.header,
                                borderBottomColor: colors.border,
                            },
                        ]}
                    >
                        <TouchableOpacity
                            style={styles.iconButton}
                            activeOpacity={0.8}
                            onPress={() => navigation.goBack()}
                        >
                            <Ionicons name="arrow-back" size={24} color={colors.text} />
                        </TouchableOpacity>

                        <View style={styles.avatarWrapper}>
                            <View
                                style={[
                                    styles.avatar,
                                    isCompactScreen && styles.avatarCompact,
                                    {
                                        backgroundColor: colors.avatarBackground,
                                        borderColor: colors.avatarBorder,
                                    },
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.avatarText,
                                        isCompactScreen && styles.avatarTextCompact,
                                        { color: colors.text },
                                    ]}
                                >
                                    {employeeInitials}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.headerInfo}>
                            <Text
                                style={[
                                    styles.employeeName,
                                    isCompactScreen && styles.employeeNameCompact,
                                    isVeryCompactScreen && styles.employeeNameVeryCompact,
                                    { color: colors.text },
                                ]}
                                numberOfLines={1}
                                ellipsizeMode="tail"
                            >
                                {employeeName}
                            </Text>

                            <Text
                                style={[
                                    styles.department,
                                    isCompactScreen && styles.departmentCompact,
                                    isVeryCompactScreen && styles.departmentVeryCompact,
                                    { color: colors.blue },
                                ]}
                                numberOfLines={1}
                                ellipsizeMode="tail"
                            >
                                {employeeDepartment || tr("department", "Sales Department")}
                            </Text>

                            <View style={styles.statusRow}>
                                <View
                                    style={[
                                        styles.onlineDot,
                                        { backgroundColor: colors.primary },
                                    ]}
                                />

                                <Text
                                    style={[
                                        styles.onlineText,
                                        isVeryCompactScreen && styles.onlineTextVeryCompact,
                                        { color: colors.primary },
                                    ]}
                                    numberOfLines={1}
                                >
                                    {isBlocked
                                        ? tr("blocked", "Blocked")
                                        : tr("online", "Online")}
                                </Text>
                            </View>
                        </View>

                        <TouchableOpacity
                            style={[
                                styles.callButton,
                                isCompactScreen && styles.callButtonCompact,
                                isVeryCompactScreen && styles.callButtonVeryCompact,
                                { borderColor: colors.border },
                            ]}
                            activeOpacity={0.8}
                        >
                            <Ionicons
                                name="call-outline"
                                size={isVeryCompactScreen ? 19 : isCompactScreen ? 21 : 23}
                                color={colors.text}
                            />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.callButton,
                                isCompactScreen && styles.callButtonCompact,
                                isVeryCompactScreen && styles.callButtonVeryCompact,
                                { borderColor: colors.border },
                            ]}
                            activeOpacity={0.8}
                            onPress={openChatMenu}
                        >
                            <Ionicons
                                name="ellipsis-vertical"
                                size={isVeryCompactScreen ? 19 : isCompactScreen ? 20 : 22}
                                color={colors.text}
                            />
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        ref={messagesScrollRef}
                        style={styles.messagesList}
                        contentContainerStyle={[
                            styles.messagesContent,
                            isCompactScreen && styles.messagesContentCompact,
                            isShortScreen && styles.messagesContentShort,
                            {
                                paddingBottom:
                                    Platform.OS === "android" && isKeyboardVisible ? 18 : 14,
                            },
                        ]}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
                        onContentSizeChange={() => scrollToBottom(false)}
                    >
                        {messages.map((item) => {
                            if (item.type === "quote") {
                                return (
                                    <QuoteCard
                                        key={item.id}
                                        colors={colors}
                                        tr={tr}
                                        time={item.time}
                                        isArabic={isArabic}
                                        isCompactScreen={isCompactScreen}
                                    />
                                );
                            }

                            if (item.type === "image") {
                                return (
                                    <ImageMessage
                                        key={item.id}
                                        item={item}
                                        colors={colors}
                                        isCompactScreen={isCompactScreen}
                                        imageWidth={imageMessageWidth}
                                        imageHeight={imageMessageHeight}
                                        onOpen={() => setPreviewImage(item)}
                                    />
                                );
                            }

                            if (item.type === "document") {
                                return (
                                    <DocumentMessage
                                        key={item.id}
                                        item={item}
                                        colors={colors}
                                        isCompactScreen={isCompactScreen}
                                        tr={tr}
                                        onOpen={() => setPreviewDocument(item)}
                                    />
                                );
                            }

                            if (item.type === "audio") {
                                return (
                                    <AudioMessage
                                        key={item.id}
                                        item={item}
                                        colors={colors}
                                        isCompactScreen={isCompactScreen}
                                        tr={tr}
                                    />
                                );
                            }

                            const isMine = item.side === "me";

                            return (
                                <View
                                    key={item.id}
                                    style={[
                                        styles.messageRow,
                                        isMine
                                            ? styles.myMessageRow
                                            : styles.employeeMessageRow,
                                    ]}
                                >
                                    <View
                                        style={[
                                            styles.bubble,
                                            isCompactScreen && styles.bubbleCompact,
                                            {
                                                backgroundColor: isMine
                                                    ? colors.myBubble
                                                    : colors.employeeBubble,
                                                borderColor: colors.border,
                                            },
                                        ]}
                                    >
                                        <Text
                                            style={[
                                                styles.messageText,
                                                isCompactScreen && styles.messageTextCompact,
                                                { color: colors.text },
                                            ]}
                                        >
                                            {item.text}
                                        </Text>

                                        <View style={styles.messageMetaRow}>
                                            <Text
                                                style={[
                                                    styles.timeText,
                                                    { color: colors.muted },
                                                ]}
                                            >
                                                {item.time}
                                            </Text>

                                            {isMine && (
                                                <Ionicons
                                                    name="checkmark-done"
                                                    size={15}
                                                    color={colors.blue}
                                                />
                                            )}
                                        </View>
                                    </View>
                                </View>
                            );
                        })}
                    </ScrollView>

                    <View
                        style={[
                            styles.composerWrapper,
                            isCompactScreen && styles.composerWrapperCompact,
                            {
                                borderTopColor: colors.border,
                                backgroundColor: colors.navScrolled,
                                paddingBottom:
                                    Platform.OS === "ios" ? Math.max(insets.bottom, 8) : 8,
                                marginBottom: androidKeyboardSpace,
                            },
                        ]}
                    >
                        <TouchableOpacity
                            style={styles.attachButton}
                            activeOpacity={0.8}
                            onPress={openAttachMenu}
                        >
                            <Ionicons name="attach" size={27} color={colors.text} />
                        </TouchableOpacity>

                        <View
                            style={[
                                styles.inputWrapper,
                                isCompactScreen && styles.inputWrapperCompact,
                                {
                                    backgroundColor: colors.input,
                                    borderColor: colors.inputBorder,
                                },
                            ]}
                        >
                            {isRecordingVoice ? (
                                <View style={styles.recordingInputContent}>
                                    <View style={styles.recordingDot} />
                                    <Text
                                        style={[
                                            styles.recordingInputText,
                                            { color: colors.text },
                                        ]}
                                        numberOfLines={1}
                                    >
                                        {tr("recording", "Recording")} {recordingDurationText}
                                    </Text>
                                </View>
                            ) : (
                                <TextInput
                                    value={messageText}
                                    onChangeText={setMessageText}
                                    onFocus={() => {
                                        setTimeout(() => {
                                            scrollToBottom(true);
                                        }, 220);
                                    }}
                                    placeholder={tr("inputPlaceholder", "Type a message...")}
                                    placeholderTextColor={colors.muted}
                                    style={[
                                        styles.input,
                                        isCompactScreen && styles.inputCompact,
                                        { color: colors.text },
                                        getWritingDirectionStyle(isArabic),
                                    ]}
                                    multiline
                                    scrollEnabled
                                    textAlign={isArabic ? "right" : "left"}
                                />
                            )}

                            {!isRecordingVoice && (
                                <TouchableOpacity
                                    activeOpacity={0.8}
                                    onPress={takePhotoWithCamera}
                                >
                                    <Ionicons
                                        name="camera-outline"
                                        size={25}
                                        color={colors.text}
                                    />
                                </TouchableOpacity>
                            )}
                        </View>

                        <TouchableOpacity
                            style={[
                                styles.actionButton,
                                isCompactScreen && styles.actionButtonCompact,
                                {
                                    backgroundColor: isRecordingVoice
                                        ? colors.danger
                                        : hasMessage
                                            ? colors.blue
                                            : colors.primary,
                                },
                            ]}
                            activeOpacity={0.85}
                            onPress={hasMessage && !isRecordingVoice ? handleSend : handleMicPress}
                            accessibilityLabel={
                                isRecordingVoice
                                    ? tr("stopRecording", "Stop recording")
                                    : hasMessage
                                        ? tr("send", "Send")
                                        : tr("recordVoiceMessage", "Record voice message")
                            }
                        >
                            <Ionicons
                                name={isRecordingVoice ? "stop" : hasMessage ? "send" : "mic"}
                                size={isCompactScreen ? 20 : 22}
                                color="#FFFFFF"
                            />
                        </TouchableOpacity>
                    </View>
                </View>

                <AttachmentOptionsModal
                    visible={attachMenuVisible}
                    onClose={() => setAttachMenuVisible(false)}
                    onSelect={handleAttachmentPress}
                    colors={colors}
                    tr={tr}
                    isArabic={isArabic}
                    isCompactScreen={isCompactScreen}
                />

                <ChatOptionsModal
                    visible={menuVisible}
                    onClose={() => setMenuVisible(false)}
                    colors={colors}
                    tr={tr}
                    language={language}
                    isDark={isDark}
                    isBlocked={isBlocked}
                    onChangeLanguage={handleChangeLanguage}
                    onChangeTheme={handleChangeTheme}
                    onToggleBlock={handleToggleBlockContact}
                    onDelete={handleDeleteConversation}
                    isArabic={isArabic}
                />

                <ImagePreviewModal
                    visible={!!previewImage}
                    image={previewImage?.image}
                    caption={previewImage?.caption}
                    time={previewImage?.time}
                    imageItem={previewImage}
                    colors={colors}
                    isDark={isDark}
                    tr={tr}
                    onClose={() => setPreviewImage(null)}
                    onSave={() => handleSaveImageToDevice(previewImage)}
                />

                <ImageConfirmModal
                    visible={!!selectedImageToSend}
                    image={selectedImageToSend?.image}
                    caption={selectedImageToSend?.caption}
                    colors={colors}
                    isDark={isDark}
                    tr={tr}
                    onCancel={handleCancelSelectedImage}
                    onSend={handleConfirmSendImage}
                />

                <DocumentPreviewModal
                    visible={!!previewDocument}
                    documentItem={previewDocument}
                    colors={colors}
                    isDark={isDark}
                    tr={tr}
                    onClose={() => setPreviewDocument(null)}
                    onOpen={() => handleOpenDocument(previewDocument)}
                    onSave={() => handleSaveDocumentToDevice(previewDocument)}
                />
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

function ImageMessage({
    item,
    colors,
    isCompactScreen,
    imageWidth,
    imageHeight,
    onOpen,
}) {
    const isMine = item.side === "me";

    return (
        <View
            style={[
                styles.messageRow,
                isMine ? styles.myMessageRow : styles.employeeMessageRow,
            ]}
        >
            <TouchableOpacity
                activeOpacity={0.9}
                onPress={onOpen}
                style={[
                    styles.imageBubble,
                    isCompactScreen && styles.imageBubbleCompact,
                    {
                        width: imageWidth,
                        backgroundColor: isMine ? colors.myBubble : colors.employeeBubble,
                        borderColor: colors.border,
                    },
                ]}
            >
                <Image
                    source={item.image}
                    style={[
                        styles.chatImage,
                        {
                            width: imageWidth - 10,
                            height: imageHeight,
                        },
                    ]}
                    resizeMode="cover"
                />

                {!!item.caption && (
                    <Text
                        style={[
                            styles.imageCaption,
                            { color: colors.text },
                        ]}
                        numberOfLines={2}
                    >
                        {item.caption}
                    </Text>
                )}

                <View style={styles.imageMetaRow}>
                    <Text style={[styles.timeText, { color: colors.muted }]}>
                        {item.time}
                    </Text>

                    {isMine && (
                        <Ionicons
                            name="checkmark-done"
                            size={15}
                            color={colors.blue}
                        />
                    )}
                </View>
            </TouchableOpacity>
        </View>
    );
}

function DocumentMessage({ item, colors, isCompactScreen, tr, onOpen }) {
    const isMine = item.side === "me";
    const fileIconName = getFileIconName(item.mimeType, item.fileName);
    const fileSizeText = formatFileSize(item.size);

    return (
        <View
            style={[
                styles.messageRow,
                isMine ? styles.myMessageRow : styles.employeeMessageRow,
            ]}
        >
            <TouchableOpacity
                activeOpacity={0.85}
                onPress={onOpen}
                style={[
                    styles.documentBubble,
                    isCompactScreen && styles.documentBubbleCompact,
                    {
                        backgroundColor: isMine ? colors.myBubble : colors.employeeBubble,
                        borderColor: colors.border,
                    },
                ]}
            >
                <View
                    style={[
                        styles.documentIconBox,
                        {
                            backgroundColor: colors.cardSoft,
                            borderColor: colors.border,
                        },
                    ]}
                >
                    <MaterialCommunityIcons
                        name={fileIconName}
                        size={32}
                        color={colors.blue}
                    />
                </View>

                <View style={styles.documentInfo}>
                    <Text
                        style={[styles.documentName, { color: colors.text }]}
                        numberOfLines={2}
                    >
                        {item.fileName || tr("attachedFile", "Attached file")}
                    </Text>

                    <Text
                        style={[styles.documentMeta, { color: colors.muted }]}
                        numberOfLines={1}
                    >
                        {fileSizeText || item.mimeType || tr("file", "File")}
                    </Text>

                    <View style={styles.documentTimeRow}>
                        <Text style={[styles.timeText, { color: colors.muted }]}>
                            {item.time}
                        </Text>

                        {isMine && (
                            <Ionicons
                                name="checkmark-done"
                                size={15}
                                color={colors.blue}
                            />
                        )}
                    </View>
                </View>
            </TouchableOpacity>
        </View>
    );
}

function AudioMessage({ item, colors, isCompactScreen, tr }) {
    const isMine = item.side === "me";
    const player = useAudioPlayer({ uri: item.uri });
    const playerStatus = useAudioPlayerStatus(player);
    const isPlaying = !!playerStatus?.playing;
    const durationText = formatAudioDuration(item.durationMillis || 0);

    const handleTogglePlayback = () => {
        if (isPlaying) {
            player.pause();
            return;
        }

        player.seekTo(0);
        player.play();
    };

    return (
        <View
            style={[
                styles.messageRow,
                isMine ? styles.myMessageRow : styles.employeeMessageRow,
            ]}
        >
            <View
                style={[
                    styles.audioBubble,
                    isCompactScreen && styles.audioBubbleCompact,
                    {
                        backgroundColor: isMine ? colors.myBubble : colors.employeeBubble,
                        borderColor: colors.border,
                    },
                ]}
            >
                <TouchableOpacity
                    style={[
                        styles.audioPlayButton,
                        { backgroundColor: colors.primary },
                    ]}
                    activeOpacity={0.85}
                    onPress={handleTogglePlayback}
                    accessibilityLabel={
                        isPlaying
                            ? tr("pauseVoiceMessage", "Pause voice message")
                            : tr("playVoiceMessage", "Play voice message")
                    }
                >
                    <Ionicons
                        name={isPlaying ? "pause" : "play"}
                        size={18}
                        color="#FFFFFF"
                    />
                </TouchableOpacity>

                <View style={styles.audioContent}>
                    <View style={styles.audioWaveRow}>
                        {Array.from({ length: 18 }).map((_, index) => (
                            <View
                                key={`wave-${item.id}-${index}`}
                                style={[
                                    styles.audioWaveBar,
                                    {
                                        height: 8 + ((index % 5) * 4),
                                        backgroundColor: colors.primary,
                                    },
                                ]}
                            />
                        ))}
                    </View>

                    <View style={styles.audioMetaRow}>
                        <Text style={[styles.audioDuration, { color: colors.muted }]}>
                            {durationText}
                        </Text>

                        <View style={styles.audioTimeWrapper}>
                            <Text style={[styles.timeText, { color: colors.muted }]}>
                                {item.time}
                            </Text>

                            {isMine && (
                                <Ionicons
                                    name="checkmark-done"
                                    size={15}
                                    color={colors.blue}
                                />
                            )}
                        </View>
                    </View>
                </View>
            </View>
        </View>
    );
}

function ImagePreviewModal({
    visible,
    image,
    caption,
    time,
    imageItem,
    colors,
    isDark,
    tr,
    onClose,
    onSave,
}) {
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
            <View
                style={[
                    styles.imagePreviewRoot,
                    { backgroundColor: colors.previewBackground },
                ]}
            >
                <StatusBar
                    style="light"
                    translucent
                    backgroundColor="transparent"
                />

                <TouchableOpacity
                    style={styles.imagePreviewClose}
                    activeOpacity={0.85}
                    onPress={onClose}
                >
                    <Ionicons name="close" size={28} color="#ffffff" />
                </TouchableOpacity>

                {!!imageItem && (
                    <TouchableOpacity
                        style={styles.imagePreviewSave}
                        activeOpacity={0.85}
                        onPress={onSave}
                    >
                        <Ionicons name="download-outline" size={22} color="#ffffff" />
                        <Text style={styles.imagePreviewSaveText}>
                            {tr("save", "Save")}
                        </Text>
                    </TouchableOpacity>
                )}

                <View style={styles.imagePreviewContent}>
                    <Image
                        source={image}
                        style={styles.fullImage}
                        resizeMode="contain"
                    />
                </View>

                {(!!caption || !!time) && (
                    <View
                        style={[
                            styles.imagePreviewFooter,
                            {
                                backgroundColor: isDark
                                    ? "rgba(2, 11, 24, 0.82)"
                                    : "rgba(0, 0, 0, 0.56)",
                            },
                        ]}
                    >
                        {!!caption && (
                            <Text style={styles.imagePreviewCaption}>
                                {caption}
                            </Text>
                        )}

                        {!!time && (
                            <Text style={styles.imagePreviewTime}>
                                {time}
                            </Text>
                        )}
                    </View>
                )}
            </View>
        </Modal>
    );
}


function ImageConfirmModal({
    visible,
    image,
    caption,
    colors,
    isDark,
    tr,
    onCancel,
    onSend,
}) {
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
            <View
                style={[
                    styles.imageConfirmRoot,
                    { backgroundColor: colors.previewBackground },
                ]}
            >
                <StatusBar
                    style="light"
                    translucent
                    backgroundColor="transparent"
                />

                <View style={styles.imageConfirmHeader}>
                    <TouchableOpacity
                        style={styles.imageConfirmClose}
                        activeOpacity={0.85}
                        onPress={onCancel}
                    >
                        <Ionicons name="close" size={27} color="#ffffff" />
                    </TouchableOpacity>

                    <Text style={styles.imageConfirmTitle}>
                        {tr("confirmImageTitle", "Send this image?")}
                    </Text>
                </View>

                <View style={styles.imageConfirmContent}>
                    <Image
                        source={image}
                        style={styles.fullImage}
                        resizeMode="contain"
                    />
                </View>

                <View
                    style={[
                        styles.imageConfirmFooter,
                        {
                            backgroundColor: isDark
                                ? "rgba(2, 11, 24, 0.88)"
                                : "rgba(0, 0, 0, 0.64)",
                        },
                    ]}
                >
                    {!!caption && (
                        <Text style={styles.imageConfirmCaption} numberOfLines={2}>
                            {caption}
                        </Text>
                    )}

                    <View style={styles.confirmActionsRow}>
                        <TouchableOpacity
                            style={styles.confirmCancelButton}
                            activeOpacity={0.85}
                            onPress={onCancel}
                        >
                            <Text style={styles.confirmCancelText}>
                                {tr("cancel", "Cancel")}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.confirmSendButton,
                                { backgroundColor: colors.primary },
                            ]}
                            activeOpacity={0.85}
                            onPress={onSend}
                        >
                            <Ionicons name="send" size={18} color="#ffffff" />
                            <Text style={styles.confirmSendText}>
                                {tr("send", "Send")}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

function DocumentPreviewModal({
    visible,
    documentItem,
    colors,
    isDark,
    tr,
    onClose,
    onOpen,
    onSave,
}) {
    const { width } = useWindowDimensions();
    const shouldStackActions = width < 390;
    const [localPreviewUri, setLocalPreviewUri] = useState(null);
    const [isPreparingPreview, setIsPreparingPreview] = useState(false);
    const [previewFailed, setPreviewFailed] = useState(false);

    const fileIconName = getFileIconName(
        documentItem?.mimeType,
        documentItem?.fileName
    );
    const fileSizeText = formatFileSize(documentItem?.size);
    const canPreviewAsImage = isImageDocument(documentItem);
    const canPreviewAsPdf = isPdfDocument(documentItem);
    const canPreviewInsideApp = canPreviewAsImage || canPreviewAsPdf;

    useEffect(() => {
        let isMounted = true;

        const preparePreview = async () => {
            if (!visible || !documentItem?.uri || !canPreviewInsideApp) {
                setLocalPreviewUri(null);
                setPreviewFailed(false);
                return;
            }

            setIsPreparingPreview(true);
            setPreviewFailed(false);

            try {
                const nextUri = await ensureLocalDocumentUri(documentItem);

                if (isMounted) {
                    setLocalPreviewUri(nextUri);
                }
            } catch (error) {
                console.log("Document preview prepare error:", error);

                if (isMounted) {
                    setPreviewFailed(true);
                    setLocalPreviewUri(null);
                }
            } finally {
                if (isMounted) {
                    setIsPreparingPreview(false);
                }
            }
        };

        preparePreview();

        return () => {
            isMounted = false;
        };
    }, [visible, documentItem?.uri, documentItem?.fileName, documentItem?.mimeType]);

    const renderPreviewContent = () => {
        if (isPreparingPreview) {
            return (
                <View style={styles.documentPreviewLoading}>
                    <MaterialCommunityIcons
                        name={fileIconName}
                        size={58}
                        color={colors.blue}
                    />
                    <Text style={[styles.documentPreviewLoadingText, { color: colors.text }]}>
                        {tr("preparingPreview", "Preparing preview...")}
                    </Text>
                </View>
            );
        }

        if (canPreviewAsImage && localPreviewUri && !previewFailed) {
            return (
                <Image
                    source={{ uri: localPreviewUri }}
                    style={styles.documentInlineImage}
                    resizeMode="contain"
                />
            );
        }

        // Android/iOS WebView is not reliable for local PDF files.
        // Keep real inline preview for image files, and guide PDFs to open in Google Drive/another reader.
        if (canPreviewAsPdf) {
            return (
                <View
                    style={[
                        styles.documentPreviewCard,
                        {
                            backgroundColor: isDark
                                ? "rgba(15, 23, 42, 0.96)"
                                : "rgba(255, 255, 255, 0.96)",
                            borderColor: colors.border,
                        },
                    ]}
                >
                    <View
                        style={[
                            styles.documentPreviewIcon,
                            {
                                backgroundColor: colors.cardSoft,
                                borderColor: colors.border,
                            },
                        ]}
                    >
                        <MaterialCommunityIcons
                            name="file-pdf-box"
                            size={64}
                            color={colors.blue}
                        />
                    </View>

                    <Text
                        style={[styles.documentPreviewName, { color: colors.text }]}
                        numberOfLines={3}
                    >
                        {documentItem?.fileName || tr("attachedFile", "Attached file")}
                    </Text>

                    <Text
                        style={[styles.documentPreviewMeta, { color: colors.muted }]}
                        numberOfLines={3}
                    >
                        {tr(
                            "pdfExternalPreviewMessage",
                            "PDF files open best in Google Drive, Files, Books, Adobe, or another PDF app."
                        )}
                    </Text>
                </View>
            );
        }

        return (
            <View
                style={[
                    styles.documentPreviewCard,
                    {
                        backgroundColor: isDark
                            ? "rgba(15, 23, 42, 0.96)"
                            : "rgba(255, 255, 255, 0.96)",
                        borderColor: colors.border,
                    },
                ]}
            >
                <View
                    style={[
                        styles.documentPreviewIcon,
                        {
                            backgroundColor: colors.cardSoft,
                            borderColor: colors.border,
                        },
                    ]}
                >
                    <MaterialCommunityIcons
                        name={fileIconName}
                        size={58}
                        color={colors.blue}
                    />
                </View>

                <Text
                    style={[styles.documentPreviewName, { color: colors.text }]}
                    numberOfLines={3}
                >
                    {documentItem?.fileName || tr("attachedFile", "Attached file")}
                </Text>

                <Text
                    style={[styles.documentPreviewMeta, { color: colors.muted }]}
                    numberOfLines={2}
                >
                    {previewFailed && canPreviewInsideApp
                        ? tr("previewUnavailable", "Preview is not available for this file. You can still open or save it.")
                        : fileSizeText || documentItem?.mimeType || tr("file", "File")}
                </Text>
            </View>
        );
    };

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
            <View
                style={[
                    styles.documentPreviewRoot,
                    { backgroundColor: colors.previewBackground },
                ]}
            >
                <StatusBar
                    style="light"
                    translucent
                    backgroundColor="transparent"
                />

                <View style={styles.documentPreviewHeader}>
                    <TouchableOpacity
                        style={styles.documentPreviewHeaderButton}
                        activeOpacity={0.85}
                        onPress={onClose}
                    >
                        <Ionicons name="close" size={28} color="#ffffff" />
                    </TouchableOpacity>

                    <View style={styles.documentPreviewHeaderTextWrapper}>
                        <Text style={styles.documentPreviewHeaderTitle} numberOfLines={1}>
                            {documentItem?.fileName || tr("attachedFile", "Attached file")}
                        </Text>
                        <Text style={styles.documentPreviewHeaderMeta} numberOfLines={1}>
                            {fileSizeText || documentItem?.mimeType || tr("file", "File")}
                        </Text>
                    </View>
                </View>

                <View style={styles.documentPreviewBody}>
                    {renderPreviewContent()}
                </View>

                <View
                    style={[
                        styles.documentPreviewBottomBar,
                        shouldStackActions && styles.documentPreviewBottomBarStacked,
                        {
                            backgroundColor: isDark
                                ? "rgba(2, 11, 24, 0.88)"
                                : "rgba(0, 0, 0, 0.62)",
                        },
                    ]}
                >
                    <TouchableOpacity
                        style={[
                            styles.documentPreviewButton,
                            shouldStackActions && styles.documentPreviewButtonStacked,
                            { backgroundColor: colors.primary },
                        ]}
                        activeOpacity={0.85}
                        onPress={onOpen}
                    >
                        <Ionicons name="open-outline" size={19} color="#ffffff" />
                        <Text style={styles.documentPreviewButtonText} numberOfLines={1}>
                            {canPreviewAsPdf
                                ? tr("openWithApp", "Open with app")
                                : tr("openFile", "Open file")}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[
                            styles.documentPreviewButton,
                            styles.documentPreviewSaveButton,
                            shouldStackActions && styles.documentPreviewButtonStacked,
                        ]}
                        activeOpacity={0.85}
                        onPress={onSave}
                    >
                        <Ionicons name="download-outline" size={19} color="#ffffff" />
                        <Text style={styles.documentPreviewButtonText} numberOfLines={1}>
                            {tr("save", "Save")}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

function AttachmentOptionsModal({
    visible,
    onClose,
    onSelect,
    colors,
    tr,
    isArabic,
    isCompactScreen,
}) {
    if (!visible) {
        return null;
    }

    const attachmentItems = [
        {
            key: "camera",
            label: tr("camera", "Camera"),
            iconType: "ion",
            iconName: "camera",
            color: colors.text,
        },
        {
            key: "photos",
            label: tr("photos", "Photos"),
            iconType: "ion",
            iconName: "images",
            color: colors.blue,
        },
        {
            key: "document",
            label: tr("document", "Document"),
            iconType: "material",
            iconName: "file-document",
            color: colors.blue,
        },
    ];

    return (
        <View style={styles.attachmentOverlayRoot} pointerEvents="box-none">
            <Pressable
                style={[
                    styles.modalOverlay,
                    { backgroundColor: colors.modalOverlay },
                ]}
                onPress={onClose}
            >
                <Pressable
                    style={[
                        styles.attachmentCard,
                        isCompactScreen && styles.attachmentCardCompact,
                        {
                            backgroundColor: colors.modalCard,
                            borderColor: colors.border,
                        },
                    ]}
                >
                    <View style={[styles.attachmentHeader, getRowDirectionStyle(isArabic)]}>
                        <Text
                            style={[
                                styles.attachmentTitle,
                                { color: colors.text },
                                getTextDirectionStyle(isArabic),
                            ]}
                        >
                            {tr("attachmentTitle", "Attach")}
                        </Text>

                        <TouchableOpacity onPress={onClose} activeOpacity={0.8}>
                            <Ionicons name="close" size={24} color={colors.text} />
                        </TouchableOpacity>
                    </View>

                    <View style={[styles.attachmentGrid, getRowDirectionStyle(isArabic)]}>
                        {attachmentItems.map((item) => (
                            <TouchableOpacity
                                key={item.key}
                                style={styles.attachmentItem}
                                activeOpacity={0.85}
                                onPress={() => onSelect(item.key)}
                            >
                                <View
                                    style={[
                                        styles.attachmentIconCircle,
                                        isCompactScreen && styles.attachmentIconCircleCompact,
                                        {
                                            backgroundColor: colors.cardSoft,
                                            borderColor: colors.border,
                                        },
                                    ]}
                                >
                                    {item.iconType === "material" ? (
                                        <MaterialCommunityIcons
                                            name={item.iconName}
                                            size={isCompactScreen ? 29 : 33}
                                            color={item.color}
                                        />
                                    ) : (
                                        <Ionicons
                                            name={item.iconName}
                                            size={isCompactScreen ? 28 : 31}
                                            color={item.color}
                                        />
                                    )}
                                </View>

                                <Text
                                    style={[
                                        styles.attachmentLabel,
                                        isCompactScreen && styles.attachmentLabelCompact,
                                        { color: colors.text },
                                    ]}
                                    numberOfLines={1}
                                >
                                    {item.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </Pressable>
            </Pressable>
        </View>
    );
}

function QuoteCard({ colors, tr, time, isArabic, isCompactScreen }) {
    return (
        <View style={styles.quoteRow}>
            <View
                style={[
                    styles.quoteCard,
                    isCompactScreen && styles.quoteCardCompact,
                    {
                        backgroundColor: colors.card,
                        borderColor: colors.primary,
                    },
                ]}
            >
                <Text
                    style={[
                        styles.quoteTitle,
                        isCompactScreen && styles.quoteTitleCompact,
                        { color: colors.primary },
                        getTextDirectionStyle(isArabic),
                    ]}
                >
                    {tr("quoteSummary", "Quote Summary")}
                </Text>

                <View
                    style={[
                        styles.quoteBody,
                        isCompactScreen && styles.quoteBodyCompact,
                        !isCompactScreen && getRowDirectionStyle(isArabic),
                    ]}
                >
                    <View style={styles.quoteDetails}>
                        <QuoteLine
                            icon="map-marker-path"
                            label={tr("route", "Route")}
                            value="Shanghai (CN) → Dubai (UAE)"
                            colors={colors}
                            isArabic={isArabic}
                        />
                        <QuoteLine
                            icon="package-variant-closed"
                            label={tr("cargoType", "Cargo Type")}
                            value="General Cargo"
                            colors={colors}
                            isArabic={isArabic}
                        />
                        <QuoteLine
                            icon="shipping-pallet"
                            label={tr("container", "Container")}
                            value="20ft FCL"
                            colors={colors}
                            isArabic={isArabic}
                        />
                        <QuoteLine
                            icon="cube-outline"
                            label={tr("volumeWeight", "Volume / Weight")}
                            value="12 CBM / 8,000 KG"
                            colors={colors}
                            isArabic={isArabic}
                        />
                        <QuoteLine
                            icon="calendar-clock"
                            label="ETD"
                            value="May 28, 2024"
                            colors={colors}
                            isArabic={isArabic}
                        />
                        <QuoteLine
                            icon="calendar-check"
                            label="ETA"
                            value="Jun 04, 2024"
                            colors={colors}
                            isArabic={isArabic}
                        />
                    </View>

                    <View
                        style={[
                            styles.priceCard,
                            isCompactScreen && styles.priceCardCompact,
                            {
                                borderColor: colors.border,
                                backgroundColor: colors.cardSoft,
                            },
                        ]}
                    >
                        <Text style={[styles.priceLabel, { color: colors.text }]}>
                            {tr("totalPrice", "Total Price (All-In)")}
                        </Text>

                        <Text
                            style={[
                                styles.priceValue,
                                isCompactScreen && styles.priceValueCompact,
                                { color: colors.primary },
                            ]}
                        >
                            USD 1,250
                        </Text>

                        <Text style={[styles.validText, { color: colors.muted }]}>
                            {tr("validUntil", "Valid Until")}: May 31, 2024
                        </Text>

                        <View
                            style={[
                                styles.divider,
                                { backgroundColor: colors.border },
                            ]}
                        />

                        <Text
                            style={[
                                styles.includesTitle,
                                { color: colors.primary },
                            ]}
                        >
                            {tr("includes", "Includes")}:
                        </Text>

                        {[
                            "Ocean Freight",
                            "Terminal Handling",
                            "Documentation",
                            "Customs Clearance",
                            "Delivery in Dubai",
                        ].map((item) => (
                            <View key={item} style={styles.includeRow}>
                                <Ionicons
                                    name="checkmark"
                                    size={14}
                                    color={colors.primary}
                                />
                                <Text
                                    style={[
                                        styles.includeText,
                                        { color: colors.text },
                                    ]}
                                >
                                    {item}
                                </Text>
                            </View>
                        ))}
                    </View>
                </View>

                <TouchableOpacity
                    style={[
                        styles.viewQuoteButton,
                        { borderColor: colors.border },
                    ]}
                    activeOpacity={0.8}
                >
                    <View style={styles.viewQuoteLeft}>
                        <MaterialCommunityIcons
                            name="file-document-outline"
                            size={20}
                            color={colors.primary}
                        />

                        <Text
                            style={[
                                styles.viewQuoteText,
                                { color: colors.text },
                            ]}
                        >
                            {tr("viewFullQuote", "View Full Quote")}
                        </Text>
                    </View>

                    <Ionicons
                        name={isArabic ? "chevron-back" : "chevron-forward"}
                        size={20}
                        color={colors.text}
                    />
                </TouchableOpacity>

                <Text style={[styles.quoteTime, { color: colors.muted }]}>
                    {time}
                </Text>
            </View>
        </View>
    );
}

function QuoteLine({ icon, label, value, colors, isArabic }) {
    return (
        <View style={[styles.quoteLine, getRowDirectionStyle(isArabic)]}>
            <MaterialCommunityIcons name={icon} size={21} color={colors.primary} />

            <View style={styles.quoteLineTextWrapper}>
                <Text
                    style={[
                        styles.quoteLineLabel,
                        { color: colors.muted },
                        getTextDirectionStyle(isArabic),
                    ]}
                >
                    {label}
                </Text>

                <Text
                    style={[
                        styles.quoteLineValue,
                        { color: colors.text },
                        getTextDirectionStyle(isArabic),
                    ]}
                >
                    {value}
                </Text>
            </View>
        </View>
    );
}

function ChatOptionsModal({
    visible,
    onClose,
    colors,
    tr,
    language,
    isDark,
    isBlocked,
    onChangeLanguage,
    onChangeTheme,
    onToggleBlock,
    onDelete,
    isArabic,
}) {
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
            <Pressable
                style={[
                    styles.modalOverlay,
                    { backgroundColor: colors.modalOverlay },
                ]}
                onPress={onClose}
            >
                <Pressable
                    style={[
                        styles.menuCard,
                        {
                            backgroundColor: colors.modalCard,
                            borderColor: colors.border,
                        },
                    ]}
                >
                    <View style={[styles.menuHeader, getRowDirectionStyle(isArabic)]}>
                        <Text style={[styles.menuTitle, { color: colors.text }]}>
                            {tr("menuTitle", "Chat Options")}
                        </Text>

                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={24} color={colors.text} />
                        </TouchableOpacity>
                    </View>

                    <Text
                        style={[
                            styles.menuSectionTitle,
                            { color: colors.muted },
                            getTextDirectionStyle(isArabic),
                        ]}
                    >
                        {tr("theme", "Theme")}
                    </Text>

                    <View style={styles.segmentRow}>
                        <OptionPill
                            label={tr("darkMode", "Dark Mode")}
                            active={isDark}
                            colors={colors}
                            onPress={() => onChangeTheme("dark")}
                        />

                        <OptionPill
                            label={tr("lightMode", "Light Mode")}
                            active={!isDark}
                            colors={colors}
                            onPress={() => onChangeTheme("light")}
                        />
                    </View>

                    <Text
                        style={[
                            styles.menuSectionTitle,
                            { color: colors.muted },
                            getTextDirectionStyle(isArabic),
                        ]}
                    >
                        {tr("language", "Language")}
                    </Text>

                    <View style={styles.segmentRow}>
                        <OptionPill
                            label={tr("english", "English")}
                            active={language === "en"}
                            colors={colors}
                            onPress={() => onChangeLanguage("en")}
                        />

                        <OptionPill
                            label={tr("arabic", "Arabic")}
                            active={language === "ar"}
                            colors={colors}
                            onPress={() => onChangeLanguage("ar")}
                        />
                    </View>

                    <TouchableOpacity
                        style={[
                            styles.dangerRow,
                            { borderColor: isBlocked ? colors.primary : colors.border },
                        ]}
                        onPress={onToggleBlock}
                    >
                        <Ionicons
                            name={isBlocked ? "checkmark-circle-outline" : "ban-outline"}
                            size={22}
                            color={isBlocked ? colors.primary : colors.danger}
                        />

                        <Text
                            style={[
                                styles.dangerText,
                                { color: isBlocked ? colors.primary : colors.danger },
                            ]}
                        >
                            {isBlocked
                                ? tr("unblock", "Unblock Contact")
                                : tr("block", "Block Contact")}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[
                            styles.dangerRow,
                            { borderColor: colors.border },
                        ]}
                        onPress={onDelete}
                    >
                        <Ionicons name="trash-outline" size={22} color={colors.danger} />
                        <Text style={[styles.dangerText, { color: colors.danger }]}>
                            {tr("deleteChat", "Delete Conversation")}
                        </Text>
                    </TouchableOpacity>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

function OptionPill({ label, active, colors, onPress }) {
    return (
        <TouchableOpacity
            style={[
                styles.optionPill,
                {
                    backgroundColor: active ? colors.primary : colors.cardSoft,
                    borderColor: active ? colors.primary : colors.border,
                },
            ]}
            onPress={onPress}
            activeOpacity={0.85}
        >
            <Text
                style={[
                    styles.optionText,
                    { color: active ? colors.darkText : colors.text },
                ]}
            >
                {label}
            </Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
    },

    flex: {
        flex: 1,
    },

    container: {
        flex: 1,
    },

    header: {
        minHeight: 90,
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 12,
        flexDirection: "row",
        alignItems: "center",
        borderBottomWidth: 1,
    },

    headerCompact: {
        minHeight: 84,
        paddingHorizontal: 12,
        paddingTop: 6,
        paddingBottom: 10,
    },

    headerShort: {
        minHeight: 80,
        paddingTop: 6,
        paddingBottom: 8,
    },

    iconButton: {
        width: 36,
        height: 36,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
    },

    avatarWrapper: {
        marginHorizontal: 8,
        flexShrink: 0,
    },

    avatar: {
        width: 52,
        height: 52,
        borderRadius: 26,
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
    },

    avatarCompact: {
        width: 44,
        height: 44,
        borderRadius: 22,
    },

    avatarText: {
        fontSize: 17,
        fontWeight: "800",
    },

    avatarTextCompact: {
        fontSize: 15,
    },

    headerInfo: {
        flex: 1,
        minWidth: 0,
        paddingRight: 4,
    },

    employeeName: {
        fontSize: 18,
        fontWeight: "800",
        includeFontPadding: false,
    },

    employeeNameCompact: {
        fontSize: 16,
    },

    employeeNameVeryCompact: {
        fontSize: 15,
    },

    department: {
        marginTop: 4,
        fontSize: 13,
        fontWeight: "600",
        includeFontPadding: false,
    },

    departmentCompact: {
        fontSize: 12,
    },

    departmentVeryCompact: {
        fontSize: 11,
    },

    statusRow: {
        marginTop: 5,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },

    onlineDot: {
        width: 9,
        height: 9,
        borderRadius: 5,
    },

    onlineText: {
        fontSize: 13,
        fontWeight: "700",
        includeFontPadding: false,
    },

    onlineTextVeryCompact: {
        fontSize: 12,
    },

    callButton: {
        width: 42,
        height: 42,
        borderRadius: 14,
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
        marginLeft: 8,
        flexShrink: 0,
    },

    callButtonCompact: {
        width: 38,
        height: 38,
        borderRadius: 13,
        marginLeft: 6,
    },

    callButtonVeryCompact: {
        width: 36,
        height: 36,
        borderRadius: 12,
        marginLeft: 4,
    },

    messagesList: {
        flex: 1,
    },

    messagesContent: {
        flexGrow: 1,
        justifyContent: "flex-end",
        paddingHorizontal: 16,
        paddingTop: 18,
        paddingBottom: 14,
    },

    messagesContentCompact: {
        paddingHorizontal: 12,
        paddingTop: 14,
    },

    messagesContentShort: {
        paddingBottom: 10,
    },

    messageRow: {
        marginBottom: 10,
        flexDirection: "row",
    },

    myMessageRow: {
        justifyContent: "flex-end",
    },

    employeeMessageRow: {
        justifyContent: "flex-start",
    },

    bubble: {
        maxWidth: "82%",
        borderRadius: 16,
        borderWidth: 1,
        paddingHorizontal: 14,
        paddingTop: 10,
        paddingBottom: 7,
    },

    bubbleCompact: {
        maxWidth: "88%",
        paddingHorizontal: 12,
    },

    messageText: {
        fontSize: 15.5,
        lineHeight: 22,
    },

    messageTextCompact: {
        fontSize: 14.5,
        lineHeight: 21,
    },

    messageMetaRow: {
        marginTop: 5,
        flexDirection: "row",
        justifyContent: "flex-end",
        alignItems: "center",
        gap: 4,
    },

    imageBubble: {
        borderWidth: 1,
        borderRadius: 18,
        padding: 5,
        overflow: "hidden",
    },

    imageBubbleCompact: {
        borderRadius: 16,
    },

    chatImage: {
        borderRadius: 14,
        backgroundColor: "#000000",
    },

    imageCaption: {
        marginTop: 7,
        paddingHorizontal: 6,
        fontSize: 13.5,
        fontWeight: "600",
        lineHeight: 19,
    },

    imageMetaRow: {
        marginTop: 5,
        paddingHorizontal: 6,
        paddingBottom: 2,
        flexDirection: "row",
        justifyContent: "flex-end",
        alignItems: "center",
        gap: 4,
    },

    documentBubble: {
        width: "82%",
        maxWidth: 330,
        borderRadius: 18,
        borderWidth: 1,
        padding: 10,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },

    documentBubbleCompact: {
        width: "88%",
        borderRadius: 16,
        padding: 9,
    },

    documentIconBox: {
        width: 54,
        height: 54,
        borderRadius: 16,
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
    },

    documentInfo: {
        flex: 1,
        minWidth: 0,
    },

    documentName: {
        fontSize: 14,
        fontWeight: "800",
        lineHeight: 19,
    },

    documentMeta: {
        marginTop: 3,
        fontSize: 12,
        fontWeight: "600",
    },

    documentTimeRow: {
        marginTop: 6,
        flexDirection: "row",
        justifyContent: "flex-end",
        alignItems: "center",
        gap: 4,
    },

    audioBubble: {
        width: "76%",
        maxWidth: 310,
        borderRadius: 18,
        borderWidth: 1,
        padding: 10,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },

    audioBubbleCompact: {
        width: "84%",
        borderRadius: 16,
        padding: 9,
    },

    audioPlayButton: {
        width: 42,
        height: 42,
        borderRadius: 21,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
    },

    audioContent: {
        flex: 1,
        minWidth: 0,
    },

    audioWaveRow: {
        height: 34,
        flexDirection: "row",
        alignItems: "center",
        gap: 3,
    },

    audioWaveBar: {
        width: 3,
        borderRadius: 2,
        opacity: 0.8,
    },

    audioMetaRow: {
        marginTop: 2,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 8,
    },

    audioDuration: {
        fontSize: 12,
        fontWeight: "700",
    },

    audioTimeWrapper: {
        flexDirection: "row",
        justifyContent: "flex-end",
        alignItems: "center",
        gap: 4,
    },

    imagePreviewRoot: {
        flex: 1,
    },

    imagePreviewClose: {
        position: "absolute",
        top: Platform.OS === "ios" ? 58 : 34,
        right: 18,
        zIndex: 10,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: "rgba(0, 0, 0, 0.45)",
        alignItems: "center",
        justifyContent: "center",
    },

    imagePreviewContent: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 10,
    },

    fullImage: {
        width: "100%",
        height: "100%",
    },

    imagePreviewFooter: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: 18,
        paddingTop: 14,
        paddingBottom: Platform.OS === "ios" ? 34 : 18,
    },

    imagePreviewCaption: {
        color: "#ffffff",
        fontSize: 15,
        fontWeight: "700",
        lineHeight: 22,
    },

    imagePreviewTime: {
        marginTop: 4,
        color: "rgba(255, 255, 255, 0.72)",
        fontSize: 12,
        fontWeight: "600",
    },

    timeText: {
        fontSize: 11.5,
    },

    quoteRow: {
        marginBottom: 10,
        alignItems: "flex-start",
    },

    quoteCard: {
        width: "100%",
        borderRadius: 18,
        borderWidth: 1.4,
        padding: 14,
    },

    quoteCardCompact: {
        padding: 12,
        borderRadius: 16,
    },

    quoteTitle: {
        fontSize: 16,
        fontWeight: "900",
        marginBottom: 12,
    },

    quoteTitleCompact: {
        fontSize: 15,
        marginBottom: 10,
    },

    quoteBody: {
        flexDirection: "row",
        gap: 12,
    },

    quoteBodyCompact: {
        flexDirection: "column",
        gap: 12,
    },

    quoteDetails: {
        flex: 1,
        gap: 9,
    },

    quoteLine: {
        flexDirection: "row",
        gap: 8,
        alignItems: "flex-start",
    },

    quoteLineTextWrapper: {
        flex: 1,
    },

    quoteLineLabel: {
        fontSize: 12,
    },

    quoteLineValue: {
        fontSize: 13,
        fontWeight: "700",
        marginTop: 1,
    },

    priceCard: {
        width: 158,
        borderRadius: 16,
        borderWidth: 1,
        padding: 10,
    },

    priceCardCompact: {
        width: "100%",
    },

    priceLabel: {
        fontSize: 12,
        textAlign: "center",
    },

    priceValue: {
        marginTop: 5,
        fontSize: 21,
        fontWeight: "900",
        textAlign: "center",
    },

    priceValueCompact: {
        fontSize: 20,
    },

    validText: {
        marginTop: 6,
        fontSize: 11,
        textAlign: "center",
    },

    divider: {
        height: 1,
        marginVertical: 8,
    },

    includesTitle: {
        fontSize: 12,
        fontWeight: "800",
        marginBottom: 4,
    },

    includeRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        marginTop: 3,
    },

    includeText: {
        flex: 1,
        fontSize: 10.5,
    },

    viewQuoteButton: {
        marginTop: 13,
        borderWidth: 1,
        borderRadius: 13,
        paddingVertical: 10,
        paddingHorizontal: 12,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },

    viewQuoteLeft: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },

    viewQuoteText: {
        fontSize: 14,
        fontWeight: "800",
    },

    quoteTime: {
        marginTop: 5,
        textAlign: "right",
        fontSize: 11.5,
    },

    composerWrapper: {
        paddingHorizontal: 14,
        paddingTop: 8,
        borderTopWidth: 1,
        flexDirection: "row",
        alignItems: "flex-end",
        gap: 8,
    },

    composerWrapperCompact: {
        paddingHorizontal: 10,
        gap: 6,
    },

    attachButton: {
        width: 40,
        minHeight: 46,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
    },

    inputWrapper: {
        flex: 1,
        minHeight: 46,
        maxHeight: 116,
        borderWidth: 1,
        borderRadius: 18,
        paddingLeft: 14,
        paddingRight: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        minWidth: 0,
    },

    inputWrapperCompact: {
        minHeight: 44,
        borderRadius: 16,
        paddingLeft: 12,
        paddingRight: 10,
    },

    input: {
        flex: 1,
        fontSize: 15,
        paddingVertical: Platform.OS === "ios" ? 11 : 8,
        maxHeight: 96,
        minWidth: 0,
    },

    inputCompact: {
        fontSize: 14.5,
        maxHeight: 86,
    },

    recordingInputContent: {
        flex: 1,
        minHeight: 44,
        flexDirection: "row",
        alignItems: "center",
        gap: 9,
        minWidth: 0,
    },

    recordingDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: "#EF4444",
    },

    recordingInputText: {
        flex: 1,
        fontSize: 15,
        fontWeight: "800",
    },

    actionButton: {
        width: 50,
        height: 50,
        borderRadius: 25,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
    },

    actionButtonCompact: {
        width: 46,
        height: 46,
        borderRadius: 23,
    },


    imagePreviewSave: {
        position: "absolute",
        top: Platform.OS === "ios" ? 58 : 34,
        left: 18,
        zIndex: 10,
        minWidth: 88,
        height: 44,
        borderRadius: 22,
        paddingHorizontal: 14,
        backgroundColor: "rgba(0, 0, 0, 0.45)",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
    },

    imagePreviewSaveText: {
        color: "#ffffff",
        fontSize: 13,
        fontWeight: "800",
    },

    imageConfirmRoot: {
        flex: 1,
    },

    imageConfirmHeader: {
        position: "absolute",
        top: Platform.OS === "ios" ? 58 : 34,
        left: 18,
        right: 18,
        zIndex: 10,
        minHeight: 44,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },

    imageConfirmClose: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: "rgba(0, 0, 0, 0.45)",
        alignItems: "center",
        justifyContent: "center",
    },

    imageConfirmTitle: {
        flex: 1,
        color: "#ffffff",
        fontSize: 18,
        fontWeight: "900",
    },

    imageConfirmContent: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 10,
    },

    imageConfirmFooter: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: 18,
        paddingTop: 14,
        paddingBottom: Platform.OS === "ios" ? 34 : 18,
    },

    imageConfirmCaption: {
        color: "#ffffff",
        fontSize: 14,
        fontWeight: "700",
        marginBottom: 12,
    },

    confirmActionsRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },

    confirmCancelButton: {
        flex: 1,
        height: 48,
        borderRadius: 16,
        backgroundColor: "rgba(255, 255, 255, 0.14)",
        alignItems: "center",
        justifyContent: "center",
    },

    confirmCancelText: {
        color: "#ffffff",
        fontSize: 15,
        fontWeight: "900",
    },

    confirmSendButton: {
        flex: 1,
        height: 48,
        borderRadius: 16,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
    },

    confirmSendText: {
        color: "#ffffff",
        fontSize: 15,
        fontWeight: "900",
    },

    documentPreviewRoot: {
        flex: 1,
    },

    documentPreviewCenter: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 22,
    },

    documentPreviewCard: {
        width: "100%",
        maxWidth: 360,
        borderWidth: 1,
        borderRadius: 28,
        padding: 22,
        alignItems: "center",
    },

    documentPreviewIcon: {
        width: 104,
        height: 104,
        borderRadius: 30,
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 18,
    },

    documentPreviewName: {
        fontSize: 17,
        fontWeight: "900",
        textAlign: "center",
        lineHeight: 23,
    },

    documentPreviewMeta: {
        marginTop: 8,
        fontSize: 13,
        fontWeight: "700",
        textAlign: "center",
    },

    documentPreviewActions: {
        width: "100%",
        marginTop: 22,
        gap: 10,
    },

    documentPreviewButton: {
        flex: 1,
        minWidth: 0,
        height: 50,
        borderRadius: 16,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        paddingHorizontal: 12,
    },

    documentPreviewButtonStacked: {
        width: "100%",
        flex: 0,
    },

    documentPreviewSecondaryButton: {
        backgroundColor: "transparent",
        borderWidth: 1,
    },

    documentPreviewButtonText: {
        color: "#ffffff",
        fontSize: 15,
        fontWeight: "900",
    },

    documentPreviewSecondaryText: {
        fontSize: 15,
        fontWeight: "900",
    },

    documentPreviewHeader: {
        position: "absolute",
        top: Platform.OS === "ios" ? 58 : 34,
        left: 18,
        right: 18,
        zIndex: 10,
        minHeight: 48,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },

    documentPreviewHeaderButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: "rgba(0, 0, 0, 0.45)",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
    },

    documentPreviewHeaderTextWrapper: {
        flex: 1,
        minWidth: 0,
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 16,
        backgroundColor: "rgba(0, 0, 0, 0.42)",
    },

    documentPreviewHeaderTitle: {
        color: "#ffffff",
        fontSize: 14,
        fontWeight: "900",
    },

    documentPreviewHeaderMeta: {
        marginTop: 2,
        color: "rgba(255, 255, 255, 0.72)",
        fontSize: 11,
        fontWeight: "700",
    },

    documentPreviewBody: {
        flex: 1,
        paddingTop: Platform.OS === "ios" ? 112 : 88,
        paddingHorizontal: 12,
        paddingBottom: Platform.OS === "ios" ? 128 : 112,
        alignItems: "center",
        justifyContent: "center",
    },

    documentInlineImage: {
        width: "100%",
        height: "100%",
        borderRadius: 18,
    },

    documentPdfWebView: {
        width: "100%",
        height: "100%",
        borderRadius: 18,
        overflow: "hidden",
        backgroundColor: "#ffffff",
    },

    documentPreviewLoading: {
        width: "100%",
        maxWidth: 340,
        minHeight: 220,
        borderRadius: 24,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(255, 255, 255, 0.10)",
        padding: 22,
    },

    documentPreviewLoadingText: {
        marginTop: 12,
        fontSize: 15,
        fontWeight: "800",
        textAlign: "center",
    },

    documentPreviewBottomBar: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: 18,
        paddingTop: 14,
        paddingBottom: Platform.OS === "ios" ? 34 : 18,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },

    documentPreviewBottomBarStacked: {
        flexDirection: "column",
        alignItems: "stretch",
        paddingHorizontal: 14,
        gap: 8,
    },

    documentPreviewSaveButton: {
        backgroundColor: "rgba(255, 255, 255, 0.16)",
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.22)",
    },

    attachmentOverlayRoot: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 50,
        elevation: 50,
    },

    modalOverlay: {
        flex: 1,
        justifyContent: "flex-end",
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 16,
    },

    attachmentCard: {
        width: "100%",
        alignSelf: "stretch",
        borderWidth: 1,
        borderRadius: 26,
        paddingHorizontal: 18,
        paddingTop: 18,
        paddingBottom: 24,
    },

    attachmentCardCompact: {
        paddingHorizontal: 14,
        paddingBottom: 20,
    },

    attachmentHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 18,
    },

    attachmentTitle: {
        flex: 1,
        fontSize: 19,
        fontWeight: "900",
    },

    attachmentGrid: {
        flexDirection: "row",
        justifyContent: "space-between",
        gap: 12,
    },

    attachmentItem: {
        flex: 1,
        alignItems: "center",
        gap: 9,
        minWidth: 0,
    },

    attachmentIconCircle: {
        width: 74,
        height: 74,
        borderRadius: 37,
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
    },

    attachmentIconCircleCompact: {
        width: 62,
        height: 62,
        borderRadius: 31,
    },

    attachmentLabel: {
        fontSize: 13,
        fontWeight: "800",
        textAlign: "center",
    },

    attachmentLabelCompact: {
        fontSize: 12,
    },

    menuCard: {
        width: "100%",
        alignSelf: "stretch",
        borderWidth: 1,
        borderRadius: 24,
        padding: 18,
    },

    menuHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 18,
    },

    menuTitle: {
        fontSize: 19,
        fontWeight: "900",
    },

    menuSectionTitle: {
        fontSize: 13,
        fontWeight: "800",
        marginBottom: 8,
        marginTop: 10,
    },

    segmentRow: {
        flexDirection: "row",
        gap: 10,
        marginBottom: 4,
    },

    optionPill: {
        flex: 1,
        borderWidth: 1,
        borderRadius: 14,
        paddingVertical: 12,
        alignItems: "center",
    },

    optionText: {
        fontSize: 14,
        fontWeight: "800",
    },

    dangerRow: {
        marginTop: 12,
        paddingVertical: 14,
        paddingHorizontal: 12,
        borderRadius: 15,
        borderWidth: 1,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },

    dangerText: {
        fontSize: 15,
        fontWeight: "800",
    },
});
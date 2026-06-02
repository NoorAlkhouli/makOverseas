import { appImages } from "@/src/constants/images";
import {
    getRowDirectionStyle,
    getTextDirectionStyle,
} from "@/src/styles/globalStyles";
import { useAppTheme } from "@/src/theme/ThemeProvider";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import {
    AudioModule,
    RecordingPresets,
    setAudioModeAsync,
    useAudioRecorder,
    useAudioRecorderState,
} from "expo-audio";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as IntentLauncher from "expo-intent-launcher";
import * as Sharing from "expo-sharing";
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
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import IndividualChatComposer from "../../components/IndividualChatComposer";
import IndividualChatHeader from "../../components/IndividualChatHeader";
import IndividualChatMessagesList from "../../components/IndividualChatMessagesList";
// import {
//     ScannedDocumentConfirmModal,
//     useScanDocument,
// } from "../../components/ScanDocumentTools";
import {
    ChatCameraCaptureModal,
    MediaConfirmModal,
    MediaPreviewModal,
    useIndividualChatMedia,
} from "../../components/useIndividualChatMedia";

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
    const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
    const [previewDocument, setPreviewDocument] = useState(null);

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
            previewBackground: appColors.background,
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

        const keyboardShowListener = Keyboard.addListener(showEvent, () => {
            setIsKeyboardVisible(true);

            setTimeout(() => {
                scrollToBottom(true);
            }, Platform.OS === "ios" ? 160 : 280);
        });

        const keyboardHideListener = Keyboard.addListener(hideEvent, () => {
            setIsKeyboardVisible(false);

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

    const {
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
    } = useIndividualChatMedia({
        tr,
        addMessages,
        cancelVoiceRecordingIfActive,
    });

    // const {
    //     selectedScannedDocument,
    //     selectedScannedDocuments,
    //     activeScannedPageIndex,
    //     isScanningDocument,
    //     isCreatingScannedPdf,
    //     scanDocumentWithCamera,
    //     handleAddScannedPages,
    //     handleRetakeScannedPage,
    //     handleDeleteScannedPage,
    //     handleCancelScannedDocument,
    //     handleConfirmSendScannedDocument,
    //     setActiveScannedPageIndex,
    // } = useScanDocument({
    //     tr,
    //     addMessages,
    //     cancelVoiceRecordingIfActive,
    // });

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
            await pickMediaFromLibrary();
            return;
        }

        if (type === "document") {
            await pickDocumentsFromDevice();
            return;
        }

        if (type === "scan") {
            await scanDocumentWithCamera();
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

    // KeyboardAvoidingView now owns keyboard resizing on both iOS and Android.
    // Keep this value at 0 so the composer does not receive an extra manual offset
    // that can push it incorrectly on different Android screen sizes.
    const androidKeyboardSpace = 0;

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
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                keyboardVerticalOffset={0}
                enabled
            >
                <View style={[styles.container, { backgroundColor: colors.screen }]}>
                    <IndividualChatHeader
                        navigation={navigation}
                        colors={colors}
                        employeeInitials={employeeInitials}
                        employeeName={employeeName}
                        employeeDepartment={employeeDepartment}
                        isBlocked={isBlocked}
                        tr={tr}
                        isCompactScreen={isCompactScreen}
                        isVeryCompactScreen={isVeryCompactScreen}
                        isShortScreen={isShortScreen}
                        onOpenMenu={openChatMenu}
                    />

                    <IndividualChatMessagesList
                        messages={messages}
                        messagesScrollRef={messagesScrollRef}
                        colors={colors}
                        tr={tr}
                        isArabic={isArabic}
                        isCompactScreen={isCompactScreen}
                        isShortScreen={isShortScreen}
                        isKeyboardVisible={isKeyboardVisible}
                        imageMessageWidth={imageMessageWidth}
                        imageMessageHeight={imageMessageHeight}
                        onContentSizeChange={() => scrollToBottom(false)}
                        onOpenImage={setPreviewMedia}
                        onOpenVideo={setPreviewMedia}
                        onOpenDocument={setPreviewDocument}
                    />

                    <IndividualChatComposer
                        colors={colors}
                        tr={tr}
                        isArabic={isArabic}
                        isCompactScreen={isCompactScreen}
                        messageText={messageText}
                        onChangeMessageText={setMessageText}
                        isRecordingVoice={isRecordingVoice}
                        recordingDurationText={recordingDurationText}
                        hasMessage={hasMessage}
                        insetsBottom={insets.bottom}
                        androidKeyboardSpace={androidKeyboardSpace}
                        onOpenAttachMenu={openAttachMenu}
                        onTakePhoto={takePhotoWithCamera}
                        onSend={handleSend}
                        onMicPress={handleMicPress}
                        onFocusInput={() => {
                            setTimeout(() => {
                                scrollToBottom(true);
                            }, 220);
                        }}
                    />
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

                <ChatCameraCaptureModal
                    visible={cameraCaptureVisible}
                    colors={colors}
                    tr={tr}
                    onClose={handleCloseCameraCapture}
                    onCaptured={handleCameraCaptured}
                    onOpenLibrary={async () => {
                        handleCloseCameraCapture();
                        setTimeout(() => {
                            pickMediaFromLibrary();
                        }, Platform.OS === "android" ? 180 : 80);
                    }}
                />

                <MediaPreviewModal
                    visible={!!previewMedia}
                    mediaItem={previewMedia}
                    image={previewMedia?.image}
                    video={previewMedia?.video || (previewMedia?.type === "video" && previewMedia?.uri ? { uri: previewMedia.uri } : null)}
                    caption={previewMedia?.caption}
                    time={previewMedia?.time}
                    colors={colors}
                    isDark={isDark}
                    tr={tr}
                    onClose={() => setPreviewMedia(null)}
                    onSave={() => handleSaveMediaToDevice(previewMedia)}
                />

                <MediaConfirmModal
                    visible={!!selectedMediaToSend}
                    mediaItem={selectedMediaToSend}
                    image={selectedMediaToSend?.image}
                    video={selectedMediaToSend?.video || (selectedMediaToSend?.type === "video" && selectedMediaToSend?.uri ? { uri: selectedMediaToSend.uri } : null)}
                    caption={selectedMediaToSend?.caption}
                    colors={colors}
                    isDark={isDark}
                    tr={tr}
                    onCancel={handleCancelSelectedMedia}
                    onSend={(finalMedia) => {
                        const isPressEvent =
                            !!finalMedia?.nativeEvent ||
                            !!finalMedia?.dispatchConfig ||
                            !!finalMedia?.target;

                        handleConfirmSendMedia(isPressEvent ? undefined : finalMedia);
                    }}
                />

                {/* <ScannedDocumentConfirmModal
                    visible={!!selectedScannedDocument}
                    documentItem={selectedScannedDocument}
                    documents={selectedScannedDocuments}
                    activeIndex={activeScannedPageIndex}
                    colors={colors}
                    tr={tr}
                    isLoading={isScanningDocument || isCreatingScannedPdf}
                    onCancel={handleCancelScannedDocument}
                    onAddPage={handleAddScannedPages}
                    onDeletePage={handleDeleteScannedPage}
                    onRetake={handleRetakeScannedPage}
                    onChangePage={setActiveScannedPageIndex}
                    onSend={handleConfirmSendScannedDocument}
                /> */}
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
                <View style={[styles.documentPreviewLoading, { backgroundColor: colors.cardSoft, borderColor: colors.border }]}>
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
                            backgroundColor: colors.cardStrong,
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
                        backgroundColor: colors.cardStrong,
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
                        style={[styles.documentPreviewHeaderButton, { backgroundColor: colors.buttonSoft, borderColor: colors.border }]}
                        activeOpacity={0.85}
                        onPress={onClose}
                    >
                        <Ionicons name="close" size={28} color={colors.text} />
                    </TouchableOpacity>

                    <View style={[styles.documentPreviewHeaderTextWrapper, { backgroundColor: colors.cardStrong, borderColor: colors.border }]}>
                        <Text style={[styles.documentPreviewHeaderTitle, { color: colors.text }]} numberOfLines={1}>
                            {documentItem?.fileName || tr("attachedFile", "Attached file")}
                        </Text>
                        <Text style={[styles.documentPreviewHeaderMeta, { color: colors.muted }]} numberOfLines={1}>
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
                            backgroundColor: colors.cardStrong,
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
                        <Ionicons name="open-outline" size={19} color={colors.darkText} />
                        <Text style={[styles.documentPreviewButtonText, { color: colors.darkText }]} numberOfLines={1}>
                            {canPreviewAsPdf
                                ? tr("openWithApp", "Open with app")
                                : tr("openFile", "Open file")}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[
                            styles.documentPreviewButton,
                            styles.documentPreviewSaveButton,
                            { backgroundColor: colors.buttonSoft, borderColor: colors.border },
                            shouldStackActions && styles.documentPreviewButtonStacked,
                        ]}
                        activeOpacity={0.85}
                        onPress={onSave}
                    >
                        <Ionicons name="download-outline" size={19} color={colors.text} />
                        <Text style={[styles.documentPreviewButtonText, { color: colors.text }]} numberOfLines={1}>
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
            label: tr("photosAndVideos", "Photos & Videos"),
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
        {
            key: "scan",
            label: tr("scanDocument", "Scan Document"),
            iconType: "ion",
            iconName: "scan-outline",
            color: colors.primary || colors.blue,
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
        borderWidth: 1,
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
        borderWidth: 1,
    },

    documentPreviewHeaderTitle: {
        fontSize: 14,
        fontWeight: "900",
    },

    documentPreviewHeaderMeta: {
        marginTop: 2,
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

    documentPreviewLoading: {
        width: "100%",
        maxWidth: 340,
        minHeight: 220,
        borderRadius: 24,
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
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
        borderWidth: 1,
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
        flexWrap: "wrap",
        justifyContent: "space-between",
        rowGap: 16,
        columnGap: 10,
    },

    attachmentItem: {
        width: "48%",
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
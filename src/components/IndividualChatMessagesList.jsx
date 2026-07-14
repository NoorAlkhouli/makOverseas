import { getTextDirectionStyle } from "@/src/styles/globalStyles";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";
import React, { useEffect, useState } from "react";
import MediaMessage from "../components/MediaMessage";
import QuoteMessageCard from "@/src/components/quotes/QuoteMessageCard";

import {
    ActivityIndicator,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,

} from "react-native";

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

const getLocalizedMessageTime = (time, tr, isArabic) => {
    const normalizedTime = String(time || "").trim().toLowerCase();
    const nowWords = ["now", "الآن", "الان"];

    if (nowWords.includes(normalizedTime)) {
        return tr("now", isArabic ? "الآن" : "Now");
    }

    return time;
};

const RTL_TEXT_REGEX = /[\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC]/;
const LTR_TEXT_REGEX = /[A-Za-z]/;

const isRTLMessageText = (value = "", fallbackIsArabic = false) => {
    const cleanValue = String(value || "").trim();

    if (!cleanValue) {
        return fallbackIsArabic;
    }

    for (const char of cleanValue) {
        if (RTL_TEXT_REGEX.test(char)) {
            return true;
        }

        if (LTR_TEXT_REGEX.test(char)) {
            return false;
        }
    }

    return fallbackIsArabic;
};

const getMessageTextDirectionStyle = (value = "", fallbackIsArabic = false) => {
    const isRTL = isRTLMessageText(value, fallbackIsArabic);

    return {
        textAlign: isRTL ? "right" : "left",
        writingDirection: isRTL ? "rtl" : "ltr",
    };
};

const getReplyPreviewText = (message, tr) => {
    if (!message) return "";

    if (message.text) return message.text;
    if (message.caption) return message.caption;
    if (message.fileName) return message.fileName;

    if (message.type === "image") return tr("imageMessage", "Image");
    if (message.type === "video") return tr("videoMessage", "Video");
    if (message.type === "document") return tr("document", "Document");
    if (message.type === "audio") return tr("voiceMessage", "Voice message");
    if (message.type === "quote") return tr("quoteSummary", "Quote Summary");

    return tr("message", "Message");
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

const getFirstDocumentAttachment = (item) => {
    if (Array.isArray(item?.attachments) && item.attachments.length > 0) {
        return item.attachments[0];
    }

    if (Array.isArray(item?.raw?.attachments) && item.raw.attachments.length > 0) {
        return item.raw.attachments[0];
    }

    return (
        item?.attachment ||
        item?.file ||
        item?.media ||
        item?.raw?.attachment ||
        item?.raw?.file ||
        item?.raw?.media ||
        null
    );
};

const getDocumentUri = (item) => {
    const attachment = getFirstDocumentAttachment(item);

    return (
        item?.uri ||
        item?.url ||
        item?.file_url ||
        item?.full_url ||
        item?.original_url ||
        item?.path ||
        attachment?.url ||
        attachment?.file_url ||
        attachment?.full_url ||
        attachment?.original_url ||
        attachment?.path ||
        attachment?.uri ||
        ""
    );
};

const decodeFileName = (fileName = "") => {
    try {
        return decodeURIComponent(String(fileName || ""));
    } catch {
        return String(fileName || "");
    }
};

const getDocumentFileName = (item, tr) => {
    const attachment = getFirstDocumentAttachment(item);

    return decodeFileName(
        item?.fileName ||
        item?.name ||
        item?.file_name ||
        item?.filename ||
        item?.original_name ||
        attachment?.name ||
        attachment?.file_name ||
        attachment?.filename ||
        attachment?.original_name ||
        tr("attachedFile", "Attached file")
    );
};

const getDocumentMimeType = (item) => {
    const attachment = getFirstDocumentAttachment(item);

    return (
        item?.mimeType ||
        item?.mime_type ||
        attachment?.mime_type ||
        attachment?.mimeType ||
        item?.raw?.mime_type ||
        item?.raw?.mimeType ||
        "application/octet-stream"
    );
};

const getDocumentSize = (item) => {
    const attachment = getFirstDocumentAttachment(item);

    return (
        item?.size ||
        item?.size_bytes ||
        attachment?.size ||
        attachment?.file_size ||
        attachment?.size_bytes ||
        item?.raw?.size ||
        item?.raw?.file_size ||
        item?.raw?.size_bytes ||
        0
    );
};

const getOpenableDocumentItem = (item, tr) => {
    return {
        ...item,
        uri: getDocumentUri(item),
        fileName: getDocumentFileName(item, tr),
        mimeType: getDocumentMimeType(item),
        size: getDocumentSize(item),
    };
};

const getMessageSendState = (message) => {
    const status = String(
        message?.sendStatus ||
        message?.status ||
        message?.delivery_status ||
        message?.deliveryStatus ||
        ""
    ).toLowerCase();

    if (
        message?.isFailed === true ||
        message?.failed === true ||
        status === "failed" ||
        status === "error"
    ) {
        return "failed";
    }

    if (
        message?.isSending === true ||
        message?.sending === true ||
        status === "sending" ||
        status === "pending"
    ) {
        return "sending";
    }

    return "sent";
};

const getDisplayMessageId = (message) => {
    const messageId =
        message?.raw?.id ||
        message?.message_id ||
        message?.id ||
        message?.uuid ||
        null;

    if (messageId === undefined || messageId === null || messageId === "") {
        return null;
    }

    return String(messageId);
};

const isHighlightedMessage = (message, highlightedMessageId) => {
    const messageId = getDisplayMessageId(message);

    return !!(
        messageId &&
        highlightedMessageId &&
        String(messageId) === String(highlightedMessageId)
    );
};

function MessageStatusIcon({ item, colors }) {
    const sendState = getMessageSendState(item);

    const isRead =
        item?.is_read === true ||
        item?.isRead === true ||
        !!item?.read_at ||
        !!item?.readAt ||
        item?.delivery_status === "read" ||
        item?.deliveryStatus === "read" ||
        item?.status === "read";

    if (sendState === "failed") {
        return (
            <Ionicons
                name="alert-circle"
                size={15}
                color={colors.danger}
            />
        );
    }

    if (sendState === "sending") {
        return (
            <Ionicons
                name="time-outline"
                size={15}
                color={colors.muted}
            />
        );
    }

    if (isRead) {
        return (
            <Ionicons
                name="checkmark-done"
                size={15}
                color={colors.blue}
            />
        );
    }

    return (
        <Ionicons
            name="checkmark-done"
            size={15}
            color={colors.muted}
        />
    );
}

export default function IndividualChatMessagesList({
    messages,
    messagesScrollRef,
    colors,
    tr,
    isArabic,
    isCompactScreen,
    isShortScreen,
    isKeyboardVisible,
    imageMessageWidth,
    imageMessageHeight,
    onContentSizeChange,
    onScroll,
    onLoadOlderMessages,
    isLoadingOlderMessages = false,
    hasOlderMessages = false,
    onOpenImage,
    onOpenVideo,
    onOpenDocument,
    onMessageLongPress,
    canCreateQuote = false,
    viewerRole = null,
    onMessageLayout,
    onReplyPreviewPress,
    highlightedMessageId = null,
}) {
    const handleMessagesScroll = (event) => {
        onScroll?.(event);

        const offsetY = Number(event?.nativeEvent?.contentOffset?.y || 0);

        if (offsetY <= 40 && hasOlderMessages && !isLoadingOlderMessages) {
            onLoadOlderMessages?.();
        }
    };

    const handleItemLayout = (item, event) => {
        onMessageLayout?.(item, event?.nativeEvent?.layout);
    };

    return (
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
            onScroll={handleMessagesScroll}
            scrollEventThrottle={16}
            onContentSizeChange={onContentSizeChange}
        >
            {isLoadingOlderMessages && (
                <View style={styles.olderMessagesLoader}>
                    <ActivityIndicator
                        size="small"
                        color={colors.primary || colors.blue}
                    />
                    <Text
                        style={[styles.olderMessagesLoaderText, { color: colors.muted }]}
                        numberOfLines={1}
                    >
                        {tr("loadingOlderMessages", "Loading earlier messages...")}
                    </Text>
                </View>
            )}
            {messages.map((item) => {
                const displayTime = getLocalizedMessageTime(item.time, tr, isArabic);

                if (item.type === "quote") {
                    const isHighlighted = isHighlightedMessage(item, highlightedMessageId);

                    return (
                        <View
                            key={item.id}
                            onLayout={(event) => handleItemLayout(item, event)}
                            style={isHighlighted ? [
                                styles.highlightedMessageWrapper,
                                { borderColor: colors.primary || colors.blue },
                            ] : null}
                        >
                            {!!item.replyToMessage && (
                                <MessageReplyPreview
                                    message={item.replyToMessage}
                                    ownerMessage={item}
                                    colors={colors}
                                    tr={tr}
                                    isArabic={isArabic}
                                    onPress={onReplyPreviewPress}
                                />
                            )}

                            <QuoteMessageCard
                                item={item}
                                colors={colors}
                                tr={tr}
                                time={displayTime}
                                isArabic={isArabic}
                                isCompactScreen={isCompactScreen}
                                onLongPress={() => onMessageLongPress?.(item)}
                                viewerCanCreateQuote={canCreateQuote}
                                viewerRole={viewerRole}
                            />
                        </View>
                    );
                }

                if (item.type === "image" || item.type === "video") {
                    const isHighlighted = isHighlightedMessage(item, highlightedMessageId);
                    const handleOpenMedia = () => {
                        if (item.type === "image") {
                            onOpenImage?.(item);
                            return;
                        }

                        onOpenVideo?.(item);
                    };

                    return (
                        <View
                            key={item.id}
                            onLayout={(event) => handleItemLayout(item, event)}
                            style={isHighlighted ? [
                                styles.highlightedMessageWrapper,
                                { borderColor: colors.primary || colors.blue },
                            ] : null}
                        >
                            {!!item.replyToMessage && (
                                <MessageReplyPreview
                                    message={item.replyToMessage}
                                    ownerMessage={item}
                                    colors={colors}
                                    tr={tr}
                                    isArabic={isArabic}
                                    onPress={onReplyPreviewPress}
                                />
                            )}

                            <Pressable
                                delayLongPress={260}
                                onPress={handleOpenMedia}
                                onLongPress={() => onMessageLongPress?.(item)}
                                onStartShouldSetResponderCapture={() => true}
                            >
                                <MediaMessage
                                    item={item}
                                    colors={colors}
                                    isCompactScreen={isCompactScreen}
                                    mediaWidth={imageMessageWidth}
                                    mediaHeight={imageMessageHeight}
                                    time={displayTime}
                                    onOpen={handleOpenMedia}
                                />
                            </Pressable>
                        </View>
                    );
                }

                if (item.type === "document") {
                    const documentItem = getOpenableDocumentItem(item, tr);
                    const isHighlighted = isHighlightedMessage(item, highlightedMessageId);

                    return (
                        <DocumentMessage
                            key={item.id}
                            item={documentItem}
                            colors={colors}
                            isCompactScreen={isCompactScreen}
                            tr={tr}
                            time={displayTime}
                            onOpen={() => onOpenDocument(documentItem)}
                            onLongPress={() => onMessageLongPress?.(item)}
                            onLayout={(event) => handleItemLayout(item, event)}
                            onReplyPreviewPress={onReplyPreviewPress}
                            isArabic={isArabic}
                            isHighlighted={isHighlighted}
                        />
                    );
                }

                if (item.type === "audio") {
                    const isHighlighted = isHighlightedMessage(item, highlightedMessageId);

                    return (
                        <AudioMessage
                            key={item.id}
                            item={item}
                            colors={colors}
                            isCompactScreen={isCompactScreen}
                            tr={tr}
                            time={displayTime}
                            onLongPress={() => onMessageLongPress?.(item)}
                            onLayout={(event) => handleItemLayout(item, event)}
                            onReplyPreviewPress={onReplyPreviewPress}
                            isArabic={isArabic}
                            isHighlighted={isHighlighted}
                        />
                    );
                }

                const isMine = item.side === "me";
                const isHighlighted = isHighlightedMessage(item, highlightedMessageId);

                return (
                    <View
                        key={item.id}
                        onLayout={(event) => handleItemLayout(item, event)}
                        style={[
                            styles.messageRow,
                            isMine ? styles.myMessageRow : styles.employeeMessageRow,
                        ]}
                    >
                        <TouchableOpacity
                            activeOpacity={0.9}
                            delayLongPress={260}
                            onLongPress={() => onMessageLongPress?.(item)}
                            style={[
                                styles.bubble,
                                isCompactScreen && styles.bubbleCompact,
                                {
                                    backgroundColor: isMine
                                        ? colors.myBubble
                                        : colors.employeeBubble,
                                    borderColor: isHighlighted
                                        ? colors.primary || colors.blue
                                        : colors.border,
                                    borderWidth: isHighlighted ? 2 : 1,
                                },
                            ]}
                        >
                            {!!item.replyToMessage && (
                                <MessageReplyPreview
                                    message={item.replyToMessage}
                                    ownerMessage={item}
                                    colors={colors}
                                    tr={tr}
                                    isArabic={isArabic}
                                    onPress={onReplyPreviewPress}
                                />
                            )}

                            <Text
                                style={[
                                    styles.messageText,
                                    isCompactScreen && styles.messageTextCompact,
                                    { color: colors.text },
                                    getMessageTextDirectionStyle(item.text, isArabic),
                                ]}
                            >
                                {item.text}
                            </Text>

                            <View style={styles.messageMetaRow}>
                                <Text style={[styles.timeText, { color: colors.muted }]}>
                                    {displayTime}
                                </Text>

                                {isMine && (
                                    <MessageStatusIcon
                                        item={item}
                                        colors={colors}
                                    />
                                )}
                            </View>
                        </TouchableOpacity>
                    </View>
                );
            })}
        </ScrollView>
    );
}


function MessageReplyPreview({
    message,
    ownerMessage,
    colors,
    tr,
    isArabic,
    onPress,
}) {
    const previewText = getReplyPreviewText(message, tr);

    return (
        <TouchableOpacity
            activeOpacity={0.78}
            onPress={() => onPress?.(message, ownerMessage)}
            style={[
                styles.messageReplyPreview,
                {
                    backgroundColor: colors.cardSoft,
                    borderLeftColor: colors.primary || colors.blue,
                },
            ]}
        >
            <Text
                style={[
                    styles.messageReplyPreviewTitle,
                    { color: colors.primary || colors.blue },
                ]}
                numberOfLines={1}
            >
                {tr("replyingTo", "Replying to message")}
            </Text>

            <Text
                style={[
                    styles.messageReplyPreviewText,
                    { color: colors.text },
                    getMessageTextDirectionStyle(previewText, isArabic),
                ]}
                numberOfLines={1}
            >
                {previewText}
            </Text>
        </TouchableOpacity>
    );
}

function DocumentMessage({
    item,
    colors,
    isCompactScreen,
    tr,
    time,
    onOpen,
    onLongPress,
    onLayout,
    onReplyPreviewPress,
    isArabic,
    isHighlighted = false,
}) {
    const isMine = item.side === "me";
    const fileName = getDocumentFileName(item, tr);
    const mimeType = getDocumentMimeType(item);
    const fileSizeText = formatFileSize(getDocumentSize(item));
    const fileIconName = getFileIconName(mimeType, fileName);

    return (
        <View
            onLayout={onLayout}
            style={[
                styles.messageRow,
                isMine ? styles.myMessageRow : styles.employeeMessageRow,
            ]}
        >
            <View
                style={[
                    styles.documentBubble,
                    isCompactScreen && styles.documentBubbleCompact,
                    item.replyToMessage && styles.messageBubbleWithReply,
                    {
                        backgroundColor: isMine ? colors.myBubble : colors.employeeBubble,
                        borderColor: isHighlighted
                            ? colors.primary || colors.blue
                            : colors.border,
                        borderWidth: isHighlighted ? 2 : 1,
                    },
                ]}
            >
                {!!item.replyToMessage && (
                    <MessageReplyPreview
                        message={item.replyToMessage}
                        ownerMessage={item}
                        colors={colors}
                        tr={tr}
                        isArabic={isArabic}
                        onPress={onReplyPreviewPress}
                    />
                )}

                <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={onOpen}
                    delayLongPress={260}
                    onLongPress={onLongPress}
                    style={styles.documentMainRow}
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
                            style={[
                                styles.documentName,
                                { color: colors.text },
                                getMessageTextDirectionStyle(fileName, false),
                            ]}
                            numberOfLines={2}
                        >
                            {fileName}
                        </Text>

                        <Text
                            style={[styles.documentMeta, { color: colors.muted }]}
                            numberOfLines={1}
                        >
                            {fileSizeText || mimeType || tr("file", "File")}
                        </Text>

                        <View style={styles.documentTimeRow}>
                            <Text style={[styles.timeText, { color: colors.muted }]}>
                                {time}
                            </Text>

                            {isMine && (
                                <MessageStatusIcon
                                    item={item}
                                    colors={colors}
                                />
                            )}
                        </View>
                    </View>
                </TouchableOpacity>
            </View>
        </View>
    );
}


const normalizeAudioUri = (uri = "") => {
    const cleanUri = String(uri || "").trim();

    if (!cleanUri) {
        return "";
    }

    if (
        cleanUri.startsWith("http://") ||
        cleanUri.startsWith("https://") ||
        cleanUri.startsWith("file://") ||
        cleanUri.startsWith("content://")
    ) {
        return encodeURI(cleanUri);
    }

    return cleanUri;
};

const getAudioUri = (item) => {
    const attachment = getFirstDocumentAttachment(item);

    return normalizeAudioUri(
        item?.uri ||
        item?.audio?.uri ||
        item?.voice?.uri ||
        item?.url ||
        item?.audio_url ||
        item?.voice_url ||
        item?.file_url ||
        item?.full_url ||
        item?.original_url ||
        item?.path ||
        attachment?.url ||
        attachment?.audio_url ||
        attachment?.voice_url ||
        attachment?.file_url ||
        attachment?.full_url ||
        attachment?.original_url ||
        attachment?.path ||
        attachment?.uri ||
        ""
    );
};

const isRemoteAudioUri = (uri = "") => {
    const cleanUri = String(uri || "").trim().toLowerCase();

    return cleanUri.startsWith("http://") || cleanUri.startsWith("https://");
};

const getSafeAudioCacheName = (item = {}, uri = "") => {
    const attachment = getFirstDocumentAttachment(item);
    const rawName = String(
        item?.fileName ||
        item?.name ||
        item?.filename ||
        attachment?.file_name ||
        attachment?.fileName ||
        attachment?.filename ||
        uri ||
        `voice-message-${Date.now()}.m4a`
    ).split("?")[0];

    const lastPart = rawName.split("/").filter(Boolean).pop() || `voice-message-${Date.now()}.m4a`;
    const decodedName = decodeFileName(lastPart);
    const safeName = decodedName
        .replace(/[^a-zA-Z0-9._-]+/g, "_")
        .replace(/^_+|_+$/g, "");

    if (safeName.includes(".")) {
        return safeName;
    }

    return `${safeName || `voice-message-${Date.now()}`}.m4a`;
};


const getAudioDurationMillisFromStatus = (status = {}) => {
    const durationMillis = Number(
        status?.durationMillis ??
        status?.duration_millis ??
        status?.totalDurationMillis ??
        status?.total_duration_millis ??
        0
    );

    if (Number.isFinite(durationMillis) && durationMillis > 0) {
        return Math.round(durationMillis);
    }

    const durationSeconds = Number(
        status?.duration ?? status?.totalDuration ?? 0
    );

    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
        return 0;
    }

    return Math.round(durationSeconds * 1000);
};

const getAudioDurationMillisFromItem = (item = {}) => {
    const attachment = getFirstDocumentAttachment(item);
    const durationMillis = Number(
        item?.durationMillis ??
        item?.duration_millis ??
        item?.audioDurationMillis ??
        item?.audio_duration_millis ??
        attachment?.durationMillis ??
        attachment?.duration_millis ??
        attachment?.audioDurationMillis ??
        attachment?.audio_duration_millis ??
        0
    );

    if (Number.isFinite(durationMillis) && durationMillis > 0) {
        return Math.round(durationMillis);
    }

    const durationSeconds = Number(
        item?.duration ??
        item?.raw?.duration ??
        attachment?.duration ??
        0
    );

    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
        return 0;
    }

    return Math.round(durationSeconds * 1000);
};

const getPlayableAudioUri = async (item = {}) => {
    const audioUri = getAudioUri(item);

    if (!audioUri) {
        return "";
    }

    if (!isRemoteAudioUri(audioUri)) {
        return audioUri;
    }

    const cacheDirectory = FileSystem.cacheDirectory;

    if (!cacheDirectory) {
        return audioUri;
    }

    const targetUri = `${cacheDirectory}${getSafeAudioCacheName(item, audioUri)}`;

    try {
        const cachedInfo = await FileSystem.getInfoAsync(targetUri);

        if (cachedInfo.exists) {
            return targetUri;
        }

        const downloadResult = await FileSystem.downloadAsync(audioUri, targetUri);

        return downloadResult?.uri || targetUri;
    } catch (error) {
        console.log("Prepare playable audio error:", error);
        return audioUri;
    }
};

let activeAudioController = null;

const getAudioMessageId = (item = {}) => {
    return String(
        getDisplayMessageId(item) ||
        item?.raw?.id ||
        item?.message_id ||
        item?.id ||
        item?.uuid ||
        item?.uri ||
        `audio-${Date.now()}`
    );
};

const pauseAudioPlayerSafely = (player) => {
    if (!player) {
        return;
    }

    try {
        if (typeof player.pause === "function") {
            player.pause();
        }

        if (typeof player.seekTo === "function") {
            player.seekTo(0);
        }
    } catch (error) {
        console.log("Stop active chat audio error:", error);
    }
};

export const stopActiveChatAudioPlayback = () => {
    const controller = activeAudioController;
    activeAudioController = null;

    if (!controller?.stop) {
        return;
    }

    controller.stop();
};

function AudioMessage({
    item,
    colors,
    isCompactScreen,
    tr,
    time,
    onLongPress,
    onLayout,
    onReplyPreviewPress,
    isArabic,
    isHighlighted = false,
}) {
    const isMine = item.side === "me";
    const audioMessageId = getAudioMessageId(item);
    const [playableAudioUri, setPlayableAudioUri] = useState(() => getAudioUri(item));
    const player = useAudioPlayer(playableAudioUri || null);
    const playerStatus = useAudioPlayerStatus(player);
    const isPlaying = !!playerStatus?.playing;
    const itemDurationMillis = getAudioDurationMillisFromItem(item);
    const statusDurationMillis = getAudioDurationMillisFromStatus(playerStatus);
    const durationText = formatAudioDuration(
        itemDurationMillis || statusDurationMillis || 0
    );

    useEffect(() => {
        let isMounted = true;

        const prepareAudio = async () => {
            const nextPlayableUri = await getPlayableAudioUri(item);

            if (isMounted) {
                setPlayableAudioUri(nextPlayableUri);
            }
        };

        prepareAudio();

        return () => {
            isMounted = false;
        };
    }, [item?.id, item?.uri, item?.fileName, item?.raw?.id]);

    useEffect(() => {
        return () => {
            if (activeAudioController?.messageId === audioMessageId) {
                activeAudioController = null;
            }
        };
    }, [audioMessageId]);

    const handleTogglePlayback = () => {
        if (!playableAudioUri || !player) {
            return;
        }

        try {
            if (isPlaying) {
                if (typeof player.pause === "function") {
                    player.pause();
                }

                if (activeAudioController?.messageId === audioMessageId) {
                    activeAudioController = null;
                }

                return;
            }

            if (
                activeAudioController?.stop &&
                activeAudioController.messageId !== audioMessageId
            ) {
                stopActiveChatAudioPlayback();
            }

            activeAudioController = {
                messageId: audioMessageId,
                stop: () => pauseAudioPlayerSafely(player),
            };

            if (typeof player.seekTo === "function") {
                player.seekTo(0);
            }

            if (typeof player.play === "function") {
                player.play();
            }
        } catch (error) {
            if (activeAudioController?.messageId === audioMessageId) {
                activeAudioController = null;
            }

            console.log("Audio playback error:", error);
        }
    };

    return (
        <View
            onLayout={onLayout}
            style={[
                styles.messageRow,
                isMine ? styles.myMessageRow : styles.employeeMessageRow,
            ]}
        >
            <TouchableOpacity
                activeOpacity={0.9}
                delayLongPress={260}
                onLongPress={onLongPress}
                style={[
                    styles.audioBubble,
                    isCompactScreen && styles.audioBubbleCompact,
                    item.replyToMessage && styles.messageBubbleWithReply,
                    {
                        backgroundColor: isMine ? colors.myBubble : colors.employeeBubble,
                        borderColor: isHighlighted
                            ? colors.primary || colors.blue
                            : colors.border,
                        borderWidth: isHighlighted ? 2 : 1,
                    },
                ]}
            >
                {!!item.replyToMessage && (
                    <MessageReplyPreview
                        message={item.replyToMessage}
                        ownerMessage={item}
                        colors={colors}
                        tr={tr}
                        isArabic={isArabic}
                        onPress={onReplyPreviewPress}
                    />
                )}

                <View style={styles.audioMainRow}>
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
                                    {time}
                                </Text>

                                {isMine && (
                                    <MessageStatusIcon
                                        item={item}
                                        colors={colors}
                                    />
                                )}
                            </View>
                        </View>
                    </View>
                </View>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
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

    olderMessagesLoader: {
        minHeight: 38,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        marginBottom: 10,
    },

    olderMessagesLoaderText: {
        fontSize: 12,
        fontWeight: "800",
    },

    messageRow: {
        marginBottom: 10,
        flexDirection: "row",
    },

    highlightedMessageWrapper: {
        borderWidth: 2,
        borderRadius: 20,
        padding: 2,
        marginBottom: 6,
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

    messageBubbleWithReply: {
        flexDirection: "column",
        alignItems: "stretch",
        gap: 8,
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

    messageReplyPreview: {
        marginBottom: 8,
        borderLeftWidth: 4,
        borderRadius: 10,
        paddingVertical: 6,
        paddingHorizontal: 8,
    },

    messageReplyPreviewTitle: {
        fontSize: 11,
        fontWeight: "900",
    },

    messageReplyPreviewText: {
        marginTop: 2,
        fontSize: 12.5,
        fontWeight: "700",
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

    documentMainRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
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

    audioMainRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
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

    timeText: {
        fontSize: 11.5,
    },
});

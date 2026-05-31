import {
    getRowDirectionStyle,
    getTextDirectionStyle,
} from "@/src/styles/globalStyles";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import React from "react";
import MediaMessage from "../components/MediaMessage";

import {
    Platform,
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
    onOpenImage,
    onOpenVideo,
    onOpenDocument,
}) {
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
            onContentSizeChange={onContentSizeChange}
        >
            {messages.map((item) => {
                const displayTime = getLocalizedMessageTime(item.time, tr, isArabic);

                if (item.type === "quote") {
                    return (
                        <QuoteCard
                            key={item.id}
                            colors={colors}
                            tr={tr}
                            time={displayTime}
                            isArabic={isArabic}
                            isCompactScreen={isCompactScreen}
                        />
                    );
                }

                if (item.type === "image" || item.type === "video") {
                    return (
                        <MediaMessage
                            key={item.id}
                            item={item}
                            colors={colors}
                            isCompactScreen={isCompactScreen}
                            mediaWidth={imageMessageWidth}
                            mediaHeight={imageMessageHeight}
                            time={displayTime}
                            onOpen={() => {
                                if (item.type === "image") {
                                    onOpenImage(item);
                                    return;
                                }

                                onOpenVideo(item);
                            }}
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
                            time={displayTime}
                            onOpen={() => onOpenDocument(item)}
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
                            time={displayTime}
                        />
                    );
                }

                const isMine = item.side === "me";

                return (
                    <View
                        key={item.id}
                        style={[
                            styles.messageRow,
                            isMine ? styles.myMessageRow : styles.employeeMessageRow,
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
                                <Text style={[styles.timeText, { color: colors.muted }]}>
                                    {displayTime}
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
    );
}


function DocumentMessage({ item, colors, isCompactScreen, tr, time, onOpen }) {
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
                            {time}
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

function AudioMessage({ item, colors, isCompactScreen, tr, time }) {
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
                                {time}
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
});

//MICrephone
import { getTextInputDirectionFromValue } from "@/src/styles/globalStyles";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

const RTL_TEXT_REGEX = /[\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC]/;
const LTR_TEXT_REGEX = /[A-Za-z]/;

const getComposerTextDirectionStyle = (value = "", fallbackIsArabic = false) => {
    const cleanValue = String(value || "").trim();

    if (!cleanValue) {
        return {
            textAlign: fallbackIsArabic ? "right" : "left",
            writingDirection: fallbackIsArabic ? "rtl" : "ltr",
        };
    }

    for (const char of cleanValue) {
        if (RTL_TEXT_REGEX.test(char)) {
            return { textAlign: "right", writingDirection: "rtl" };
        }

        if (LTR_TEXT_REGEX.test(char)) {
            return { textAlign: "left", writingDirection: "ltr" };
        }
    }

    return {
        textAlign: fallbackIsArabic ? "right" : "left",
        writingDirection: fallbackIsArabic ? "rtl" : "ltr",
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

export default function IndividualChatComposer({
    colors,
    tr,
    isArabic,
    isCompactScreen,
    messageText,
    onChangeMessageText,
    onTyping,
    isRecordingVoice,
    recordingDurationText,
    hasMessage,
    insetsBottom,
    androidKeyboardSpace,
    onOpenAttachMenu,
    onTakePhoto,
    onSend,
    onMicPress,
    onFocusInput,
    replyingToMessage,
    onCancelReply,

    // Block / permission guard props.
    // Keep multiple names supported so the screen file can pass any one of them
    // without breaking this component.
    isBlocked = false,
    isChatInputDisabled = false,
    isComposerDisabled = false,
    canSendMessage = true,
    disabledMessage,
    blockMessage,
}) {
    const replyPreviewText = getReplyPreviewText(replyingToMessage, tr);
    const composerDisabled =
        isBlocked === true ||
        isChatInputDisabled === true ||
        isComposerDisabled === true ||
        canSendMessage === false;

    const disabledText =
        disabledMessage ||
        blockMessage ||
        (isBlocked
            ? tr(
                "blockedComposerMessage",
                isArabic
                    ? "هذه المحادثة محظورة، لا يمكنك إرسال رسائل."
                    : "This conversation is blocked. You cannot send messages."
            )
            : tr(
                "cannotSendComposerMessage",
                isArabic
                    ? "لا يمكنك إرسال رسائل في هذه المحادثة."
                    : "You cannot send messages in this conversation."
            ));

    const handleChangeText = (text) => {
        if (composerDisabled) {
            return;
        }

        onChangeMessageText?.(text);
        onTyping?.(text);
    };

    const handleAttachPress = () => {
        if (composerDisabled) {
            return;
        }

        onOpenAttachMenu?.();
    };

    const handleCameraPress = () => {
        if (composerDisabled) {
            return;
        }

        onTakePhoto?.();
    };

    const handleActionPress = () => {
        if (composerDisabled) {
            return;
        }

        if (hasMessage && !isRecordingVoice) {
            onSend?.();
            return;
        }

        onMicPress?.();
    };

    return (
        <View
            style={[
                styles.composerContainer,
                {
                    borderTopColor: colors.border,
                    backgroundColor: colors.navScrolled,
                    paddingBottom:
                        Platform.OS === "ios" ? Math.max(insetsBottom, 8) : 8,
                    marginBottom: androidKeyboardSpace,
                },
            ]}
        >
            {composerDisabled && (
                <View
                    style={[
                        styles.blockedBanner,
                        isCompactScreen && styles.blockedBannerCompact,
                        {
                            backgroundColor: colors.cardSoft,
                            borderColor: colors.border,
                        },
                    ]}
                >
                    <Ionicons
                        name="lock-closed-outline"
                        size={17}
                        color={colors.danger || colors.muted}
                    />

                    <Text
                        style={[
                            styles.blockedBannerText,
                            { color: colors.danger || colors.text },
                            getComposerTextDirectionStyle(disabledText, isArabic),
                        ]}
                        numberOfLines={2}
                    >
                        {disabledText}
                    </Text>
                </View>
            )}

            {!!replyingToMessage && !composerDisabled && (
                <View
                    style={[
                        styles.replyPreviewWrapper,
                        isCompactScreen && styles.replyPreviewWrapperCompact,
                        {
                            backgroundColor: colors.cardSoft,
                            borderColor: colors.border,
                        },
                    ]}
                >
                    <View
                        style={[
                            styles.replyPreviewAccent,
                            { backgroundColor: colors.primary || colors.blue },
                        ]}
                    />

                    <View style={styles.replyPreviewContent}>
                        <Text
                            style={[styles.replyPreviewTitle, { color: colors.primary || colors.blue }]}
                            numberOfLines={1}
                        >
                            {tr("replyingTo", "Replying to message")}
                        </Text>

                        <Text
                            style={[
                                styles.replyPreviewText,
                                { color: colors.text },
                                getComposerTextDirectionStyle(replyPreviewText, isArabic),
                            ]}
                            numberOfLines={1}
                        >
                            {replyPreviewText}
                        </Text>
                    </View>

                    <TouchableOpacity
                        style={styles.replyPreviewCloseButton}
                        activeOpacity={0.8}
                        onPress={onCancelReply}
                    >
                        <Ionicons name="close" size={20} color={colors.muted} />
                    </TouchableOpacity>
                </View>
            )}

            <View
                style={[
                    styles.composerWrapper,
                    isCompactScreen && styles.composerWrapperCompact,
                    composerDisabled && styles.composerWrapperDisabled,
                ]}
            >
                <TouchableOpacity
                    style={[
                        styles.attachButton,
                        composerDisabled && styles.disabledControl,
                    ]}
                    activeOpacity={0.8}
                    onPress={handleAttachPress}
                    disabled={composerDisabled}
                >
                    <Ionicons
                        name="attach"
                        size={27}
                        color={composerDisabled ? colors.muted : colors.text}
                    />
                </TouchableOpacity>

                <View
                    style={[
                        styles.inputWrapper,
                        isCompactScreen && styles.inputWrapperCompact,
                        composerDisabled && styles.inputWrapperDisabled,
                        {
                            backgroundColor: composerDisabled
                                ? colors.cardSoft
                                : colors.input,
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
                            onChangeText={handleChangeText}
                            onFocus={composerDisabled ? undefined : onFocusInput}
                            placeholder={
                                composerDisabled
                                    ? tr(
                                        "inputBlockedPlaceholder",
                                        isArabic ? "إرسال الرسائل غير متاح" : "Messaging unavailable"
                                    )
                                    : tr("inputPlaceholder", "Type a message...")
                            }
                            placeholderTextColor={colors.muted}
                            style={[
                                styles.input,
                                isCompactScreen && styles.inputCompact,
                                { color: composerDisabled ? colors.muted : colors.text },
                                getTextInputDirectionFromValue(messageText, isArabic),
                            ]}
                            multiline
                            scrollEnabled
                            editable={!composerDisabled}
                        />
                    )}

                    {!isRecordingVoice && (
                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={handleCameraPress}
                            disabled={composerDisabled}
                            style={composerDisabled && styles.disabledControl}
                        >
                            <Ionicons
                                name="camera-outline"
                                size={25}
                                color={composerDisabled ? colors.muted : colors.text}
                            />
                        </TouchableOpacity>
                    )}
                </View>

                <TouchableOpacity
                    style={[
                        styles.actionButton,
                        isCompactScreen && styles.actionButtonCompact,
                        composerDisabled && styles.actionButtonDisabled,
                        {
                            backgroundColor: composerDisabled
                                ? colors.border
                                : isRecordingVoice
                                    ? colors.danger
                                    : hasMessage
                                        ? colors.blue
                                        : colors.primary,
                        },
                    ]}
                    activeOpacity={0.85}
                    onPress={handleActionPress}
                    disabled={composerDisabled}
                    accessibilityLabel={
                        composerDisabled
                            ? tr("messagingUnavailable", "Messaging unavailable")
                            : isRecordingVoice
                                ? tr("stopRecording", "Stop recording")
                                : hasMessage
                                    ? tr("send", "Send")
                                    : tr("recordVoiceMessage", "Record voice message")
                    }
                >
                    <Ionicons
                        name={composerDisabled ? "lock-closed" : isRecordingVoice ? "stop" : hasMessage ? "send" : "mic"}
                        size={isCompactScreen ? 20 : 22}
                        color="#FFFFFF"
                    />
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    composerContainer: {
        borderTopWidth: 1,
    },

    blockedBanner: {
        marginHorizontal: 14,
        marginTop: 8,
        borderWidth: 1,
        borderRadius: 16,
        paddingVertical: 9,
        paddingHorizontal: 11,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },

    blockedBannerCompact: {
        marginHorizontal: 10,
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderRadius: 14,
    },

    blockedBannerText: {
        flex: 1,
        minWidth: 0,
        fontSize: 13,
        lineHeight: 18,
        fontWeight: "800",
    },

    composerWrapper: {
        paddingHorizontal: 14,
        paddingTop: 8,
        flexDirection: "row",
        alignItems: "flex-end",
        gap: 8,
    },

    composerWrapperDisabled: {
        opacity: 0.95,
    },

    composerWrapperCompact: {
        paddingHorizontal: 10,
        gap: 6,
    },

    replyPreviewWrapper: {
        marginHorizontal: 14,
        marginTop: 8,
        borderWidth: 1,
        borderRadius: 16,
        paddingVertical: 8,
        paddingHorizontal: 10,
        flexDirection: "row",
        alignItems: "center",
        gap: 9,
    },

    replyPreviewWrapperCompact: {
        marginHorizontal: 10,
        borderRadius: 14,
        paddingVertical: 7,
        paddingHorizontal: 9,
    },

    replyPreviewAccent: {
        width: 4,
        alignSelf: "stretch",
        borderRadius: 999,
    },

    replyPreviewContent: {
        flex: 1,
        minWidth: 0,
    },

    replyPreviewTitle: {
        fontSize: 12,
        fontWeight: "900",
    },

    replyPreviewText: {
        marginTop: 2,
        fontSize: 13,
        fontWeight: "700",
    },

    replyPreviewCloseButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
    },

    attachButton: {
        width: 40,
        minHeight: 46,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
    },

    disabledControl: {
        opacity: 0.55,
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

    inputWrapperDisabled: {
        opacity: 0.9,
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

    actionButtonDisabled: {
        opacity: 0.75,
    },

    actionButtonCompact: {
        width: 46,
        height: 46,
        borderRadius: 23,
    },
});

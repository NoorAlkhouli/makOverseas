//MICrephone
import { getWritingDirectionStyle } from "@/src/styles/globalStyles";
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

export default function IndividualChatComposer({
    colors,
    tr,
    isArabic,
    isCompactScreen,
    messageText,
    onChangeMessageText,
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
}) {
    return (
        <View
            style={[
                styles.composerWrapper,
                isCompactScreen && styles.composerWrapperCompact,
                {
                    borderTopColor: colors.border,
                    backgroundColor: colors.navScrolled,
                    paddingBottom:
                        Platform.OS === "ios" ? Math.max(insetsBottom, 8) : 8,
                    marginBottom: androidKeyboardSpace,
                },
            ]}
        >
            <TouchableOpacity
                style={styles.attachButton}
                activeOpacity={0.8}
                onPress={onOpenAttachMenu}
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
                        onChangeText={onChangeMessageText}
                        onFocus={onFocusInput}
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
                        onPress={onTakePhoto}
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
                onPress={hasMessage && !isRecordingVoice ? onSend : onMicPress}
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
    );
}

const styles = StyleSheet.create({
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
});

import { Ionicons } from "@expo/vector-icons";
import { useVideoPlayer, VideoView } from "expo-video";
import {
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

function VideoThumbnail({ uri, style }) {
    const player = useVideoPlayer(uri ? { uri } : null, (playerInstance) => {
        playerInstance.loop = false;
        playerInstance.muted = true;
    });

    return (
        <VideoView
            player={player}
            style={style}
            nativeControls={false}
            contentFit="cover"
            fullscreenOptions={{ enable: false }}
            allowsPictureInPicture={false}
            surfaceType="textureView"
        />
    );
}

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

function MessageStatusIcon({ item, colors }) {
    const sendState = getMessageSendState(item);

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

    return (
        <Ionicons
            name="checkmark-done"
            size={15}
            color={colors.blue}
        />
    );
}

export default function MediaMessage({
    item,
    colors,
    isCompactScreen,
    mediaWidth,
    mediaHeight,
    time,
    onOpen,
}) {
    const isMine = item.side === "me";
    const isVideo = item.type === "video";
    const videoUri =
        item.uri ||
        item.video?.uri ||
        item.videoUrl ||
        item.video_url ||
        item.url ||
        null;

    const imageSource = item.image || (item.uri ? { uri: item.uri } : null);

    const handleOpenMedia = () => {
        onOpen?.(item);
    };

    return (
        <View
            style={[
                styles.messageRow,
                isMine ? styles.myMessageRow : styles.employeeMessageRow,
            ]}
        >
            <TouchableOpacity
                activeOpacity={0.9}
                onPress={handleOpenMedia}
                style={[
                    styles.mediaBubble,
                    isCompactScreen && styles.mediaBubbleCompact,
                    {
                        width: mediaWidth,
                        backgroundColor: isMine ? colors.myBubble : colors.employeeBubble,
                        borderColor: colors.border,
                    },
                ]}
            >
                <View style={styles.mediaWrapper}>
                    {isVideo ? (
                        <>
                            <VideoThumbnail
                                uri={videoUri}
                                style={[
                                    styles.chatMedia,
                                    {
                                        width: mediaWidth - 10,
                                        height: mediaHeight,
                                    },
                                ]}
                            />

                            <View style={styles.videoPlayOverlay} pointerEvents="none">
                                <View style={styles.videoPlayCircle}>
                                    <Ionicons
                                        name="play"
                                        size={24}
                                        color="#ffffff"
                                    />
                                </View>
                            </View>
                        </>
                    ) : (
                        <Image
                            source={imageSource}
                            style={[
                                styles.chatMedia,
                                {
                                    width: mediaWidth - 10,
                                    height: mediaHeight,
                                },
                            ]}
                            resizeMode="cover"
                        />
                    )}
                </View>

                {!!item.caption && (
                    <Text
                        style={[
                            styles.mediaCaption,
                            { color: colors.text },
                        ]}
                        numberOfLines={2}
                    >
                        {item.caption}
                    </Text>
                )}

                <View style={styles.mediaMetaRow}>
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
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
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

    mediaBubble: {
        borderWidth: 1,
        borderRadius: 18,
        padding: 5,
        overflow: "hidden",
    },

    mediaBubbleCompact: {
        borderRadius: 16,
    },

    mediaWrapper: {
        position: "relative",
    },

    chatMedia: {
        borderRadius: 14,
        backgroundColor: "#000000",
        overflow: "hidden",
    },

    videoPlayOverlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: "center",
        justifyContent: "center",
    },

    videoPlayCircle: {
        width: 54,
        height: 54,
        borderRadius: 27,
        backgroundColor: "rgba(0, 0, 0, 0.48)",
        alignItems: "center",
        justifyContent: "center",
        paddingLeft: 3,
    },

    mediaCaption: {
        marginTop: 7,
        paddingHorizontal: 6,
        fontSize: 13.5,
        fontWeight: "600",
        lineHeight: 19,
    },

    mediaMetaRow: {
        marginTop: 5,
        paddingHorizontal: 6,
        paddingBottom: 2,
        flexDirection: "row",
        justifyContent: "flex-end",
        alignItems: "center",
        gap: 4,
    },

    timeText: {
        fontSize: 11.5,
    },
});
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useEvent } from "expo";
import * as FileSystem from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library";
import { StatusBar } from "expo-status-bar";
import { useVideoPlayer, VideoView } from "expo-video";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    Alert,
    PanResponder,
    PixelRatio,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { captureRef } from "react-native-view-shot";
import { FFmpegKit, ReturnCode } from "ffmpeg-kit-react-native";

const DRAW_COLORS = ["#FFFFFF", "#22C55E", "#38BDF8", "#F97316", "#EF4444"];
const DRAW_WIDTH = 7;

const formatVideoTime = (seconds = 0) => {
    const totalSeconds = Math.max(0, Math.floor(seconds || 0));
    const minutes = Math.floor(totalSeconds / 60);
    const remainingSeconds = totalSeconds % 60;

    return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
};

const getVideoUri = (mediaItem, video) => {
    if (video?.uri) return video.uri;
    if (mediaItem?.video?.uri) return mediaItem.video.uri;
    if (mediaItem?.uri) return mediaItem.uri;
    return null;
};

const cleanFilePath = (uri = "") => String(uri || "").replace(/^file:\/\//, "");

const quotePath = (uri = "") => `"${cleanFilePath(uri).replace(/"/g, "\\\"")}"`;

const getCleanFileName = (fileName = "video") =>
    String(fileName || "video")
        .replace(/\.[^/.]+$/, "")
        .replace(/[^\w.-]+/g, "_");

const getOutputUri = (mediaItem) => {
    const baseName = getCleanFileName(mediaItem?.fileName || `video-${Date.now()}`);
    return `${FileSystem.cacheDirectory}${baseName}-edited-${Date.now()}.mp4`;
};

const getCropFilter = (cropRatio) => {
    if (cropRatio === "square") {
        return "crop=min(iw\\,ih):min(iw\\,ih)";
    }

    if (cropRatio === "portrait") {
        return "crop='if(gt(iw/ih,0.8),ih*0.8,iw)':'if(gt(iw/ih,0.8),ih,iw/0.8)'";
    }

    if (cropRatio === "landscape") {
        return "crop='if(gt(iw/ih,1.7777778),ih*1.7777778,iw)':'if(gt(iw/ih,1.7777778),ih,iw/1.7777778)'";
    }

    return null;
};

const buildVideoFilters = ({ cropRatio, isHdEnabled, hasDrawing }) => {
    const baseFilters = [];
    const cropFilter = getCropFilter(cropRatio);

    if (cropFilter) {
        baseFilters.push(cropFilter);
    }

    if (!isHdEnabled) {
        baseFilters.push("scale='min(1280,iw)':-2");
    }

    if (!hasDrawing) {
        return baseFilters.length ? baseFilters.join(",") : null;
    }

    const normalizedBaseFilters = baseFilters.length ? baseFilters.join(",") : "null";

    return `[0:v]${normalizedBaseFilters}[base];[1:v][base]scale2ref[overlay][video];[video][overlay]overlay=0:0:format=auto[v]`;
};

function ToolButton({ icon, active, disabled, onPress, children }) {
    return (
        <TouchableOpacity
            style={[
                styles.toolButton,
                active && styles.toolButtonActive,
                disabled && styles.toolButtonDisabled,
            ]}
            activeOpacity={0.85}
            disabled={disabled}
            onPress={onPress}
        >
            {children || <Ionicons name={icon} size={24} color="#ffffff" />}
        </TouchableOpacity>
    );
}

function CropPill({ label, active, onPress }) {
    return (
        <TouchableOpacity
            style={[styles.cropPill, active && styles.cropPillActive]}
            activeOpacity={0.85}
            onPress={onPress}
        >
            <Text style={[styles.cropPillText, active && styles.cropPillTextActive]}>
                {label}
            </Text>
        </TouchableOpacity>
    );
}

function DrawPoint({ point, color, size }) {
    return (
        <View
            style={[
                styles.drawPoint,
                {
                    left: point.x - size / 2,
                    top: point.y - size / 2,
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    backgroundColor: color,
                },
            ]}
        />
    );
}

function DrawSegment({ from, to, color, width }) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);

    if (length < 1) {
        return <DrawPoint point={from} color={color} size={width} />;
    }

    return (
        <View
            style={[
                styles.drawSegment,
                {
                    left: from.x,
                    top: from.y - width / 2,
                    width: length,
                    height: width,
                    borderRadius: width / 2,
                    backgroundColor: color,
                    transform: [{ rotateZ: `${angle}rad` }],
                },
            ]}
        />
    );
}

function DrawingOverlay({ paths }) {
    return (
        <View pointerEvents="none" style={styles.drawDisplayLayer}>
            {paths.map((path, pathIndex) => {
                if (path.points.length === 1) {
                    return (
                        <DrawPoint
                            key={`draw-point-${pathIndex}`}
                            point={path.points[0]}
                            color={path.color}
                            size={path.width}
                        />
                    );
                }

                return path.points.slice(1).map((point, index) => (
                    <DrawSegment
                        key={`draw-line-${pathIndex}-${index}`}
                        from={path.points[index]}
                        to={point}
                        color={path.color}
                        width={path.width}
                    />
                ));
            })}
        </View>
    );
}

export default function VideoMediaEditor({
    visible,
    mediaItem,
    video,
    caption,
    colors,
    tr,
    onCancel,
    onSend,
}) {
    const insets = useSafeAreaInsets();
    const { width: screenWidth, height: screenHeight } = useWindowDimensions();
    const videoUri = getVideoUri(mediaItem, video);
    const source = videoUri ? { uri: videoUri } : null;
    const videoCanvasRef = useRef(null);
    const overlayRef = useRef(null);

    const [isHdEnabled, setIsHdEnabled] = useState(true);
    const [isCropMode, setIsCropMode] = useState(false);
    const [cropRatio, setCropRatio] = useState("original");
    const [isDrawMode, setIsDrawMode] = useState(false);
    const [drawColor, setDrawColor] = useState(DRAW_COLORS[0]);
    const [paths, setPaths] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        if (!visible) return;
        setIsHdEnabled(true);
        setIsCropMode(false);
        setCropRatio("original");
        setIsDrawMode(false);
        setPaths([]);
    }, [visible, videoUri]);

    const player = useVideoPlayer(source, (playerInstance) => {
        playerInstance.loop = true;
        playerInstance.muted = false;
        playerInstance.timeUpdateEventInterval = 0.25;
    });

    const { isPlaying } = useEvent(player, "playingChange", {
        isPlaying: player.playing,
    });

    const { currentTime } = useEvent(player, "timeUpdate", {
        currentTime: player.currentTime || 0,
    });

    const duration = Number(player.duration || 0);
    const progress = duration > 0 ? Math.min((currentTime || 0) / duration, 1) : 0;

    const topHeight = insets.top + 102;
    const bottomHeight = Math.max(insets.bottom, 12) + 154;
    const mediaAreaHeight = Math.max(260, screenHeight - topHeight - bottomHeight);

    const displaySize = useMemo(() => {
        return {
            width: Math.max(1, screenWidth),
            height: Math.max(1, mediaAreaHeight),
        };
    }, [mediaAreaHeight, screenWidth]);

    const panResponder = useMemo(
        () =>
            PanResponder.create({
                onStartShouldSetPanResponder: () => isDrawMode,
                onMoveShouldSetPanResponder: () => isDrawMode,
                onPanResponderGrant: (event) => {
                    if (!isDrawMode) return;

                    const { locationX, locationY } = event.nativeEvent;
                    setPaths((prev) => [
                        ...prev,
                        {
                            color: drawColor,
                            width: DRAW_WIDTH,
                            points: [
                                {
                                    x: Math.max(0, Math.min(locationX, displaySize.width)),
                                    y: Math.max(0, Math.min(locationY, displaySize.height)),
                                },
                            ],
                        },
                    ]);
                },
                onPanResponderMove: (event) => {
                    if (!isDrawMode) return;

                    const { locationX, locationY } = event.nativeEvent;
                    setPaths((prev) => {
                        if (!prev.length) return prev;

                        const nextPaths = [...prev];
                        const lastPath = nextPaths[nextPaths.length - 1];

                        nextPaths[nextPaths.length - 1] = {
                            ...lastPath,
                            points: [
                                ...lastPath.points,
                                {
                                    x: Math.max(0, Math.min(locationX, displaySize.width)),
                                    y: Math.max(0, Math.min(locationY, displaySize.height)),
                                },
                            ],
                        };

                        return nextPaths;
                    });
                },
            }),
        [displaySize.height, displaySize.width, drawColor, isDrawMode]
    );

    const togglePlayback = () => {
        if (isPlaying) {
            player.pause();
            return;
        }

        player.play();
    };

    const buildEditedVideo = async () => {
        if (!videoUri) return mediaItem;

        const hasDrawing = paths.length > 0;
        const needsProcessing = hasDrawing || cropRatio !== "original" || !isHdEnabled;

        if (!needsProcessing) {
            return mediaItem;
        }

        let overlayUri = null;

        if (hasDrawing) {
            const pixelRatio = PixelRatio.get();
            overlayUri = await captureRef(overlayRef, {
                result: "tmpfile",
                format: "png",
                quality: 1,
                width: Math.round(displaySize.width * pixelRatio),
                height: Math.round(displaySize.height * pixelRatio),
            });
        }

        const outputUri = getOutputUri(mediaItem);
        const filters = buildVideoFilters({ cropRatio, isHdEnabled, hasDrawing });
        const crf = isHdEnabled ? 18 : 26;
        const audioArgs = "-map 0:a? -c:a aac -b:a 128k";
        const videoArgs = `-c:v libx264 -preset veryfast -crf ${crf} -pix_fmt yuv420p -movflags +faststart`;

        let command;

        if (hasDrawing) {
            command = `-y -i ${quotePath(videoUri)} -i ${quotePath(overlayUri)} -filter_complex "${filters}" -map "[v]" ${audioArgs} ${videoArgs} ${quotePath(outputUri)}`;
        } else if (filters) {
            command = `-y -i ${quotePath(videoUri)} -vf "${filters}" -map 0:v:0 ${audioArgs} ${videoArgs} ${quotePath(outputUri)}`;
        } else {
            command = `-y -i ${quotePath(videoUri)} -map 0:v:0 ${audioArgs} ${videoArgs} ${quotePath(outputUri)}`;
        }

        const session = await FFmpegKit.execute(command);
        const returnCode = await session.getReturnCode();

        if (!ReturnCode.isSuccess(returnCode)) {
            const logs = await session.getAllLogsAsString();
            throw new Error(logs || "FFmpeg video processing failed.");
        }

        return {
            ...mediaItem,
            id: `${Date.now()}-edited-video`,
            type: "video",
            uri: outputUri,
            video: { uri: outputUri },
            image: undefined,
            fileName: `${getCleanFileName(mediaItem?.fileName || "video")}-edited.mp4`,
            mimeType: "video/mp4",
            isHd: isHdEnabled,
            cropRatio,
            hasDrawing,
        };
    };

    const handleSave = async () => {
        try {
            if (isProcessing) return;

            setIsProcessing(true);
            player.pause();

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

            const finalVideo = await buildEditedVideo();

            if (!finalVideo?.uri) return;

            await MediaLibrary.saveToLibraryAsync(finalVideo.uri);

            Alert.alert(
                tr("saved", "Saved"),
                tr("videoSavedMessage", "Video saved to your device.")
            );
        } catch (error) {
            console.log("Save edited video error:", error);

            Alert.alert(
                tr("errorTitle", "Something went wrong"),
                tr("saveMediaError", "Could not save the media. Please try again.")
            );
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSend = async () => {
        try {
            if (isProcessing) return;

            setIsProcessing(true);
            player.pause();

            const finalVideo = await buildEditedVideo();
            onSend(finalVideo);
        } catch (error) {
            console.log("Prepare video before send error:", error);

            Alert.alert(
                tr("errorTitle", "Something went wrong"),
                tr("prepareVideoError", "Could not prepare the video. Please try again.")
            );
        } finally {
            setIsProcessing(false);
        }
    };

    const handleUndoDraw = () => {
        setPaths((prev) => prev.slice(0, -1));
    };

    return (
        <View style={styles.root}>
            <StatusBar style="light" translucent backgroundColor="transparent" />

            <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
                <ToolButton icon="close" disabled={isProcessing} onPress={onCancel} />

                <View style={styles.topActions}>
                    <ToolButton
                        icon="download-outline"
                        disabled={isProcessing}
                        onPress={handleSave}
                    />

                    <ToolButton
                        active={isHdEnabled}
                        disabled={isProcessing}
                        onPress={() => setIsHdEnabled((prev) => !prev)}
                    >
                        <Text style={styles.hdText}>HD</Text>
                    </ToolButton>

                    <ToolButton
                        icon="crop-outline"
                        active={isCropMode}
                        disabled={isProcessing}
                        onPress={() => {
                            setIsCropMode((prev) => !prev);
                            setIsDrawMode(false);
                        }}
                    />

                    <ToolButton
                        icon="create-outline"
                        active={isDrawMode}
                        disabled={isProcessing}
                        onPress={() => {
                            setIsDrawMode((prev) => !prev);
                            setIsCropMode(false);
                        }}
                    />
                </View>
            </View>

            {isCropMode && (
                <View style={[styles.cropPanel, { top: insets.top + 82 }]}>
                    <CropPill
                        label={tr("original", "Original")}
                        active={cropRatio === "original"}
                        onPress={() => setCropRatio("original")}
                    />
                    <CropPill
                        label="1:1"
                        active={cropRatio === "square"}
                        onPress={() => setCropRatio("square")}
                    />
                    <CropPill
                        label="4:5"
                        active={cropRatio === "portrait"}
                        onPress={() => setCropRatio("portrait")}
                    />
                    <CropPill
                        label="16:9"
                        active={cropRatio === "landscape"}
                        onPress={() => setCropRatio("landscape")}
                    />
                </View>
            )}

            {isDrawMode && (
                <View style={[styles.drawPanel, { top: insets.top + 82 }]}>
                    {DRAW_COLORS.map((color) => (
                        <TouchableOpacity
                            key={color}
                            style={[
                                styles.colorDot,
                                { backgroundColor: color },
                                drawColor === color && styles.colorDotActive,
                            ]}
                            activeOpacity={0.85}
                            onPress={() => setDrawColor(color)}
                        />
                    ))}

                    <TouchableOpacity
                        style={styles.undoButton}
                        activeOpacity={0.85}
                        onPress={handleUndoDraw}
                        disabled={!paths.length}
                    >
                        <Ionicons name="arrow-undo" size={18} color="#ffffff" />
                        <Text style={styles.undoText}>{tr("undo", "Undo")}</Text>
                    </TouchableOpacity>
                </View>
            )}

            <View style={styles.mediaArea}>
                <View
                    ref={videoCanvasRef}
                    collapsable={false}
                    style={[
                        styles.videoCanvas,
                        {
                            width: displaySize.width,
                            height: displaySize.height,
                        },
                    ]}
                >
                    <VideoView
                        player={player}
                        style={styles.video}
                        nativeControls={false}
                        contentFit="contain"
                        fullscreenOptions={{ enable: false }}
                        allowsPictureInPicture={false}
                        surfaceType="textureView"
                    />

                    <View
                        ref={overlayRef}
                        collapsable={false}
                        pointerEvents="none"
                        style={styles.transparentOverlayCapture}
                    >
                        <DrawingOverlay paths={paths} />
                    </View>

                    <View
                        style={styles.drawTouchLayer}
                        pointerEvents={isDrawMode ? "auto" : "none"}
                        {...panResponder.panHandlers}
                    />

                    {isCropMode && cropRatio !== "original" && (
                        <View style={styles.cropGuide} pointerEvents="none">
                            <Text style={styles.cropGuideText}>{cropRatio}</Text>
                        </View>
                    )}

                    <View style={styles.videoControlsCenter} pointerEvents="box-none">
                        <TouchableOpacity
                            style={styles.playButton}
                            activeOpacity={0.9}
                            onPress={togglePlayback}
                            disabled={isProcessing}
                        >
                            <Ionicons
                                name={isPlaying ? "pause" : "play"}
                                size={42}
                                color="#ffffff"
                                style={!isPlaying && styles.playIconOffset}
                            />
                        </TouchableOpacity>
                    </View>

                    {duration > 0 && (
                        <View style={styles.videoProgressPill}>
                            <Text style={styles.videoProgressText}>{formatVideoTime(currentTime)}</Text>
                            <View style={styles.progressTrack}>
                                <View
                                    style={[
                                        styles.progressFill,
                                        { width: `${progress * 100}%` },
                                    ]}
                                />
                            </View>
                            <Text style={styles.videoProgressText}>
                                -{formatVideoTime(Math.max(0, duration - currentTime))}
                            </Text>
                        </View>
                    )}
                </View>
            </View>

            {isProcessing && (
                <View style={styles.processingOverlay}>
                    <MaterialCommunityIcons name="movie-edit" size={34} color="#ffffff" />
                    <Text style={styles.processingText}>
                        {tr("processingVideo", "Processing video...")}
                    </Text>
                </View>
            )}

            <View
                style={[
                    styles.bottomArea,
                    { paddingBottom: Math.max(insets.bottom, 12) + 10 },
                ]}
            >
                <View style={styles.captionInputRow}>
                    <Ionicons
                        name="videocam-outline"
                        size={24}
                        color="rgba(255, 255, 255, 0.86)"
                    />
                    <Text style={styles.captionText} numberOfLines={1}>
                        {caption || mediaItem?.fileName || tr("addCaption", "Add a caption...")}
                    </Text>
                </View>

                <View style={styles.sendRow}>
                    <View style={styles.recipientPill}>
                        <Text style={styles.recipientText}>{tr("you", "You")}</Text>
                    </View>

                    <TouchableOpacity
                        style={[
                            styles.sendCircle,
                            {
                                backgroundColor:
                                    colors?.primary || colors?.green || "#22C55E",
                            },
                        ]}
                        activeOpacity={0.9}
                        disabled={isProcessing}
                        onPress={handleSend}
                    >
                        <Ionicons name="send" size={25} color="#06111F" />
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: "#000000",
    },

    topBar: {
        minHeight: 90,
        paddingHorizontal: 14,
        paddingBottom: 12,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        backgroundColor: "rgba(0, 0, 0, 0.96)",
        zIndex: 30,
    },

    topActions: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 10,
        flexShrink: 1,
    },

    toolButton: {
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: "rgba(255, 255, 255, 0.13)",
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.10)",
        alignItems: "center",
        justifyContent: "center",
    },

    toolButtonActive: {
        backgroundColor: "rgba(34, 197, 94, 0.35)",
        borderColor: "rgba(34, 197, 94, 0.82)",
    },

    toolButtonDisabled: {
        opacity: 0.45,
    },

    hdText: {
        color: "#ffffff",
        fontSize: 12,
        fontWeight: "900",
        borderWidth: 1,
        borderColor: "#ffffff",
        borderRadius: 4,
        paddingHorizontal: 4,
        paddingVertical: 1,
    },

    cropPanel: {
        position: "absolute",
        left: 12,
        right: 12,
        zIndex: 28,
        minHeight: 46,
        borderRadius: 23,
        paddingHorizontal: 8,
        paddingVertical: 6,
        backgroundColor: "rgba(0, 0, 0, 0.74)",
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.12)",
        flexDirection: "row",
        alignItems: "center",
        gap: 7,
    },

    cropPill: {
        minHeight: 34,
        borderRadius: 17,
        paddingHorizontal: 10,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(255, 255, 255, 0.12)",
    },

    cropPillActive: {
        backgroundColor: "#ffffff",
    },

    cropPillText: {
        color: "#ffffff",
        fontSize: 12,
        fontWeight: "900",
    },

    cropPillTextActive: {
        color: "#020B18",
    },

    drawPanel: {
        position: "absolute",
        left: 12,
        right: 12,
        zIndex: 29,
        minHeight: 46,
        borderRadius: 23,
        paddingHorizontal: 10,
        paddingVertical: 6,
        backgroundColor: "rgba(0, 0, 0, 0.74)",
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.12)",
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },

    colorDot: {
        width: 30,
        height: 30,
        borderRadius: 15,
        borderWidth: 2,
        borderColor: "rgba(255, 255, 255, 0.22)",
    },

    colorDotActive: {
        borderColor: "#ffffff",
        transform: [{ scale: 1.12 }],
    },

    undoButton: {
        marginLeft: "auto",
        minHeight: 34,
        borderRadius: 17,
        paddingHorizontal: 12,
        backgroundColor: "rgba(255, 255, 255, 0.14)",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 5,
    },

    undoText: {
        color: "#ffffff",
        fontSize: 12,
        fontWeight: "900",
    },

    mediaArea: {
        flex: 1,
        width: "100%",
        backgroundColor: "#000000",
        alignItems: "center",
        justifyContent: "center",
    },

    videoCanvas: {
        backgroundColor: "#000000",
        overflow: "hidden",
    },

    video: {
        width: "100%",
        height: "100%",
    },

    transparentOverlayCapture: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "transparent",
    },

    drawDisplayLayer: {
        ...StyleSheet.absoluteFillObject,
    },

    drawTouchLayer: {
        ...StyleSheet.absoluteFillObject,
    },

    drawPoint: {
        position: "absolute",
    },

    drawSegment: {
        position: "absolute",
        transformOrigin: "left center",
    },

    cropGuide: {
        position: "absolute",
        left: 24,
        right: 24,
        top: 80,
        bottom: 80,
        borderWidth: 2,
        borderColor: "rgba(255, 255, 255, 0.92)",
        backgroundColor: "rgba(255, 255, 255, 0.04)",
        alignItems: "center",
        justifyContent: "center",
    },

    cropGuideText: {
        color: "#ffffff",
        fontSize: 13,
        fontWeight: "900",
        textTransform: "uppercase",
        backgroundColor: "rgba(0,0,0,0.55)",
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },

    videoControlsCenter: {
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        alignItems: "center",
        justifyContent: "center",
    },

    playButton: {
        width: 82,
        height: 82,
        borderRadius: 41,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0, 0, 0, 0.44)",
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.18)",
    },

    playIconOffset: {
        marginLeft: 4,
    },

    videoProgressPill: {
        position: "absolute",
        left: 24,
        right: 24,
        bottom: 16,
        minHeight: 38,
        borderRadius: 19,
        paddingHorizontal: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        backgroundColor: "rgba(0, 0, 0, 0.58)",
    },

    videoProgressText: {
        color: "#ffffff",
        fontSize: 12,
        fontWeight: "700",
    },

    progressTrack: {
        flex: 1,
        height: 4,
        borderRadius: 2,
        overflow: "hidden",
        backgroundColor: "rgba(255, 255, 255, 0.22)",
    },

    progressFill: {
        height: "100%",
        borderRadius: 2,
        backgroundColor: "#ffffff",
    },

    processingOverlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 80,
        backgroundColor: "rgba(0, 0, 0, 0.65)",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
    },

    processingText: {
        color: "#ffffff",
        fontSize: 16,
        fontWeight: "900",
    },

    bottomArea: {
        paddingHorizontal: 14,
        paddingTop: 12,
        backgroundColor: "rgba(0, 0, 0, 0.96)",
        borderTopWidth: 1,
        borderTopColor: "rgba(255, 255, 255, 0.08)",
        gap: 12,
    },

    captionInputRow: {
        minHeight: 54,
        borderRadius: 27,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.22)",
        backgroundColor: "rgba(255, 255, 255, 0.05)",
        paddingHorizontal: 16,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },

    captionText: {
        flex: 1,
        minWidth: 0,
        color: "#ffffff",
        fontSize: 16,
        fontWeight: "700",
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
        backgroundColor: "rgba(255, 255, 255, 0.14)",
        alignItems: "center",
        justifyContent: "center",
    },

    recipientText: {
        color: "#ffffff",
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

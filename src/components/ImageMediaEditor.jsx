import { Ionicons } from "@expo/vector-icons";
import * as ImageManipulator from "expo-image-manipulator";
import * as MediaLibrary from "expo-media-library";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    Alert,
    Image,
    PanResponder,
    PixelRatio,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from "react-native";
import { captureRef } from "react-native-view-shot";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const DRAW_COLORS = ["#FFFFFF", "#22C55E", "#38BDF8", "#F97316", "#EF4444"];
const DRAW_WIDTH = 7;

const getImageUri = (mediaItem, image) => {
    if (image?.uri) return image.uri;
    if (mediaItem?.image?.uri) return mediaItem.image.uri;
    if (mediaItem?.uri) return mediaItem.uri;
    return null;
};

const getCleanFileName = (fileName = "image") =>
    String(fileName || "image")
        .replace(/\.[^/.]+$/, "")
        .replace(/[^\w.-]+/g, "_");

const getSaveFormat = (uri = "") => {
    const cleanUri = String(uri || "").toLowerCase();

    if (cleanUri.endsWith(".png")) {
        return ImageManipulator.SaveFormat.PNG;
    }

    return ImageManipulator.SaveFormat.JPEG;
};

const getMimeTypeFromFormat = (format) =>
    format === ImageManipulator.SaveFormat.PNG ? "image/png" : "image/jpeg";

const getImageSizeAsync = (uri, fallbackWidth, fallbackHeight) =>
    new Promise((resolve) => {
        if (fallbackWidth && fallbackHeight) {
            resolve({ width: fallbackWidth, height: fallbackHeight });
            return;
        }

        Image.getSize(
            uri,
            (width, height) => resolve({ width, height }),
            () => resolve({ width: fallbackWidth || 1080, height: fallbackHeight || 1080 })
        );
    });

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

export default function ImageMediaEditor({
    visible,
    mediaItem,
    image,
    caption,
    colors,
    tr,
    onCancel,
    onSend,
}) {
    const insets = useSafeAreaInsets();
    const { width: screenWidth, height: screenHeight } = useWindowDimensions();

    const originalUri = getImageUri(mediaItem, image);
    const imageCanvasRef = useRef(null);

    const [currentUri, setCurrentUri] = useState(originalUri);
    const [imageSize, setImageSize] = useState({
        width: mediaItem?.width || 1080,
        height: mediaItem?.height || 1080,
    });
    const [isHdEnabled, setIsHdEnabled] = useState(true);
    const [isCropMode, setIsCropMode] = useState(false);
    const [cropRatio, setCropRatio] = useState("original");
    const [isDrawMode, setIsDrawMode] = useState(false);
    const [drawColor, setDrawColor] = useState(DRAW_COLORS[0]);
    const [paths, setPaths] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        let isMounted = true;

        const prepareImage = async () => {
            if (!visible || !originalUri) return;

            setCurrentUri(originalUri);
            setPaths([]);
            setIsCropMode(false);
            setIsDrawMode(false);
            setCropRatio("original");
            setIsHdEnabled(true);

            const nextSize = await getImageSizeAsync(
                originalUri,
                mediaItem?.width,
                mediaItem?.height
            );

            if (isMounted) {
                setImageSize(nextSize);
            }
        };

        prepareImage();

        return () => {
            isMounted = false;
        };
    }, [visible, originalUri, mediaItem?.width, mediaItem?.height]);

    const topHeight = insets.top + 102;
    const bottomHeight = Math.max(insets.bottom, 12) + 154;
    const mediaAreaHeight = Math.max(260, screenHeight - topHeight - bottomHeight);

    const displaySize = useMemo(() => {
        const maxWidth = screenWidth;
        const maxHeight = mediaAreaHeight;
        const imageAspect = imageSize.width / Math.max(imageSize.height, 1);

        let nextWidth = maxWidth;
        let nextHeight = nextWidth / imageAspect;

        if (nextHeight > maxHeight) {
            nextHeight = maxHeight;
            nextWidth = nextHeight * imageAspect;
        }

        return {
            width: Math.max(1, nextWidth),
            height: Math.max(1, nextHeight),
        };
    }, [screenWidth, mediaAreaHeight, imageSize.width, imageSize.height]);

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

    const buildFinalImageMessage = async () => {
        if (!currentUri) return mediaItem;

        const hasDrawing = paths.length > 0;
        const sourceFormat = getSaveFormat(currentUri);

        if (!hasDrawing) {
            return {
                ...mediaItem,
                type: "image",
                uri: currentUri,
                image: { uri: currentUri },
                width: imageSize.width,
                height: imageSize.height,
                mimeType: getMimeTypeFromFormat(sourceFormat),
                isHd: isHdEnabled,
            };
        }

        const pixelRatio = PixelRatio.get();
        const capturedUri = await captureRef(imageCanvasRef, {
            result: "tmpfile",
            format: "png",
            quality: 1,
            width: Math.round(displaySize.width * pixelRatio),
            height: Math.round(displaySize.height * pixelRatio),
        });

        return {
            ...mediaItem,
            id: `${Date.now()}-edited-image`,
            type: "image",
            uri: capturedUri,
            image: { uri: capturedUri },
            fileName: `${getCleanFileName(mediaItem?.fileName)}-edited.png`,
            mimeType: "image/png",
            width: Math.round(displaySize.width * pixelRatio),
            height: Math.round(displaySize.height * pixelRatio),
            isHd: true,
        };
    };

    const handleSave = async () => {
        try {
            if (!currentUri || isProcessing) return;

            setIsProcessing(true);

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

            const finalImage = await buildFinalImageMessage();

            if (!finalImage?.uri) return;

            await MediaLibrary.saveToLibraryAsync(finalImage.uri);

            Alert.alert(
                tr("saved", "Saved"),
                tr("imageSavedMessage", "Image saved to your device.")
            );
        } catch (error) {
            console.log("Save edited image error:", error);

            Alert.alert(
                tr("errorTitle", "Something went wrong"),
                tr("saveMediaError", "Could not save the media. Please try again.")
            );
        } finally {
            setIsProcessing(false);
        }
    };

    const handleCropApply = async () => {
        try {
            if (!currentUri || isProcessing) return;

            if (cropRatio === "original") {
                setIsCropMode(false);
                return;
            }

            setIsProcessing(true);

            const sourceWidth = imageSize.width;
            const sourceHeight = imageSize.height;
            const targetRatio =
                cropRatio === "square"
                    ? 1
                    : cropRatio === "portrait"
                        ? 4 / 5
                        : 16 / 9;

            const sourceRatio = sourceWidth / Math.max(sourceHeight, 1);
            let cropWidth = sourceWidth;
            let cropHeight = sourceHeight;
            let originX = 0;
            let originY = 0;

            if (sourceRatio > targetRatio) {
                cropWidth = sourceHeight * targetRatio;
                originX = (sourceWidth - cropWidth) / 2;
            } else {
                cropHeight = sourceWidth / targetRatio;
                originY = (sourceHeight - cropHeight) / 2;
            }

            const format = getSaveFormat(currentUri);
            const context = ImageManipulator.manipulate(currentUri);

            context.crop({
                originX: Math.max(0, Math.round(originX)),
                originY: Math.max(0, Math.round(originY)),
                width: Math.max(1, Math.round(cropWidth)),
                height: Math.max(1, Math.round(cropHeight)),
            });

            const renderedImage = await context.renderAsync();
            const result = await renderedImage.saveAsync({
                compress: isHdEnabled ? 1 : 0.88,
                format,
            });

            setCurrentUri(result.uri);
            setImageSize({
                width: result.width || Math.round(cropWidth),
                height: result.height || Math.round(cropHeight),
            });
            setPaths([]);
            setIsCropMode(false);
        } catch (error) {
            console.log("Crop image error:", error);

            Alert.alert(
                tr("errorTitle", "Something went wrong"),
                tr("cropImageError", "Could not crop the image. Please try again.")
            );
        } finally {
            setIsProcessing(false);
        }
    };

    const handleUndoDraw = () => {
        setPaths((prev) => prev.slice(0, -1));
    };

    const handleSend = async () => {
        try {
            if (isProcessing) return;

            setIsProcessing(true);

            const finalImage = await buildFinalImageMessage();
            onSend(finalImage);
        } catch (error) {
            console.log("Prepare image before send error:", error);

            Alert.alert(
                tr("errorTitle", "Something went wrong"),
                tr("prepareImageError", "Could not prepare the image. Please try again.")
            );
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <View style={styles.root}>
            <StatusBar style="light" translucent backgroundColor="transparent" />

            <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
                <ToolButton icon="close" onPress={onCancel} />

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

                    <TouchableOpacity
                        style={styles.applyCropButton}
                        activeOpacity={0.85}
                        onPress={handleCropApply}
                        disabled={isProcessing}
                    >
                        <Text style={styles.applyCropText}>{tr("apply", "Apply")}</Text>
                    </TouchableOpacity>
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
                    ref={imageCanvasRef}
                    collapsable={false}
                    style={[
                        styles.imageCanvas,
                        {
                            width: displaySize.width,
                            height: displaySize.height,
                        },
                    ]}
                >
                    <Image
                        source={currentUri ? { uri: currentUri } : image}
                        style={styles.image}
                        resizeMode="contain"
                    />

                    <DrawingOverlay paths={paths} />

                    <View
                        style={styles.drawTouchLayer}
                        pointerEvents={isDrawMode ? "auto" : "none"}
                        {...panResponder.panHandlers}
                    />

                    {isCropMode && <View style={styles.cropGuide} pointerEvents="none" />}
                </View>
            </View>

            <View
                style={[
                    styles.bottomArea,
                    { paddingBottom: Math.max(insets.bottom, 12) + 10 },
                ]}
            >
                <View style={styles.captionInputRow}>
                    <Ionicons
                        name="image-outline"
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

    applyCropButton: {
        marginLeft: "auto",
        minHeight: 34,
        borderRadius: 17,
        paddingHorizontal: 13,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#22C55E",
    },

    applyCropText: {
        color: "#04111F",
        fontSize: 12,
        fontWeight: "900",
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

    imageCanvas: {
        backgroundColor: "#000000",
        overflow: "hidden",
    },

    image: {
        width: "100%",
        height: "100%",
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
        ...StyleSheet.absoluteFillObject,
        borderWidth: 2,
        borderColor: "rgba(255, 255, 255, 0.92)",
        backgroundColor: "rgba(255, 255, 255, 0.04)",
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

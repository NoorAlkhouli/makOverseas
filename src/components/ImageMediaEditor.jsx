// IMAGE_EDITOR_THEME_FIXED_FINAL
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

const DRAW_WIDTH = 7;
const MIN_CROP_SIZE = 72;

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

const getEditorThemeColors = (colors = {}) => {
    const text = colors.textPrimary || colors.textSecondary || colors.darkText;
    const muted = colors.textMuted || colors.textSecondary || text;
    const primary = colors.primary || colors.success || text;
    const primaryText = colors.darkText || colors.background || text;
    const border = colors.border || colors.borderSoft || colors.borderLight;
    const borderLight = colors.borderLight || colors.border || colors.borderSoft;
    const buttonBackground = colors.buttonSoft || colors.cardSoft || colors.card;

    return {
        background: colors.background,
        barBackground: colors.cardStrong || colors.card || colors.background,
        cardBackground: colors.cardSoft || colors.card || colors.background,
        buttonBackground,
        inputBackground: colors.inputBackground || colors.cardSoft || colors.card,
        text,
        muted,
        primary,
        primaryText,
        border,
        borderLight,
        overlay: colors.overlay || colors.homeOverlay || colors.authOverlay || colors.cardSoft,
        blue: colors.blue || primary,
        warning: colors.warning || primary,
        danger: colors.danger || primary,
        success: colors.success || primary,
        primarySoft: colors.primarySoft || buttonBackground,
    };
};

const getDrawColors = (themeColors) =>
    [
        themeColors.text,
        themeColors.primary,
        themeColors.blue,
        themeColors.warning,
        themeColors.danger,
    ].filter(Boolean);

const clamp = (value, min, max) => Math.max(min, Math.min(value, max));

const getCropAspectRatio = (cropRatio) => {
    if (cropRatio === "square") return 1;
    if (cropRatio === "portrait") return 4 / 5;
    if (cropRatio === "landscape") return 16 / 9;
    return null;
};

const createCenteredCropBox = (displaySize, cropRatio = "free") => {
    const safeWidth = Math.max(1, displaySize.width);
    const safeHeight = Math.max(1, displaySize.height);
    const aspectRatio = getCropAspectRatio(cropRatio);

    let width = safeWidth * 0.82;
    let height = safeHeight * 0.82;

    if (aspectRatio) {
        if (width / Math.max(height, 1) > aspectRatio) {
            width = height * aspectRatio;
        } else {
            height = width / aspectRatio;
        }
    }

    width = clamp(width, Math.min(MIN_CROP_SIZE, safeWidth), safeWidth);
    height = clamp(height, Math.min(MIN_CROP_SIZE, safeHeight), safeHeight);

    return {
        x: (safeWidth - width) / 2,
        y: (safeHeight - height) / 2,
        width,
        height,
    };
};

const clampCropBox = (box, displaySize) => {
    const safeWidth = Math.max(1, displaySize.width);
    const safeHeight = Math.max(1, displaySize.height);
    const minWidth = Math.min(MIN_CROP_SIZE, safeWidth);
    const minHeight = Math.min(MIN_CROP_SIZE, safeHeight);
    const width = clamp(box.width, minWidth, safeWidth);
    const height = clamp(box.height, minHeight, safeHeight);

    return {
        x: clamp(box.x, 0, Math.max(0, safeWidth - width)),
        y: clamp(box.y, 0, Math.max(0, safeHeight - height)),
        width,
        height,
    };
};

function ToolButton({ icon, active, disabled, onPress, children, themeColors }) {
    return (
        <TouchableOpacity
            style={[
                styles.toolButton,
                {
                    backgroundColor: active
                        ? themeColors.primarySoft
                        : themeColors.buttonBackground,
                    borderColor: active ? themeColors.primary : themeColors.borderLight,
                },
                disabled && styles.disabled,
            ]}
            activeOpacity={0.85}
            disabled={disabled}
            onPress={onPress}
        >
            {children || <Ionicons name={icon} size={24} color={themeColors.text} />}
        </TouchableOpacity>
    );
}

function CropPill({ label, active, onPress, themeColors }) {
    return (
        <TouchableOpacity
            style={[
                styles.cropPill,
                {
                    backgroundColor: active ? themeColors.text : themeColors.buttonBackground,
                    borderColor: active ? themeColors.text : themeColors.borderLight,
                },
            ]}
            activeOpacity={0.85}
            onPress={onPress}
        >
            <Text
                style={[
                    styles.cropPillText,
                    { color: active ? themeColors.primaryText : themeColors.text },
                ]}
            >
                {label}
            </Text>
        </TouchableOpacity>
    );
}

function CropControlButton({ icon, label, onPress, disabled, themeColors }) {
    return (
        <TouchableOpacity
            style={[
                styles.cropControlButton,
                {
                    backgroundColor: themeColors.buttonBackground,
                    borderColor: themeColors.borderLight,
                },
                disabled && styles.disabled,
            ]}
            activeOpacity={0.85}
            disabled={disabled}
            onPress={onPress}
        >
            {icon ? (
                <Ionicons name={icon} size={20} color={themeColors.text} />
            ) : (
                <Text style={[styles.cropControlButtonText, { color: themeColors.text }]}>
                    {label}
                </Text>
            )}
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
    const themeColors = useMemo(() => getEditorThemeColors(colors), [colors]);
    const drawColors = useMemo(() => getDrawColors(themeColors), [themeColors]);

    const originalUri = getImageUri(mediaItem, image);
    const imageCanvasRef = useRef(null);

    const [currentUri, setCurrentUri] = useState(originalUri);
    const [imageSize, setImageSize] = useState({
        width: mediaItem?.width || 1080,
        height: mediaItem?.height || 1080,
    });
    const [isHdEnabled, setIsHdEnabled] = useState(true);
    const [isCropMode, setIsCropMode] = useState(false);
    const [cropRatio, setCropRatio] = useState("free");
    const [isDrawMode, setIsDrawMode] = useState(false);
    const [drawColor, setDrawColor] = useState(null);
    const [paths, setPaths] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [cropBox, setCropBox] = useState(() =>
        createCenteredCropBox({ width: 1, height: 1 })
    );

    useEffect(() => {
        if (!drawColor && drawColors.length) {
            setDrawColor(drawColors[0]);
        }
    }, [drawColor, drawColors]);

    useEffect(() => {
        let isMounted = true;

        const prepareImage = async () => {
            if (!visible || !originalUri) return;

            setCurrentUri(originalUri);
            setPaths([]);
            setIsCropMode(false);
            setIsDrawMode(false);
            setCropRatio("free");
            setIsHdEnabled(true);
            setDrawColor((prev) => prev || drawColors[0]);

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
    }, [visible, originalUri, mediaItem?.width, mediaItem?.height, drawColors]);

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

    useEffect(() => {
        if (!isCropMode) return;
        setCropBox(createCenteredCropBox(displaySize, cropRatio));
    }, [cropRatio, displaySize.height, displaySize.width, isCropMode]);

    const moveCropBox = (direction) => {
        const step = Math.max(
            8,
            Math.round(Math.min(displaySize.width, displaySize.height) * 0.06)
        );
        const offsetMap = {
            up: { x: 0, y: -step },
            down: { x: 0, y: step },
            left: { x: -step, y: 0 },
            right: { x: step, y: 0 },
        };
        const offset = offsetMap[direction] || { x: 0, y: 0 };

        setCropBox((prev) =>
            clampCropBox(
                {
                    ...prev,
                    x: prev.x + offset.x,
                    y: prev.y + offset.y,
                },
                displaySize
            )
        );
    };

    const resizeCropBox = (scale) => {
        setCropBox((prev) => {
            const aspectRatio =
                getCropAspectRatio(cropRatio) || prev.width / Math.max(prev.height, 1);
            const centerX = prev.x + prev.width / 2;
            const centerY = prev.y + prev.height / 2;
            let nextWidth = clamp(prev.width * scale, MIN_CROP_SIZE, displaySize.width);
            let nextHeight = nextWidth / aspectRatio;

            if (nextHeight > displaySize.height) {
                nextHeight = displaySize.height;
                nextWidth = nextHeight * aspectRatio;
            }

            nextWidth = clamp(nextWidth, Math.min(MIN_CROP_SIZE, displaySize.width), displaySize.width);
            nextHeight = clamp(nextHeight, Math.min(MIN_CROP_SIZE, displaySize.height), displaySize.height);

            return clampCropBox(
                {
                    x: centerX - nextWidth / 2,
                    y: centerY - nextHeight / 2,
                    width: nextWidth,
                    height: nextHeight,
                },
                displaySize
            );
        });
    };

    const resetCropBox = () => {
        setCropBox(createCenteredCropBox(displaySize, cropRatio));
    };

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
                            color: drawColor || drawColors[0],
                            width: DRAW_WIDTH,
                            points: [
                                {
                                    x: clamp(locationX, 0, displaySize.width),
                                    y: clamp(locationY, 0, displaySize.height),
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
                                    x: clamp(locationX, 0, displaySize.width),
                                    y: clamp(locationY, 0, displaySize.height),
                                },
                            ],
                        };

                        return nextPaths;
                    });
                },
            }),
        [displaySize.height, displaySize.width, drawColor, drawColors, isDrawMode]
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

            setIsProcessing(true);

            const scaleX = imageSize.width / Math.max(displaySize.width, 1);
            const scaleY = imageSize.height / Math.max(displaySize.height, 1);
            const cropX = clamp(Math.round(cropBox.x * scaleX), 0, imageSize.width - 1);
            const cropY = clamp(Math.round(cropBox.y * scaleY), 0, imageSize.height - 1);
            const cropWidth = clamp(
                Math.round(cropBox.width * scaleX),
                1,
                imageSize.width - cropX
            );
            const cropHeight = clamp(
                Math.round(cropBox.height * scaleY),
                1,
                imageSize.height - cropY
            );
            const format = getSaveFormat(currentUri);
            const result = await ImageManipulator.manipulateAsync(
                currentUri,
                [
                    {
                        crop: {
                            originX: cropX,
                            originY: cropY,
                            width: cropWidth,
                            height: cropHeight,
                        },
                    },
                ],
                {
                    compress: isHdEnabled ? 1 : 0.88,
                    format,
                }
            );

            setCurrentUri(result.uri);
            setImageSize({
                width: result.width || cropWidth,
                height: result.height || cropHeight,
            });
            setPaths([]);
            setIsCropMode(false);
            setCropRatio("free");
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
        <View style={[styles.root, { backgroundColor: themeColors.background }]}>
            <StatusBar style="light" translucent backgroundColor="transparent" />

            <View
                style={[
                    styles.topBar,
                    {
                        paddingTop: insets.top + 8,
                        backgroundColor: themeColors.barBackground,
                        borderBottomColor: themeColors.border,
                    },
                ]}
            >
                <ToolButton icon="close" onPress={onCancel} themeColors={themeColors} />

                <View style={styles.topActions}>
                    <ToolButton
                        icon="download-outline"
                        disabled={isProcessing}
                        onPress={handleSave}
                        themeColors={themeColors}
                    />

                    <ToolButton
                        active={isHdEnabled}
                        disabled={isProcessing}
                        onPress={() => setIsHdEnabled((prev) => !prev)}
                        themeColors={themeColors}
                    >
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
                    </ToolButton>

                    <ToolButton
                        icon="crop-outline"
                        active={isCropMode}
                        disabled={isProcessing}
                        onPress={() => {
                            setIsCropMode((prev) => !prev);
                            setIsDrawMode(false);
                        }}
                        themeColors={themeColors}
                    />

                    <ToolButton
                        icon="create-outline"
                        active={isDrawMode}
                        disabled={isProcessing}
                        onPress={() => {
                            setIsDrawMode((prev) => !prev);
                            setIsCropMode(false);
                        }}
                        themeColors={themeColors}
                    />
                </View>
            </View>

            {isCropMode && (
                <View
                    style={[
                        styles.cropPanel,
                        {
                            top: insets.top + 82,
                            backgroundColor: themeColors.barBackground,
                            borderColor: themeColors.border,
                        },
                    ]}
                >
                    <CropPill
                        label={tr("freeCrop", "Free")}
                        active={cropRatio === "free"}
                        onPress={() => setCropRatio("free")}
                        themeColors={themeColors}
                    />
                    <CropPill
                        label="1:1"
                        active={cropRatio === "square"}
                        onPress={() => setCropRatio("square")}
                        themeColors={themeColors}
                    />
                    <CropPill
                        label="4:5"
                        active={cropRatio === "portrait"}
                        onPress={() => setCropRatio("portrait")}
                        themeColors={themeColors}
                    />
                    <CropPill
                        label="16:9"
                        active={cropRatio === "landscape"}
                        onPress={() => setCropRatio("landscape")}
                        themeColors={themeColors}
                    />

                    <TouchableOpacity
                        style={[styles.applyCropButton, { backgroundColor: themeColors.primary }]}
                        activeOpacity={0.85}
                        onPress={handleCropApply}
                        disabled={isProcessing}
                    >
                        <Text style={[styles.applyCropText, { color: themeColors.primaryText }]}>
                            {tr("apply", "Apply")}
                        </Text>
                    </TouchableOpacity>
                </View>
            )}

            {isDrawMode && (
                <View
                    style={[
                        styles.drawPanel,
                        {
                            top: insets.top + 82,
                            backgroundColor: themeColors.barBackground,
                            borderColor: themeColors.border,
                        },
                    ]}
                >
                    {drawColors.map((color) => (
                        <TouchableOpacity
                            key={color}
                            style={[
                                styles.colorDot,
                                {
                                    backgroundColor: color,
                                    borderColor:
                                        drawColor === color
                                            ? themeColors.text
                                            : themeColors.borderLight,
                                },
                                drawColor === color && styles.colorDotActive,
                            ]}
                            activeOpacity={0.85}
                            onPress={() => setDrawColor(color)}
                        />
                    ))}

                    <TouchableOpacity
                        style={[
                            styles.undoButton,
                            { backgroundColor: themeColors.buttonBackground },
                            !paths.length && styles.disabled,
                        ]}
                        activeOpacity={0.85}
                        onPress={handleUndoDraw}
                        disabled={!paths.length}
                    >
                        <Ionicons name="arrow-undo" size={18} color={themeColors.text} />
                        <Text style={[styles.undoText, { color: themeColors.text }]}>
                            {tr("undo", "Undo")}
                        </Text>
                    </TouchableOpacity>
                </View>
            )}

            <View style={[styles.mediaArea, { backgroundColor: themeColors.background }]}>
                <View
                    ref={imageCanvasRef}
                    collapsable={false}
                    style={[
                        styles.imageCanvas,
                        {
                            width: displaySize.width,
                            height: displaySize.height,
                            backgroundColor: themeColors.background,
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

                    {isCropMode && (
                        <>
                            <View
                                style={[
                                    styles.cropDimLayer,
                                    { backgroundColor: themeColors.overlay },
                                ]}
                                pointerEvents="none"
                            />
                            <View
                                pointerEvents="none"
                                style={[
                                    styles.cropGuide,
                                    {
                                        left: cropBox.x,
                                        top: cropBox.y,
                                        width: cropBox.width,
                                        height: cropBox.height,
                                        borderColor: themeColors.text,
                                        backgroundColor: themeColors.primarySoft,
                                    },
                                ]}
                            >
                                <View
                                    style={[
                                        styles.cropGridVertical,
                                        { backgroundColor: themeColors.borderLight },
                                    ]}
                                />
                                <View
                                    style={[
                                        styles.cropGridVertical,
                                        {
                                            left: "66.66%",
                                            backgroundColor: themeColors.borderLight,
                                        },
                                    ]}
                                />
                                <View
                                    style={[
                                        styles.cropGridHorizontal,
                                        { backgroundColor: themeColors.borderLight },
                                    ]}
                                />
                                <View
                                    style={[
                                        styles.cropGridHorizontal,
                                        {
                                            top: "66.66%",
                                            backgroundColor: themeColors.borderLight,
                                        },
                                    ]}
                                />
                            </View>

                            <View
                                style={[
                                    styles.cropControlsPanel,
                                    {
                                        backgroundColor: themeColors.barBackground,
                                        borderColor: themeColors.border,
                                    },
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.cropControlsTitle,
                                        { color: themeColors.text },
                                    ]}
                                >
                                    {tr("adjustCropArea", "Adjust crop area")}
                                </Text>

                                <View style={styles.cropControlsRow}>
                                    <CropControlButton
                                        icon="arrow-up"
                                        disabled={isProcessing}
                                        themeColors={themeColors}
                                        onPress={() => moveCropBox("up")}
                                    />
                                    <CropControlButton
                                        icon="arrow-down"
                                        disabled={isProcessing}
                                        themeColors={themeColors}
                                        onPress={() => moveCropBox("down")}
                                    />
                                    <CropControlButton
                                        icon="arrow-back"
                                        disabled={isProcessing}
                                        themeColors={themeColors}
                                        onPress={() => moveCropBox("left")}
                                    />
                                    <CropControlButton
                                        icon="arrow-forward"
                                        disabled={isProcessing}
                                        themeColors={themeColors}
                                        onPress={() => moveCropBox("right")}
                                    />
                                    <CropControlButton
                                        label="−"
                                        disabled={isProcessing}
                                        themeColors={themeColors}
                                        onPress={() => resizeCropBox(0.88)}
                                    />
                                    <CropControlButton
                                        label="+"
                                        disabled={isProcessing}
                                        themeColors={themeColors}
                                        onPress={() => resizeCropBox(1.12)}
                                    />
                                    <CropControlButton
                                        icon="refresh"
                                        disabled={isProcessing}
                                        themeColors={themeColors}
                                        onPress={resetCropBox}
                                    />
                                </View>
                            </View>
                        </>
                    )}
                </View>
            </View>

            <View
                style={[
                    styles.bottomArea,
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
                            backgroundColor: themeColors.inputBackground,
                            borderColor: themeColors.borderLight,
                        },
                    ]}
                >
                    <Ionicons name="image-outline" size={24} color={themeColors.muted} />
                    <Text
                        style={[styles.captionText, { color: themeColors.text }]}
                        numberOfLines={1}
                    >
                        {caption || mediaItem?.fileName || tr("addCaption", "Add a caption...")}
                    </Text>
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
                        style={[styles.sendCircle, { backgroundColor: themeColors.primary }]}
                        activeOpacity={0.9}
                        disabled={isProcessing}
                        onPress={handleSend}
                    >
                        <Ionicons name="send" size={25} color={themeColors.primaryText} />
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
    },

    topBar: {
        minHeight: 90,
        paddingHorizontal: 14,
        paddingBottom: 12,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        borderBottomWidth: 1,
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
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
    },

    disabled: {
        opacity: 0.45,
    },

    hdText: {
        fontSize: 12,
        fontWeight: "900",
        borderWidth: 1,
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
        borderWidth: 1,
        flexDirection: "row",
        alignItems: "center",
        gap: 7,
    },

    cropPill: {
        minHeight: 34,
        borderRadius: 17,
        paddingHorizontal: 10,
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
    },

    cropPillText: {
        fontSize: 12,
        fontWeight: "900",
    },

    applyCropButton: {
        marginLeft: "auto",
        minHeight: 34,
        borderRadius: 17,
        paddingHorizontal: 13,
        alignItems: "center",
        justifyContent: "center",
    },

    applyCropText: {
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
        borderWidth: 1,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },

    colorDot: {
        width: 30,
        height: 30,
        borderRadius: 15,
        borderWidth: 2,
    },

    colorDotActive: {
        transform: [{ scale: 1.12 }],
    },

    undoButton: {
        marginLeft: "auto",
        minHeight: 34,
        borderRadius: 17,
        paddingHorizontal: 12,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 5,
    },

    undoText: {
        fontSize: 12,
        fontWeight: "900",
    },

    mediaArea: {
        flex: 1,
        width: "100%",
        alignItems: "center",
        justifyContent: "center",
    },

    imageCanvas: {
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

    cropDimLayer: {
        ...StyleSheet.absoluteFillObject,
    },

    cropGuide: {
        position: "absolute",
        borderWidth: 2,
    },

    cropGridVertical: {
        position: "absolute",
        top: 0,
        bottom: 0,
        left: "33.33%",
        width: 1,
    },

    cropGridHorizontal: {
        position: "absolute",
        left: 0,
        right: 0,
        top: "33.33%",
        height: 1,
    },

    cropControlsPanel: {
        position: "absolute",
        left: 12,
        right: 12,
        bottom: 12,
        borderRadius: 20,
        borderWidth: 1,
        paddingHorizontal: 12,
        paddingVertical: 10,
        gap: 8,
    },

    cropControlsTitle: {
        fontSize: 12,
        fontWeight: "900",
        textAlign: "center",
    },

    cropControlsRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        flexWrap: "wrap",
        gap: 8,
    },

    cropControlButton: {
        minWidth: 38,
        height: 38,
        borderRadius: 19,
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 10,
    },

    cropControlButtonText: {
        fontSize: 22,
        lineHeight: 24,
        fontWeight: "900",
    },

    bottomArea: {
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

    captionText: {
        flex: 1,
        minWidth: 0,
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

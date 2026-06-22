import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";
import React, { useMemo, useState } from "react";
import {
    Alert,
    FlatList,
    Image,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const MAX_SCAN_PAGES = 30;

let cachedDocumentScannerPlugin = undefined;

const getDocumentScannerPlugin = () => {
    if (cachedDocumentScannerPlugin !== undefined) {
        return cachedDocumentScannerPlugin;
    }

    try {
        // Keep the native scanner lazy-loaded so the chat screen does not crash
        // when the current Expo/dev build does not include DocumentScanner.
        // Static importing this package can throw TurboModuleRegistry.getEnforcing
        // before we get a chance to show a friendly message.
        // eslint-disable-next-line global-require
        const scannerModule = require("react-native-document-scanner-plugin");

        cachedDocumentScannerPlugin = {
            scanDocument:
                scannerModule?.default?.scanDocument ||
                scannerModule?.scanDocument ||
                null,
            ResponseType:
                scannerModule?.ResponseType ||
                scannerModule?.default?.ResponseType ||
                {},
            ScanDocumentResponseStatus:
                scannerModule?.ScanDocumentResponseStatus ||
                scannerModule?.default?.ScanDocumentResponseStatus ||
                {},
        };

        return cachedDocumentScannerPlugin;
    } catch (error) {
        console.log("Document scanner native module is not available:", error);
        cachedDocumentScannerPlugin = null;
        return cachedDocumentScannerPlugin;
    }
};

const isDocumentScannerCancelResponse = (response, scannerPlugin) => {
    const cancelStatus =
        scannerPlugin?.ScanDocumentResponseStatus?.Cancel ||
        scannerPlugin?.ScanDocumentResponseStatus?.CancelStatus ||
        "cancel";

    const status = String(response?.status || "").toLowerCase();

    return [
        String(cancelStatus).toLowerCase(),
        "cancel",
        "canceled",
        "cancelled",
    ].includes(status);
};

const normalizeScannedUri = (uri) => {
    if (!uri) return null;

    if (
        uri.startsWith("file://") ||
        uri.startsWith("content://") ||
        uri.startsWith("data:")
    ) {
        return uri;
    }

    return `file://${uri}`;
};

const getScannedPdfFileName = () => `scanned-document-${Date.now()}.pdf`;

const getScannedPageFileName = (pageNumber = 1) =>
    `scanned-document-page-${pageNumber}-${Date.now()}.jpg`;

const getSafeActiveIndex = (activeIndex, pagesLength) => {
    if (!pagesLength) return 0;
    return Math.min(Math.max(activeIndex, 0), pagesLength - 1);
};

const createScannedDocumentPage = ({ uri, tr, pageNumber, width, height }) => {
    return {
        id: `${Date.now()}-${pageNumber}-scanned-page`,
        uri,
        fileName: getScannedPageFileName(pageNumber),
        mimeType: "image/jpeg",
        width,
        height,
        size: undefined,
        pageNumber,
        time: tr("now", "Now"),
    };
};

const createPreviewBundle = (pages = [], tr) => {
    return {
        id: `${Date.now()}-scanned-preview-bundle`,
        side: "me",
        type: "document",
        uri: pages[0]?.uri,
        fileName: getScannedPdfFileName(),
        mimeType: "application/pdf",
        pages,
        pageCount: pages.length,
        time: tr("now", "Now"),
    };
};

const getPagesFromDocument = (documentItem) => {
    if (!documentItem) return [];
    if (Array.isArray(documentItem)) return documentItem;
    if (Array.isArray(documentItem.pages)) return documentItem.pages;
    if (Array.isArray(documentItem.attachments)) return documentItem.attachments;
    return [documentItem];
};

const getBase64Encoding = () => {
    return FileSystem.EncodingType?.Base64 || "base64";
};

const readImageAsBase64 = async (uri) => {
    if (!uri) return null;

    const normalizedUri = normalizeScannedUri(uri);

    if (!normalizedUri) return null;

    if (normalizedUri.startsWith("data:image")) {
        return normalizedUri;
    }

    const base64 = await FileSystem.readAsStringAsync(normalizedUri, {
        encoding: getBase64Encoding(),
    });

    return `data:image/jpeg;base64,${base64}`;
};

const escapeHtml = (value = "") => {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
};

const buildPdfHtml = async (pages = []) => {
    const htmlPages = [];

    for (let index = 0; index < pages.length; index += 1) {
        const page = pages[index];
        const imageSource = await readImageAsBase64(page.uri);

        if (!imageSource) continue;

        htmlPages.push(`
            <section class="page">
                <img src="${imageSource}" alt="Scanned page ${index + 1}" />
            </section>
        `);
    }

    return `
        <!DOCTYPE html>
        <html>
            <head>
                <meta charset="utf-8" />
                <style>
                    @page {
                        size: A4;
                        margin: 0;
                    }

                    * {
                        box-sizing: border-box;
                    }

                    html,
                    body {
                        margin: 0;
                        padding: 0;
                        width: 100%;
                        min-height: 100%;
                        background: #ffffff;
                        font-family: Arial, sans-serif;
                    }

                    .page {
                        width: 100%;
                        height: 100vh;
                        page-break-after: always;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        background: #ffffff;
                        overflow: hidden;
                    }

                    .page:last-child {
                        page-break-after: auto;
                    }

                    img {
                        width: 100%;
                        height: 100%;
                        object-fit: contain;
                        display: block;
                    }
                </style>
            </head>

            <body>
                ${htmlPages.join("")}
            </body>
        </html>
    `;
};

const getFileSize = async (uri) => {
    if (!uri) return 0;

    try {
        const fileInfo = await FileSystem.getInfoAsync(uri, {
            size: true,
        });

        return Number(fileInfo?.size || 0);
    } catch (error) {
        console.log("Get scanned PDF size error:", error);
        return 0;
    }
};

const createPdfFromScannedPages = async (pages = []) => {
    if (!pages.length) return null;

    const html = await buildPdfHtml(pages);

    const pdfResult = await Print.printToFileAsync({
        html,
        base64: false,
    });

    if (!pdfResult?.uri) return null;

    const pdfFileName = getScannedPdfFileName();
    const targetUri = `${FileSystem.cacheDirectory}${pdfFileName}`;

    try {
        await FileSystem.copyAsync({
            from: pdfResult.uri,
            to: targetUri,
        });

        return {
            uri: targetUri,
            fileName: pdfFileName,
            mimeType: "application/pdf",
            size: await getFileSize(targetUri),
        };
    } catch (error) {
        console.log("PDF copy error:", error);

        return {
            uri: pdfResult.uri,
            fileName: pdfFileName,
            mimeType: "application/pdf",
            size: await getFileSize(pdfResult.uri),
        };
    }
};

const createScannedPdfMessage = ({ pdfFile, pages, tr }) => {
    return {
        id: `${Date.now()}-scanned-pdf-document`,
        side: "me",
        type: "document",

        // هذا هو الملف الحقيقي الذي سينفتح كـ PDF متعدد الصفحات
        uri: pdfFile.uri,
        fileName: pdfFile.fileName,
        mimeType: "application/pdf",

        // نخلي الصفحات للمعاينة داخل التطبيق فقط، مش كملفات منفصلة
        pages,
        pageCount: pages.length,
        previewUri: pages[0]?.uri,

        size: pdfFile.size || 0,
        fileSize: pdfFile.size || 0,
        time: tr("now", "Now"),
    };
};

export function useScanDocument({
    tr,
    addMessages,
    cancelVoiceRecordingIfActive,
    onSendScannedDocument,
}) {
    const [selectedScannedDocument, setSelectedScannedDocument] = useState(null);
    const [activeScannedPageIndex, setActiveScannedPageIndex] = useState(0);
    const [isScanningDocument, setIsScanningDocument] = useState(false);
    const [isCreatingScannedPdf, setIsCreatingScannedPdf] = useState(false);

    const selectedScannedDocuments = selectedScannedDocument?.pages || [];

    const runDocumentScanner = async ({ maxNumDocuments = MAX_SCAN_PAGES } = {}) => {
        const scannerPlugin = getDocumentScannerPlugin();

        if (typeof scannerPlugin?.scanDocument !== "function") {
            throw new Error(
                "DocumentScanner native module is not registered in this build."
            );
        }

        const response = await scannerPlugin.scanDocument({
            croppedImageQuality: 100,
            maxNumDocuments,
            responseType:
                scannerPlugin?.ResponseType?.ImageFilePath ||
                scannerPlugin?.ResponseType?.IMAGE_FILE_PATH ||
                "imageFilePath",
        });

        if (
            isDocumentScannerCancelResponse(response, scannerPlugin) ||
            !response?.scannedImages?.length
        ) {
            return [];
        }

        return response.scannedImages
            .map((uri) => normalizeScannedUri(uri))
            .filter(Boolean);
    };

    const scanDocumentWithCamera = async () => {
        if (isScanningDocument || isCreatingScannedPdf) return;

        try {
            setSelectedScannedDocument(null);
            setActiveScannedPageIndex(0);
            setIsScanningDocument(true);

            if (typeof cancelVoiceRecordingIfActive === "function") {
                await cancelVoiceRecordingIfActive();
            }

            const scannedUris = await runDocumentScanner({
                maxNumDocuments: MAX_SCAN_PAGES,
            });

            if (!scannedUris.length) return;

            const scannedPages = scannedUris.map((uri, index) =>
                createScannedDocumentPage({
                    uri,
                    tr,
                    pageNumber: index + 1,
                })
            );

            setSelectedScannedDocument(createPreviewBundle(scannedPages, tr));
            setActiveScannedPageIndex(0);
        } catch (error) {
            console.log("Document scanner error:", error);

            Alert.alert(
                tr("errorTitle", "Something went wrong"),
                tr(
                    "scanDocumentNativeError",
                    "Document scanner is not included in this app build. Install react-native-document-scanner-plugin and create a new development/preview build, or use the normal document picker."
                )
            );
        } finally {
            setIsScanningDocument(false);
        }
    };

    const handleAddScannedPages = async () => {
        if (isScanningDocument || isCreatingScannedPdf) return;

        try {
            setIsScanningDocument(true);

            if (typeof cancelVoiceRecordingIfActive === "function") {
                await cancelVoiceRecordingIfActive();
            }

            const scannedUris = await runDocumentScanner({
                maxNumDocuments: MAX_SCAN_PAGES,
            });

            if (!scannedUris.length) return;

            setSelectedScannedDocument((currentDocument) => {
                const currentPages = currentDocument?.pages || [];

                const newPages = scannedUris.map((uri, index) =>
                    createScannedDocumentPage({
                        uri,
                        tr,
                        pageNumber: currentPages.length + index + 1,
                    })
                );

                const mergedPages = [...currentPages, ...newPages];

                setActiveScannedPageIndex(currentPages.length);

                return createPreviewBundle(mergedPages, tr);
            });
        } catch (error) {
            console.log("Document scanner add pages error:", error);

            Alert.alert(
                tr("errorTitle", "Something went wrong"),
                tr(
                    "scanDocumentError",
                    "Could not scan the document. Make sure this build includes the native document scanner module."
                )
            );
        } finally {
            setIsScanningDocument(false);
        }
    };

    const handleRetakeScannedPage = async (pageIndex = activeScannedPageIndex) => {
        if (
            isScanningDocument ||
            isCreatingScannedPdf ||
            !selectedScannedDocuments.length
        ) {
            return;
        }

        try {
            setIsScanningDocument(true);

            if (typeof cancelVoiceRecordingIfActive === "function") {
                await cancelVoiceRecordingIfActive();
            }

            const scannedUris = await runDocumentScanner({
                maxNumDocuments: 1,
            });

            const firstScannedUri = scannedUris[0];

            if (!firstScannedUri) return;

            setSelectedScannedDocument((currentDocument) => {
                const currentPages = currentDocument?.pages || [];
                const safeIndex = getSafeActiveIndex(
                    pageIndex,
                    currentPages.length
                );

                if (!currentPages.length) return currentDocument;

                const updatedPages = currentPages.map((page, index) => {
                    if (index !== safeIndex) return page;

                    return {
                        ...page,
                        uri: firstScannedUri,
                        time: tr("now", "Now"),
                    };
                });

                setActiveScannedPageIndex(safeIndex);

                return createPreviewBundle(updatedPages, tr);
            });
        } catch (error) {
            console.log("Document scanner retake page error:", error);

            Alert.alert(
                tr("errorTitle", "Something went wrong"),
                tr(
                    "scanDocumentError",
                    "Could not scan the document. Make sure this build includes the native document scanner module."
                )
            );
        } finally {
            setIsScanningDocument(false);
        }
    };

    const handleDeleteScannedPage = (pageIndex = activeScannedPageIndex) => {
        if (isScanningDocument || isCreatingScannedPdf) return;

        setSelectedScannedDocument((currentDocument) => {
            const currentPages = currentDocument?.pages || [];
            const safeIndex = getSafeActiveIndex(pageIndex, currentPages.length);

            const nextPages = currentPages
                .filter((_, index) => index !== safeIndex)
                .map((page, index) => ({
                    ...page,
                    pageNumber: index + 1,
                }));

            if (!nextPages.length) {
                setActiveScannedPageIndex(0);
                return null;
            }

            setActiveScannedPageIndex(
                getSafeActiveIndex(safeIndex, nextPages.length)
            );

            return createPreviewBundle(nextPages, tr);
        });
    };

    const handleCancelScannedDocument = () => {
        if (isCreatingScannedPdf) return;

        setSelectedScannedDocument(null);
        setActiveScannedPageIndex(0);
    };

    const handleConfirmSendScannedDocument = async () => {
        const pagesToSend = selectedScannedDocument?.pages || [];

        if (!pagesToSend.length || isCreatingScannedPdf) return;

        try {
            setIsCreatingScannedPdf(true);

            const pdfFile = await createPdfFromScannedPages(pagesToSend);

            if (!pdfFile?.uri) {
                Alert.alert(
                    tr("errorTitle", "Something went wrong"),
                    tr(
                        "createScannedPdfError",
                        "Could not create the scanned PDF file. Please try again."
                    )
                );
                return;
            }

            const scannedPdfMessage = createScannedPdfMessage({
                pdfFile,
                pages: pagesToSend,
                tr,
            });

            // هون صار الإرسال ملف واحد PDF، مش صورة صورة.
            // إذا الشاشة مررت onSendScannedDocument، منرفعه على الباك مثل أي ملف عادي.
            // وإذا ما مررتها، منخلي fallback قديم يضيفه محلياً بدون ما نكسر أي استخدام ثاني.
            if (typeof onSendScannedDocument === "function") {
                await onSendScannedDocument(scannedPdfMessage);
            } else if (typeof addMessages === "function") {
                addMessages([scannedPdfMessage]);
            }

            setSelectedScannedDocument(null);
            setActiveScannedPageIndex(0);
        } catch (error) {
            console.log("Create scanned PDF error:", error);

            Alert.alert(
                tr("errorTitle", "Something went wrong"),
                tr(
                    "createScannedPdfError",
                    "Could not create the scanned PDF file. Please try again."
                )
            );
        } finally {
            setIsCreatingScannedPdf(false);
        }
    };

    return {
        selectedScannedDocument,
        selectedScannedDocuments,
        activeScannedPageIndex,
        isScanningDocument,
        isCreatingScannedPdf,

        scanDocumentWithCamera,
        handleAddScannedPages,
        handleRetakeScannedPage,
        handleDeleteScannedPage,
        handleCancelScannedDocument,
        handleConfirmSendScannedDocument,

        setActiveScannedPageIndex,
    };
}

export function ScannedDocumentConfirmModal({
    visible,
    documentItem,
    documents,
    activeIndex = 0,
    colors,
    tr,
    isLoading = false,
    onCancel,
    onAddPage,
    onDeletePage,
    onRetake,
    onChangePage,
    onSend,
}) {
    const insets = useSafeAreaInsets();

    const pages = useMemo(() => {
        if (Array.isArray(documents) && documents.length) return documents;
        return getPagesFromDocument(documentItem);
    }, [documentItem, documents]);

    const safeActiveIndex = getSafeActiveIndex(activeIndex, pages.length);
    const activePage = pages[safeActiveIndex];

    const theme = useMemo(
        () => ({
            background: colors?.background || "#020b18",
            card: colors?.cardStrong || colors?.card || "rgba(5, 18, 38, 0.97)",
            cardSoft: colors?.cardSoft || "rgba(5, 18, 38, 0.68)",
            textPrimary: colors?.textPrimary || "#ffffff",
            textSecondary: colors?.textSecondary || "#d8deea",
            textMuted: colors?.textMuted || "#a9b1c2",
            primary: colors?.primary || "#51a234",
            primarySoft: colors?.primarySoft || "rgba(81, 162, 52, 0.12)",
            blue: colors?.blue || "#39BDFF",
            border: colors?.border || "rgba(205, 222, 255, 0.35)",
            borderSoft: colors?.borderSoft || "rgba(205, 222, 255, 0.24)",
            buttonSoft: colors?.buttonSoft || "rgba(255, 255, 255, 0.08)",
            darkText: colors?.darkText || "#03101f",
            danger: colors?.danger || "#E3342F",
            success: colors?.success || "#2FAE24",
        }),
        [colors]
    );

    if (!visible || !activePage) {
        return null;
    }

    const handleRetakeCurrentPage = () => {
        if (isLoading) return;

        if (typeof onRetake === "function") {
            onRetake(safeActiveIndex);
        }
    };

    const handleDeleteCurrentPage = () => {
        if (isLoading || typeof onDeletePage !== "function") return;

        Alert.alert(
            tr("deleteScannedPageTitle", "Delete this page?"),
            tr("deleteScannedPageMessage", "Only this scanned page will be removed."),
            [
                {
                    text: tr("cancel", "Cancel"),
                    style: "cancel",
                },
                {
                    text: tr("delete", "Delete"),
                    style: "destructive",
                    onPress: () => onDeletePage(safeActiveIndex),
                },
            ]
        );
    };

    const renderThumbnail = ({ item, index }) => {
        const isSelected = index === safeActiveIndex;

        return (
            <TouchableOpacity
                style={[
                    styles.thumbnailButton,
                    {
                        backgroundColor: theme.buttonSoft,
                        borderColor: theme.borderSoft,
                    },
                    isSelected && {
                        borderColor: theme.primary,
                        backgroundColor: theme.primarySoft,
                    },
                ]}
                activeOpacity={0.85}
                disabled={isLoading}
                onPress={() => {
                    if (typeof onChangePage === "function") {
                        onChangePage(index);
                    }
                }}
            >
                <Image
                    source={{ uri: item.uri }}
                    style={styles.thumbnailImage}
                    resizeMode="cover"
                />

                <View style={styles.thumbnailBadge}>
                    <Text style={styles.thumbnailBadgeText}>{index + 1}</Text>
                </View>
            </TouchableOpacity>
        );
    };

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
            <View style={[styles.modalRoot, { backgroundColor: theme.background }]}>
                <StatusBar style="light" translucent backgroundColor="transparent" />

                <View
                    style={[
                        styles.header,
                        {
                            paddingTop: insets.top + 8,
                            backgroundColor: theme.card,
                            borderBottomColor: theme.borderSoft,
                        },
                    ]}
                >
                    <TouchableOpacity
                        style={[
                            styles.roundButton,
                            {
                                backgroundColor: theme.buttonSoft,
                                borderColor: theme.borderSoft,
                                opacity: isLoading ? 0.5 : 1,
                            },
                        ]}
                        activeOpacity={0.85}
                        disabled={isLoading}
                        onPress={onCancel}
                    >
                        <Ionicons
                            name="close"
                            size={27}
                            color={theme.textPrimary}
                        />
                    </TouchableOpacity>

                    <View style={styles.headerTitleWrapper}>
                        <Text
                            style={[
                                styles.headerTitle,
                                { color: theme.textPrimary },
                            ]}
                        >
                            {tr("scannedDocument", "Scanned Document")}
                        </Text>

                        <Text
                            style={[
                                styles.headerSubtitle,
                                { color: theme.textMuted },
                            ]}
                            numberOfLines={1}
                        >
                            {tr("scanPagesCount", "Page")} {safeActiveIndex + 1} /{" "}
                            {pages.length}
                        </Text>
                    </View>

                    <TouchableOpacity
                        style={[
                            styles.headerActionButton,
                            {
                                backgroundColor: theme.buttonSoft,
                                borderColor: theme.borderSoft,
                                opacity: isLoading ? 0.5 : 1,
                            },
                        ]}
                        activeOpacity={0.85}
                        disabled={isLoading}
                        onPress={onAddPage}
                    >
                        <Ionicons
                            name="add"
                            size={20}
                            color={theme.textPrimary}
                        />
                        <Text
                            style={[
                                styles.headerActionText,
                                { color: theme.textPrimary },
                            ]}
                        >
                            {tr("addPage", "Add")}
                        </Text>
                    </TouchableOpacity>
                </View>

                <View
                    style={[
                        styles.previewArea,
                        { backgroundColor: theme.background },
                    ]}
                >
                    <View
                        style={[
                            styles.paperFrame,
                            {
                                backgroundColor: theme.cardSoft,
                                borderColor: theme.borderSoft,
                            },
                        ]}
                    >
                        <Image
                            source={{ uri: activePage.uri }}
                            style={styles.scannedImage}
                            resizeMode="contain"
                        />
                    </View>
                </View>

                <View
                    style={[
                        styles.pageActionsRow,
                        {
                            backgroundColor: theme.card,
                            borderTopColor: theme.borderSoft,
                        },
                    ]}
                >
                    <TouchableOpacity
                        style={[
                            styles.pageActionButton,
                            {
                                backgroundColor: theme.buttonSoft,
                                borderColor: theme.borderSoft,
                                opacity: isLoading ? 0.5 : 1,
                            },
                        ]}
                        activeOpacity={0.85}
                        disabled={isLoading}
                        onPress={handleRetakeCurrentPage}
                    >
                        <Ionicons
                            name="camera-outline"
                            size={19}
                            color={theme.textPrimary}
                        />
                        <Text
                            style={[
                                styles.pageActionText,
                                { color: theme.textPrimary },
                            ]}
                        >
                            {tr("retakePage", "Retake page")}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[
                            styles.pageActionButton,
                            {
                                backgroundColor: "rgba(227, 52, 47, 0.16)",
                                borderColor: "rgba(227, 52, 47, 0.35)",
                                opacity: isLoading ? 0.5 : 1,
                            },
                        ]}
                        activeOpacity={0.85}
                        disabled={isLoading}
                        onPress={handleDeleteCurrentPage}
                    >
                        <Ionicons
                            name="trash-outline"
                            size={19}
                            color={theme.textPrimary}
                        />
                        <Text
                            style={[
                                styles.pageActionText,
                                { color: theme.textPrimary },
                            ]}
                        >
                            {tr("deletePage", "Delete page")}
                        </Text>
                    </TouchableOpacity>
                </View>

                {pages.length > 1 ? (
                    <View
                        style={[
                            styles.thumbnailsWrapper,
                            {
                                backgroundColor: theme.card,
                                borderTopColor: theme.borderSoft,
                            },
                        ]}
                    >
                        <FlatList
                            horizontal
                            data={pages}
                            renderItem={renderThumbnail}
                            keyExtractor={(item, index) =>
                                item.id || `${item.uri}-${index}`
                            }
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.thumbnailsContent}
                        />
                    </View>
                ) : null}

                <View
                    style={[
                        styles.bottomBar,
                        {
                            paddingBottom: Math.max(insets.bottom, 12) + 10,
                            backgroundColor: theme.card,
                            borderTopColor: theme.borderSoft,
                        },
                    ]}
                >
                    <View
                        style={[
                            styles.filePill,
                            {
                                backgroundColor: theme.buttonSoft,
                                borderColor: theme.borderSoft,
                            },
                        ]}
                    >
                        <MaterialCommunityIcons
                            name="file-pdf-box"
                            size={28}
                            color={theme.textPrimary}
                        />

                        <View style={styles.fileTextWrapper}>
                            <Text
                                style={[
                                    styles.fileName,
                                    { color: theme.textPrimary },
                                ]}
                                numberOfLines={1}
                            >
                                {escapeHtml(
                                    tr("scannedPdfDocument", "Scanned PDF Document")
                                )}
                            </Text>

                            <Text
                                style={[
                                    styles.fileMeta,
                                    { color: theme.textMuted },
                                ]}
                            >
                                {pages.length === 1
                                    ? tr(
                                        "oneScanReadyToSend",
                                        "1 page will be sent as one PDF file"
                                    )
                                    : `${pages.length} ${tr(
                                        "scanPagesReadyToSend",
                                        "pages will be sent as one PDF file"
                                    )}`}
                            </Text>
                        </View>
                    </View>

                    <TouchableOpacity
                        style={[
                            styles.sendButton,
                            {
                                backgroundColor: theme.primary,
                                opacity: isLoading ? 0.72 : 1,
                            },
                        ]}
                        activeOpacity={0.9}
                        disabled={isLoading}
                        onPress={onSend}
                    >
                        <Ionicons
                            name={isLoading ? "hourglass-outline" : "send"}
                            size={24}
                            color={theme.darkText}
                        />
                        <Text
                            style={[
                                styles.sendText,
                                { color: theme.darkText },
                            ]}
                        >
                            {isLoading
                                ? tr("creatingPdf", "Creating PDF...")
                                : tr("sendAsPdf", "Send as one PDF")}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalRoot: {
        flex: 1,
    },

    header: {
        minHeight: 90,
        paddingHorizontal: 14,
        paddingBottom: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        borderBottomWidth: 1,
        zIndex: 10,
    },

    roundButton: {
        width: 46,
        height: 46,
        borderRadius: 23,
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
    },

    headerTitleWrapper: {
        flex: 1,
        minWidth: 0,
        alignItems: "center",
    },

    headerTitle: {
        fontSize: 16,
        fontWeight: "900",
    },

    headerSubtitle: {
        marginTop: 2,
        fontSize: 11,
        fontWeight: "700",
    },

    headerActionButton: {
        minWidth: 82,
        height: 46,
        borderRadius: 23,
        paddingHorizontal: 12,
        borderWidth: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 5,
        flexShrink: 0,
    },

    headerActionText: {
        fontSize: 13,
        fontWeight: "900",
    },

    previewArea: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 14,
        paddingVertical: 14,
    },

    paperFrame: {
        width: "100%",
        height: "100%",
        borderRadius: 12,
        borderWidth: 1,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
    },

    scannedImage: {
        width: "100%",
        height: "100%",
    },

    pageActionsRow: {
        paddingHorizontal: 14,
        paddingTop: 10,
        paddingBottom: 10,
        borderTopWidth: 1,
        flexDirection: "row",
        gap: 10,
    },

    pageActionButton: {
        flex: 1,
        minHeight: 44,
        borderRadius: 15,
        borderWidth: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 7,
    },

    pageActionText: {
        fontSize: 12,
        fontWeight: "900",
    },

    thumbnailsWrapper: {
        borderTopWidth: 1,
    },

    thumbnailsContent: {
        paddingHorizontal: 14,
        paddingVertical: 10,
    },

    thumbnailButton: {
        width: 62,
        height: 78,
        borderRadius: 12,
        borderWidth: 2,
        overflow: "hidden",
        marginRight: 10,
    },

    thumbnailImage: {
        width: "100%",
        height: "100%",
    },

    thumbnailBadge: {
        position: "absolute",
        left: 5,
        bottom: 5,
        minWidth: 22,
        height: 22,
        borderRadius: 11,
        paddingHorizontal: 6,
        backgroundColor: "rgba(0, 0, 0, 0.72)",
        alignItems: "center",
        justifyContent: "center",
    },

    thumbnailBadgeText: {
        color: "#ffffff",
        fontSize: 11,
        fontWeight: "900",
    },

    bottomBar: {
        paddingHorizontal: 14,
        paddingTop: 12,
        borderTopWidth: 1,
        gap: 12,
    },

    filePill: {
        minHeight: 58,
        borderRadius: 18,
        paddingHorizontal: 14,
        borderWidth: 1,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },

    fileTextWrapper: {
        flex: 1,
        minWidth: 0,
    },

    fileName: {
        fontSize: 14,
        fontWeight: "900",
    },

    fileMeta: {
        marginTop: 3,
        fontSize: 12,
        fontWeight: "700",
    },

    sendButton: {
        height: 52,
        borderRadius: 18,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
    },

    sendText: {
        fontSize: 15,
        fontWeight: "900",
    },
});
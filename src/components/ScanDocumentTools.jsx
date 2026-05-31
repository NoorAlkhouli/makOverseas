// import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
// import DocumentScanner, {
//     ResponseType,
//     ScanDocumentResponseStatus,
// } from "react-native-document-scanner-plugin";
// import React, { useState } from "react";
// import {
//     Alert,
//     Image,
//     Modal,
//     StyleSheet,
//     Text,
//     TouchableOpacity,
//     View,
// } from "react-native";
// import { StatusBar } from "expo-status-bar";
// import { useSafeAreaInsets } from "react-native-safe-area-context";

// const normalizeScannedUri = (uri) => {
//     if (!uri) return null;

//     if (
//         uri.startsWith("file://") ||
//         uri.startsWith("content://") ||
//         uri.startsWith("data:")
//     ) {
//         return uri;
//     }

//     return `file://${uri}`;
// };

// const getScannedFileName = () => `scanned-document-${Date.now()}.jpg`;

// const createScannedDocumentMessage = ({ uri, tr, width, height }) => {
//     const fileName = getScannedFileName();

//     return {
//         id: `${Date.now()}-scanned-document`,
//         side: "me",
//         type: "document",
//         uri,
//         fileName,
//         mimeType: "image/jpeg",
//         width,
//         height,
//         size: undefined,
//         time: tr("now", "Now"),
//     };
// };

// export function useScanDocument({
//     tr,
//     addMessages,
//     cancelVoiceRecordingIfActive,
// }) {
//     const [selectedScannedDocument, setSelectedScannedDocument] = useState(null);
//     const [isScanningDocument, setIsScanningDocument] = useState(false);

//     const scanDocumentWithCamera = async () => {
//         if (isScanningDocument) return;

//         try {
//             setSelectedScannedDocument(null);
//             setIsScanningDocument(true);

//             if (typeof cancelVoiceRecordingIfActive === "function") {
//                 await cancelVoiceRecordingIfActive();
//             }

//             const response = await DocumentScanner.scanDocument({
//                 croppedImageQuality: 100,
//                 maxNumDocuments: 1,
//                 responseType: ResponseType.ImageFilePath,
//             });

//             if (
//                 response?.status === ScanDocumentResponseStatus.Cancel ||
//                 !response?.scannedImages?.length
//             ) {
//                 return;
//             }

//             const scannedUri = normalizeScannedUri(response.scannedImages[0]);

//             if (!scannedUri) {
//                 Alert.alert(
//                     tr("errorTitle", "Something went wrong"),
//                     tr("scanDocumentError", "Could not scan the document. Please try again.")
//                 );
//                 return;
//             }

//             const scannedMessage = createScannedDocumentMessage({
//                 uri: scannedUri,
//                 tr,
//             });

//             setSelectedScannedDocument(scannedMessage);
//         } catch (error) {
//             console.log("Document scanner error:", error);

//             Alert.alert(
//                 tr("errorTitle", "Something went wrong"),
//                 tr(
//                     "scanDocumentNativeError",
//                     "Document scanner is not available in Expo Go. Use a development build after installing react-native-document-scanner-plugin."
//                 )
//             );
//         } finally {
//             setIsScanningDocument(false);
//         }
//     };

//     const handleCancelScannedDocument = () => {
//         setSelectedScannedDocument(null);
//     };

//     const handleConfirmSendScannedDocument = () => {
//         if (!selectedScannedDocument) return;

//         addMessages([
//             {
//                 ...selectedScannedDocument,
//                 id: selectedScannedDocument.id || `${Date.now()}-scanned-document`,
//                 time: tr("now", "Now"),
//             },
//         ]);

//         setSelectedScannedDocument(null);
//     };

//     return {
//         selectedScannedDocument,
//         isScanningDocument,
//         scanDocumentWithCamera,
//         handleCancelScannedDocument,
//         handleConfirmSendScannedDocument,
//     };
// }

// export function ScannedDocumentConfirmModal({
//     visible,
//     documentItem,
//     colors,
//     tr,
//     onCancel,
//     onRetake,
//     onSend,
// }) {
//     const insets = useSafeAreaInsets();

//     if (!visible || !documentItem) {
//         return null;
//     }

//     return (
//         <Modal
//             visible={visible}
//             transparent
//             animationType="fade"
//             onRequestClose={onCancel}
//             statusBarTranslucent
//             navigationBarTranslucent
//             presentationStyle="overFullScreen"
//         >
//             <View style={styles.modalRoot}>
//                 <StatusBar style="light" translucent backgroundColor="transparent" />

//                 <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
//                     <TouchableOpacity
//                         style={styles.roundButton}
//                         activeOpacity={0.85}
//                         onPress={onCancel}
//                     >
//                         <Ionicons name="close" size={27} color="#ffffff" />
//                     </TouchableOpacity>

//                     <View style={styles.headerTitleWrapper}>
//                         <Text style={styles.headerTitle}>
//                             {tr("scannedDocument", "Scanned Document")}
//                         </Text>
//                         <Text style={styles.headerSubtitle} numberOfLines={1}>
//                             {documentItem.fileName}
//                         </Text>
//                     </View>

//                     <TouchableOpacity
//                         style={styles.retakeButton}
//                         activeOpacity={0.85}
//                         onPress={onRetake}
//                     >
//                         <Ionicons name="camera-outline" size={18} color="#ffffff" />
//                         <Text style={styles.retakeText}>
//                             {tr("retake", "Retake")}
//                         </Text>
//                     </TouchableOpacity>
//                 </View>

//                 <View style={styles.previewArea}>
//                     <View style={styles.paperFrame}>
//                         <Image
//                             source={{ uri: documentItem.uri }}
//                             style={styles.scannedImage}
//                             resizeMode="contain"
//                         />
//                     </View>
//                 </View>

//                 <View
//                     style={[
//                         styles.bottomBar,
//                         { paddingBottom: Math.max(insets.bottom, 12) + 10 },
//                     ]}
//                 >
//                     <View style={styles.filePill}>
//                         <MaterialCommunityIcons
//                             name="file-image"
//                             size={25}
//                             color="rgba(255, 255, 255, 0.9)"
//                         />

//                         <View style={styles.fileTextWrapper}>
//                             <Text style={styles.fileName} numberOfLines={1}>
//                                 {documentItem.fileName}
//                             </Text>
//                             <Text style={styles.fileMeta}>
//                                 {tr("scanReadyToSend", "Ready to send as document")}
//                             </Text>
//                         </View>
//                     </View>

//                     <TouchableOpacity
//                         style={[
//                             styles.sendButton,
//                             { backgroundColor: colors?.primary || "#22C55E" },
//                         ]}
//                         activeOpacity={0.9}
//                         onPress={onSend}
//                     >
//                         <Ionicons name="send" size={24} color="#06111F" />
//                         <Text style={styles.sendText}>
//                             {tr("send", "Send")}
//                         </Text>
//                     </TouchableOpacity>
//                 </View>
//             </View>
//         </Modal>
//     );
// }

// const styles = StyleSheet.create({
//     modalRoot: {
//         flex: 1,
//         backgroundColor: "#000000",
//     },

//     header: {
//         minHeight: 90,
//         paddingHorizontal: 14,
//         paddingBottom: 12,
//         flexDirection: "row",
//         alignItems: "center",
//         gap: 12,
//         backgroundColor: "rgba(0, 0, 0, 0.96)",
//         zIndex: 10,
//     },

//     roundButton: {
//         width: 46,
//         height: 46,
//         borderRadius: 23,
//         backgroundColor: "rgba(255, 255, 255, 0.13)",
//         borderWidth: 1,
//         borderColor: "rgba(255, 255, 255, 0.10)",
//         alignItems: "center",
//         justifyContent: "center",
//         flexShrink: 0,
//     },

//     headerTitleWrapper: {
//         flex: 1,
//         minWidth: 0,
//         alignItems: "center",
//     },

//     headerTitle: {
//         color: "#ffffff",
//         fontSize: 16,
//         fontWeight: "900",
//     },

//     headerSubtitle: {
//         marginTop: 2,
//         color: "rgba(255, 255, 255, 0.62)",
//         fontSize: 11,
//         fontWeight: "700",
//     },

//     retakeButton: {
//         minWidth: 94,
//         height: 46,
//         borderRadius: 23,
//         paddingHorizontal: 13,
//         backgroundColor: "rgba(255, 255, 255, 0.13)",
//         borderWidth: 1,
//         borderColor: "rgba(255, 255, 255, 0.10)",
//         flexDirection: "row",
//         alignItems: "center",
//         justifyContent: "center",
//         gap: 6,
//         flexShrink: 0,
//     },

//     retakeText: {
//         color: "#ffffff",
//         fontSize: 13,
//         fontWeight: "900",
//     },

//     previewArea: {
//         flex: 1,
//         backgroundColor: "#0B0F14",
//         alignItems: "center",
//         justifyContent: "center",
//         paddingHorizontal: 14,
//         paddingVertical: 14,
//     },

//     paperFrame: {
//         width: "100%",
//         height: "100%",
//         borderRadius: 12,
//         backgroundColor: "#111827",
//         borderWidth: 1,
//         borderColor: "rgba(255, 255, 255, 0.10)",
//         overflow: "hidden",
//         alignItems: "center",
//         justifyContent: "center",
//     },

//     scannedImage: {
//         width: "100%",
//         height: "100%",
//     },

//     bottomBar: {
//         paddingHorizontal: 14,
//         paddingTop: 12,
//         backgroundColor: "rgba(0, 0, 0, 0.96)",
//         borderTopWidth: 1,
//         borderTopColor: "rgba(255, 255, 255, 0.08)",
//         gap: 12,
//     },

//     filePill: {
//         minHeight: 58,
//         borderRadius: 18,
//         paddingHorizontal: 14,
//         backgroundColor: "rgba(255, 255, 255, 0.08)",
//         borderWidth: 1,
//         borderColor: "rgba(255, 255, 255, 0.13)",
//         flexDirection: "row",
//         alignItems: "center",
//         gap: 10,
//     },

//     fileTextWrapper: {
//         flex: 1,
//         minWidth: 0,
//     },

//     fileName: {
//         color: "#ffffff",
//         fontSize: 14,
//         fontWeight: "900",
//     },

//     fileMeta: {
//         marginTop: 3,
//         color: "rgba(255, 255, 255, 0.62)",
//         fontSize: 12,
//         fontWeight: "700",
//     },

//     sendButton: {
//         height: 52,
//         borderRadius: 18,
//         flexDirection: "row",
//         alignItems: "center",
//         justifyContent: "center",
//         gap: 8,
//     },

//     sendText: {
//         color: "#06111F",
//         fontSize: 15,
//         fontWeight: "900",
//     },
// });

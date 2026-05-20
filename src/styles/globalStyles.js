import { StyleSheet } from "react-native";

export const globalStyles = StyleSheet.create({
    rtlText: {
        textAlign: "right",
        writingDirection: "rtl",
    },

    ltrText: {
        textAlign: "left",
        writingDirection: "ltr",
    },

    rtlWriting: {
        writingDirection: "rtl",
    },

    ltrWriting: {
        writingDirection: "ltr",
    },

    rowReverse: {
        flexDirection: "row-reverse",
    },

    row: {
        flexDirection: "row",
    },

    inputArabic: {
        marginLeft: 0,
        marginRight: 18,
        writingDirection: "rtl",
        textAlign: "right",
    },

    inputEnglish: {
        marginLeft: 18,
        marginRight: 0,
        writingDirection: "ltr",
        textAlign: "left",
    },

    alignArabic: {
        alignSelf: "flex-end",
    },

    alignEnglish: {
        alignSelf: "flex-start",
    },
});

export const getTextDirectionStyle = (isArabic) =>
    isArabic ? globalStyles.rtlText : globalStyles.ltrText;

export const getWritingDirectionStyle = (isArabic) =>
    isArabic ? globalStyles.rtlWriting : globalStyles.ltrWriting;

export const getRowDirectionStyle = (isArabic) =>
    isArabic ? globalStyles.rowReverse : globalStyles.row;

export const getInputLanguageStyle = (isArabic) =>
    isArabic ? globalStyles.inputArabic : globalStyles.inputEnglish;

export const getLanguageButtonPositionStyle = (isArabic) =>
    isArabic ? globalStyles.alignArabic : globalStyles.alignEnglish;
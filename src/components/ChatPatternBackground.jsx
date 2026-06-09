
import { Feather } from "@expo/vector-icons";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { useAppTheme } from "@/src/theme/ThemeProvider";

const CHANNEL_PATTERN_ICONS = [
    { name: "package", topRatio: 0.03, left: 22 },
    { name: "truck", topRatio: 0.10, right: 28 },
    { name: "map-pin", topRatio: 0.20, left: 14 },
    { name: "anchor", topRatio: 0.31, right: 16 },
    { name: "box", topRatio: 0.45, left: 30 },
    { name: "navigation", topRatio: 0.60, right: 34 },
    { name: "globe", topRatio: 0.76, left: 18 },
    { name: "package", topRatio: 0.91, right: 18 },
];

export default function ChatPatternBackground({ topOffset = 0, iconSize = 32, style }) {
    const { height } = useWindowDimensions();
    const { colors, isDark } = useAppTheme();
    const iconColor = isDark ? colors.border || colors.borderSoft : colors.borderSoft;

    const availableHeight = Math.max(0, height - topOffset);

    return (
        <View pointerEvents="none" style={[styles.patternLayer, { top: topOffset }, style]}>
            {CHANNEL_PATTERN_ICONS.map((item, index) => (
                <Feather
                    key={`${item.name}-${index}`}
                    name={item.name}
                    size={iconSize}
                    style={[
                        styles.patternIcon,
                        {
                            top: availableHeight * item.topRatio,
                            left: item.left,
                            right: item.right,
                            color: iconColor,
                        },
                    ]}
                />
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    patternLayer: {
        position: "absolute",
        right: 0,
        bottom: 0,
        left: 0,
        zIndex: 0,
    },
    patternIcon: {
        position: "absolute",
    },
});

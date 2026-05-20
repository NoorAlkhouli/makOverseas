// import { Stack } from "expo-router";

// export default function RootLayout() {
//   return <Stack />;
// }

// import "../src/i18n";
// import RootNavigator from "../src/navigation/RootNavigator";

// export default function Layout() {
//   return <RootNavigator />;
// }

import "../src/i18n";
import RootNavigator from "../src/navigation/RootNavigator";
import { ThemeProvider } from "../src/theme/ThemeProvider";

export default function Layout() {
  return (
    <ThemeProvider>
      <RootNavigator />
    </ThemeProvider>
  );
}
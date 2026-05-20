import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import MainTabsNavigator from './MainTabsNavigator';

import Notifications from '../screens/main/Notifications';
// import NotificationSettings from '../screens/main/NotificationSettings';
// import ChannelDetails from '../screens/main/ChannelDetails';
// import ChatDetails from '../screens/main/ChatDetails';

const Stack = createNativeStackNavigator();

export default function MainAppNavigator() {
    return (
        <Stack.Navigator
            initialRouteName="MainTabs"
            screenOptions={{
                headerShown: false,
            }}
        >
            <Stack.Screen name="MainTabs" component={MainTabsNavigator} />

            <Stack.Screen name="Notifications" component={Notifications} />
        </Stack.Navigator>
    );
}
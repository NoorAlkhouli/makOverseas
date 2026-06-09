import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import MainTabsNavigator from './MainTabsNavigator';

import Notifications from '../screens/main/Notifications';


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
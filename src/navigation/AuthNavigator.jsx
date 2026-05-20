import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import SplashScreen from '../screens/auth/SplashScreen';
import Login from '../screens/auth/Login';
import AccessCode from '../screens/auth/AccessCode';

import MainTabsNavigator from './MainTabsNavigator';
import IndividualChat from '../screens/main/IndividualChat';

const Stack = createNativeStackNavigator();

export default function AuthNavigator() {
    return (
        <Stack.Navigator
            initialRouteName="Splash"
            screenOptions={{
                headerShown: false,
            }}
        >
            <Stack.Screen name="Splash" component={SplashScreen} />
            <Stack.Screen name="Login" component={Login} />
            <Stack.Screen name="AccessCode" component={AccessCode} />

            <Stack.Screen name="MainTabsNavigator" component={MainTabsNavigator} />
            <Stack.Screen name="IndividualChat" component={IndividualChat} />
        </Stack.Navigator>
    );
}
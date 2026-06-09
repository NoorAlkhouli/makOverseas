import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import SplashScreen from '../screens/auth/SplashScreen';
import Login from '../screens/auth/Login';
import AccessCode from '../screens/auth/AccessCode';

import MainTabsNavigator from './MainTabsNavigator';
import IndividualChat from '../screens/main/IndividualChat';
import IndividualChatProfile from '../screens/main/IndividualChatProfile';
import ChannelChat from "../components/ChannelChat";

import { AppRealtimeProvider } from '../context/AppRealtimeProvider';

const RootStack = createNativeStackNavigator();
const AppStack = createNativeStackNavigator();

function AuthenticatedAppNavigator() {
    return (
        <AppRealtimeProvider>
            <AppStack.Navigator
                initialRouteName="MainTabs"
                screenOptions={{
                    headerShown: false,
                }}
            >
                <AppStack.Screen
                    name="MainTabs"
                    component={MainTabsNavigator}
                />

                <AppStack.Screen
                    name="IndividualChat"
                    component={IndividualChat}
                />

                <AppStack.Screen
                    name="IndividualChatProfile"
                    component={IndividualChatProfile}
                />

                <AppStack.Screen
                    name="ChannelChat"
                    component={ChannelChat}
                />
            </AppStack.Navigator>
        </AppRealtimeProvider>
    );
}

export default function AuthNavigator() {
    return (
        <RootStack.Navigator
            initialRouteName="Splash"
            screenOptions={{
                headerShown: false,
            }}
        >
            <RootStack.Screen
                name="Splash"
                component={SplashScreen}
            />

            <RootStack.Screen
                name="Login"
                component={Login}
            />

            <RootStack.Screen
                name="AccessCode"
                component={AccessCode}
            />

            <RootStack.Screen
                name="MainTabsNavigator"
                component={AuthenticatedAppNavigator}
            />
        </RootStack.Navigator>
    );
}
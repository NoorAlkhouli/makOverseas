import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import Home from '../screens/main/Home';
import Channels from '../screens/main/Channels';
import Chat from '../screens/main/Chat';
import Profile from '../screens/main/Profile';
import Search from '../screens/main/Search';
import Calls from '../screens/main/Calls';

import BottomTabBar from '../components/BottomTabBar';
import Notifications from '../screens/main/Notifications';

const Tab = createBottomTabNavigator();

export default function MainTabsNavigator() {
    return (
        <Tab.Navigator
            initialRouteName="Home"
            tabBar={(props) => <BottomTabBar {...props} />}
            screenOptions={{
                headerShown: false,
            }}
        >
            <Tab.Screen name="Home" component={Home} />
            <Tab.Screen name="Chat" component={Chat} />
            <Tab.Screen name="Channels" component={Channels} />
            <Tab.Screen name="Search" component={Search} />
            <Tab.Screen name="Profile" component={Profile} />
            <Tab.Screen name="Calls" component={Calls} />

            <Tab.Screen name="Notifications" component={Notifications} />
        </Tab.Navigator>
    );
}
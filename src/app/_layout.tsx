import { StatusBar } from 'expo-status-bar';
import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import BottomNavbar from "../components/NavBarComponent/bottom-navbar.component";
import { useAppStore } from "../store";
import Index from "./index";
import Settings from "./settings";

const RootLayout = () => {
  const [activeTab, setActiveTab] = useState('map');
  const { appTheme } = useAppStore();

  const renderActiveScreen = () => {
    switch (activeTab) {
      case 'settings':
        return <Settings />;
      default:
        return <Index />;
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style={appTheme === 'dark' ? 'light' : 'dark'} hidden={false} translucent={true} />
      <View style={styles.content}>
        {renderActiveScreen()}
      </View>
      <BottomNavbar onTabChange={setActiveTab} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  content: {
    flex: 1,
  },
});

export default RootLayout;
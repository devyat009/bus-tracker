import { StyleSheet, View } from "react-native";
import React, { useState } from "react";
import BottomNavbar from "../components/BottomNavbar";
import Index from "./index";
import Settings from "./settings";

const RootLayout = () => {
  const [activeTab, setActiveTab] = useState('map');

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

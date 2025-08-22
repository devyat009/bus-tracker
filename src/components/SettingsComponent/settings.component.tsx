import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { LayoutAnimation, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAppStore } from '../../store';

const SettingsOptions = () => {
  const [mapExpanded, setMapExpanded] = useState(false);
  const [appExpanded, setAppExpanded] = useState(false);
  
  const mapTheme = useAppStore(state => state.style); // Map theme
  const appTheme = useAppStore(state => state.appTheme); // App theme
  const setMapTheme = useAppStore(state => state.setMapStyle);
  const setAppTheme = useAppStore(state => state.setAppTheme);

  const toggleMapExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setMapExpanded(!mapExpanded);
  };

  const toggleAppExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setAppExpanded(!appExpanded);
  };

  const handleMapThemeChange = (selectedTheme: 'light' | 'dark') => {
    setMapTheme(selectedTheme);
  };

  const handleAppThemeChange = (selectedTheme: 'light' | 'dark') => {
    setAppTheme(selectedTheme);
  };

  return (
    <View>
      {/* Tema do Aplicativo */}
      <TouchableOpacity onPress={toggleAppExpand} style={[styles.option, { 
        borderBottomColor: appTheme === 'dark' ? '#333' : '#eee',
        backgroundColor: appTheme === 'dark' ? '#000' : '#fff' 
      }]}>
        <Text style={[styles.optionText, { color: appTheme === 'dark' ? '#fff' : '#333' }]}>Tema do Aplicativo</Text>
        <Ionicons
          name={appExpanded ? "chevron-up" : "chevron-down"}
          size={24}
          color={appTheme === 'dark' ? '#ccc' : '#666'}
        />
      </TouchableOpacity>
      {appExpanded && (
        <View style={[styles.expandedContent, { backgroundColor: appTheme === 'dark' ? '#111' : '#f9f9f9' }]}>
          <TouchableOpacity
            style={[
              styles.themeToggle, 
              appTheme === 'light' && {
                backgroundColor: '#e3f2fd',
                borderRadius: 8
              }
            ]}
            onPress={() => handleAppThemeChange('light')}
          >
            <Ionicons
              name={appTheme === 'light' ? "radio-button-on" : "radio-button-off"}
              size={20}
              color={appTheme === 'light' ? "#007AFF" : "#999"}
            />
            <Text style={[styles.themeText, { color: appTheme === 'dark' ? '#fff' : '#333' }]}>Claro</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.themeToggle, 
              appTheme === 'dark' && {
                backgroundColor: '#555',
                borderRadius: 8
              }
            ]}
            onPress={() => handleAppThemeChange('dark')}
          >
            <Ionicons
              name={appTheme === 'dark' ? "radio-button-on" : "radio-button-off"}
              size={20}
              color={appTheme === 'dark' ? "#007AFF" : "#999"}
            />
            <Text style={[styles.themeText, { color: appTheme === 'dark' ? '#fff' : '#333' }]}>Escuro</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Tema do Mapa */}
      <TouchableOpacity onPress={toggleMapExpand} style={[styles.option, { 
        borderBottomColor: appTheme === 'dark' ? '#333' : '#eee',
        backgroundColor: appTheme === 'dark' ? '#000' : '#fff' 
      }]}>
        <Text style={[styles.optionText, { color: appTheme === 'dark' ? '#fff' : '#333' }]}>Tema do Mapa</Text>
        <Ionicons
          name={mapExpanded ? "chevron-up" : "chevron-down"}
          size={24}
          color={appTheme === 'dark' ? '#ccc' : '#666'}
        />
      </TouchableOpacity>
      {mapExpanded && (
        <View style={[styles.expandedContent, { backgroundColor: appTheme === 'dark' ? '#111' : '#f9f9f9' }]}>
          <TouchableOpacity
            style={[
              styles.themeToggle, 
              mapTheme === 'light' && {
                backgroundColor: appTheme === 'dark' ? '#555' : '#e3f2fd',
                borderRadius: 8
              }
            ]}
            onPress={() => handleMapThemeChange('light')}
          >
            <Ionicons
              name={mapTheme === 'light' ? "radio-button-on" : "radio-button-off"}
              size={20}
              color={mapTheme === 'light' ? "#007AFF" : "#999"}
            />
            <Text style={[styles.themeText, { color: appTheme === 'dark' ? '#fff' : '#333' }]}>Claro</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.themeToggle, 
              mapTheme === 'dark' && {
                backgroundColor: appTheme === 'dark' ? '#555' : '#e3f2fd',
                borderRadius: 8
              }
            ]}
            onPress={() => handleMapThemeChange('dark')}
          >
            <Ionicons
              name={mapTheme === 'dark' ? "radio-button-on" : "radio-button-off"}
              size={20}
              color={mapTheme === 'dark' ? "#007AFF" : "#999"}
            />
            <Text style={[styles.themeText, { color: appTheme === 'dark' ? '#fff' : '#333' }]}>Escuro</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  option: {
    padding: 12,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  optionText: {
    fontSize: 16,
  },
  expandedContent: {
    padding: 12,
  },
  themeToggle: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  themeText: {
    marginLeft: 10,
    fontSize: 16,
  },
});

export default SettingsOptions;
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { LayoutAnimation, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAppStore } from '../../store';

const SettingsOptions = () => {
  const [expanded, setExpanded] = useState(false);
  const theme = useAppStore(state => state.style); // 'light' | 'dark' | 'osm'...
  const setTheme = useAppStore(state => state.setMapStyle);

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(!expanded);
  };

  const handleThemeChange = (selectedTheme: 'light' | 'dark') => {
    setTheme(selectedTheme);
  };

  return (
    <View>
      <TouchableOpacity onPress={toggleExpand} style={[styles.option, { 
        borderBottomColor: theme === 'dark' ? '#333' : '#eee',
        backgroundColor: theme === 'dark' ? '#000' : '#fff' 
      }]}>
        <Text style={[styles.optionText, { color: theme === 'dark' ? '#fff' : '#333' }]}>Tema do Mapa</Text>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={24}
          color={theme === 'dark' ? '#ccc' : '#666'}
        />
      </TouchableOpacity>
      {expanded && (
        <View style={[styles.expandedContent, { backgroundColor: theme === 'dark' ? '#111' : '#f9f9f9' }]}>
          <TouchableOpacity
            style={[styles.themeToggle, theme === 'light' && styles.themeActive]}
            onPress={() => handleThemeChange('light')}
          >
            <Ionicons
              name={theme === 'light' ? "radio-button-on" : "radio-button-off"}
              size={20}
              color={theme === 'light' ? "#007AFF" : "#999"}
            />
            <Text style={[styles.themeText, { color: theme === 'dark' ? '#fff' : '#333' }]}>Claro</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.themeToggle, theme === 'dark' && styles.themeActive]}
            onPress={() => handleThemeChange('dark')}
          >
            <Ionicons
              name={theme === 'dark' ? "radio-button-on" : "radio-button-off"}
              size={20}
              color={theme === 'dark' ? "#007AFF" : "#999"}
            />
            <Text style={[styles.themeText, { color: theme === 'dark' ? '#fff' : '#333' }]}>Escuro</Text>
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
  themeActive: {
    backgroundColor: "#e6f0ff",
    borderRadius: 8,
  },
  themeText: {
    marginLeft: 10,
    fontSize: 16,
  },
});

export default SettingsOptions;
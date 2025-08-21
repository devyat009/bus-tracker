import SettingsOptions from '@/src/components/Settings/options.component';
import { useAppStore } from '@/src/store';
import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import DeveloperOptions from '../components/SettingsComponent/DeveloperOptions';

const Settings = () => {
  const theme = useAppStore(state => state.style);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme === 'dark' ? '#000' : '#fff' }]}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <Text style={[styles.title, { color: theme === 'dark' ? '#fff' : '#000' }]}>Settings</Text>
          <Text style={[styles.subtitle, { color: theme === 'dark' ? '#ccc' : '#666' }]}>Configurações do aplicativo</Text>
          <DeveloperOptions />
          <SettingsOptions />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  title: {
    marginTop: 25,
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
  },
});

export default Settings;

import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { LayoutAnimation, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, UIManager, View } from 'react-native';
import { useAppStore } from '../../src/store';

type UrlKey = 'buses' | 'stops' | 'lines';
interface UrlItem {
  key: UrlKey;
  label: string;
  url: string;
}
const URLS: UrlItem[] = [
  {
    key: 'buses',
    label: 'Ônibus',
    url: 'http://geoserver.semob.df.gov.br/geoserver/semob/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=semob%3A%C3%9Altima%20posi%C3%A7%C3%A3o%20da%20frota&outputFormat=application%2Fjson',
  },
  {
    key: 'stops',
    label: 'Paradas',
    url: 'http://geoserver.semob.df.gov.br/geoserver/semob/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=semob%3AParadas%20de%20onibus&outputFormat=application%2Fjson',
  },
  {
    key: 'lines',
    label: 'Linhas',
    url: 'http://geoserver.semob.df.gov.br/geoserver/semob/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=semob%3ALinhas%20de%20onibus&outputFormat=application%2Fjson',
  },
];

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const DeveloperOptions = () => {
  const appTheme = useAppStore(state => state.appTheme);
  const [expanded, setExpanded] = useState(false);
  const [results, setResults] = useState<Partial<Record<UrlKey, 'success' | 'error' | 'loading'>>>({});
  const [logs, setLogs] = useState<Partial<Record<UrlKey, string>>>({});
  const [previewData, setPreviewData] = useState<Partial<Record<UrlKey, any>>>({});
  const [showPreview, setShowPreview] = useState<{ key: UrlKey | null, visible: boolean }>({ key: null, visible: false });

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => !prev);
  };

  const fetchAndPreview = async (key: UrlKey, url: string) => {
    setResults(r => ({ ...r, [key]: 'loading' }));
    setLogs(l => ({ ...l, [key]: '' }));
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const geojson = await res.json();
      setResults(r => ({ ...r, [key]: 'success' }));
      setLogs(l => ({ ...l, [key]: JSON.stringify(geojson).slice(0, 500) }));
      setPreviewData(d => ({ ...d, [key]: geojson }));
    } catch (e) {
      setResults(r => ({ ...r, [key]: 'error' }));
      setLogs(l => ({ ...l, [key]: String(e) }));
      setPreviewData(d => ({ ...d, [key]: null }));
    }
  };

  const checkUrl = async (key: UrlKey, url: string) => {
    setResults(r => ({ ...r, [key]: 'loading' }));
    setLogs(l => ({ ...l, [key]: '' }));
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const text = await res.text();
      setResults(r => ({ ...r, [key]: 'success' }));
      setLogs(l => ({ ...l, [key]: text.slice(0, 500) }));
    } catch (e) {
      setResults(r => ({ ...r, [key]: 'error' }));
      setLogs(l => ({ ...l, [key]: String(e) }));
    }
  };

  const getPreviewTitle = (key: UrlKey | null) => {
    switch (key) {
      case 'buses': return 'Preview dos Ônibus';
      case 'stops': return 'Preview das Paradas';
      case 'lines': return 'Preview das Rotas';
      default: return 'Preview';
    }
  };

  return (
    <View style={[styles.section, { backgroundColor: appTheme === 'dark' ? '#111' : '#f7f7f7' }]}>
      <TouchableOpacity style={styles.headerRow} onPress={toggleExpand} activeOpacity={0.7}>
        <Text style={[styles.sectionTitle, { color: appTheme === 'dark' ? '#fff' : '#000' }]}>Opções de Desenvolvedor</Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={24}
          color={appTheme === 'dark' ? '#fff' : '#333'}
          style={styles.chevron}
        />
      </TouchableOpacity>
      {expanded && (
        <ScrollView>
          {URLS.map(({ key, label, url }) => (
            <View key={key} style={styles.row}>
              <TouchableOpacity
                style={styles.button}
                onPress={() => fetchAndPreview(key, url)}
              >
                <Text style={styles.buttonText}>{label}</Text>
              </TouchableOpacity>
              <Text style={{ 
                color: results[key] === 'success' ? 'green' : results[key] === 'error' ? 'red' : (appTheme === 'dark' ? '#ccc' : '#888'), 
                marginLeft: 8 
              }}>
                {results[key] === 'success' && 'OK'}
                {results[key] === 'error' && 'Erro'}
                {results[key] === 'loading' && '...'}
              </Text>
              {results[key] === 'error' && (
                <TouchableOpacity onPress={() => alert(logs[key])}>
                  <Text style={[styles.logLink, { color: appTheme === 'dark' ? '#ff6b6b' : '#c30505' }]}>Ver log</Text>
                </TouchableOpacity>
              )}
              {results[key] === 'success' && previewData[key] && (
                <TouchableOpacity onPress={() => setShowPreview({ key, visible: true })}>
                  <Text style={[styles.logLink, { color: appTheme === 'dark' ? '#ff6b6b' : '#c30505' }]}>Preview</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </ScrollView>
      )}

      {/* Modal de preview */}
      <Modal
        visible={showPreview.visible && !!showPreview.key}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPreview({ key: null, visible: false })}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: appTheme === 'dark' ? '#222' : '#fff' }]}>
            <Text style={[styles.modalTitle, { color: appTheme === 'dark' ? '#fff' : '#000' }]}>{getPreviewTitle(showPreview.key)}</Text>
            <ScrollView style={{ maxHeight: 400 }}>
              {previewData[showPreview.key as UrlKey]?.features?.slice(0, 10).map((feature: any, idx: number) => (
                <View key={idx} style={[styles.featureBox, { backgroundColor: appTheme === 'dark' ? '#333' : '#f3f3f3' }]}>
                  <Text style={[styles.featureTitle, { color: appTheme === 'dark' ? '#fff' : '#000' }]}>{`${getPreviewTitle(showPreview.key).replace('Preview ', '')} #${idx + 1}`}</Text>
                  <Text style={[styles.featureText, { color: appTheme === 'dark' ? '#ccc' : '#222' }]}>
                    {JSON.stringify(feature.properties, null, 2)}
                  </Text>
                </View>
              ))}
              {!previewData[showPreview.key as UrlKey]?.features?.length && (
                <Text style={[styles.featureText, { color: appTheme === 'dark' ? '#ccc' : '#222' }]}>Nenhum dado encontrado.</Text>
              )}
            </ScrollView>
            <Pressable style={styles.closeButton} onPress={() => setShowPreview({ key: null, visible: false })}>
              <Text style={styles.closeButtonText}>Fechar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    marginTop: 32,
    padding: 16,
    borderRadius: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  chevron: {
    marginLeft: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  button: {
    backgroundColor: '#1f6feb',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 6,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  logLink: {
    marginLeft: 10,
    textDecorationLine: 'underline',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxWidth: 400,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  featureBox: {
    marginBottom: 14,
    borderRadius: 8,
    padding: 8,
  },
  featureTitle: {
    fontWeight: 'bold',
    marginBottom: 2,
  },
  featureText: {
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  closeButton: {
    marginTop: 16,
    alignSelf: 'center',
    backgroundColor: '#1f6feb',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 24,
  },
  closeButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default DeveloperOptions;
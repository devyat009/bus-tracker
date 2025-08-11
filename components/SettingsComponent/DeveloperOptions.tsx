import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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

const DeveloperOptions = () => {
  const [results, setResults] = useState<Partial<Record<UrlKey, 'success' | 'error' | 'loading'>>>({});
  const [logs, setLogs] = useState<Partial<Record<UrlKey, string>>>({});
  const [previewRoutes, setPreviewRoutes] = useState<any>(null);

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

  const handlePreviewRoutes = async () => {
    setResults(r => ({ ...r, lines: 'loading' }));
    setLogs(l => ({ ...l, lines: '' }));
    try {
      const urlObj = URLS.find(u => u.key === 'lines');
      if (!urlObj) throw new Error('URL não encontrada');
      const res = await fetch(urlObj.url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const geojson = await res.json();
      setResults(r => ({ ...r, lines: 'success' }));
      setLogs(l => ({ ...l, lines: JSON.stringify(geojson).slice(0, 500) }));
      setPreviewRoutes(geojson);
    } catch (e) {
      setResults(r => ({ ...r, lines: 'error' }));
      setLogs(l => ({ ...l, lines: String(e) }));
      setPreviewRoutes(null);
    }
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Opções de Desenvolvedor</Text>
      <ScrollView>
        {URLS.map(({ key, label, url }) => (
          <View key={key} style={styles.row}>
            <TouchableOpacity
              style={styles.button}
              onPress={() => key === 'lines' ? handlePreviewRoutes() : checkUrl(key, url)}
            >
              <Text style={styles.buttonText}>{label}</Text>
            </TouchableOpacity>
            <Text style={{ color: results[key] === 'success' ? 'green' : results[key] === 'error' ? 'red' : '#888', marginLeft: 8 }}>
              {results[key] === 'success' && 'OK'}
              {results[key] === 'error' && 'Erro'}
              {results[key] === 'loading' && '...'}
            </Text>
            {results[key] === 'error' && (
              <TouchableOpacity onPress={() => alert(logs[key])}>
                <Text style={styles.logLink}>Ver log</Text>
              </TouchableOpacity>
            )}
            {key === 'lines' && results[key] === 'success' && previewRoutes && (
              <TouchableOpacity onPress={() => alert('Preview de rotas não implementado no mobile.')}>
                <Text style={styles.logLink}>Preview</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    marginTop: 32,
    padding: 16,
    backgroundColor: '#f7f7f7',
    borderRadius: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
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
    color: '#c30505',
    marginLeft: 10,
    textDecorationLine: 'underline',
  },
});

export default DeveloperOptions;

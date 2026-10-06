import Feather from '@expo/vector-icons/Feather';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState, type ComponentProps } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { APP_URL, classifyNavigation } from './src/navigation';

type IconName = ComponentProps<typeof Feather>['name'];

function IconButton({
  icon,
  label,
  onPress,
  disabled = false,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
    >
      <Feather name={icon} size={22} color={disabled ? '#b6bdc8' : '#263247'} />
    </Pressable>
  );
}

function SetlineApp() {
  const webView = useRef<WebView>(null);
  const [sourceUrl, setSourceUrl] = useState(APP_URL);
  const [currentUrl, setCurrentUrl] = useState(APP_URL);
  const [instance, setInstance] = useState(0);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  async function openExternal(url: string) {
    if (classifyNavigation(url) !== 'external' && classifyNavigation(url) !== 'internal') return;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Unable to open link', 'No app is available to open this link.');
    }
  }

  function load(url: string) {
    if (url === 'about:blank' || classifyNavigation(url) !== 'internal') return;
    setFailed(false);
    setLoading(true);
    setCanGoBack(false);
    setCanGoForward(false);
    setSourceUrl(url);
    setCurrentUrl(url);
    setInstance((value) => value + 1);
  }

  function retry() {
    // A new WebView also recovers after iOS terminates its web-content process.
    load(currentUrl);
  }

  function markFailed() {
    setLoading(false);
    setFailed(true);
  }

  async function sharePage() {
    try {
      await Share.share({ url: currentUrl, title: 'Setline' });
    } catch {
      Alert.alert('Unable to share', 'Please try again.');
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Setline home"
          onPress={() => load(APP_URL)}
          style={({ pressed }) => [styles.brand, pressed && styles.pressed]}
        >
          <View style={styles.brandMark}><Text style={styles.brandLetter}>S</Text></View>
          <Text style={styles.brandName}>Setline</Text>
        </Pressable>
        {loading && !failed && <ActivityIndicator accessibilityLabel="Loading Setline" color="#2563eb" />}
      </View>

      <View style={styles.content}>
        <WebView
          key={instance}
          ref={webView}
          source={{ uri: sourceUrl }}
          style={[styles.webView, failed && styles.hidden]}
          // Route top-level links ourselves, including mail and telephone links.
          originWhitelist={['*']}
          onShouldStartLoadWithRequest={(request) => {
            const destination = classifyNavigation(request.url);
            // HTTPS embeds may load inside the site without opening Safari.
            if (request.isTopFrame === false) {
              return destination === 'internal' || (destination === 'external' && /^https:\/\//i.test(request.url));
            }
            if (destination === 'external') void openExternal(request.url);
            return destination === 'internal';
          }}
          onOpenWindow={({ nativeEvent }) => {
            const destination = classifyNavigation(nativeEvent.targetUrl);
            if (destination === 'internal' && nativeEvent.targetUrl !== 'about:blank') {
              // Reuse the WebView so an internal new-window link keeps history.
              setSourceUrl(nativeEvent.targetUrl);
              setFailed(false);
            }
            if (destination === 'external') void openExternal(nativeEvent.targetUrl);
          }}
          onNavigationStateChange={(navigation) => {
            setCanGoBack(navigation.canGoBack);
            setCanGoForward(navigation.canGoForward);
            if (navigation.url !== 'about:blank' && classifyNavigation(navigation.url) === 'internal') {
              setCurrentUrl(navigation.url);
            }
          }}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onError={markFailed}
          onHttpError={({ nativeEvent }) => {
            // WKWebView reports this callback for the main-frame response.
            if (nativeEvent.statusCode >= 400) markFailed();
          }}
          onContentProcessDidTerminate={markFailed}
          allowsBackForwardNavigationGestures
          allowsInlineMediaPlayback
          sharedCookiesEnabled
          javaScriptCanOpenWindowsAutomatically={false}
          contentInsetAdjustmentBehavior="never"
          renderError={() => <View />}
        />

        {failed && (
          <View style={styles.errorScreen} accessibilityLiveRegion="polite">
            <View style={styles.errorIcon}><Feather name="wifi-off" size={30} color="#2563eb" /></View>
            <Text style={styles.errorTitle}>Can't connect to Setline</Text>
            <Text style={styles.errorDescription}>Check your internet connection and try again.</Text>
            <Pressable
              accessibilityRole="button"
              onPress={retry}
              style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
            >
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => void openExternal(currentUrl)}
              style={styles.browserButton}
            >
              <Text style={styles.browserText}>Open in Safari</Text>
            </Pressable>
          </View>
        )}
      </View>

      <View style={styles.toolbar}>
        <IconButton icon="chevron-left" label="Go back" disabled={!canGoBack || failed} onPress={() => webView.current?.goBack()} />
        <IconButton icon="chevron-right" label="Go forward" disabled={!canGoForward || failed} onPress={() => webView.current?.goForward()} />
        <IconButton icon="rotate-cw" label="Reload page" onPress={() => failed ? retry() : webView.current?.reload()} />
        <IconButton icon="share" label="Share page" onPress={() => void sharePage()} />
        <IconButton icon="external-link" label="Open in Safari" onPress={() => void openExternal(currentUrl)} />
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  return <SafeAreaProvider><SetlineApp /></SafeAreaProvider>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#ffffff' },
  header: { minHeight: 60, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e5e9f0' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48 },
  brandMark: { width: 30, height: 30, borderRadius: 9, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center' },
  brandLetter: { color: '#ffffff', fontSize: 19, fontWeight: '800' },
  brandName: { fontSize: 20, fontWeight: '700', color: '#172034' },
  content: { flex: 1 },
  webView: { flex: 1, backgroundColor: '#ffffff' },
  hidden: { opacity: 0 },
  toolbar: { flexDirection: 'row', justifyContent: 'space-around', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#e5e9f0', paddingVertical: 4 },
  iconButton: { width: 52, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  pressed: { opacity: 0.55 },
  errorScreen: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: '#ffffff', padding: 30, alignItems: 'center', justifyContent: 'center', gap: 18 },
  errorIcon: { width: 72, height: 72, borderRadius: 24, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' },
  errorTitle: { color: '#172034', fontSize: 23, fontWeight: '700', textAlign: 'center' },
  errorDescription: { color: '#647084', fontSize: 16, lineHeight: 24, textAlign: 'center', maxWidth: 310 },
  retryButton: { minHeight: 48, paddingHorizontal: 28, borderRadius: 14, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center' },
  retryText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  browserButton: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 16 },
  browserText: { color: '#2563eb', fontSize: 16, fontWeight: '600' },
});

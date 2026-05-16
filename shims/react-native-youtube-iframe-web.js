// Web shim for react-native-youtube-iframe
// On web, MeditationVideoModal renders a plain <iframe> directly,
// so this component is never used. Exporting a no-op prevents the
// bundler from pulling in react-native-web-webview (which is not installed).
export default function YoutubePlayer() {
  return null;
}


// youtubePlayer.native.ts
// Static import — Metro must be able to statically analyze the require to include
// the package in the native bundle. Dynamic concatenated requires (e.g.
// 'react-native-youtube-' + 'iframe') are not resolved by Metro's static bundler,
// causing the package to be omitted from the bundle and the component to be null.
// @ts-nocheck

let _YoutubePlayer: any = null;
try {
  _YoutubePlayer = require('react-native-youtube-iframe').default ?? require('react-native-youtube-iframe');
} catch {}
export default _YoutubePlayer;

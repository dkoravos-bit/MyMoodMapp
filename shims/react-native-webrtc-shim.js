/**
 * react-native-webrtc — complete null shim for ALL platforms.
 *
 * react-native-webrtc is listed in package.json for dependency reasons but
 * its native iOS framework (WebRTC.framework) crashes on iOS 26 at startup
 * because RTCPeerConnectionFactory initializes AVFoundation / Core Audio
 * during module registration — before the React Native bridge is ready.
 *
 * This shim replaces ALL exports with safe no-ops so the JS bundle never
 * references the native module, preventing the ObjC exception that causes
 * abort() on com.facebook.react.ExceptionsManagerQueue.
 *
 * Metro resolveRequest intercepts BOTH native and web platforms.
 */

const noop = () => {};
const noopAsync = () => Promise.resolve();

// RTCPeerConnection stub
class RTCPeerConnection {
  constructor() {}
  createOffer()  { return Promise.resolve({}); }
  createAnswer() { return Promise.resolve({}); }
  setLocalDescription()  { return Promise.resolve(); }
  setRemoteDescription() { return Promise.resolve(); }
  addIceCandidate() { return Promise.resolve(); }
  addTrack() { return null; }
  removeTrack() {}
  getLocalStreams()  { return []; }
  getRemoteStreams() { return []; }
  getSenders()   { return []; }
  getReceivers() { return []; }
  getTransceivers() { return []; }
  getStats() { return Promise.resolve(new Map()); }
  close() {}
  addEventListener() {}
  removeEventListener() {}
  dispatchEvent() { return false; }
}

// MediaStream stub
class MediaStream {
  constructor() { this.id = ''; this.active = false; }
  getTracks()      { return []; }
  getAudioTracks() { return []; }
  getVideoTracks() { return []; }
  addTrack() {}
  removeTrack() {}
  addEventListener() {}
  removeEventListener() {}
  toURL() { return ''; }
  release() {}
}

// MediaStreamTrack stub
class MediaStreamTrack {
  constructor() {
    this.id = ''; this.kind = 'audio'; this.label = '';
    this.muted = false; this.enabled = true; this.readyState = 'ended';
  }
  stop() {}
  addEventListener() {}
  removeEventListener() {}
  applyConstraints() { return Promise.resolve(); }
}

// RTCIceCandidate stub
class RTCIceCandidate {
  constructor(init) {
    this.candidate = (init && init.candidate) || '';
    this.sdpMid = (init && init.sdpMid) || null;
    this.sdpMLineIndex = (init && init.sdpMLineIndex) || null;
  }
  toJSON() { return { candidate: this.candidate, sdpMid: this.sdpMid, sdpMLineIndex: this.sdpMLineIndex }; }
}

// RTCSessionDescription stub
class RTCSessionDescription {
  constructor(init) {
    this.type = (init && init.type) || 'offer';
    this.sdp  = (init && init.sdp)  || '';
  }
  toJSON() { return { type: this.type, sdp: this.sdp }; }
}

// RTCView stub (returns null in React — safe no-op component)
const RTCView = () => null;

// getUserMedia stub
const mediaDevices = {
  getUserMedia:    noopAsync,
  getDisplayMedia: noopAsync,
  enumerateDevices: () => Promise.resolve([]),
  addEventListener: noop,
  removeEventListener: noop,
};

const registerGlobals = noop;

module.exports = {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  RTCView,
  MediaStream,
  MediaStreamTrack,
  mediaDevices,
  registerGlobals,
  default: {
    RTCPeerConnection,
    RTCIceCandidate,
    RTCSessionDescription,
    RTCView,
    MediaStream,
    MediaStreamTrack,
    mediaDevices,
    registerGlobals,
  },
};

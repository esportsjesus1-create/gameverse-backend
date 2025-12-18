import dotenv from 'dotenv';
import { IceServer, QualityLevel, QualityPreset, Resolution, VideoCodec } from '../types';

dotenv.config();

export const config = {
  server: {
    port: parseInt(process.env.PORT || '3040', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    wsPort: parseInt(process.env.WS_PORT || '3041', 10)
  },

  webrtc: {
    iceServers: getIceServers(),
    iceCandidatePoolSize: 10
  },

  recording: {
    storagePath: process.env.RECORDING_STORAGE_PATH || '/tmp/recordings',
    maxSizeMB: parseInt(process.env.MAX_RECORDING_SIZE_MB || '1024', 10)
  },

  stream: {
    maxViewersPerStream: parseInt(process.env.MAX_VIEWERS_PER_STREAM || '1000', 10),
    defaultBitrate: parseInt(process.env.DEFAULT_BITRATE || '2500000', 10),
    maxBitrate: parseInt(process.env.MAX_BITRATE || '8000000', 10),
    minBitrate: parseInt(process.env.MIN_BITRATE || '500000', 10)
  },

  quality: {
    presets: getQualityPresets(),
    adaptationInterval: 5000,
    bandwidthThresholds: {
      low: 750000,
      medium: 2000000,
      high: 5000000,
      ultra: 10000000
    }
  }
};

function getIceServers(): IceServer[] {
  const servers: IceServer[] = [];

  const stunServer = process.env.STUN_SERVER;
  if (stunServer) {
    servers.push({ urls: stunServer });
  } else {
    servers.push({ urls: 'stun:stun.l.google.com:19302' });
  }

  const turnServer = process.env.TURN_SERVER;
  const turnUsername = process.env.TURN_USERNAME;
  const turnPassword = process.env.TURN_PASSWORD;

  if (turnServer && turnUsername && turnPassword) {
    servers.push({
      urls: turnServer,
      username: turnUsername,
      credential: turnPassword
    });
  }

  return servers;
}

function getQualityPresets(): QualityLevel[] {
  return [
    {
      preset: QualityPreset.LOW,
      resolution: { width: 640, height: 360 } as Resolution,
      framerate: 15,
      bitrate: parseInt(process.env.QUALITY_LOW_BITRATE || '500000', 10)
    },
    {
      preset: QualityPreset.MEDIUM,
      resolution: { width: 1280, height: 720 } as Resolution,
      framerate: 30,
      bitrate: parseInt(process.env.QUALITY_MEDIUM_BITRATE || '1500000', 10)
    },
    {
      preset: QualityPreset.HIGH,
      resolution: { width: 1920, height: 1080 } as Resolution,
      framerate: 30,
      bitrate: parseInt(process.env.QUALITY_HIGH_BITRATE || '4000000', 10)
    },
    {
      preset: QualityPreset.ULTRA,
      resolution: { width: 3840, height: 2160 } as Resolution,
      framerate: 60,
      bitrate: parseInt(process.env.QUALITY_ULTRA_BITRATE || '8000000', 10)
    }
  ];
}

export function getDefaultStreamSettings() {
  const mediumPreset = config.quality.presets.find(p => p.preset === QualityPreset.MEDIUM);
  return {
    resolution: mediumPreset?.resolution || { width: 1280, height: 720 },
    framerate: mediumPreset?.framerate || 30,
    bitrate: mediumPreset?.bitrate || config.stream.defaultBitrate,
    codec: VideoCodec.VP8,
    audioEnabled: true,
    audioBitrate: 128000
  };
}

export function getDefaultCameraCapabilities() {
  return {
    maxResolution: { width: 1920, height: 1080 } as Resolution,
    supportedResolutions: [
      { width: 640, height: 360 },
      { width: 1280, height: 720 },
      { width: 1920, height: 1080 }
    ] as Resolution[],
    maxFramerate: 60,
    supportedFramerates: [15, 30, 60],
    hasAudio: true,
    hasPanTiltZoom: false
  };
}

import {
  BandwidthStats,
  QualityPreset,
  QualityLevel,
  Viewer
} from '../types';
import { config } from '../config';
import { viewerService } from './viewer.service';
import logger from '../utils/logger';

interface BandwidthSample {
  timestamp: number;
  bandwidth: number;
  packetLoss: number;
  latency: number;
}

const bandwidthHistory: Map<string, BandwidthSample[]> = new Map();
const SAMPLE_WINDOW_MS = 30000;
const MAX_SAMPLES = 30;

export class BandwidthService {
  async recordSample(viewerId: string, stats: BandwidthStats): Promise<void> {
    const samples = bandwidthHistory.get(viewerId) || [];
    const now = Date.now();

    samples.push({
      timestamp: now,
      bandwidth: stats.estimatedBandwidth,
      packetLoss: stats.packetLoss,
      latency: stats.latency
    });

    const cutoff = now - SAMPLE_WINDOW_MS;
    const filteredSamples = samples.filter(s => s.timestamp > cutoff).slice(-MAX_SAMPLES);
    bandwidthHistory.set(viewerId, filteredSamples);

    await viewerService.updateBandwidth(viewerId, stats);
  }

  async getAverageBandwidth(viewerId: string): Promise<number> {
    const samples = bandwidthHistory.get(viewerId) || [];
    if (samples.length === 0) {
      return 0;
    }

    const sum = samples.reduce((acc, s) => acc + s.bandwidth, 0);
    return sum / samples.length;
  }

  async getRecommendedQuality(viewerId: string): Promise<QualityPreset> {
    const avgBandwidth = await this.getAverageBandwidth(viewerId);
    const thresholds = config.quality.bandwidthThresholds;

    if (avgBandwidth >= thresholds.ultra) {
      return QualityPreset.ULTRA;
    } else if (avgBandwidth >= thresholds.high) {
      return QualityPreset.HIGH;
    } else if (avgBandwidth >= thresholds.medium) {
      return QualityPreset.MEDIUM;
    } else {
      return QualityPreset.LOW;
    }
  }

  async adaptQuality(viewerId: string): Promise<QualityPreset | null> {
    try {
      const viewer = await viewerService.findById(viewerId);
      
      if (viewer.quality !== QualityPreset.AUTO) {
        return null;
      }

      const recommendedQuality = await this.getRecommendedQuality(viewerId);
      const currentQuality = this.getCurrentEffectiveQuality(viewer);

      if (recommendedQuality !== currentQuality) {
        await viewerService.setQuality(viewerId, recommendedQuality);
        logger.info(`Adapted quality for viewer ${viewerId}: ${currentQuality} -> ${recommendedQuality}`);
        return recommendedQuality;
      }

      return null;
    } catch {
      return null;
    }
  }

  getQualityLevel(preset: QualityPreset): QualityLevel | undefined {
    return config.quality.presets.find(p => p.preset === preset);
  }

  getBitrateForQuality(preset: QualityPreset): number {
    const level = this.getQualityLevel(preset);
    return level?.bitrate || config.stream.defaultBitrate;
  }

  async estimateBandwidth(viewerId: string, bytesReceived: number, timeMs: number): Promise<number> {
    if (timeMs <= 0) {
      return 0;
    }

    const bandwidth = (bytesReceived * 8 * 1000) / timeMs;
    
    const samples = bandwidthHistory.get(viewerId) || [];
    if (samples.length > 0) {
      const lastSample = samples[samples.length - 1];
      const smoothedBandwidth = lastSample.bandwidth * 0.7 + bandwidth * 0.3;
      return smoothedBandwidth;
    }

    return bandwidth;
  }

  async calculateOptimalBitrate(viewerId: string): Promise<number> {
    const avgBandwidth = await this.getAverageBandwidth(viewerId);
    
    const targetBitrate = avgBandwidth * 0.8;
    
    return Math.min(
      Math.max(targetBitrate, config.stream.minBitrate),
      config.stream.maxBitrate
    );
  }

  async getNetworkCondition(viewerId: string): Promise<'excellent' | 'good' | 'fair' | 'poor'> {
    const samples = bandwidthHistory.get(viewerId) || [];
    if (samples.length === 0) {
      return 'fair';
    }

    const recentSamples = samples.slice(-5);
    const avgPacketLoss = recentSamples.reduce((acc, s) => acc + s.packetLoss, 0) / recentSamples.length;
    const avgLatency = recentSamples.reduce((acc, s) => acc + s.latency, 0) / recentSamples.length;
    const avgBandwidth = recentSamples.reduce((acc, s) => acc + s.bandwidth, 0) / recentSamples.length;

    if (avgPacketLoss < 1 && avgLatency < 50 && avgBandwidth > config.quality.bandwidthThresholds.high) {
      return 'excellent';
    } else if (avgPacketLoss < 3 && avgLatency < 100 && avgBandwidth > config.quality.bandwidthThresholds.medium) {
      return 'good';
    } else if (avgPacketLoss < 5 && avgLatency < 200 && avgBandwidth > config.quality.bandwidthThresholds.low) {
      return 'fair';
    } else {
      return 'poor';
    }
  }

  async getStreamBandwidthStats(streamId: string): Promise<{
    totalBandwidth: number;
    averageBandwidth: number;
    minBandwidth: number;
    maxBandwidth: number;
    viewerCount: number;
  }> {
    const viewers = await viewerService.findByStream(streamId);
    
    if (viewers.length === 0) {
      return {
        totalBandwidth: 0,
        averageBandwidth: 0,
        minBandwidth: 0,
        maxBandwidth: 0,
        viewerCount: 0
      };
    }

    const bandwidths = await Promise.all(
      viewers.map(v => this.getAverageBandwidth(v.id))
    );

    const validBandwidths = bandwidths.filter(b => b > 0);
    
    if (validBandwidths.length === 0) {
      return {
        totalBandwidth: 0,
        averageBandwidth: 0,
        minBandwidth: 0,
        maxBandwidth: 0,
        viewerCount: viewers.length
      };
    }

    const totalBandwidth = validBandwidths.reduce((acc, b) => acc + b, 0);

    return {
      totalBandwidth,
      averageBandwidth: totalBandwidth / validBandwidths.length,
      minBandwidth: Math.min(...validBandwidths),
      maxBandwidth: Math.max(...validBandwidths),
      viewerCount: viewers.length
    };
  }

  async shouldReduceQuality(viewerId: string): Promise<boolean> {
    const samples = bandwidthHistory.get(viewerId) || [];
    if (samples.length < 3) {
      return false;
    }

    const recentSamples = samples.slice(-3);
    const avgPacketLoss = recentSamples.reduce((acc, s) => acc + s.packetLoss, 0) / recentSamples.length;
    
    return avgPacketLoss > 5;
  }

  async shouldIncreaseQuality(viewerId: string): Promise<boolean> {
    const samples = bandwidthHistory.get(viewerId) || [];
    if (samples.length < 5) {
      return false;
    }

    const recentSamples = samples.slice(-5);
    const avgPacketLoss = recentSamples.reduce((acc, s) => acc + s.packetLoss, 0) / recentSamples.length;
    const avgBandwidth = recentSamples.reduce((acc, s) => acc + s.bandwidth, 0) / recentSamples.length;

    try {
      const viewer = await viewerService.findById(viewerId);
      const currentBitrate = this.getBitrateForQuality(viewer.quality);
      
      return avgPacketLoss < 1 && avgBandwidth > currentBitrate * 1.5;
    } catch {
      return false;
    }
  }

  private getCurrentEffectiveQuality(viewer: Viewer): QualityPreset {
    if (viewer.quality === QualityPreset.AUTO) {
      const bandwidth = viewer.bandwidth.estimatedBandwidth;
      const thresholds = config.quality.bandwidthThresholds;

      if (bandwidth >= thresholds.ultra) return QualityPreset.ULTRA;
      if (bandwidth >= thresholds.high) return QualityPreset.HIGH;
      if (bandwidth >= thresholds.medium) return QualityPreset.MEDIUM;
      return QualityPreset.LOW;
    }
    return viewer.quality;
  }

  clearHistory(viewerId: string): void {
    bandwidthHistory.delete(viewerId);
  }

  clear(): void {
    bandwidthHistory.clear();
  }
}

export const bandwidthService = new BandwidthService();

import { cameraService } from '../src/services/camera.service';
import { streamService } from '../src/services/stream.service';
import { recordingService } from '../src/services/recording.service';
import { viewerService } from '../src/services/viewer.service';
import { signalingService } from '../src/services/signaling.service';
import { bandwidthService } from '../src/services/bandwidth.service';

jest.mock('../src/utils/logger');

beforeEach(() => {
  cameraService.clear();
  streamService.clear();
  recordingService.clear();
  viewerService.clear();
  signalingService.clear();
  bandwidthService.clear();
});

afterAll(() => {
  jest.clearAllMocks();
});

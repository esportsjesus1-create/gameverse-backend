import { AssetManager } from '../../src/streaming/asset-manager';
import { testLogger } from '../setup';

describe('AssetManager', () => {
  let assetManager: AssetManager;

  beforeEach(() => {
    assetManager = new AssetManager(
      {
        maxAssets: 100,
        defaultChunkSize: 1024,
        maxConcurrentTransfers: 5,
        transferTimeout: 30000,
        cacheSize: 50
      },
      testLogger
    );
  });

  afterEach(() => {
    assetManager.stop();
  });

  describe('registerAsset', () => {
    it('should register a new asset', () => {
      const data = Buffer.from('test asset data');
      const manifest = assetManager.registerAsset(
        'asset-1',
        'texture',
        'test.png',
        data,
        { customMeta: 'value' }
      );

      expect(manifest).toBeDefined();
      expect(manifest.assetId).toBe('asset-1');
      expect(manifest.assetType).toBe('texture');
      expect(manifest.fileName).toBe('test.png');
      expect(manifest.fileSize).toBe(data.length);
      expect(manifest.metadata.customMeta).toBe('value');
    });

    it('should calculate correct chunk count', () => {
      const data = Buffer.alloc(3000);
      const manifest = assetManager.registerAsset('asset-1', 'mesh', 'test.fbx', data);

      expect(manifest.totalChunks).toBe(3);
    });

    it('should throw error when max assets reached', () => {
      const limitedManager = new AssetManager(
        {
          maxAssets: 1,
          defaultChunkSize: 1024,
          maxConcurrentTransfers: 5,
          transferTimeout: 30000,
          cacheSize: 50
        },
        testLogger
      );

      limitedManager.registerAsset('asset-1', 'texture', 'test.png', Buffer.from('data'));

      expect(() =>
        limitedManager.registerAsset('asset-2', 'texture', 'test2.png', Buffer.from('data'))
      ).toThrow();
    });

    it('should emit assetRegistered event', () => {
      const callback = jest.fn();
      assetManager.on('assetRegistered', callback);

      const data = Buffer.from('test');
      assetManager.registerAsset('asset-1', 'texture', 'test.png', data);

      expect(callback).toHaveBeenCalled();
    });
  });

  describe('getManifest', () => {
    it('should return manifest for existing asset', () => {
      assetManager.registerAsset('asset-1', 'texture', 'test.png', Buffer.from('data'));

      const manifest = assetManager.getManifest('asset-1');

      expect(manifest).toBeDefined();
      expect(manifest?.assetId).toBe('asset-1');
    });

    it('should return undefined for non-existent asset', () => {
      const manifest = assetManager.getManifest('non-existent');
      expect(manifest).toBeUndefined();
    });
  });

  describe('removeAsset', () => {
    it('should remove existing asset', () => {
      assetManager.registerAsset('asset-1', 'texture', 'test.png', Buffer.from('data'));

      const result = assetManager.removeAsset('asset-1');

      expect(result).toBe(true);
      expect(assetManager.getManifest('asset-1')).toBeUndefined();
    });

    it('should return false for non-existent asset', () => {
      const result = assetManager.removeAsset('non-existent');
      expect(result).toBe(false);
    });

    it('should emit assetRemoved event', () => {
      const callback = jest.fn();
      assetManager.on('assetRemoved', callback);

      assetManager.registerAsset('asset-1', 'texture', 'test.png', Buffer.from('data'));
      assetManager.removeAsset('asset-1');

      expect(callback).toHaveBeenCalledWith('asset-1');
    });
  });

  describe('startTransfer', () => {
    it('should start transfer for existing asset', () => {
      assetManager.registerAsset('asset-1', 'texture', 'test.png', Buffer.from('data'));

      const manifest = assetManager.startTransfer(
        { assetId: 'asset-1', assetType: 'texture', priority: 5 },
        'session-1'
      );

      expect(manifest).toBeDefined();
      expect(manifest.assetId).toBe('asset-1');
    });

    it('should throw error for non-existent asset', () => {
      expect(() =>
        assetManager.startTransfer(
          { assetId: 'non-existent', assetType: 'texture', priority: 5 },
          'session-1'
        )
      ).toThrow();
    });

    it('should throw error when max concurrent transfers reached', () => {
      const limitedManager = new AssetManager(
        {
          maxAssets: 100,
          defaultChunkSize: 1024,
          maxConcurrentTransfers: 1,
          transferTimeout: 30000,
          cacheSize: 50
        },
        testLogger
      );

      limitedManager.registerAsset('asset-1', 'texture', 'test1.png', Buffer.from('data1'));
      limitedManager.registerAsset('asset-2', 'texture', 'test2.png', Buffer.from('data2'));

      limitedManager.startTransfer(
        { assetId: 'asset-1', assetType: 'texture', priority: 5 },
        'session-1'
      );

      expect(() =>
        limitedManager.startTransfer(
          { assetId: 'asset-2', assetType: 'texture', priority: 5 },
          'session-1'
        )
      ).toThrow();
    });

    it('should emit transferStarted event', () => {
      const callback = jest.fn();
      assetManager.on('transferStarted', callback);

      assetManager.registerAsset('asset-1', 'texture', 'test.png', Buffer.from('data'));
      assetManager.startTransfer(
        { assetId: 'asset-1', assetType: 'texture', priority: 5 },
        'session-1'
      );

      expect(callback).toHaveBeenCalledWith('asset-1', 'session-1');
    });

    it('should support resume from offset', () => {
      const data = Buffer.alloc(3000);
      assetManager.registerAsset('asset-1', 'texture', 'test.png', data);

      assetManager.startTransfer(
        { assetId: 'asset-1', assetType: 'texture', priority: 5, resumeFrom: 1024 },
        'session-1'
      );

      const status = assetManager.getTransferStatus('asset-1', 'session-1');
      expect(status?.currentChunk).toBe(1);
    });
  });

  describe('getNextChunk', () => {
    it('should return chunk data', () => {
      const data = Buffer.from('test asset data for chunking');
      assetManager.registerAsset('asset-1', 'texture', 'test.png', data);
      assetManager.startTransfer(
        { assetId: 'asset-1', assetType: 'texture', priority: 5 },
        'session-1'
      );

      const chunk = assetManager.getNextChunk('asset-1', 'session-1');

      expect(chunk).toBeDefined();
      expect(chunk?.assetId).toBe('asset-1');
      expect(chunk?.chunkIndex).toBe(0);
      expect(chunk?.data).toBeDefined();
    });

    it('should return null when transfer not found', () => {
      const chunk = assetManager.getNextChunk('non-existent', 'session-1');
      expect(chunk).toBeNull();
    });

    it('should return null when all chunks sent', () => {
      const data = Buffer.from('small');
      assetManager.registerAsset('asset-1', 'texture', 'test.png', data);
      assetManager.startTransfer(
        { assetId: 'asset-1', assetType: 'texture', priority: 5 },
        'session-1'
      );

      assetManager.getNextChunk('asset-1', 'session-1');
      const secondChunk = assetManager.getNextChunk('asset-1', 'session-1');

      expect(secondChunk).toBeNull();
    });

    it('should emit transferProgress event', () => {
      const callback = jest.fn();
      assetManager.on('transferProgress', callback);

      const data = Buffer.from('test data');
      assetManager.registerAsset('asset-1', 'texture', 'test.png', data);
      assetManager.startTransfer(
        { assetId: 'asset-1', assetType: 'texture', priority: 5 },
        'session-1'
      );

      assetManager.getNextChunk('asset-1', 'session-1');

      expect(callback).toHaveBeenCalled();
    });
  });

  describe('completeTransfer', () => {
    it('should complete transfer', () => {
      assetManager.registerAsset('asset-1', 'texture', 'test.png', Buffer.from('data'));
      assetManager.startTransfer(
        { assetId: 'asset-1', assetType: 'texture', priority: 5 },
        'session-1'
      );

      assetManager.completeTransfer('asset-1', 'session-1');

      expect(assetManager.getTransferStatus('asset-1', 'session-1')).toBeUndefined();
    });

    it('should emit transferCompleted event', () => {
      const callback = jest.fn();
      assetManager.on('transferCompleted', callback);

      assetManager.registerAsset('asset-1', 'texture', 'test.png', Buffer.from('data'));
      assetManager.startTransfer(
        { assetId: 'asset-1', assetType: 'texture', priority: 5 },
        'session-1'
      );
      assetManager.completeTransfer('asset-1', 'session-1');

      expect(callback).toHaveBeenCalledWith('asset-1', 'session-1');
    });
  });

  describe('cancelTransfer', () => {
    it('should cancel active transfer', () => {
      assetManager.registerAsset('asset-1', 'texture', 'test.png', Buffer.from('data'));
      assetManager.startTransfer(
        { assetId: 'asset-1', assetType: 'texture', priority: 5 },
        'session-1'
      );

      const result = assetManager.cancelTransfer('asset-1', 'session-1');

      expect(result).toBe(true);
      expect(assetManager.getTransferStatus('asset-1', 'session-1')).toBeUndefined();
    });

    it('should return false for non-existent transfer', () => {
      const result = assetManager.cancelTransfer('non-existent', 'session-1');
      expect(result).toBe(false);
    });

    it('should emit transferFailed event', () => {
      const callback = jest.fn();
      assetManager.on('transferFailed', callback);

      assetManager.registerAsset('asset-1', 'texture', 'test.png', Buffer.from('data'));
      assetManager.startTransfer(
        { assetId: 'asset-1', assetType: 'texture', priority: 5 },
        'session-1'
      );
      assetManager.cancelTransfer('asset-1', 'session-1');

      expect(callback).toHaveBeenCalled();
    });
  });

  describe('cancelAllTransfers', () => {
    it('should cancel all transfers for session', () => {
      assetManager.registerAsset('asset-1', 'texture', 'test1.png', Buffer.from('data1'));
      assetManager.registerAsset('asset-2', 'texture', 'test2.png', Buffer.from('data2'));

      assetManager.startTransfer(
        { assetId: 'asset-1', assetType: 'texture', priority: 5 },
        'session-1'
      );
      assetManager.startTransfer(
        { assetId: 'asset-2', assetType: 'texture', priority: 5 },
        'session-1'
      );

      const count = assetManager.cancelAllTransfers('session-1');

      expect(count).toBe(2);
    });
  });

  describe('getActiveTransferCount', () => {
    it('should return correct count', () => {
      assetManager.registerAsset('asset-1', 'texture', 'test1.png', Buffer.from('data1'));
      assetManager.registerAsset('asset-2', 'texture', 'test2.png', Buffer.from('data2'));

      expect(assetManager.getActiveTransferCount('session-1')).toBe(0);

      assetManager.startTransfer(
        { assetId: 'asset-1', assetType: 'texture', priority: 5 },
        'session-1'
      );

      expect(assetManager.getActiveTransferCount('session-1')).toBe(1);
    });
  });

  describe('getAssetCount', () => {
    it('should return correct asset count', () => {
      expect(assetManager.getAssetCount()).toBe(0);

      assetManager.registerAsset('asset-1', 'texture', 'test.png', Buffer.from('data'));

      expect(assetManager.getAssetCount()).toBe(1);
    });
  });

  describe('getAllManifests', () => {
    it('should return all manifests', () => {
      assetManager.registerAsset('asset-1', 'texture', 'test1.png', Buffer.from('data1'));
      assetManager.registerAsset('asset-2', 'mesh', 'test2.fbx', Buffer.from('data2'));

      const manifests = assetManager.getAllManifests();

      expect(manifests.length).toBe(2);
    });
  });

  describe('start/stop', () => {
    it('should start and stop without errors', () => {
      expect(() => assetManager.start()).not.toThrow();
      expect(() => assetManager.stop()).not.toThrow();
    });
  });
});

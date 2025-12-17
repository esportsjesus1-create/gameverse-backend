import request from 'supertest';
import express from 'express';
import { BannerType, Rarity, ItemType } from '../../src/types';

jest.mock('../../src/config/database');
jest.mock('../../src/config/redis');

const mockGachaService = {
  executePull: jest.fn(),
  getPullHistory: jest.fn(),
  getPityStatus: jest.fn(),
  simulatePulls: jest.fn(),
};

const mockBannerService = {
  getActiveBanners: jest.fn(),
  getBannerById: jest.fn(),
  createBanner: jest.fn(),
  updateBanner: jest.fn(),
  deleteBanner: jest.fn(),
};

const mockItemRepository = {
  create: jest.fn(),
  findActive: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

jest.mock('../../src/services', () => ({
  GachaService: jest.fn().mockImplementation(() => mockGachaService),
  BannerService: jest.fn().mockImplementation(() => mockBannerService),
}));

jest.mock('../../src/repositories', () => ({
  ItemRepository: jest.fn().mockImplementation(() => mockItemRepository),
  PlayerPityRepository: jest.fn(),
  PlayerPullRepository: jest.fn(),
  BannerRepository: jest.fn(),
}));

import gachaRoutes from '../../src/routes/gacha.routes';
import { errorHandler } from '../../src/middleware';

const app = express();
app.use(express.json());
app.use('/gacha', gachaRoutes);
app.use(errorHandler);

describe('Gacha API Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /gacha/health', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/gacha/health');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('healthy');
    });
  });

  describe('POST /gacha/pull', () => {
    const validPullRequest = {
      playerId: '123e4567-e89b-12d3-a456-426614174000',
      bannerId: '123e4567-e89b-12d3-a456-426614174001',
      count: 1,
    };

    it('should execute a single pull successfully', async () => {
      const mockResult = {
        success: true,
        results: [
          {
            itemId: 'item-1',
            itemName: 'Test Item',
            rarity: Rarity.RARE,
            isFeatured: false,
            pityCount: 1,
            isGuaranteed: false,
          },
        ],
        updatedPity: {
          playerId: validPullRequest.playerId,
          bannerType: BannerType.LIMITED,
          pityCounter: 1,
          guaranteedFeatured: false,
          lastPullTimestamp: new Date(),
        },
        totalCost: 160,
      };

      mockGachaService.executePull.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/gacha/pull')
        .send(validPullRequest);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.results).toHaveLength(1);
    });

    it('should reject invalid playerId', async () => {
      const response = await request(app)
        .post('/gacha/pull')
        .send({ ...validPullRequest, playerId: 'invalid' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject invalid count', async () => {
      const response = await request(app)
        .post('/gacha/pull')
        .send({ ...validPullRequest, count: 11 });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /gacha/pull/multi', () => {
    const validMultiPullRequest = {
      playerId: '123e4567-e89b-12d3-a456-426614174000',
      bannerId: '123e4567-e89b-12d3-a456-426614174001',
    };

    it('should execute 10 pulls successfully', async () => {
      const mockResults = Array(10).fill({
        itemId: 'item-1',
        itemName: 'Test Item',
        rarity: Rarity.COMMON,
        isFeatured: false,
        pityCount: 1,
        isGuaranteed: false,
      });

      mockGachaService.executePull.mockResolvedValue({
        success: true,
        results: mockResults,
        updatedPity: {
          playerId: validMultiPullRequest.playerId,
          bannerType: BannerType.LIMITED,
          pityCounter: 10,
          guaranteedFeatured: false,
          lastPullTimestamp: new Date(),
        },
        totalCost: 1440,
      });

      const response = await request(app)
        .post('/gacha/pull/multi')
        .send(validMultiPullRequest);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.results).toHaveLength(10);
    });
  });

  describe('GET /gacha/banners', () => {
    it('should return active banners', async () => {
      const mockBanners = [
        {
          id: '123e4567-e89b-12d3-a456-426614174001',
          name: 'Test Banner',
          type: BannerType.LIMITED,
          baseRates: {},
          pityConfig: {},
          featuredItems: [],
          itemPool: [],
          featuredRate: 0.5,
          startDate: new Date(),
          endDate: null,
          pullCost: 160,
          multiPullDiscount: 0.1,
        },
      ];

      mockBannerService.getActiveBanners.mockResolvedValue(mockBanners);

      const response = await request(app).get('/gacha/banners');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.banners).toHaveLength(1);
    });
  });

  describe('GET /gacha/banners/:id', () => {
    it('should return banner by id', async () => {
      const mockBanner = {
        id: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Test Banner',
        type: BannerType.LIMITED,
      };

      mockBannerService.getBannerById.mockResolvedValue(mockBanner);

      const response = await request(app).get(
        '/gacha/banners/123e4567-e89b-12d3-a456-426614174001'
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Test Banner');
    });

    it('should return 404 for non-existent banner', async () => {
      mockBannerService.getBannerById.mockResolvedValue(null);

      const response = await request(app).get(
        '/gacha/banners/123e4567-e89b-12d3-a456-426614174001'
      );

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /gacha/history/:playerId', () => {
    it('should return pull history', async () => {
      const mockHistory = {
        history: [
          {
            itemId: 'item-1',
            itemName: 'Test Item',
            rarity: Rarity.RARE,
            isFeatured: false,
            pityCount: 1,
            isGuaranteed: false,
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
      };

      mockGachaService.getPullHistory.mockResolvedValue(mockHistory);

      const response = await request(app).get(
        '/gacha/history/123e4567-e89b-12d3-a456-426614174000'
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.history).toHaveLength(1);
    });
  });

  describe('GET /gacha/pity/:playerId', () => {
    it('should return pity status', async () => {
      const mockPityStates = [
        {
          playerId: '123e4567-e89b-12d3-a456-426614174000',
          bannerType: BannerType.LIMITED,
          pityCounter: 50,
          guaranteedFeatured: false,
          lastPullTimestamp: new Date(),
        },
      ];

      mockGachaService.getPityStatus.mockResolvedValue(mockPityStates);

      const response = await request(app).get(
        '/gacha/pity/123e4567-e89b-12d3-a456-426614174000'
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.pityStates).toHaveLength(1);
    });
  });

  describe('POST /gacha/admin/banner', () => {
    const validBannerRequest = {
      name: 'New Banner',
      type: BannerType.LIMITED,
      featuredItems: ['123e4567-e89b-12d3-a456-426614174002'],
      itemPool: ['123e4567-e89b-12d3-a456-426614174002'],
      startDate: new Date().toISOString(),
      pullCost: 160,
    };

    it('should create a new banner', async () => {
      const mockBanner = {
        id: '123e4567-e89b-12d3-a456-426614174001',
        ...validBannerRequest,
      };

      mockBannerService.createBanner.mockResolvedValue(mockBanner);

      const response = await request(app)
        .post('/gacha/admin/banner')
        .send(validBannerRequest);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('New Banner');
    });

    it('should reject invalid banner request', async () => {
      const response = await request(app)
        .post('/gacha/admin/banner')
        .send({ name: 'Invalid' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /gacha/admin/items', () => {
    const validItemRequest = {
      name: 'New Item',
      rarity: Rarity.LEGENDARY,
      type: ItemType.CHARACTER,
    };

    it('should create a new item', async () => {
      const mockItem = {
        id: '123e4567-e89b-12d3-a456-426614174003',
        ...validItemRequest,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockItemRepository.create.mockResolvedValue(mockItem);

      const response = await request(app)
        .post('/gacha/admin/items')
        .send(validItemRequest);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('New Item');
    });
  });

  describe('POST /gacha/simulate', () => {
    it('should simulate pulls', async () => {
      const mockSimulation = {
        rarityDistribution: {
          [Rarity.COMMON]: 5030,
          [Rarity.RARE]: 4300,
          [Rarity.EPIC]: 510,
          [Rarity.LEGENDARY]: 60,
          [Rarity.MYTHIC]: 100,
        },
        featuredCount: 30,
      };

      mockGachaService.simulatePulls.mockResolvedValue(mockSimulation);

      const response = await request(app)
        .post('/gacha/simulate')
        .send({
          bannerId: '123e4567-e89b-12d3-a456-426614174001',
          count: 10000,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.rarityDistribution).toBeDefined();
    });

    it('should reject invalid simulation count', async () => {
      const response = await request(app)
        .post('/gacha/simulate')
        .send({
          bannerId: '123e4567-e89b-12d3-a456-426614174001',
          count: 200000,
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });
});

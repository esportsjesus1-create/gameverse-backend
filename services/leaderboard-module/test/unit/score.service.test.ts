import { scoreSubmissionService } from '../../src/services/score.service';
import { ScoreSubmissionStatus, GameMode, Region } from '../../src/types';

describe('ScoreSubmissionService', () => {
  beforeEach(() => {
    scoreSubmissionService.clearAllData();
  });

  describe('submitScore', () => {
    it('should submit a valid score', async () => {
      const submission = await scoreSubmissionService.submitScore({
        playerId: 'player-1',
        score: 1000,
        gameId: 'game-1',
        matchId: 'match-1',
      });

      expect(submission.id).toBeDefined();
      expect(submission.playerId).toBe('player-1');
      expect(submission.score).toBe(1000);
      expect(submission.status).toBe(ScoreSubmissionStatus.VALIDATED);
    });

    it('should submit score with all optional fields', async () => {
      const submission = await scoreSubmissionService.submitScore({
        playerId: 'player-1',
        score: 1000,
        gameId: 'game-1',
        matchId: 'match-1',
        sessionId: 'session-1',
        gameMode: GameMode.RANKED,
        region: Region.NA,
        validationChecksum: 'abc123',
        validationData: { key: 'value' },
        metadata: { extra: 'data' },
      });

      expect(submission.gameMode).toBe(GameMode.RANKED);
      expect(submission.region).toBe(Region.NA);
      expect(submission.metadata).toEqual({ extra: 'data' });
    });

    it('should reject negative score', async () => {
      await expect(
        scoreSubmissionService.submitScore({
          playerId: 'player-1',
          score: -100,
        })
      ).rejects.toThrow();
    });

    it('should reject score from banned player', async () => {
      await scoreSubmissionService.banPlayer('player-1', 'Cheating');

      await expect(
        scoreSubmissionService.submitScore({
          playerId: 'player-1',
          score: 1000,
        })
      ).rejects.toThrow();
    });

    it('should track rank changes', async () => {
      const submission = await scoreSubmissionService.submitScore({
        playerId: 'player-1',
        score: 1000,
        leaderboardId: 'lb-1',
      });

      expect(submission.previousRank).toBeDefined();
      expect(submission.newRank).toBeDefined();
    });
  });

  describe('submitBatchScores', () => {
    it('should submit multiple scores', async () => {
      const results = await scoreSubmissionService.submitBatchScores({
        submissions: [
          { playerId: 'player-1', score: 1000 },
          { playerId: 'player-2', score: 2000 },
          { playerId: 'player-3', score: 1500 },
        ],
      });

      expect(results.successful).toHaveLength(3);
      expect(results.failed).toHaveLength(0);
      expect(results.totalProcessed).toBe(3);
    });

    it('should handle partial failures', async () => {
      await scoreSubmissionService.banPlayer('player-2', 'Cheating');

      const results = await scoreSubmissionService.submitBatchScores({
        submissions: [
          { playerId: 'player-1', score: 1000 },
          { playerId: 'player-2', score: 2000 },
          { playerId: 'player-3', score: 1500 },
        ],
      });

      expect(results.successful).toHaveLength(2);
      expect(results.failed).toHaveLength(1);
      expect(results.failed[0].playerId).toBe('player-2');
    });

    it('should reject batch exceeding 100 submissions', async () => {
      const submissions = Array(101)
        .fill(null)
        .map((_, i) => ({
          playerId: `player-${i}`,
          score: i * 10,
        }));

      await expect(
        scoreSubmissionService.submitBatchScores({ submissions })
      ).rejects.toThrow();
    });
  });

  describe('getSubmission', () => {
    it('should get a submission by ID', async () => {
      const created = await scoreSubmissionService.submitScore({
        playerId: 'player-1',
        score: 1000,
      });

      const retrieved = await scoreSubmissionService.getSubmission(created.id);
      expect(retrieved).toEqual(created);
    });

    it('should throw error for non-existent submission', async () => {
      await expect(
        scoreSubmissionService.getSubmission('non-existent')
      ).rejects.toThrow();
    });
  });

  describe('getPlayerSubmissions', () => {
    it('should get all submissions for a player', async () => {
      await scoreSubmissionService.submitScore({
        playerId: 'player-1',
        score: 1000,
      });
      await scoreSubmissionService.submitScore({
        playerId: 'player-1',
        score: 1500,
      });
      await scoreSubmissionService.submitScore({
        playerId: 'player-2',
        score: 2000,
      });

      const submissions = await scoreSubmissionService.getPlayerSubmissions('player-1', {
        page: 1,
        limit: 10,
      });

      expect(submissions.data).toHaveLength(2);
      expect(submissions.data.every(s => s.playerId === 'player-1')).toBe(true);
    });

    it('should filter by status', async () => {
      await scoreSubmissionService.submitScore({
        playerId: 'player-1',
        score: 1000,
      });

      const submission2 = await scoreSubmissionService.submitScore({
        playerId: 'player-1',
        score: 1500,
      });

      await scoreSubmissionService.disputeSubmission({
        submissionId: submission2.id,
        playerId: 'player-1',
        reason: 'This score was incorrectly recorded.',
      });

      const disputed = await scoreSubmissionService.getPlayerSubmissions('player-1', {
        page: 1,
        limit: 10,
        status: ScoreSubmissionStatus.DISPUTED,
      });

      expect(disputed.data).toHaveLength(1);
      expect(disputed.data[0].status).toBe(ScoreSubmissionStatus.DISPUTED);
    });
  });

  describe('getPendingSubmissions', () => {
    it('should get all pending submissions', async () => {
      await scoreSubmissionService.submitScore({
        playerId: 'player-1',
        score: 1000,
      });

      const pending = await scoreSubmissionService.getPendingSubmissions({
        page: 1,
        limit: 10,
      });

      expect(pending.data.every(s => s.status === ScoreSubmissionStatus.PENDING || s.status === ScoreSubmissionStatus.VALIDATED)).toBe(true);
    });
  });

  describe('disputeSubmission', () => {
    it('should create a dispute for a submission', async () => {
      const submission = await scoreSubmissionService.submitScore({
        playerId: 'player-1',
        score: 1000,
      });

      const disputed = await scoreSubmissionService.disputeSubmission({
        submissionId: submission.id,
        playerId: 'player-1',
        reason: 'This score was incorrectly recorded due to a server error.',
      });

      expect(disputed.status).toBe(ScoreSubmissionStatus.DISPUTED);
      expect(disputed.disputeReason).toBe('This score was incorrectly recorded due to a server error.');
    });

    it('should reject dispute from non-owner', async () => {
      const submission = await scoreSubmissionService.submitScore({
        playerId: 'player-1',
        score: 1000,
      });

      await expect(
        scoreSubmissionService.disputeSubmission({
          submissionId: submission.id,
          playerId: 'player-2',
          reason: 'This is not my submission.',
        })
      ).rejects.toThrow();
    });

    it('should reject duplicate dispute', async () => {
      const submission = await scoreSubmissionService.submitScore({
        playerId: 'player-1',
        score: 1000,
      });

      await scoreSubmissionService.disputeSubmission({
        submissionId: submission.id,
        playerId: 'player-1',
        reason: 'First dispute.',
      });

      await expect(
        scoreSubmissionService.disputeSubmission({
          submissionId: submission.id,
          playerId: 'player-1',
          reason: 'Second dispute.',
        })
      ).rejects.toThrow();
    });
  });

  describe('adminAction', () => {
    describe('APPROVE', () => {
      it('should approve a submission', async () => {
        const submission = await scoreSubmissionService.submitScore({
          playerId: 'player-1',
          score: 1000,
        });

        const approved = await scoreSubmissionService.adminAction({
          submissionId: submission.id,
          adminId: 'admin-1',
          action: 'APPROVE',
        });

        expect(approved.status).toBe(ScoreSubmissionStatus.APPROVED);
        expect(approved.reviewedBy).toBe('admin-1');
        expect(approved.reviewedAt).toBeDefined();
      });
    });

    describe('REJECT', () => {
      it('should reject a submission', async () => {
        const submission = await scoreSubmissionService.submitScore({
          playerId: 'player-1',
          score: 1000,
        });

        const rejected = await scoreSubmissionService.adminAction({
          submissionId: submission.id,
          adminId: 'admin-1',
          action: 'REJECT',
          reason: 'Invalid submission data',
        });

        expect(rejected.status).toBe(ScoreSubmissionStatus.REJECTED);
        expect(rejected.rejectionReason).toBe('Invalid submission data');
      });
    });

    describe('ROLLBACK', () => {
      it('should rollback an approved submission', async () => {
        const submission = await scoreSubmissionService.submitScore({
          playerId: 'player-1',
          score: 1000,
        });

        await scoreSubmissionService.adminAction({
          submissionId: submission.id,
          adminId: 'admin-1',
          action: 'APPROVE',
        });

        const rolledBack = await scoreSubmissionService.adminAction({
          submissionId: submission.id,
          adminId: 'admin-1',
          action: 'ROLLBACK',
        });

        expect(rolledBack.status).toBe(ScoreSubmissionStatus.ROLLED_BACK);
      });
    });
  });

  describe('getSubmissionStatistics', () => {
    it('should return submission statistics', async () => {
      await scoreSubmissionService.submitScore({
        playerId: 'player-1',
        score: 1000,
      });

      await scoreSubmissionService.submitScore({
        playerId: 'player-2',
        score: 2000,
      });

      const submission3 = await scoreSubmissionService.submitScore({
        playerId: 'player-3',
        score: 1500,
      });

      await scoreSubmissionService.adminAction({
        submissionId: submission3.id,
        adminId: 'admin-1',
        action: 'REJECT',
        reason: 'Invalid',
      });

      const stats = await scoreSubmissionService.getSubmissionStatistics();
      expect(stats.totalSubmissions).toBe(3);
      expect(stats.byStatus[ScoreSubmissionStatus.REJECTED]).toBe(1);
    });

    it('should filter statistics by date range', async () => {
      await scoreSubmissionService.submitScore({
        playerId: 'player-1',
        score: 1000,
      });

      const stats = await scoreSubmissionService.getSubmissionStatistics({
        startDate: new Date(Date.now() - 86400000),
        endDate: new Date(),
      });

      expect(stats.totalSubmissions).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getAuditTrail', () => {
    it('should return audit trail for a submission', async () => {
      const submission = await scoreSubmissionService.submitScore({
        playerId: 'player-1',
        score: 1000,
      });

      await scoreSubmissionService.adminAction({
        submissionId: submission.id,
        adminId: 'admin-1',
        action: 'APPROVE',
      });

      const audit = await scoreSubmissionService.getAuditTrail(submission.id);
      expect(audit).toHaveLength(2);
      expect(audit[0].action).toBe('SUBMITTED');
      expect(audit[1].action).toBe('APPROVED');
    });
  });

  describe('banPlayer', () => {
    it('should ban a player', async () => {
      await scoreSubmissionService.banPlayer('player-1', 'Cheating');

      const isBanned = await scoreSubmissionService.isPlayerBanned('player-1');
      expect(isBanned).toBe(true);
    });

    it('should prevent banned player from submitting scores', async () => {
      await scoreSubmissionService.banPlayer('player-1', 'Cheating');

      await expect(
        scoreSubmissionService.submitScore({
          playerId: 'player-1',
          score: 1000,
        })
      ).rejects.toThrow();
    });
  });

  describe('unbanPlayer', () => {
    it('should unban a player', async () => {
      await scoreSubmissionService.banPlayer('player-1', 'Cheating');
      await scoreSubmissionService.unbanPlayer('player-1');

      const isBanned = await scoreSubmissionService.isPlayerBanned('player-1');
      expect(isBanned).toBe(false);
    });

    it('should allow unbanned player to submit scores', async () => {
      await scoreSubmissionService.banPlayer('player-1', 'Cheating');
      await scoreSubmissionService.unbanPlayer('player-1');

      const submission = await scoreSubmissionService.submitScore({
        playerId: 'player-1',
        score: 1000,
      });

      expect(submission).toBeDefined();
    });
  });

  describe('Anti-cheat validation', () => {
    it('should flag suspicious score variance', async () => {
      await scoreSubmissionService.submitScore({
        playerId: 'player-1',
        score: 100,
      });

      await scoreSubmissionService.submitScore({
        playerId: 'player-1',
        score: 150,
      });

      const suspiciousSubmission = await scoreSubmissionService.submitScore({
        playerId: 'player-1',
        score: 10000,
      });

      expect(suspiciousSubmission.antiCheatFlags).toBeDefined();
      expect(suspiciousSubmission.antiCheatFlags?.length).toBeGreaterThan(0);
    });

    it('should validate checksum if provided', async () => {
      const submission = await scoreSubmissionService.submitScore({
        playerId: 'player-1',
        score: 1000,
        validationChecksum: 'valid-checksum',
        validationData: { expectedChecksum: 'valid-checksum' },
      });

      expect(submission.status).toBe(ScoreSubmissionStatus.VALIDATED);
    });
  });
});

import { friendRankingService } from '../../src/services/friend.service';
import { SortField, SortOrder } from '../../src/types';

describe('FriendRankingService', () => {
  beforeEach(() => {
    friendRankingService.clearAllData();
  });

  describe('addFriendship', () => {
    it('should add a friendship between two players', async () => {
      await friendRankingService.addFriendship('player-1', 'player-2');
      
      const areFriends = await friendRankingService.areFriends('player-1', 'player-2');
      expect(areFriends).toBe(true);
    });

    it('should create bidirectional friendship', async () => {
      await friendRankingService.addFriendship('player-1', 'player-2');
      
      const friends1 = await friendRankingService.getFriends('player-1');
      const friends2 = await friendRankingService.getFriends('player-2');
      
      expect(friends1).toContain('player-2');
      expect(friends2).toContain('player-1');
    });

    it('should not duplicate friendships', async () => {
      await friendRankingService.addFriendship('player-1', 'player-2');
      await friendRankingService.addFriendship('player-1', 'player-2');
      
      const friends = await friendRankingService.getFriends('player-1');
      expect(friends.filter(f => f === 'player-2')).toHaveLength(1);
    });
  });

  describe('removeFriendship', () => {
    it('should remove a friendship', async () => {
      await friendRankingService.addFriendship('player-1', 'player-2');
      await friendRankingService.removeFriendship('player-1', 'player-2');
      
      const areFriends = await friendRankingService.areFriends('player-1', 'player-2');
      expect(areFriends).toBe(false);
    });

    it('should remove bidirectional friendship', async () => {
      await friendRankingService.addFriendship('player-1', 'player-2');
      await friendRankingService.removeFriendship('player-1', 'player-2');
      
      const friends1 = await friendRankingService.getFriends('player-1');
      const friends2 = await friendRankingService.getFriends('player-2');
      
      expect(friends1).not.toContain('player-2');
      expect(friends2).not.toContain('player-1');
    });
  });

  describe('getFriends', () => {
    it('should return all friends of a player', async () => {
      await friendRankingService.addFriendship('player-1', 'player-2');
      await friendRankingService.addFriendship('player-1', 'player-3');
      await friendRankingService.addFriendship('player-1', 'player-4');
      
      const friends = await friendRankingService.getFriends('player-1');
      expect(friends).toHaveLength(3);
      expect(friends).toContain('player-2');
      expect(friends).toContain('player-3');
      expect(friends).toContain('player-4');
    });

    it('should return empty array for player with no friends', async () => {
      const friends = await friendRankingService.getFriends('lonely-player');
      expect(friends).toHaveLength(0);
    });
  });

  describe('areFriends', () => {
    it('should return true for friends', async () => {
      await friendRankingService.addFriendship('player-1', 'player-2');
      
      expect(await friendRankingService.areFriends('player-1', 'player-2')).toBe(true);
      expect(await friendRankingService.areFriends('player-2', 'player-1')).toBe(true);
    });

    it('should return false for non-friends', async () => {
      expect(await friendRankingService.areFriends('player-1', 'player-2')).toBe(false);
    });
  });

  describe('updatePlayerData', () => {
    it('should update player data', async () => {
      await friendRankingService.updatePlayerData('player-1', {
        playerName: 'TestPlayer',
        score: 1000,
        mmr: 1500,
        wins: 10,
        losses: 5,
      });

      const data = await friendRankingService.getPlayerData('player-1');
      expect(data.playerName).toBe('TestPlayer');
      expect(data.score).toBe(1000);
      expect(data.mmr).toBe(1500);
    });
  });

  describe('getFriendLeaderboard', () => {
    it('should return leaderboard of friends', async () => {
      await friendRankingService.addFriendship('player-1', 'player-2');
      await friendRankingService.addFriendship('player-1', 'player-3');
      await friendRankingService.addFriendship('player-1', 'player-4');

      await friendRankingService.updatePlayerData('player-1', {
        playerName: 'Player1',
        score: 1000,
      });
      await friendRankingService.updatePlayerData('player-2', {
        playerName: 'Player2',
        score: 2000,
      });
      await friendRankingService.updatePlayerData('player-3', {
        playerName: 'Player3',
        score: 1500,
      });
      await friendRankingService.updatePlayerData('player-4', {
        playerName: 'Player4',
        score: 500,
      });

      const leaderboard = await friendRankingService.getFriendLeaderboard('player-1', {
        page: 1,
        limit: 10,
        sortBy: SortField.SCORE,
        sortOrder: SortOrder.DESC,
      });

      expect(leaderboard.data).toHaveLength(4);
      expect(leaderboard.data[0].playerId).toBe('player-2');
      expect(leaderboard.data[0].score).toBe(2000);
    });

    it('should include the requesting player in leaderboard', async () => {
      await friendRankingService.addFriendship('player-1', 'player-2');

      await friendRankingService.updatePlayerData('player-1', {
        playerName: 'Player1',
        score: 1000,
      });
      await friendRankingService.updatePlayerData('player-2', {
        playerName: 'Player2',
        score: 2000,
      });

      const leaderboard = await friendRankingService.getFriendLeaderboard('player-1', {
        page: 1,
        limit: 10,
        sortBy: SortField.SCORE,
        sortOrder: SortOrder.DESC,
      });

      expect(leaderboard.data.some(e => e.playerId === 'player-1')).toBe(true);
    });
  });

  describe('getPlayerRankAmongFriends', () => {
    it('should return player rank among friends', async () => {
      await friendRankingService.addFriendship('player-1', 'player-2');
      await friendRankingService.addFriendship('player-1', 'player-3');

      await friendRankingService.updatePlayerData('player-1', {
        playerName: 'Player1',
        score: 1500,
      });
      await friendRankingService.updatePlayerData('player-2', {
        playerName: 'Player2',
        score: 2000,
      });
      await friendRankingService.updatePlayerData('player-3', {
        playerName: 'Player3',
        score: 1000,
      });

      const rank = await friendRankingService.getPlayerRankAmongFriends('player-1');
      expect(rank.rank).toBe(2);
      expect(rank.totalFriends).toBe(3);
    });
  });

  describe('getFriendComparison', () => {
    it('should compare two friends', async () => {
      await friendRankingService.addFriendship('player-1', 'player-2');

      await friendRankingService.updatePlayerData('player-1', {
        playerName: 'Player1',
        score: 1000,
        wins: 50,
        losses: 30,
      });
      await friendRankingService.updatePlayerData('player-2', {
        playerName: 'Player2',
        score: 1500,
        wins: 60,
        losses: 20,
      });

      const comparison = await friendRankingService.getFriendComparison('player-1', 'player-2');
      expect(comparison.player1.playerId).toBe('player-1');
      expect(comparison.player2.playerId).toBe('player-2');
      expect(comparison.scoreDifference).toBe(-500);
    });

    it('should throw error for non-friends', async () => {
      await friendRankingService.updatePlayerData('player-1', {
        playerName: 'Player1',
        score: 1000,
      });
      await friendRankingService.updatePlayerData('player-2', {
        playerName: 'Player2',
        score: 1500,
      });

      await expect(
        friendRankingService.getFriendComparison('player-1', 'player-2')
      ).rejects.toThrow();
    });
  });

  describe('recordHeadToHeadResult', () => {
    it('should record head-to-head result', async () => {
      await friendRankingService.addFriendship('player-1', 'player-2');

      await friendRankingService.recordHeadToHeadResult('player-1', 'player-2', 'player-1');

      const comparison = await friendRankingService.getFriendComparison('player-1', 'player-2');
      expect(comparison.headToHead.player1Wins).toBe(1);
      expect(comparison.headToHead.player2Wins).toBe(0);
    });

    it('should accumulate head-to-head results', async () => {
      await friendRankingService.addFriendship('player-1', 'player-2');

      await friendRankingService.recordHeadToHeadResult('player-1', 'player-2', 'player-1');
      await friendRankingService.recordHeadToHeadResult('player-1', 'player-2', 'player-1');
      await friendRankingService.recordHeadToHeadResult('player-1', 'player-2', 'player-2');

      const comparison = await friendRankingService.getFriendComparison('player-1', 'player-2');
      expect(comparison.headToHead.player1Wins).toBe(2);
      expect(comparison.headToHead.player2Wins).toBe(1);
      expect(comparison.headToHead.totalGames).toBe(3);
    });
  });

  describe('Friend Groups', () => {
    describe('createFriendGroup', () => {
      it('should create a friend group', async () => {
        const group = await friendRankingService.createFriendGroup('player-1', 'Test Group');
        
        expect(group.id).toBeDefined();
        expect(group.name).toBe('Test Group');
        expect(group.ownerId).toBe('player-1');
        expect(group.members).toContain('player-1');
      });
    });

    describe('getFriendGroup', () => {
      it('should get a friend group by ID', async () => {
        const created = await friendRankingService.createFriendGroup('player-1', 'Test Group');
        const retrieved = await friendRankingService.getFriendGroup(created.id);
        
        expect(retrieved).toEqual(created);
      });

      it('should throw error for non-existent group', async () => {
        await expect(
          friendRankingService.getFriendGroup('non-existent')
        ).rejects.toThrow();
      });
    });

    describe('addMemberToGroup', () => {
      it('should add a member to group', async () => {
        const group = await friendRankingService.createFriendGroup('player-1', 'Test Group');
        
        await friendRankingService.addMemberToGroup(group.id, 'player-2', 'player-1');
        
        const updated = await friendRankingService.getFriendGroup(group.id);
        expect(updated.members).toContain('player-2');
      });

      it('should throw error if not owner', async () => {
        const group = await friendRankingService.createFriendGroup('player-1', 'Test Group');
        
        await expect(
          friendRankingService.addMemberToGroup(group.id, 'player-3', 'player-2')
        ).rejects.toThrow();
      });

      it('should throw error if group is full', async () => {
        const group = await friendRankingService.createFriendGroup('player-1', 'Test Group');
        
        for (let i = 2; i <= 50; i++) {
          await friendRankingService.addMemberToGroup(group.id, `player-${i}`, 'player-1');
        }
        
        await expect(
          friendRankingService.addMemberToGroup(group.id, 'player-51', 'player-1')
        ).rejects.toThrow();
      });
    });

    describe('removeMemberFromGroup', () => {
      it('should remove a member from group', async () => {
        const group = await friendRankingService.createFriendGroup('player-1', 'Test Group');
        await friendRankingService.addMemberToGroup(group.id, 'player-2', 'player-1');
        
        await friendRankingService.removeMemberFromGroup(group.id, 'player-2', 'player-1');
        
        const updated = await friendRankingService.getFriendGroup(group.id);
        expect(updated.members).not.toContain('player-2');
      });
    });

    describe('getGroupLeaderboard', () => {
      it('should return leaderboard for group members', async () => {
        const group = await friendRankingService.createFriendGroup('player-1', 'Test Group');
        await friendRankingService.addMemberToGroup(group.id, 'player-2', 'player-1');
        await friendRankingService.addMemberToGroup(group.id, 'player-3', 'player-1');

        await friendRankingService.updatePlayerData('player-1', {
          playerName: 'Player1',
          score: 1000,
        });
        await friendRankingService.updatePlayerData('player-2', {
          playerName: 'Player2',
          score: 2000,
        });
        await friendRankingService.updatePlayerData('player-3', {
          playerName: 'Player3',
          score: 1500,
        });

        const leaderboard = await friendRankingService.getGroupLeaderboard(group.id, {
          page: 1,
          limit: 10,
          sortBy: SortField.SCORE,
          sortOrder: SortOrder.DESC,
        });

        expect(leaderboard.data).toHaveLength(3);
        expect(leaderboard.data[0].playerId).toBe('player-2');
      });
    });
  });

  describe('Challenges', () => {
    describe('createChallenge', () => {
      it('should create a challenge between friends', async () => {
        await friendRankingService.addFriendship('player-1', 'player-2');

        const challenge = await friendRankingService.createChallenge(
          'player-1',
          'player-2',
          'Beat my high score!',
          1000
        );

        expect(challenge.id).toBeDefined();
        expect(challenge.challengerId).toBe('player-1');
        expect(challenge.challengedId).toBe('player-2');
        expect(challenge.targetScore).toBe(1000);
        expect(challenge.status).toBe('PENDING');
      });

      it('should throw error for self-challenge', async () => {
        await expect(
          friendRankingService.createChallenge('player-1', 'player-1', 'Test', 1000)
        ).rejects.toThrow();
      });

      it('should throw error for non-friends', async () => {
        await expect(
          friendRankingService.createChallenge('player-1', 'player-2', 'Test', 1000)
        ).rejects.toThrow();
      });
    });

    describe('getChallenge', () => {
      it('should get a challenge by ID', async () => {
        await friendRankingService.addFriendship('player-1', 'player-2');
        const created = await friendRankingService.createChallenge(
          'player-1',
          'player-2',
          'Test',
          1000
        );

        const retrieved = await friendRankingService.getChallenge(created.id);
        expect(retrieved).toEqual(created);
      });
    });

    describe('getPlayerChallenges', () => {
      it('should get all challenges for a player', async () => {
        await friendRankingService.addFriendship('player-1', 'player-2');
        await friendRankingService.addFriendship('player-1', 'player-3');

        await friendRankingService.createChallenge('player-1', 'player-2', 'Test 1', 1000);
        await friendRankingService.createChallenge('player-3', 'player-1', 'Test 2', 2000);

        const challenges = await friendRankingService.getPlayerChallenges('player-1');
        expect(challenges).toHaveLength(2);
      });
    });

    describe('updateChallengeProgress', () => {
      it('should update challenge progress', async () => {
        await friendRankingService.addFriendship('player-1', 'player-2');
        const challenge = await friendRankingService.createChallenge(
          'player-1',
          'player-2',
          'Test',
          1000
        );

        await friendRankingService.updateChallengeProgress(challenge.id, 'player-2', 500);

        const updated = await friendRankingService.getChallenge(challenge.id);
        expect(updated.challengedProgress).toBe(500);
      });

      it('should complete challenge when target is reached', async () => {
        await friendRankingService.addFriendship('player-1', 'player-2');
        const challenge = await friendRankingService.createChallenge(
          'player-1',
          'player-2',
          'Test',
          1000
        );

        await friendRankingService.updateChallengeProgress(challenge.id, 'player-2', 1500);

        const updated = await friendRankingService.getChallenge(challenge.id);
        expect(updated.status).toBe('COMPLETED');
        expect(updated.winnerId).toBe('player-2');
      });
    });

    describe('cancelChallenge', () => {
      it('should cancel a challenge', async () => {
        await friendRankingService.addFriendship('player-1', 'player-2');
        const challenge = await friendRankingService.createChallenge(
          'player-1',
          'player-2',
          'Test',
          1000
        );

        await friendRankingService.cancelChallenge(challenge.id, 'player-1');

        const updated = await friendRankingService.getChallenge(challenge.id);
        expect(updated.status).toBe('CANCELLED');
      });
    });
  });

  describe('Activity Feed', () => {
    describe('getActivityFeed', () => {
      it('should return activity feed for player', async () => {
        await friendRankingService.addFriendship('player-1', 'player-2');

        await friendRankingService.addActivityFeedItem('player-1', {
          type: 'SCORE_UPDATE',
          playerId: 'player-2',
          playerName: 'Player2',
          data: { newScore: 1000 },
        });

        const feed = await friendRankingService.getActivityFeed('player-1', { limit: 10 });
        expect(feed).toHaveLength(1);
        expect(feed[0].type).toBe('SCORE_UPDATE');
      });

      it('should limit activity feed items', async () => {
        await friendRankingService.addFriendship('player-1', 'player-2');

        for (let i = 0; i < 20; i++) {
          await friendRankingService.addActivityFeedItem('player-1', {
            type: 'SCORE_UPDATE',
            playerId: 'player-2',
            playerName: 'Player2',
            data: { newScore: i * 100 },
          });
        }

        const feed = await friendRankingService.getActivityFeed('player-1', { limit: 10 });
        expect(feed).toHaveLength(10);
      });
    });
  });

  describe('Mutual Friends', () => {
    describe('getMutualFriends', () => {
      it('should return mutual friends between two players', async () => {
        await friendRankingService.addFriendship('player-1', 'player-3');
        await friendRankingService.addFriendship('player-2', 'player-3');
        await friendRankingService.addFriendship('player-1', 'player-4');
        await friendRankingService.addFriendship('player-2', 'player-4');
        await friendRankingService.addFriendship('player-1', 'player-5');

        const mutual = await friendRankingService.getMutualFriends('player-1', 'player-2');
        expect(mutual).toHaveLength(2);
        expect(mutual).toContain('player-3');
        expect(mutual).toContain('player-4');
      });

      it('should return empty array for no mutual friends', async () => {
        await friendRankingService.addFriendship('player-1', 'player-3');
        await friendRankingService.addFriendship('player-2', 'player-4');

        const mutual = await friendRankingService.getMutualFriends('player-1', 'player-2');
        expect(mutual).toHaveLength(0);
      });
    });

    describe('getMutualFriendsLeaderboard', () => {
      it('should return leaderboard of mutual friends', async () => {
        await friendRankingService.addFriendship('player-1', 'player-3');
        await friendRankingService.addFriendship('player-2', 'player-3');
        await friendRankingService.addFriendship('player-1', 'player-4');
        await friendRankingService.addFriendship('player-2', 'player-4');

        await friendRankingService.updatePlayerData('player-3', {
          playerName: 'Player3',
          score: 1000,
        });
        await friendRankingService.updatePlayerData('player-4', {
          playerName: 'Player4',
          score: 2000,
        });

        const leaderboard = await friendRankingService.getMutualFriendsLeaderboard(
          'player-1',
          'player-2',
          { page: 1, limit: 10, sortBy: SortField.SCORE, sortOrder: SortOrder.DESC }
        );

        expect(leaderboard.data).toHaveLength(2);
        expect(leaderboard.data[0].playerId).toBe('player-4');
      });
    });
  });
});

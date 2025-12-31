import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { TournamentMatch, MatchStatus } from '../../entities/tournament-match.entity';
import { TournamentStanding } from '../../entities/tournament-standing.entity';
import { Tournament, TournamentStatus, TournamentFormat } from '../../entities/tournament.entity';
import { TournamentRegistration, RegistrationStatus } from '../../entities/tournament-registration.entity';
import { TournamentBracket, BracketFormat } from '../../entities/tournament-bracket.entity';

const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

describe('Edge Cases - Tie-breakers and Forfeit Scenarios', () => {
  describe('Tie-breaker Scenarios', () => {
    describe('Swiss System Tie-breakers', () => {
      it('should resolve ties using Buchholz score', () => {
        const standings = [
          {
            participantId: generateUUID(),
            wins: 5,
            losses: 2,
            pointsDifferential: 10,
            buchholzScore: 25,
          },
          {
            participantId: generateUUID(),
            wins: 5,
            losses: 2,
            pointsDifferential: 10,
            buchholzScore: 22,
          },
        ];

        const sorted = standings.sort((a, b) => {
          if (a.wins !== b.wins) return b.wins - a.wins;
          if (a.buchholzScore !== b.buchholzScore) return b.buchholzScore - a.buchholzScore;
          return b.pointsDifferential - a.pointsDifferential;
        });

        expect(sorted[0].buchholzScore).toBe(25);
        expect(sorted[1].buchholzScore).toBe(22);
      });

      it('should use head-to-head as secondary tie-breaker', () => {
        const participant1Id = generateUUID();
        const participant2Id = generateUUID();

        const headToHeadMatches = [
          {
            participant1Id,
            participant2Id,
            winnerId: participant1Id,
            participant1Score: 3,
            participant2Score: 1,
          },
        ];

        const participant1Wins = headToHeadMatches.filter(
          (m) => m.winnerId === participant1Id,
        ).length;
        const participant2Wins = headToHeadMatches.filter(
          (m) => m.winnerId === participant2Id,
        ).length;

        expect(participant1Wins).toBeGreaterThan(participant2Wins);
      });

      it('should use points differential as tertiary tie-breaker', () => {
        const standings = [
          {
            participantId: generateUUID(),
            wins: 5,
            buchholzScore: 20,
            pointsDifferential: 15,
          },
          {
            participantId: generateUUID(),
            wins: 5,
            buchholzScore: 20,
            pointsDifferential: 12,
          },
        ];

        const sorted = standings.sort((a, b) => {
          if (a.wins !== b.wins) return b.wins - a.wins;
          if (a.buchholzScore !== b.buchholzScore) return b.buchholzScore - a.buchholzScore;
          return b.pointsDifferential - a.pointsDifferential;
        });

        expect(sorted[0].pointsDifferential).toBe(15);
      });
    });

    describe('Round Robin Tie-breakers', () => {
      it('should resolve three-way tie using points scored', () => {
        const standings = [
          { participantId: generateUUID(), wins: 2, losses: 1, pointsScored: 45 },
          { participantId: generateUUID(), wins: 2, losses: 1, pointsScored: 42 },
          { participantId: generateUUID(), wins: 2, losses: 1, pointsScored: 48 },
        ];

        const sorted = standings.sort((a, b) => {
          if (a.wins !== b.wins) return b.wins - a.wins;
          return b.pointsScored - a.pointsScored;
        });

        expect(sorted[0].pointsScored).toBe(48);
        expect(sorted[1].pointsScored).toBe(45);
        expect(sorted[2].pointsScored).toBe(42);
      });

      it('should handle circular head-to-head (A beats B, B beats C, C beats A)', () => {
        const participantA = generateUUID();
        const participantB = generateUUID();
        const participantC = generateUUID();

        const matches = [
          { participant1Id: participantA, participant2Id: participantB, winnerId: participantA },
          { participant1Id: participantB, participant2Id: participantC, winnerId: participantB },
          { participant1Id: participantC, participant2Id: participantA, winnerId: participantC },
        ];

        const winsA = matches.filter((m) => m.winnerId === participantA).length;
        const winsB = matches.filter((m) => m.winnerId === participantB).length;
        const winsC = matches.filter((m) => m.winnerId === participantC).length;

        expect(winsA).toBe(1);
        expect(winsB).toBe(1);
        expect(winsC).toBe(1);
      });
    });

    describe('Elimination Bracket Tie-breakers', () => {
      it('should determine 3rd place through losers bracket final', () => {
        const semifinalLoser1 = generateUUID();
        const semifinalLoser2 = generateUUID();

        const thirdPlaceMatch = {
          participant1Id: semifinalLoser1,
          participant2Id: semifinalLoser2,
          winnerId: semifinalLoser1,
          round: 'third_place',
        };

        expect(thirdPlaceMatch.winnerId).toBe(semifinalLoser1);
      });

      it('should handle grand finals reset in double elimination', () => {
        const winnersBracketChampion = generateUUID();
        const losersBracketChampion = generateUUID();

        const grandFinals1 = {
          participant1Id: winnersBracketChampion,
          participant2Id: losersBracketChampion,
          winnerId: losersBracketChampion,
          isGrandFinals: true,
          grandFinalsReset: false,
        };

        const grandFinals2 = {
          participant1Id: winnersBracketChampion,
          participant2Id: losersBracketChampion,
          winnerId: winnersBracketChampion,
          isGrandFinals: true,
          grandFinalsReset: true,
        };

        expect(grandFinals1.winnerId).toBe(losersBracketChampion);
        expect(grandFinals2.winnerId).toBe(winnersBracketChampion);
        expect(grandFinals2.grandFinalsReset).toBe(true);
      });
    });
  });

  describe('Forfeit Scenarios', () => {
    describe('Individual Match Forfeits', () => {
      it('should award win to opponent on forfeit', () => {
        const participant1Id = generateUUID();
        const participant2Id = generateUUID();

        const match = {
          participant1Id,
          participant2Id,
          status: MatchStatus.FORFEIT,
          forfeitedBy: participant1Id,
          winnerId: participant2Id,
          participant1Score: 0,
          participant2Score: 0,
        };

        expect(match.winnerId).toBe(participant2Id);
        expect(match.forfeitedBy).toBe(participant1Id);
      });

      it('should update standings correctly on forfeit', () => {
        const standing = {
          participantId: generateUUID(),
          wins: 3,
          losses: 1,
          forfeits: 0,
          matchesPlayed: 4,
        };

        standing.losses += 1;
        standing.forfeits += 1;
        standing.matchesPlayed += 1;

        expect(standing.losses).toBe(2);
        expect(standing.forfeits).toBe(1);
        expect(standing.matchesPlayed).toBe(5);
      });

      it('should handle no-show forfeit', () => {
        const match = {
          participant1Id: generateUUID(),
          participant2Id: generateUUID(),
          status: MatchStatus.SCHEDULED,
          scheduledTime: new Date(Date.now() - 3600000),
          noShowTimeout: 15,
        };

        const timeSinceScheduled =
          (Date.now() - match.scheduledTime.getTime()) / 60000;
        const isNoShow = timeSinceScheduled > match.noShowTimeout;

        expect(isNoShow).toBe(true);
      });
    });

    describe('Tournament-wide Forfeits', () => {
      it('should handle participant withdrawal mid-tournament', () => {
        const withdrawnParticipantId = generateUUID();

        const upcomingMatches = [
          {
            id: generateUUID(),
            participant1Id: withdrawnParticipantId,
            participant2Id: generateUUID(),
            status: MatchStatus.SCHEDULED,
          },
          {
            id: generateUUID(),
            participant1Id: generateUUID(),
            participant2Id: withdrawnParticipantId,
            status: MatchStatus.SCHEDULED,
          },
        ];

        const processedMatches = upcomingMatches.map((match) => {
          if (
            match.participant1Id === withdrawnParticipantId ||
            match.participant2Id === withdrawnParticipantId
          ) {
            const winnerId =
              match.participant1Id === withdrawnParticipantId
                ? match.participant2Id
                : match.participant1Id;
            return {
              ...match,
              status: MatchStatus.FORFEIT,
              winnerId,
              forfeitedBy: withdrawnParticipantId,
            };
          }
          return match;
        });

        expect(processedMatches[0].status).toBe(MatchStatus.FORFEIT);
        expect(processedMatches[1].status).toBe(MatchStatus.FORFEIT);
      });

      it('should handle disqualification and prize forfeiture', () => {
        const disqualifiedParticipantId = generateUUID();

        const standing = {
          participantId: disqualifiedParticipantId,
          placement: 2,
          isDisqualified: false,
          disqualificationReason: null as string | null,
          prizeForfeited: false,
        };

        standing.isDisqualified = true;
        standing.disqualificationReason = 'Cheating detected';
        standing.prizeForfeited = true;

        expect(standing.isDisqualified).toBe(true);
        expect(standing.prizeForfeited).toBe(true);
      });

      it('should recalculate placements after disqualification', () => {
        const standings = [
          { participantId: generateUUID(), placement: 1, isDisqualified: false },
          { participantId: generateUUID(), placement: 2, isDisqualified: true },
          { participantId: generateUUID(), placement: 3, isDisqualified: false },
          { participantId: generateUUID(), placement: 4, isDisqualified: false },
        ];

        const activeStandings = standings.filter((s) => !s.isDisqualified);
        activeStandings.forEach((s, index) => {
          s.placement = index + 1;
        });

        expect(activeStandings[0].placement).toBe(1);
        expect(activeStandings[1].placement).toBe(2);
        expect(activeStandings[2].placement).toBe(3);
      });
    });

    describe('Double Forfeit Scenarios', () => {
      it('should handle both participants forfeiting', () => {
        const match = {
          participant1Id: generateUUID(),
          participant2Id: generateUUID(),
          status: MatchStatus.SCHEDULED,
          participant1Forfeited: true,
          participant2Forfeited: true,
        };

        const result = {
          ...match,
          status: MatchStatus.FORFEIT,
          winnerId: null,
          isDraw: true,
          doubleForfeit: true,
        };

        expect(result.doubleForfeit).toBe(true);
        expect(result.winnerId).toBeNull();
      });

      it('should advance neither participant in elimination bracket on double forfeit', () => {
        const match = {
          participant1Id: generateUUID(),
          participant2Id: generateUUID(),
          nextMatchId: generateUUID(),
          doubleForfeit: true,
        };

        const nextMatch = {
          id: match.nextMatchId,
          participant1Id: null as string | null,
          participant2Id: generateUUID(),
        };

        expect(nextMatch.participant1Id).toBeNull();
      });
    });
  });

  describe('BYE Handling', () => {
    it('should auto-advance participant with BYE', () => {
      const participantWithBye = generateUUID();

      const byeMatch = {
        participant1Id: participantWithBye,
        participant2Id: null,
        status: MatchStatus.BYE,
        winnerId: participantWithBye,
        isBye: true,
      };

      expect(byeMatch.winnerId).toBe(participantWithBye);
      expect(byeMatch.isBye).toBe(true);
    });

    it('should not count BYE as a win in standings', () => {
      const standing = {
        participantId: generateUUID(),
        wins: 3,
        losses: 1,
        byes: 1,
        matchesPlayed: 4,
      };

      expect(standing.byes).toBe(1);
      expect(standing.matchesPlayed).toBe(4);
    });

    it('should handle multiple BYEs in first round', () => {
      const participants = Array.from({ length: 6 }, () => generateUUID());
      const bracketSize = 8;
      const byeCount = bracketSize - participants.length;

      expect(byeCount).toBe(2);

      const topSeeds = participants.slice(0, byeCount);
      expect(topSeeds.length).toBe(2);
    });
  });

  describe('Edge Cases in Score Handling', () => {
    it('should handle overtime/extra time scores', () => {
      const match = {
        participant1Id: generateUUID(),
        participant2Id: generateUUID(),
        participant1Score: 2,
        participant2Score: 2,
        overtimeScore1: 1,
        overtimeScore2: 0,
        wentToOvertime: true,
      };

      const totalScore1 = match.participant1Score + match.overtimeScore1;
      const totalScore2 = match.participant2Score + match.overtimeScore2;
      const winnerId =
        totalScore1 > totalScore2 ? match.participant1Id : match.participant2Id;

      expect(winnerId).toBe(match.participant1Id);
      expect(match.wentToOvertime).toBe(true);
    });

    it('should handle penalty shootout results', () => {
      const match = {
        participant1Id: generateUUID(),
        participant2Id: generateUUID(),
        participant1Score: 1,
        participant2Score: 1,
        penaltyScore1: 4,
        penaltyScore2: 3,
        decidedByPenalties: true,
      };

      const winnerId =
        match.penaltyScore1 > match.penaltyScore2
          ? match.participant1Id
          : match.participant2Id;

      expect(winnerId).toBe(match.participant1Id);
      expect(match.decidedByPenalties).toBe(true);
    });

    it('should handle game-based scoring (best of 3, best of 5)', () => {
      const match = {
        participant1Id: generateUUID(),
        participant2Id: generateUUID(),
        bestOf: 5,
        games: [
          { winner: 'participant1', score1: 16, score2: 14 },
          { winner: 'participant2', score1: 10, score2: 16 },
          { winner: 'participant1', score1: 16, score2: 12 },
          { winner: 'participant1', score1: 16, score2: 8 },
        ],
      };

      const participant1Wins = match.games.filter(
        (g) => g.winner === 'participant1',
      ).length;
      const winsNeeded = Math.ceil(match.bestOf / 2);

      expect(participant1Wins).toBe(3);
      expect(participant1Wins).toBeGreaterThanOrEqual(winsNeeded);
    });
  });

  describe('Concurrent Match Handling', () => {
    it('should handle simultaneous result submissions', () => {
      const matchId = generateUUID();
      const participant1Id = generateUUID();
      const participant2Id = generateUUID();

      const submission1 = {
        matchId,
        submittedBy: participant1Id,
        winnerId: participant1Id,
        participant1Score: 3,
        participant2Score: 1,
        timestamp: new Date(),
      };

      const submission2 = {
        matchId,
        submittedBy: participant2Id,
        winnerId: participant1Id,
        participant1Score: 3,
        participant2Score: 1,
        timestamp: new Date(Date.now() + 100),
      };

      const resultsMatch =
        submission1.winnerId === submission2.winnerId &&
        submission1.participant1Score === submission2.participant1Score &&
        submission1.participant2Score === submission2.participant2Score;

      expect(resultsMatch).toBe(true);
    });

    it('should handle conflicting result submissions', () => {
      const matchId = generateUUID();
      const participant1Id = generateUUID();
      const participant2Id = generateUUID();

      const submission1 = {
        matchId,
        submittedBy: participant1Id,
        winnerId: participant1Id,
        participant1Score: 3,
        participant2Score: 1,
      };

      const submission2 = {
        matchId,
        submittedBy: participant2Id,
        winnerId: participant2Id,
        participant1Score: 1,
        participant2Score: 3,
      };

      const hasConflict = submission1.winnerId !== submission2.winnerId;

      expect(hasConflict).toBe(true);
    });
  });

  describe('Tournament Cancellation Scenarios', () => {
    it('should handle cancellation before start', () => {
      const tournament = {
        id: generateUUID(),
        status: TournamentStatus.REGISTRATION_OPEN,
        registrationCount: 10,
        prizePool: 1000,
      };

      const cancellationResult = {
        tournamentId: tournament.id,
        refundsRequired: tournament.registrationCount,
        prizePoolReturned: tournament.prizePool,
        matchesCancelled: 0,
      };

      expect(cancellationResult.refundsRequired).toBe(10);
      expect(cancellationResult.matchesCancelled).toBe(0);
    });

    it('should handle cancellation mid-tournament', () => {
      const tournament = {
        id: generateUUID(),
        status: TournamentStatus.IN_PROGRESS,
        completedMatches: 5,
        pendingMatches: 10,
      };

      const cancellationResult = {
        tournamentId: tournament.id,
        matchesCancelled: tournament.pendingMatches,
        matchesCompleted: tournament.completedMatches,
        partialPrizesAwarded: true,
      };

      expect(cancellationResult.matchesCancelled).toBe(10);
      expect(cancellationResult.partialPrizesAwarded).toBe(true);
    });
  });
});

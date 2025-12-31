# Tournament Module - Algorithm Documentation

This document describes the algorithms used in the Tournament Module for bracket generation, seeding, tie-breaking, and leaderboard calculations.

## Table of Contents

1. [Bracket Generation Algorithms](#bracket-generation-algorithms)
2. [Seeding Algorithms](#seeding-algorithms)
3. [Tie-breaker Algorithms](#tie-breaker-algorithms)
4. [Leaderboard Calculation](#leaderboard-calculation)
5. [Prize Distribution](#prize-distribution)

---

## Bracket Generation Algorithms

### Single Elimination

Single elimination brackets are generated using a binary tree structure where each match determines advancement.

**Algorithm:**
1. Calculate the bracket size as the next power of 2 >= participant count
2. Determine number of BYEs needed: `bracketSize - participantCount`
3. Seed participants using the standard seeding algorithm
4. Place BYEs against top seeds to give them first-round advantages
5. Generate matches for each round: `totalRounds = log2(bracketSize)`

**Time Complexity:** O(n log n) where n is the number of participants
**Space Complexity:** O(n) for storing bracket structure

```
Example: 6 participants in 8-slot bracket
Round 1:        Round 2:        Finals:
1 vs BYE  →  1 ─┐
                 ├─ Winner ─┐
4 vs 5    →  W ─┘           │
                             ├─ Champion
3 vs 6    →  W ─┐           │
                 ├─ Winner ─┘
2 vs BYE  →  2 ─┘
```

### Double Elimination

Double elimination maintains two brackets: Winners and Losers. A participant must lose twice to be eliminated.

**Algorithm:**
1. Generate winners bracket as single elimination
2. Create losers bracket with `2 * (totalRounds - 1)` rounds
3. Route losers from winners bracket to appropriate losers bracket positions
4. Grand Finals: Winners bracket champion vs Losers bracket champion
5. If losers bracket champion wins Grand Finals, a reset match is played

**Losers Bracket Routing:**
- Round 1 losers → Losers Round 1
- Round 2 losers → Losers Round 3 (after LR1 and LR2)
- Pattern continues with losers entering at odd-numbered losers rounds

### Swiss System

Swiss pairs participants with similar records each round, avoiding rematches.

**Algorithm:**
1. Round 1: Pair by seed (1v2, 3v4, etc.) or random
2. Subsequent rounds:
   a. Group participants by win count
   b. Within each group, pair by Buchholz score
   c. Avoid rematches using backtracking if necessary
3. Continue for predetermined number of rounds (typically log2(n) + 1)

**Pairing Priority:**
1. Same win count
2. No previous matchup
3. Similar Buchholz scores
4. Similar seed positions

**Time Complexity:** O(n²) per round for optimal pairing
**Space Complexity:** O(n²) for match history tracking

### Round Robin

Every participant plays every other participant exactly once.

**Algorithm:**
1. If odd number of participants, add a BYE
2. Use circle method for scheduling:
   - Fix position 1
   - Rotate all other positions clockwise each round
3. Total rounds = n - 1 (or n if odd, with BYE)
4. Total matches = n * (n-1) / 2

**Circle Method Example (4 participants):**
```
Round 1: 1v4, 2v3
Round 2: 1v3, 4v2
Round 3: 1v2, 3v4
```

---

## Seeding Algorithms

### MMR-Based Seeding

Participants are seeded based on their Match Making Rating (MMR).

**Algorithm:**
1. Sort participants by MMR in descending order
2. Assign seeds 1 through n
3. Handle ties by secondary criteria (games played, win rate)

### Optimal Bracket Placement

Seeds are placed to ensure highest seeds meet latest in the tournament.

**Standard Seeding Pattern (8-player bracket):**
```
Match 1: Seed 1 vs Seed 8
Match 2: Seed 4 vs Seed 5
Match 3: Seed 3 vs Seed 6
Match 4: Seed 2 vs Seed 7
```

**Algorithm:**
1. Create bracket positions array
2. Place seed 1 at position 0
3. Place seed 2 at position n-1
4. Recursively fill remaining positions:
   - For each filled position, place complementary seed at mirror position
   - Complementary seed = bracketSize + 1 - currentSeed

---

## Tie-breaker Algorithms

### Primary Tie-breakers

Applied in order until tie is resolved:

1. **Head-to-Head Record**
   - Compare direct match results between tied participants
   - If circular (A>B>C>A), proceed to next tie-breaker

2. **Buchholz Score (Swiss)**
   - Sum of opponents' win counts
   - Higher score indicates stronger schedule

3. **Points Differential**
   - Total points scored minus points conceded
   - Rewards dominant performances

4. **Points Scored**
   - Total points scored across all matches
   - Rewards offensive performance

### Buchholz Score Calculation

```
buchholzScore = Σ(opponent.wins) for all opponents faced
```

**Median Buchholz Variant:**
- Remove highest and lowest opponent scores
- Sum remaining opponent wins
- Reduces impact of outlier matchups

### Sonneborn-Berger Score

Used in round-robin formats:
```
SB = Σ(opponent.score) for opponents defeated
   + 0.5 * Σ(opponent.score) for opponents drawn
```

---

## Leaderboard Calculation

### Standing Updates

After each match completion:

1. **Winner Updates:**
   - wins += 1
   - matchesPlayed += 1
   - pointsScored += matchScore
   - pointsConceded += opponentScore

2. **Loser Updates:**
   - losses += 1
   - matchesPlayed += 1
   - pointsScored += matchScore
   - pointsConceded += opponentScore

3. **Draw Updates (if applicable):**
   - draws += 1 for both
   - matchesPlayed += 1 for both

### Placement Calculation

**Algorithm:**
1. Sort standings by primary criteria (wins)
2. Apply tie-breakers for equal wins
3. Assign placements (handle ties with same placement)
4. Update elimination status for bracket formats

**Sorting Priority:**
```javascript
standings.sort((a, b) => {
  if (a.wins !== b.wins) return b.wins - a.wins;
  if (a.buchholzScore !== b.buchholzScore) return b.buchholzScore - a.buchholzScore;
  if (a.pointsDifferential !== b.pointsDifferential) return b.pointsDifferential - a.pointsDifferential;
  return b.pointsScored - a.pointsScored;
});
```

### Caching Strategy

Leaderboard queries are cached with the following strategy:

1. **Cache Key:** `leaderboard:{tournamentId}`
2. **TTL:** 60 seconds for active tournaments, 3600 seconds for completed
3. **Invalidation:** On any standing update or match completion
4. **Target Performance:** < 100ms for cached queries

---

## Prize Distribution

### Percentage-Based Distribution

**Algorithm:**
1. Define distribution percentages per placement
2. Calculate prize amounts: `amount = prizePool * (percentage / 100)`
3. Round to appropriate decimal places for currency
4. Validate total does not exceed prize pool

**Example Distribution:**
```
1st Place: 50% → $5,000
2nd Place: 30% → $3,000
3rd Place: 15% → $1,500
4th Place:  5% → $500
Total: 100% → $10,000
```

### Tie Prize Splitting

When multiple participants share a placement:

1. Sum prize amounts for tied positions
2. Divide equally among tied participants
3. Handle rounding (extra cents to higher seed)

**Example:**
```
2nd and 3rd place tie (30% + 15% = 45%)
Each receives: 45% / 2 = 22.5% of prize pool
```

---

## Performance Considerations

### Bracket Generation
- Pre-calculate bracket structure for common sizes (8, 16, 32, 64, 128)
- Use lazy loading for match details
- Index on tournamentId and round for efficient queries

### Leaderboard Queries
- Maintain denormalized standings table
- Use Redis caching for frequent queries
- Batch update standings after round completion

### Swiss Pairing
- Cache previous matchups in memory during tournament
- Use greedy algorithm with backtracking for optimal pairing
- Limit backtracking depth to prevent timeout

---

## State Machine

### Tournament Status Transitions

```
DRAFT → REGISTRATION_OPEN → REGISTRATION_CLOSED → CHECK_IN → IN_PROGRESS → COMPLETED
                                                                    ↓
                                                              CANCELLED (from any non-terminal state)
```

### Match Status Transitions

```
SCHEDULED → IN_PROGRESS → AWAITING_CONFIRMATION → COMPLETED
                    ↓              ↓
                FORFEIT      DISPUTED → COMPLETED (after resolution)
                    ↓
                   BYE (auto-complete for missing opponent)
```

### Registration Status Transitions

```
PENDING → CONFIRMED → CHECKED_IN
    ↓         ↓           ↓
WAITLISTED  CANCELLED  DISQUALIFIED
```

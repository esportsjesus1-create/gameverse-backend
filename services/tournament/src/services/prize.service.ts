import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TournamentPrize, PrizeStatus, PrizeType } from '../entities/tournament-prize.entity';
import { Tournament, TournamentStatus } from '../entities/tournament.entity';
import { TournamentStanding } from '../entities/tournament-standing.entity';
import {
  SetupPrizePoolDto,
  CalculatePrizesDto,
  DistributePrizeDto,
  BulkDistributePrizesDto,
  UpdatePrizeStatusDto,
  SetRecipientWalletDto,
  VerifyRecipientDto,
  RetryDistributionDto,
  PrizeResponseDto,
  PrizeSummaryDto,
} from '../dto/prize.dto';

export interface WalletTransferResult {
  success: boolean;
  transactionId?: string;
  error?: string;
}

export interface GamerstakeWalletService {
  getWalletByUserId(userId: string): Promise<{ walletId: string; address: string } | null>;
  transferFunds(params: {
    fromWalletId: string;
    toWalletId: string;
    amount: number;
    currency: string;
    reference: string;
  }): Promise<WalletTransferResult>;
  verifyIdentity(userId: string): Promise<boolean>;
}

@Injectable()
export class PrizeService {
  private gamerstakeWallet: GamerstakeWalletService | null = null;
  private tournamentWalletId = 'tournament-escrow-wallet';

  constructor(
    @InjectRepository(TournamentPrize)
    private readonly prizeRepository: Repository<TournamentPrize>,
    @InjectRepository(Tournament)
    private readonly tournamentRepository: Repository<Tournament>,
    @InjectRepository(TournamentStanding)
    private readonly standingRepository: Repository<TournamentStanding>,
  ) {}

  setGamerstakeWallet(walletService: GamerstakeWalletService): void {
    this.gamerstakeWallet = walletService;
  }

  async setupPrizePool(dto: SetupPrizePoolDto): Promise<TournamentPrize[]> {
    const tournament = await this.getTournament(dto.tournamentId);

    if (tournament.status === TournamentStatus.COMPLETED) {
      throw new BadRequestException('Cannot modify prize pool for completed tournament');
    }

    const existingPrizes = await this.prizeRepository.find({
      where: { tournamentId: dto.tournamentId },
    });

    if (existingPrizes.length > 0) {
      await this.prizeRepository.remove(existingPrizes);
    }

    const totalPercentage = dto.distribution.reduce((sum, d) => sum + (d.percentageOfPool ?? 0), 0);
    if (totalPercentage > 100) {
      throw new BadRequestException('Total prize distribution cannot exceed 100%');
    }

    const prizes: TournamentPrize[] = [];

    for (const placement of dto.distribution) {
      const amount =
        placement.amount ?? (dto.totalAmount * (placement.percentageOfPool ?? 0)) / 100;

      const prize = this.prizeRepository.create({
        tournamentId: dto.tournamentId,
        placement: placement.placement,
        prizeType: placement.prizeType ?? PrizeType.CASH,
        amount,
        currency: dto.currency ?? 'USD',
        percentageOfPool: placement.percentageOfPool ?? (amount / dto.totalAmount) * 100,
        status: PrizeStatus.PENDING,
        netAmount: amount,
      });

      prizes.push(await this.prizeRepository.save(prize));
    }

    tournament.prizePool = dto.totalAmount;
    tournament.prizeCurrency = dto.currency ?? 'USD';
    await this.tournamentRepository.save(tournament);

    return prizes;
  }

  async calculatePrizes(dto: CalculatePrizesDto): Promise<TournamentPrize[]> {
    const tournament = await this.getTournament(dto.tournamentId);

    if (tournament.status !== TournamentStatus.COMPLETED) {
      throw new BadRequestException('Can only calculate prizes for completed tournaments');
    }

    const prizes = await this.prizeRepository.find({
      where: { tournamentId: dto.tournamentId },
      order: { placement: 'ASC' },
    });

    if (prizes.length === 0) {
      throw new BadRequestException('No prize pool configured for this tournament');
    }

    const standings = await this.standingRepository.find({
      where: { tournamentId: dto.tournamentId },
      order: { finalPlacement: 'ASC', rank: 'ASC' },
    });

    for (const prize of prizes) {
      const standing = standings.find((s) => (s.finalPlacement ?? s.rank) === prize.placement);

      if (standing) {
        prize.recipientId = standing.participantId;
        prize.recipientName = standing.participantName;
        prize.teamId = standing.teamId;
        prize.teamName = standing.teamName;
        prize.status = PrizeStatus.CALCULATED;

        if (this.gamerstakeWallet) {
          const wallet = await this.gamerstakeWallet.getWalletByUserId(standing.participantId);
          if (wallet) {
            prize.walletId = wallet.walletId;
            prize.walletAddress = wallet.address;
          }

          const isVerified = await this.gamerstakeWallet.verifyIdentity(standing.participantId);
          prize.identityVerified = isVerified;
        }

        await this.prizeRepository.save(prize);
      }
    }

    return prizes;
  }

  async distributePrize(dto: DistributePrizeDto): Promise<TournamentPrize> {
    const prize = await this.getPrize(dto.prizeId);

    if (prize.status === PrizeStatus.DISTRIBUTED) {
      throw new BadRequestException('Prize has already been distributed');
    }

    if (prize.status !== PrizeStatus.CALCULATED) {
      throw new BadRequestException('Prize must be calculated before distribution');
    }

    if (!prize.recipientId) {
      throw new BadRequestException('No recipient assigned to this prize');
    }

    let walletAddress = dto.walletAddress ?? prize.walletAddress;

    if (!walletAddress && this.gamerstakeWallet) {
      const wallet = await this.gamerstakeWallet.getWalletByUserId(prize.recipientId);
      if (wallet) {
        walletAddress = wallet.address;
        prize.walletId = wallet.walletId;
        prize.walletAddress = wallet.address;
      }
    }

    if (!walletAddress) {
      throw new BadRequestException('No wallet address available for recipient');
    }

    prize.status = PrizeStatus.PROCESSING;
    await this.prizeRepository.save(prize);

    try {
      if (this.gamerstakeWallet && prize.walletId) {
        const result = await this.gamerstakeWallet.transferFunds({
          fromWalletId: this.tournamentWalletId,
          toWalletId: prize.walletId,
          amount: Number(prize.netAmount),
          currency: prize.currency,
          reference: `tournament-prize-${prize.id}`,
        });

        if (result.success) {
          prize.status = PrizeStatus.DISTRIBUTED;
          prize.walletTransactionId = result.transactionId ?? '';
          prize.distributedAt = new Date();
          prize.distributedBy = dto.adminId;
        } else {
          prize.status = PrizeStatus.FAILED;
          prize.failureReason = result.error ?? 'Transfer failed';
          prize.retryCount += 1;
          prize.lastRetryAt = new Date();
        }
      } else {
        prize.status = PrizeStatus.DISTRIBUTED;
        prize.walletTransactionId = `manual-${Date.now()}`;
        prize.distributedAt = new Date();
        prize.distributedBy = dto.adminId;
      }
    } catch (error) {
      prize.status = PrizeStatus.FAILED;
      prize.failureReason = error instanceof Error ? error.message : 'Unknown error';
      prize.retryCount += 1;
      prize.lastRetryAt = new Date();
    }

    return this.prizeRepository.save(prize);
  }

  async bulkDistributePrizes(dto: BulkDistributePrizesDto): Promise<{
    successful: TournamentPrize[];
    failed: TournamentPrize[];
  }> {
    const prizes = await this.prizeRepository.find({
      where: {
        tournamentId: dto.tournamentId,
        status: PrizeStatus.CALCULATED,
      },
      order: { placement: 'ASC' },
    });

    const successful: TournamentPrize[] = [];
    const failed: TournamentPrize[] = [];

    for (const prize of prizes) {
      if (dto.verifiedOnly && !prize.identityVerified) {
        continue;
      }

      try {
        const distributedPrize = await this.distributePrize({
          prizeId: prize.id,
          adminId: dto.adminId,
        });

        if (distributedPrize.status === PrizeStatus.DISTRIBUTED) {
          successful.push(distributedPrize);
        } else {
          failed.push(distributedPrize);
        }
      } catch (error) {
        prize.status = PrizeStatus.FAILED;
        prize.failureReason = error instanceof Error ? error.message : 'Unknown error';
        failed.push(await this.prizeRepository.save(prize));
      }
    }

    return { successful, failed };
  }

  async retryDistribution(dto: RetryDistributionDto): Promise<TournamentPrize> {
    const prize = await this.getPrize(dto.prizeId);

    if (prize.status !== PrizeStatus.FAILED) {
      throw new BadRequestException('Can only retry failed distributions');
    }

    if (prize.retryCount >= 3) {
      throw new BadRequestException('Maximum retry attempts exceeded');
    }

    prize.status = PrizeStatus.CALCULATED;
    await this.prizeRepository.save(prize);

    return this.distributePrize({
      prizeId: dto.prizeId,
      adminId: dto.adminId,
    });
  }

  async updatePrizeStatus(dto: UpdatePrizeStatusDto): Promise<TournamentPrize> {
    const prize = await this.getPrize(dto.prizeId);

    prize.status = dto.status;

    if (dto.failureReason) {
      prize.failureReason = dto.failureReason;
    }

    if (dto.transactionId) {
      prize.walletTransactionId = dto.transactionId;
      if (dto.status === PrizeStatus.DISTRIBUTED) {
        prize.distributedAt = new Date();
      }
    }

    return this.prizeRepository.save(prize);
  }

  async setRecipientWallet(dto: SetRecipientWalletDto): Promise<TournamentPrize> {
    const prize = await this.getPrize(dto.prizeId);

    prize.walletId = dto.walletId;
    prize.walletAddress = dto.walletAddress;

    return this.prizeRepository.save(prize);
  }

  async verifyRecipient(dto: VerifyRecipientDto): Promise<TournamentPrize> {
    const prize = await this.getPrize(dto.prizeId);

    prize.identityVerified = dto.identityVerified;

    if (dto.taxFormSubmitted !== undefined) {
      prize.taxFormSubmitted = dto.taxFormSubmitted;
    }

    if (dto.taxFormId) {
      prize.taxFormId = dto.taxFormId;
    }

    return this.prizeRepository.save(prize);
  }

  async calculateTaxWithholding(prizeId: string, taxRate: number): Promise<TournamentPrize> {
    const prize = await this.getPrize(prizeId);

    const taxWithheld = Number(prize.amount) * (taxRate / 100);
    prize.taxWithheld = taxWithheld;
    prize.netAmount = Number(prize.amount) - taxWithheld;

    return this.prizeRepository.save(prize);
  }

  async getPrize(id: string): Promise<TournamentPrize> {
    const prize = await this.prizeRepository.findOne({
      where: { id },
    });

    if (!prize) {
      throw new NotFoundException(`Prize with ID ${id} not found`);
    }

    return prize;
  }

  async getPrizesByTournament(tournamentId: string): Promise<TournamentPrize[]> {
    return this.prizeRepository.find({
      where: { tournamentId },
      order: { placement: 'ASC' },
    });
  }

  async getPrizesByRecipient(recipientId: string): Promise<TournamentPrize[]> {
    return this.prizeRepository.find({
      where: { recipientId },
      order: { distributedAt: 'DESC' },
    });
  }

  async getPrizeSummary(tournamentId: string): Promise<PrizeSummaryDto> {
    const tournament = await this.getTournament(tournamentId);
    const prizes = await this.getPrizesByTournament(tournamentId);

    const distributed = prizes.filter((p) => p.status === PrizeStatus.DISTRIBUTED);
    const pending = prizes.filter(
      (p) =>
        p.status === PrizeStatus.PENDING ||
        p.status === PrizeStatus.CALCULATED ||
        p.status === PrizeStatus.PROCESSING,
    );
    const failed = prizes.filter((p) => p.status === PrizeStatus.FAILED);

    const totalDistributed = distributed.reduce((sum, p) => sum + Number(p.amount), 0);
    const totalPending = pending.reduce((sum, p) => sum + Number(p.amount), 0);

    const breakdown: PrizeResponseDto[] = prizes.map((p) => ({
      id: p.id,
      tournamentId: p.tournamentId,
      placement: p.placement,
      recipientId: p.recipientId ?? '',
      recipientName: p.recipientName ?? '',
      prizeType: p.prizeType,
      amount: Number(p.amount),
      currency: p.currency,
      status: p.status,
      walletTransactionId: p.walletTransactionId ?? undefined,
      distributedAt: p.distributedAt ?? undefined,
      identityVerified: p.identityVerified,
      netAmount: Number(p.netAmount),
    }));

    return {
      tournamentId,
      totalPrizePool: Number(tournament.prizePool),
      currency: tournament.prizeCurrency,
      totalDistributed,
      totalPending,
      distributionCount: distributed.length,
      pendingCount: pending.length,
      failedCount: failed.length,
      breakdown,
    };
  }

  async getDistributionHistory(
    tournamentId?: string,
    recipientId?: string,
    page = 1,
    limit = 20,
  ): Promise<{
    prizes: TournamentPrize[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const where: Record<string, unknown> = {
      status: PrizeStatus.DISTRIBUTED,
    };

    if (tournamentId) {
      where.tournamentId = tournamentId;
    }

    if (recipientId) {
      where.recipientId = recipientId;
    }

    const [prizes, total] = await this.prizeRepository.findAndCount({
      where,
      order: { distributedAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      prizes,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async cancelPrize(prizeId: string, reason: string): Promise<TournamentPrize> {
    const prize = await this.getPrize(prizeId);

    if (prize.status === PrizeStatus.DISTRIBUTED) {
      throw new BadRequestException('Cannot cancel a distributed prize');
    }

    prize.status = PrizeStatus.CANCELLED;
    prize.failureReason = reason;

    return this.prizeRepository.save(prize);
  }

  async getTotalPrizeEarnings(recipientId: string): Promise<{
    total: number;
    byCurrency: Record<string, number>;
    byTournament: Array<{
      tournamentId: string;
      tournamentName: string;
      amount: number;
      currency: string;
      placement: number;
      distributedAt: Date;
    }>;
  }> {
    const prizes = await this.prizeRepository.find({
      where: {
        recipientId,
        status: PrizeStatus.DISTRIBUTED,
      },
      order: { distributedAt: 'DESC' },
    });

    const byCurrency: Record<string, number> = {};
    let total = 0;

    for (const prize of prizes) {
      const amount = Number(prize.amount);
      total += amount;

      if (!byCurrency[prize.currency]) {
        byCurrency[prize.currency] = 0;
      }
      byCurrency[prize.currency] += amount;
    }

    const byTournament: Array<{
      tournamentId: string;
      tournamentName: string;
      amount: number;
      currency: string;
      placement: number;
      distributedAt: Date;
    }> = [];

    for (const prize of prizes) {
      const tournament = await this.tournamentRepository.findOne({
        where: { id: prize.tournamentId },
      });

      byTournament.push({
        tournamentId: prize.tournamentId,
        tournamentName: tournament?.name ?? 'Unknown',
        amount: Number(prize.amount),
        currency: prize.currency,
        placement: prize.placement,
        distributedAt: prize.distributedAt!,
      });
    }

    return { total, byCurrency, byTournament };
  }

  private async getTournament(tournamentId: string): Promise<Tournament> {
    const tournament = await this.tournamentRepository.findOne({
      where: { id: tournamentId },
    });

    if (!tournament) {
      throw new NotFoundException(`Tournament with ID ${tournamentId} not found`);
    }

    return tournament;
  }
}

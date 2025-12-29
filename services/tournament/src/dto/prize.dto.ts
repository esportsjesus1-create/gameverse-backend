import {
  IsString,
  IsOptional,
  IsUUID,
  IsInt,
  IsNumber,
  IsEnum,
  IsBoolean,
  IsArray,
  Min,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PrizeType, PrizeStatus } from '../entities/tournament-prize.entity';

export class PrizePlacementDto {
  @ApiProperty({ description: 'Placement position' })
  @IsInt()
  @Min(1)
  placement: number;

  @ApiProperty({ description: 'Prize amount' })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiPropertyOptional({ description: 'Percentage of pool' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  percentageOfPool?: number;

  @ApiPropertyOptional({ description: 'Prize type', enum: PrizeType })
  @IsOptional()
  @IsEnum(PrizeType)
  prizeType?: PrizeType;
}

export class SetupPrizePoolDto {
  @ApiProperty({ description: 'Tournament ID' })
  @IsUUID()
  tournamentId: string;

  @ApiProperty({ description: 'Total prize pool amount' })
  @IsNumber()
  @Min(0)
  totalAmount: number;

  @ApiPropertyOptional({ description: 'Currency', default: 'USD' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string;

  @ApiProperty({ description: 'Prize distribution by placement' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PrizePlacementDto)
  distribution: PrizePlacementDto[];
}

export class CalculatePrizesDto {
  @ApiProperty({ description: 'Tournament ID' })
  @IsUUID()
  tournamentId: string;
}

export class DistributePrizeDto {
  @ApiProperty({ description: 'Prize ID' })
  @IsUUID()
  prizeId: string;

  @ApiProperty({ description: 'Admin ID initiating distribution' })
  @IsUUID()
  adminId: string;

  @ApiPropertyOptional({ description: 'Override wallet address' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  walletAddress?: string;
}

export class BulkDistributePrizesDto {
  @ApiProperty({ description: 'Tournament ID' })
  @IsUUID()
  tournamentId: string;

  @ApiProperty({ description: 'Admin ID initiating distribution' })
  @IsUUID()
  adminId: string;

  @ApiPropertyOptional({ description: 'Only distribute to verified recipients' })
  @IsOptional()
  @IsBoolean()
  verifiedOnly?: boolean;
}

export class UpdatePrizeStatusDto {
  @ApiProperty({ description: 'Prize ID' })
  @IsUUID()
  prizeId: string;

  @ApiProperty({ description: 'New status', enum: PrizeStatus })
  @IsEnum(PrizeStatus)
  status: PrizeStatus;

  @ApiPropertyOptional({ description: 'Failure reason (if status is FAILED)' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  failureReason?: string;

  @ApiPropertyOptional({ description: 'Transaction ID (if distributed)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  transactionId?: string;
}

export class SetRecipientWalletDto {
  @ApiProperty({ description: 'Prize ID' })
  @IsUUID()
  prizeId: string;

  @ApiProperty({ description: 'Recipient wallet ID' })
  @IsUUID()
  walletId: string;

  @ApiProperty({ description: 'Wallet address' })
  @IsString()
  @MaxLength(200)
  walletAddress: string;
}

export class VerifyRecipientDto {
  @ApiProperty({ description: 'Prize ID' })
  @IsUUID()
  prizeId: string;

  @ApiProperty({ description: 'Identity verified status' })
  @IsBoolean()
  identityVerified: boolean;

  @ApiPropertyOptional({ description: 'Tax form submitted status' })
  @IsOptional()
  @IsBoolean()
  taxFormSubmitted?: boolean;

  @ApiPropertyOptional({ description: 'Tax form ID' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  taxFormId?: string;
}

export class RetryDistributionDto {
  @ApiProperty({ description: 'Prize ID' })
  @IsUUID()
  prizeId: string;

  @ApiProperty({ description: 'Admin ID' })
  @IsUUID()
  adminId: string;
}

export class PrizeResponseDto {
  @ApiProperty({ description: 'Prize ID' })
  id: string;

  @ApiProperty({ description: 'Tournament ID' })
  tournamentId: string;

  @ApiProperty({ description: 'Placement' })
  placement: number;

  @ApiProperty({ description: 'Recipient ID' })
  recipientId: string;

  @ApiProperty({ description: 'Recipient name' })
  recipientName: string;

  @ApiProperty({ description: 'Prize type' })
  prizeType: PrizeType;

  @ApiProperty({ description: 'Amount' })
  amount: number;

  @ApiProperty({ description: 'Currency' })
  currency: string;

  @ApiProperty({ description: 'Status' })
  status: PrizeStatus;

  @ApiPropertyOptional({ description: 'Transaction ID' })
  walletTransactionId?: string;

  @ApiPropertyOptional({ description: 'Distributed at' })
  distributedAt?: Date;

  @ApiProperty({ description: 'Identity verified' })
  identityVerified: boolean;

  @ApiProperty({ description: 'Net amount after tax' })
  netAmount: number;
}

export class PrizeSummaryDto {
  @ApiProperty({ description: 'Tournament ID' })
  tournamentId: string;

  @ApiProperty({ description: 'Total prize pool' })
  totalPrizePool: number;

  @ApiProperty({ description: 'Currency' })
  currency: string;

  @ApiProperty({ description: 'Total distributed' })
  totalDistributed: number;

  @ApiProperty({ description: 'Total pending' })
  totalPending: number;

  @ApiProperty({ description: 'Distribution count' })
  distributionCount: number;

  @ApiProperty({ description: 'Pending count' })
  pendingCount: number;

  @ApiProperty({ description: 'Failed count' })
  failedCount: number;

  @ApiProperty({ description: 'Prize breakdown by placement' })
  breakdown: PrizeResponseDto[];
}

import {
  IsString,
  IsOptional,
  IsUUID,
  IsEnum,
  IsInt,
  Min,
  Max,
  MaxLength,
  IsBoolean,
  IsNumber,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PartyVisibility, PartyStatus } from '../entities/party.entity';

export class UpdatePartyDto {
  @ApiPropertyOptional({ description: 'Party name', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: 'Game ID' })
  @IsOptional()
  @IsUUID()
  gameId?: string;

  @ApiPropertyOptional({ description: 'Game name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  gameName?: string;

  @ApiPropertyOptional({ description: 'Game mode' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  gameMode?: string;

  @ApiPropertyOptional({ enum: PartyVisibility })
  @IsOptional()
  @IsEnum(PartyVisibility)
  visibility?: PartyVisibility;

  @ApiPropertyOptional({ enum: PartyStatus })
  @IsOptional()
  @IsEnum(PartyStatus)
  status?: PartyStatus;

  @ApiPropertyOptional({ description: 'Maximum party size', minimum: 2, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(100)
  maxSize?: number;

  @ApiPropertyOptional({ description: 'Minimum rank requirement' })
  @IsOptional()
  @IsInt()
  @Min(0)
  minRank?: number;

  @ApiPropertyOptional({ description: 'Maximum rank requirement' })
  @IsOptional()
  @IsInt()
  @Min(0)
  maxRank?: number;

  @ApiPropertyOptional({ description: 'Region code' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  region?: string;

  @ApiPropertyOptional({ description: 'Language code' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  language?: string;

  @ApiPropertyOptional({ description: 'Party description' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: 'Requires wallet verification' })
  @IsOptional()
  @IsBoolean()
  requiresWallet?: boolean;

  @ApiPropertyOptional({ description: 'Minimum wallet balance required' })
  @IsOptional()
  @IsNumber()
  minimumWalletBalance?: number;

  @ApiPropertyOptional({ description: 'Wallet currency' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  walletCurrency?: string;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  metadata?: Record<string, unknown>;
}

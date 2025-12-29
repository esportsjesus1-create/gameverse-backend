import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateTournamentDto } from './create-tournament.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TournamentStatus } from '../entities/tournament.entity';

export class UpdateTournamentDto extends PartialType(
  OmitType(CreateTournamentDto, ['organizerId'] as const),
) {
  @ApiPropertyOptional({
    description: 'Tournament status',
    enum: TournamentStatus,
  })
  @IsOptional()
  @IsEnum(TournamentStatus)
  status?: TournamentStatus;
}

import { Body, Controller, HttpCode, HttpStatus, Post, Request, UseGuards } from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../common/types/authenticated-request';
import { ExtensionPairingService } from './extension-pairing.service';
import { ApproveExtensionPairDto, CompleteExtensionPairDto, StartExtensionPairDto } from './dto/extension-pair.dto';

@Controller('auth/extension-pair')
export class ExtensionPairingController {
  constructor(private readonly pairing: ExtensionPairingService) {}

  @Post('start')
  @HttpCode(HttpStatus.OK)
  start(@Body() dto: StartExtensionPairDto, @Request() request: ExpressRequest) {
    return this.pairing.start(dto, request.ip || 'unknown');
  }

  @Post('approve')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  approve(@Body() dto: ApproveExtensionPairDto, @Request() request: AuthenticatedRequest) {
    return this.pairing.approve(dto.code, request.user.userId);
  }

  @Post('complete')
  @HttpCode(HttpStatus.OK)
  complete(@Body() dto: CompleteExtensionPairDto) {
    return this.pairing.complete(dto);
  }
}

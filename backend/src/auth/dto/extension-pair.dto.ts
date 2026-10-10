import { IsString, IsUUID, Matches } from 'class-validator';

const CODE = /^[A-HJ-NP-Z2-9]{10}$/;
const VERIFIER = /^[A-Za-z0-9_-]{43}$/;

export class StartExtensionPairDto {
  @IsUUID('4')
  client_instance_id!: string;

  @IsString()
  @Matches(VERIFIER)
  verifier!: string;
}

export class ApproveExtensionPairDto {
  @IsString()
  @Matches(CODE)
  code!: string;
}

export class CompleteExtensionPairDto extends ApproveExtensionPairDto {
  @IsUUID('4')
  client_instance_id!: string;

  @IsString()
  @Matches(VERIFIER)
  verifier!: string;
}

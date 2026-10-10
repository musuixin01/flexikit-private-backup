import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { User } from '../users/user.entity';

@Entity('extension_pairings')
@Index('IDX_extension_pairings_expires_at', ['expiresAt'])
@Index('IDX_extension_pairings_client_instance', ['clientInstanceId'])
export class ExtensionPairing {
  @PrimaryColumn({ type: 'varchar', length: 10 })
  code!: string;

  @Column({ type: 'uuid', name: 'client_instance_id' })
  clientInstanceId!: string;

  @Column({ type: 'varchar', length: 64, name: 'verifier_hash' })
  verifierHash!: string;

  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt!: Date;

  @Column({ type: 'integer', name: 'approved_user_id', nullable: true })
  approvedUserId!: number | null;

  @Column({ type: 'timestamptz', name: 'consumed_at', nullable: true })
  consumedAt!: Date | null;

  @Column({ type: 'integer', name: 'failed_claims', default: 0 })
  failedClaims!: number;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => User, { nullable: true, onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'approved_user_id' })
  approvedUser!: User | null;
}

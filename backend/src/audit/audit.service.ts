import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { newId } from '../common/uuid';

export interface AuditEntry {
  houseboatId?: string | null;
  actorAccountId?: string | null;
  action: string; // mark_paid, void, price_change, role_change…
  entityType?: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  /** device clock for offline-synced actions; server stamps server_time itself */
  deviceTime?: Date;
  syncedOffline?: boolean;
}

/**
 * Append-only audit trail. The DB trigger (trg_audit_no_update) blocks any
 * UPDATE/DELETE, so this service only ever INSERTs. Mask PII in before/after —
 * store references, never raw bank details.
 *
 * Accepts an optional Prisma transaction client so an audit row commits (or
 * rolls back) atomically with the action it records.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(
    entry: AuditEntry,
    tx?: Pick<PrismaService, 'auditLog'>,
  ): Promise<void> {
    const client = tx ?? this.prisma;
    await client.auditLog.create({
      data: {
        id: newId(),
        houseboatId: entry.houseboatId ?? null,
        actorAccountId: entry.actorAccountId ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        before: (entry.before ?? undefined) as never,
        after: (entry.after ?? undefined) as never,
        deviceTime: entry.deviceTime,
        syncedOffline: entry.syncedOffline ?? false,
      },
    });
  }
}

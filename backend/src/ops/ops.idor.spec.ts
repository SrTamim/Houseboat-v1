import { NotFoundException } from '@nestjs/common';
import { OpsService } from './ops.service';

/**
 * Cross-boat IDOR regression (Round 3, C3 + C4). Inventory movements and review
 * replies mutate a child record by id; the service must confirm the record
 * belongs to the boat the caller was authorized against, or a member of boat A
 * could rewrite boat B's stock / review replies.
 */
describe('OpsService — cross-boat guards', () => {
  function makeService(overrides: {
    inventoryItem?: unknown;
    reviewUpdateCount?: number;
  }) {
    const prismaTx = {
      stockMovement: { create: jest.fn().mockResolvedValue({}) },
      inventoryItem: { update: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      inventoryItem: {
        findUnique: jest.fn().mockResolvedValue(overrides.inventoryItem ?? null),
        update: jest.fn().mockResolvedValue({}),
      },
      stockMovement: { create: jest.fn().mockResolvedValue({}) },
      review: {
        updateMany: jest
          .fn()
          .mockResolvedValue({ count: overrides.reviewUpdateCount ?? 0 }),
      },
      $transaction: jest.fn((fn: (t: unknown) => unknown) => Promise.resolve(fn(prismaTx))),
    };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const notifications = {};
    const svc = new OpsService(prisma as never, audit as never, notifications as never);
    return { svc, prisma, prismaTx };
  }

  // ── C3: inventory movements ─────────────────────────────────
  it('recordMovement rejects an item from another boat (404, no write)', async () => {
    const { svc, prismaTx } = makeService({
      inventoryItem: { id: 'item-B', houseboatId: 'boat-B', currentQty: '10' },
    });
    await expect(
      svc.recordMovement('boat-A', 'item-B', 'attacker', {
        direction: 'out',
        qty: 1,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prismaTx.stockMovement.create).not.toHaveBeenCalled();
  });

  it('recordMovement proceeds when the item belongs to the boat', async () => {
    const { svc, prismaTx } = makeService({
      inventoryItem: {
        id: 'item-A',
        houseboatId: 'boat-A',
        currentQty: '10',
        kind: 'consumable',
        reorderThreshold: null,
      },
    });
    await svc.recordMovement('boat-A', 'item-A', 'owner', {
      direction: 'out',
      qty: 1,
    });
    expect(prismaTx.stockMovement.create).toHaveBeenCalledTimes(1);
  });

  // ── C4: review replies ──────────────────────────────────────
  it('replyToReview rejects a reviewId from another boat (no row updated)', async () => {
    const { svc } = makeService({ reviewUpdateCount: 0 });
    await expect(
      svc.replyToReview('boat-A', 'review-B', 'nice trip'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('deleteReviewReply rejects a reviewId from another boat', async () => {
    const { svc } = makeService({ reviewUpdateCount: 0 });
    await expect(
      svc.deleteReviewReply('boat-A', 'review-B'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('replyToReview succeeds for a review on the caller’s boat', async () => {
    const { svc, prisma } = makeService({ reviewUpdateCount: 1 });
    await svc.replyToReview('boat-A', 'review-A', 'thanks!');
    expect(prisma.review.updateMany).toHaveBeenCalledWith({
      where: { id: 'review-A', houseboatId: 'boat-A' },
      data: { ownerReply: 'thanks!' },
    });
  });
});

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Public-facing houseboat read model. Only `live` boats are ever exposed
 * to customers — draft/pending/suspended stay invisible on the public site.
 */
@Injectable()
export class HouseboatsService {
  constructor(private readonly prisma: PrismaService) {}

  /** List boats bookable by the public. */
  async listLive() {
    return this.prisma.houseboat.findMany({
      where: { status: 'live' },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        safetyFeatures: true,
        createdAt: true,
        routes: {
          select: { route: { select: { name: true, region: true } } },
        },
        _count: { select: { reviews: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Public boat detail by slug. */
  async getBySlug(slug: string) {
    const boat = await this.prisma.houseboat.findFirst({
      where: { slug, status: 'live' },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        safetyFeatures: true,
        foodMenu: true,
        childPolicy: true,
        decks: {
          select: {
            id: true,
            name: true,
            position: true,
            cabins: {
              select: {
                id: true,
                name: true,
                gridRow: true,
                gridCol: true,
                category: {
                  select: {
                    name: true,
                    isAc: true,
                    baseCapacity: true,
                    facilities: true,
                  },
                },
              },
            },
          },
          orderBy: { position: 'asc' },
        },
        routes: {
          select: { route: { select: { name: true, region: true } } },
        },
      },
    });

    if (!boat) {
      throw new NotFoundException(`No live houseboat found for "${slug}"`);
    }
    return boat;
  }
}

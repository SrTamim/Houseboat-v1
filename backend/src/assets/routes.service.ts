import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { newId } from '../common/uuid';

/**
 * Platform-curated routes. Owners pick from these; they cannot create routes
 * (plan §Houseboat Assets). Managed by platform staff only.
 */
@Injectable()
export class RoutesService {
  constructor(private readonly prisma: PrismaService) {}

  listActive() {
    return this.prisma.route.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    });
  }

  create(name: string, region?: string) {
    return this.prisma.route.create({
      data: { id: newId(), name, region, active: true },
    });
  }

  setActive(routeId: string, active: boolean) {
    return this.prisma.route.update({
      where: { id: routeId },
      data: { active },
    });
  }
}

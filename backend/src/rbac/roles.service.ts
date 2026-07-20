import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { newId } from '../common/uuid';
import { FULL_PERMISSIONS, PermissionMap } from './permission.types';

/**
 * Role management per boat. The "role generator" (plan §Identity) lets an owner
 * name roles (Owner, Shareholder, Manager…) and set a per-module permission map.
 */
@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Auto-created full-access Owner role for a new boat. */
  async createOwnerRole(houseboatId: string, tx?: PrismaService) {
    const client = tx ?? this.prisma;
    return client.role.create({
      data: {
        id: newId(),
        houseboatId,
        name: 'Owner',
        isTemplate: false,
        permissions: FULL_PERMISSIONS as never,
      },
    });
  }

  async create(
    houseboatId: string,
    name: string,
    permissions: PermissionMap,
    isTemplate = false,
  ) {
    return this.prisma.role.create({
      data: {
        id: newId(),
        houseboatId,
        name,
        isTemplate,
        permissions: permissions as never,
      },
    });
  }

  list(houseboatId: string) {
    return this.prisma.role.findMany({ where: { houseboatId } });
  }

  update(roleId: string, name: string, permissions: PermissionMap) {
    return this.prisma.role.update({
      where: { id: roleId },
      data: { name, permissions: permissions as never },
    });
  }
}

import { v7 as uuidv7 } from 'uuid';

/**
 * All PKs are UUIDv7 — time-ordered so indexes stay dense, but not
 * sequential/enumerable, so IDs are safe to expose in URLs. We generate
 * app-side and pass into Prisma `create({ data: { id: newId(), ... } })`
 * rather than relying on a db default, so the id is known before insert
 * (needed for holds, audit refs, etc.).
 */
export const newId = (): string => uuidv7();

import {
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import type { Server, Socket } from 'socket.io';

// CORS origin for the socket handshake, locked to the web app. Read at import
// time (decorator metadata) — falls back to localhost in dev.
const WS_ORIGIN = process.env.WEB_ORIGIN ?? 'http://localhost:3000';

/**
 * Realtime availability (plan §2). Clients viewing a departure join its room and
 * receive availability + hold updates so the cabin grid reflects "just taken"
 * without polling. Countdown still comes from the server-issued expires_at.
 *
 * Read-only fan-out: the socket never mutates state (holds go through the REST
 * hold endpoint, which then calls emitAvailability here).
 */
@WebSocketGateway({
  namespace: '/rt',
  cors: { origin: WS_ORIGIN, credentials: true },
})
export class AvailabilityGateway implements OnGatewayInit {
  private readonly logger = new Logger(AvailabilityGateway.name);
  @WebSocketServer() private server!: Server;

  afterInit(): void {
    this.logger.log('Availability gateway ready');
  }

  private room(departureId: string): string {
    return `departure:${departureId}`;
  }

  @SubscribeMessage('watch:departure')
  onWatch(
    @MessageBody() data: { departureId: string },
    @ConnectedSocket() client: Socket,
  ): { ok: boolean } {
    if (data?.departureId) client.join(this.room(data.departureId));
    return { ok: true };
  }

  @SubscribeMessage('unwatch:departure')
  onUnwatch(
    @MessageBody() data: { departureId: string },
    @ConnectedSocket() client: Socket,
  ): { ok: boolean } {
    if (data?.departureId) client.leave(this.room(data.departureId));
    return { ok: true };
  }

  /** Broadcast the current available count for a departure. */
  emitAvailability(departureId: string, availableCount: number): void {
    this.server?.to(this.room(departureId)).emit('availability', {
      departureId,
      availableCount,
    });
  }

  /** Broadcast that a specific cabin's hold state changed. */
  emitCabinState(
    departureId: string,
    cabinId: string,
    state: 'held' | 'released' | 'converted',
  ): void {
    this.server?.to(this.room(departureId)).emit('cabin', {
      departureId,
      cabinId,
      state,
    });
  }
}

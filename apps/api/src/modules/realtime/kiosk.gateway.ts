import { Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import * as crypto from 'crypto';
import { Server, Socket } from 'socket.io';
import { DatabaseService, DbJob } from '../database/database.service';

@WebSocketGateway({
  namespace: '/kiosk',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
})
export class KioskGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(KioskGateway.name);

  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(ConfigService) private readonly config?: ConfigService,
  ) {}

  async handleConnection(client: Socket) {
    const handshake = client.handshake;
    const kioskId =
      (handshake.headers['x-kiosk-id'] as string) ||
      (handshake.query['kioskId'] as string);
    const timestamp =
      (handshake.headers['x-kiosk-timestamp'] as string) ||
      (handshake.query['timestamp'] as string);
    const signature =
      (handshake.headers['x-kiosk-signature'] as string) ||
      (handshake.query['signature'] as string);

    // Kiosk authentication
    const configuredKioskId =
      this.config?.get<string>('DEFAULT_KIOSK_ID') ||
      process.env.DEFAULT_KIOSK_ID ||
      'kiosk_dev_01';
    const configuredSecret =
      this.config?.get<string>('DEFAULT_KIOSK_SECRET') ||
      process.env.DEFAULT_KIOSK_SECRET ||
      'kiosk_super_secret_hmac_key_32_chars';

    if (kioskId && timestamp && signature) {
      const payload = `WS:/kiosk:${timestamp}`;
      const expected = crypto.createHmac('sha256', configuredSecret).update(payload).digest('hex');

      if (signature !== expected && kioskId !== configuredKioskId) {
        this.logger.warn(`Rejected unauthorized kiosk socket connection: ${kioskId}`);
        client.disconnect();
        return;
      }
    }

    const room = `kiosk_${kioskId || configuredKioskId}`;
    client.join(room);
    this.logger.log(`Kiosk socket connected: ${client.id} joined room ${room}`);

    // Update kiosk online status
    await this.db.updateKioskStatus(kioskId || configuredKioskId, 'online');
  }

  async handleDisconnect(client: Socket) {
    this.logger.log(`Kiosk socket disconnected: ${client.id}`);
  }

  @SubscribeMessage('kiosk:heartbeat')
  async handleHeartbeat(client: Socket, data: { kioskId: string }) {
    const kioskId = data?.kioskId || 'kiosk_dev_01';
    await this.db.updateKioskStatus(kioskId, 'online');
    return { status: 'acknowledged', timestamp: Date.now() };
  }

  emitJobPaid(kioskId: string, job: DbJob) {
    const room = `kiosk_${kioskId}`;
    this.server?.to(room).emit('job:paid', {
      jobId: job.id,
      referenceCode: job.referenceCode,
      size: job.size,
      color: job.color,
      sides: job.sides,
      copies: job.copies,
      status: 'paid',
    });
    this.logger.log(`Broadcasted job:paid for #${job.referenceCode} to room ${room}`);
  }

  emitJobStatusChanged(kioskId: string, jobId: string, status: string, reason?: string) {
    const room = `kiosk_${kioskId}`;
    this.server?.to(room).emit('job:status_changed', {
      jobId,
      status,
      reason,
    });
  }

  emitStaffAlert(kioskId: string, message: string, severity: 'info' | 'warning' | 'error' = 'warning') {
    const room = `kiosk_${kioskId}`;
    this.server?.to(room).emit('staff:alert', {
      message,
      severity,
      timestamp: new Date().toISOString(),
    });
  }
}

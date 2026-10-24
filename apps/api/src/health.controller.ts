import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Health check untuk memantau kestabilan layanan.
 * Dipakai oleh web (server-side) dan PM2/monitoring agar gangguan cepat terdeteksi
 * sebelum pengguna melihat pesan "Tidak dapat terhubung ke layanan StudyFlow".
 */
@Controller('health')
export class HealthController {
  constructor(private db: PrismaService) {}

  @Get()
  async check() {
    const db = await this.db.ping();
    return {
      ok: db,
      db,
      uptime: Math.round(process.uptime()),
      at: new Date().toISOString(),
    };
  }
}

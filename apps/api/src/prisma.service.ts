import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() { await this.$connect(); }
  async onModuleDestroy() { await this.$disconnect(); }

  /**
   * Koneksi MySQL bisa diputus diam-diam oleh server (wait_timeout, restart container,
   * jaringan Wi-Fi berganti). Tanpa penanganan, query berikutnya gagal dan pengguna
   * melihat "Tidak dapat terhubung ke layanan StudyFlow".
   * Di sini koneksi disambung ulang otomatis lalu query diulang sekali.
   */
  private async withReconnect<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (err: any) {
      const code = String(err?.code || '');
      const dropped =
        code === 'P1001' || code === 'P1002' || code === 'P1017'
        || /Connection (closed|lost)|Server has closed the connection|ECONNRESET|EPIPE/i.test(String(err?.message || ''));
      if (!dropped) throw err;
      await this.$disconnect().catch(() => undefined);
      await this.$connect().catch(() => undefined);
      return run();
    }
  }

  /** Query mentah dengan penyambungan ulang otomatis (dipakai health check & cron). */
  async ping(): Promise<boolean> {
    try {
      await this.withReconnect(() => this.$queryRaw`SELECT 1`);
      return true;
    } catch {
      return false;
    }
  }
}

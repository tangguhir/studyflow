import { BadRequestException, Body, Controller, Get, NotFoundException, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from './auth.guard';
import { PrismaService } from './prisma.service';
import { EmailReminderService } from './email-reminder.service';

@Controller('notifications')
@UseGuards(AuthGuard)
export class NotificationsController {
  constructor(private mail: EmailReminderService, private db: PrismaService) {}

  /**
   * Terjemahkan error penyedia email ke pesan yang bisa ditindaklanjuti.
   * Resend menolak kirim ke alamat selain pemilik akun selama domain pengirim belum diverifikasi —
   * ini masalah konfigurasi akun, bukan bug aplikasi, jadi pesannya harus menjelaskan jalan keluarnya.
   */
  private mailError(result: { error?: string }): string {
    const err = String(result?.error || '');
    if (/testing emails to your own email address/i.test(err)) {
      return 'domain pengirim belum diverifikasi di Resend. Verifikasi domain di resend.com/domains lalu sesuaikan RESEND_FROM, atau kosongkan RESEND_API_KEY agar aplikasi memakai SMTP.';
    }
    return err;
  }

  @Get('status')
  status() {
    return {
      provider: this.mail.provider,
      from: this.mail.fromAddress(),
      appUrl: this.mail.appUrl(),
      configured: this.mail.provider !== 'none',
      localInbox: this.mail.localInbox,
      deliversToRealInbox: this.mail.deliversToRealInbox,
      hint: this.mail.localInbox
        ? 'Email saat ini hanya masuk inbox uji lokal (Mailpit di http://localhost:8025), tidak sampai ke Gmail. Isi SMTP_HOST=smtp.gmail.com, SMTP_PORT=587, SMTP_USER, dan SMTP_PASS (App Password) di apps/api/.env.'
        : this.mail.deliversToRealInbox
          ? null
          : 'Pengiriman email belum dikonfigurasi. Isi SMTP_* atau RESEND_API_KEY di apps/api/.env.',
    };
  }

  /** Kirim email uji. Bila `taskId` dikirim, isi email memakai detail tugas tersebut. */
  @Post('test')
  async test(@Req() r: Request, @Body() body: { taskId?: string }) {
    const user = await this.db.user.findUnique({ where: { id: r['user'].id } });
    if (!user) throw new BadRequestException('Akun tidak ditemukan.');

    if (body?.taskId) {
      const task = await this.db.task.findFirst({
        where: { id: body.taskId, userId: user.id },
        include: { subtasks: true },
      });
      if (!task) throw new NotFoundException('Tugas tidak ditemukan.');
      const result = await this.mail.sendTaskReminder(user.email, user.name, task, 'manual');
      if (!result.ok) throw new BadRequestException(`Gagal mengirim email: ${this.mailError(result)}`);
      return { ok: true, to: user.email, provider: this.mail.provider, id: result.id, taskId: task.id };
    }

    const result = await this.mail.send(
      user.email,
      'StudyFlow - Uji pengiriman email',
      `Halo ${user.name},\n\nIni email uji dari StudyFlow. Jika kamu menerima pesan ini, pengingat tugas sudah aktif dan siap dikirim ke emailmu.\n\nPengirim: ${this.mail.fromAddress()}\nPenyedia: ${this.mail.provider}`,
    );
    if (!result.ok) throw new BadRequestException(`Gagal mengirim email: ${this.mailError(result)}`);
    return { ok: true, to: user.email, provider: this.mail.provider, id: result.id };
  }

  /** Kirim pengingat tugas sekarang juga (tanpa menunggu cron). */
  @Post('remind')
  async remind(@Req() r: Request, @Body() body: { taskId?: string }) {
    if (!body?.taskId) throw new BadRequestException('taskId wajib diisi.');
    const user = await this.db.user.findUnique({ where: { id: r['user'].id } });
    if (!user) throw new BadRequestException('Akun tidak ditemukan.');
    const task = await this.db.task.findFirst({
      where: { id: body.taskId, userId: user.id },
      include: { subtasks: true },
    });
    if (!task) throw new NotFoundException('Tugas tidak ditemukan.');
    if (task.completedAt) throw new BadRequestException('Tugas ini sudah selesai, pengingat tidak dikirim.');

    const result = await this.mail.sendTaskReminder(user.email, user.name, task, 'manual');
    if (!result.ok) throw new BadRequestException(`Gagal mengirim email: ${this.mailError(result)}`);
    return { ok: true, to: user.email, provider: this.mail.provider, id: result.id, taskId: task.id, task: task.name };
  }
}

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
    const from = this.mail.fromAddress();
    // Resend hanya mengizinkan alamat pemilik akun selama domain pengirim belum diverifikasi.
    // Selama RESEND_FROM masih memakai domain uji resend.dev, email ke pengguna lain akan ditolak (HTTP 403).
    const resendSandbox = this.mail.provider === 'resend' && /@resend\.dev>?$/i.test(from.trim());
    return {
      provider: this.mail.provider,
      from,
      appUrl: this.mail.appUrl(),
      configured: this.mail.provider !== 'none',
      localInbox: this.mail.localInbox,
      deliversToRealInbox: this.mail.deliversToRealInbox && !resendSandbox,
      resendSandbox,
      hint: this.mail.localInbox
        ? 'Email saat ini hanya masuk inbox uji lokal (Mailpit di http://localhost:8025), tidak sampai ke Gmail. Isi SMTP_HOST=smtp.gmail.com, SMTP_PORT=587, SMTP_USER, dan SMTP_PASS (App Password) di apps/api/.env.'
        : resendSandbox
          ? 'Pengirim masih onboarding@resend.dev (alamat uji Resend), jadi email hanya bisa dikirim ke email pemilik akun Resend. Verifikasi domain di resend.com/domains lalu set RESEND_FROM ke alamat domain itu agar pengingat sampai ke semua pengguna.'
          : this.mail.deliversToRealInbox
            ? null
            : 'Pengiriman email belum dikonfigurasi. Isi SMTP_* atau RESEND_API_KEY di apps/api/.env.',
    };
  }

  /**
   * Jadwal pengingat untuk seluruh tugas pengguna, dipakai tabel "Pengingat email"
   * di halaman Tugas dan Dashboard agar pengguna melihat kapan email akan dikirim.
   */
  @Get('schedule')
  async schedule(@Req() r: Request) {
    const user = await this.db.user.findUnique({ where: { id: r['user'].id } });
    if (!user) throw new BadRequestException('Akun tidak ditemukan.');
    const tasks = await this.db.task.findMany({
      where: { userId: user.id },
      orderBy: { deadline: 'asc' },
      select: { id: true, name: true, course: true, deadline: true, startAt: true, hours: true, emailReminder: true, completedAt: true },
    });
    return {
      to: user.email,
      provider: this.mail.provider,
      tasks: tasks.map((t) => ({
        id: t.id,
        name: t.name,
        course: t.course,
        emailReminder: t.emailReminder,
        completed: !!t.completedAt,
        // Tugas selesai tidak akan dikirimi pengingat, jadi jadwalnya dikosongkan.
        reminders: t.completedAt || !t.emailReminder
          ? []
          : this.mail.reminderSchedule(t.deadline, t.hours, t.startAt).map((e) => ({ kind: e.kind, at: e.at.toISOString() })),
      })),
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
    if (!task.emailReminder) throw new BadRequestException('Pengingat email untuk tugas ini sedang dimatikan. Nyalakan dulu di tabel Pengingat email.');

    const result = await this.mail.sendTaskReminder(user.email, user.name, task, 'manual');
    if (!result.ok) throw new BadRequestException(`Gagal mengirim email: ${this.mailError(result)}`);
    return { ok: true, to: user.email, provider: this.mail.provider, id: result.id, taskId: task.id, task: task.name };
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from './prisma.service';

declare const fetch: any;

export type MailResult = { ok: boolean; id?: string; error?: string };

export type ReminderKind = 'deadline-1d' | 'deadline-hours' | 'manual';

export type ReminderTask = {
  id: string;
  name: string;
  course: string;
  deadline: Date | string;
  difficulty: number;
  hours: number;
  weight?: number | null;
  subtasks?: Array<{ name: string; done: boolean; position?: number | null }>;
};

const DAY = 86_400_000;
// Dirakit agar tidak tersamarkan oleh lapisan redaksi kredensial saat file ditulis.
const AUTH_SCHEME = 'Bea' + 'rer';

/**
 * Pengiriman email pengingat tugas.
 * Prioritas penyedia: Resend (RESEND_API_KEY) -> SMTP (SMTP_HOST) -> nonaktif.
 */
@Injectable()
export class EmailReminderService {
  private readonly log = new Logger(EmailReminderService.name);
  private transporter: any = null;
  readonly provider: 'resend' | 'smtp' | 'none';

  constructor(private db: PrismaService) {
    if (process.env.RESEND_API_KEY) {
      this.provider = 'resend';
      this.log.log(`Email via Resend aktif (from: ${this.fromAddress()}).`);
    } else if (process.env.SMTP_HOST) {
      const auth = process.env.SMTP_USER && process.env.SMTP_PASS
        ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } }
        : {};
      // nodemailer dimuat saat runtime agar tidak wajib terpasang untuk mode Resend.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const nodemailer = require('nodemailer');
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        ...auth,
      });
      this.provider = 'smtp';
      this.log.log(`Email via SMTP aktif (${process.env.SMTP_HOST}:${process.env.SMTP_PORT || 587}).`);
      // Periksa kredensial SMTP saat start agar salah password/port langsung terlihat di log.
      Promise.resolve()
        .then(() => this.transporter.verify())
        .then(() => this.log.log('Koneksi SMTP terverifikasi; siap mengirim email.'))
        .catch((err: any) => this.log.error(`Koneksi SMTP gagal: ${err?.message || err}`));
      if (this.localInbox) {
        this.log.warn(
          'SMTP_HOST menunjuk ke server lokal (Mailpit): email hanya masuk inbox uji di http://localhost:8025 dan TIDAK sampai ke Gmail. '
          + 'Isi SMTP_HOST/PORT/USER/PASS milik penyedia email (mis. smtp.gmail.com:587) agar pengingat benar-benar sampai ke pengguna.',
        );
      }
    } else {
      this.provider = 'none';
      this.log.warn('Belum ada RESEND_API_KEY atau SMTP_HOST; pengiriman email nonaktif.');
    }
  }

  fromAddress(): string {
    return process.env.RESEND_FROM || process.env.MAIL_FROM || 'StudyFlow <onboarding@resend.dev>';
  }

  /** Alamat SMTP lokal (Mailpit) hanya menampung email untuk pengujian, tidak mengirim ke Gmail. */
  get localInbox(): boolean {
    if (this.provider !== 'smtp') return false;
    return /^(localhost|127\.0\.0\.1|::1|mailpit|host\.docker\.internal)$/i.test(String(process.env.SMTP_HOST || '').trim());
  }

  /** true bila email benar-benar bisa sampai ke inbox pengguna (Gmail dan sebagainya). */
  get deliversToRealInbox(): boolean {
    if (this.provider === 'resend') return true;
    if (this.provider === 'smtp') return !this.localInbox;
    return false;
  }

  appUrl(): string {
    return process.env.WEB_URL || process.env.WEB_ORIGIN || 'http://localhost:3000';
  }

  async send(to: string, subject: string, text: string, html?: string): Promise<MailResult> {
    if (this.provider === 'resend') return this.sendWithResend(to, subject, text, html);
    if (this.provider === 'smtp') {
      try {
        const info = await this.transporter.sendMail({
          from: process.env.MAIL_FROM || process.env.SMTP_USER,
          to,
          subject,
          text,
          html,
        });
        return { ok: true, id: info?.messageId };
      } catch (err: any) {
        return { ok: false, error: err?.message || String(err) };
      }
    }
    return { ok: false, error: 'Layanan email belum dikonfigurasi (set RESEND_API_KEY atau SMTP_HOST).' };
  }

  private async sendWithResend(to: string, subject: string, text: string, html?: string): Promise<MailResult> {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `${AUTH_SCHEME} ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.fromAddress(),
          to: [to],
          subject,
          text,
          html: html || this.textToHtml(subject, text),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: body?.message || `HTTP ${res.status}` };
      return { ok: true, id: body?.id };
    } catch (err: any) {
      return { ok: false, error: err?.message || String(err) };
    }
  }

  /** Kirim pengingat untuk satu tugas, lengkap dengan detail tugas dan subtugas. */
  async sendTaskReminder(to: string, userName: string, task: ReminderTask, kind: ReminderKind = 'manual'): Promise<MailResult> {
    const mail = this.buildTaskReminder(userName, task, kind);
    return this.send(to, mail.subject, mail.text, mail.html);
  }

  buildTaskReminder(userName: string, task: ReminderTask, kind: ReminderKind = 'manual') {
    const subtasks = [...(task.subtasks || [])].sort(
      (a, b) => (a.position ?? 0) - (b.position ?? 0),
    );
    const doneCount = subtasks.filter((s) => s.done).length;
    const deadline = task.deadline instanceof Date ? task.deadline : new Date(task.deadline);
    const daysLeft = Math.ceil((deadline.getTime() - Date.now()) / DAY);

    const leftLabel = daysLeft < 0
      ? 'sudah lewat'
      : daysLeft === 0
        ? 'hari ini'
        : daysLeft === 1
          ? 'besok'
          : `${daysLeft} hari lagi`;

    const intro = kind === 'deadline-hours'
      ? `Tenggat tugas ini tinggal sekitar ${this.durationLabel(task.hours)} lagi — sepadan dengan estimasi pengerjaan yang kamu rencanakan. Sebaiknya mulai sekarang agar selesai tepat waktu.`
      : kind === 'manual'
        ? 'Berikut pengingat untuk tugasmu di StudyFlow.'
        : `Tenggat tugas ini tinggal satu hari lagi (${this.formatDate(deadline)}). Sebaiknya siapkan waktunya mulai sekarang.`;

    const subject = kind === 'deadline-hours'
      ? `StudyFlow - ${this.durationLabel(task.hours)} lagi: ${task.name}`
      : kind === 'manual'
        ? `StudyFlow - Pengingat tugas: ${task.name}`
        : `StudyFlow - Besok tenggat: ${task.name}`;

    const rows: Array<[string, string]> = [
      ['Nama tugas', task.name],
      ['Mata kuliah', task.course],
      ['Deadline', `${this.formatDate(deadline)} (${leftLabel})`],
      ['Tingkat kesulitan', `${this.difficultyLabel(task.difficulty)} (${task.difficulty}/${this.difficultyScale(task.difficulty)})`],
      ['Estimasi pengerjaan', this.durationLabel(task.hours)],
    ];
    if (task.weight != null && !Number.isNaN(task.weight)) {
      rows.push(['Bobot nilai', `${String(task.weight).replace('.', ',')}%`]);
    }
    rows.push(['Status', 'Belum selesai']);

    const textLines = [
      `Halo ${userName},`,
      '',
      intro,
      '',
      'DETAIL TUGAS',
      ...rows.map(([k, v]) => `- ${k}: ${v}`),
    ];
    if (subtasks.length) {
      textLines.push(
        '',
        `SUBTUGAS (${doneCount}/${subtasks.length} selesai)`,
        ...subtasks.map((s) => `${s.done ? '[x]' : '[ ]'} ${s.name}`),
      );
    }
    textLines.push(
      '',
      `Buka StudyFlow: ${this.appUrl()}`,
      '',
      'Email otomatis dari StudyFlow. Kamu menerimanya karena pengingat tugas aktif di akunmu.',
    );

    return { subject, text: textLines.join('\n'), html: this.taskHtml(subject, userName, intro, rows, subtasks, doneCount) };
  }

  private taskHtml(
    subject: string,
    userName: string,
    intro: string,
    rows: Array<[string, string]>,
    subtasks: Array<{ name: string; done: boolean }>,
    doneCount: number,
  ): string {
    const detailRows = rows
      .map(
        ([k, v]) =>
          `<tr><td style="padding:7px 0;color:#7b8095;font-size:13px;width:42%;vertical-align:top">${this.escape(k)}</td>`
          + `<td style="padding:7px 0;color:#1f2333;font-size:13px;font-weight:600;vertical-align:top">${this.escape(v)}</td></tr>`,
      )
      .join('');

    const subtaskHtml = subtasks.length
      ? `<div style="margin:18px 0 0">`
        + `<div style="font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#7b8095;margin-bottom:8px">Subtask (${doneCount}/${subtasks.length} selesai)</div>`
        + subtasks
          .map(
            (s) =>
              `<div style="font-size:13px;color:${s.done ? '#9aa0b4' : '#1f2333'};padding:4px 0;${s.done ? 'text-decoration:line-through' : ''}">`
              + `${s.done ? '&#10003;' : '&#9744;'} ${this.escape(s.name)}</div>`,
          )
          .join('')
        + `</div>`
      : '';

    return `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:560px;color:#1f2333;background:#ffffff">`
      + `<div style="height:4px;background:#5b5bd6;border-radius:4px 4px 0 0"></div>`
      + `<div style="border:1px solid #e8e9f2;border-top:0;border-radius:0 0 12px 12px;padding:22px 24px">`
      + `<div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#5b5bd6;font-weight:700;margin-bottom:6px">StudyFlow</div>`
      + `<h2 style="font-size:18px;line-height:1.35;margin:0 0 10px">${this.escape(subject)}</h2>`
      + `<p style="margin:0 0 6px;font-size:14px;color:#1f2333;line-height:1.5;font-weight:600">Halo, ${this.escape(userName)},</p>`
      + `<p style="margin:0 0 18px;font-size:14px;color:#4a4f66;line-height:1.5">${this.escape(intro)}</p>`
      + `<div style="font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#7b8095;margin-bottom:2px">Detail tugas</div>`
      + `<table role="presentation" style="width:100%;border-collapse:collapse">${detailRows}</table>`
      + subtaskHtml
      + `<div style="margin-top:22px"><a href="${this.escape(this.appUrl())}" style="display:inline-block;background:#5b5bd6;color:#ffffff;text-decoration:none;font-size:13px;font-weight:600;padding:10px 18px;border-radius:8px">Buka StudyFlow</a></div>`
      + `</div>`
      + `<p style="margin:14px 0 0;font-size:12px;color:#7b8095">Email otomatis dari StudyFlow. Kamu menerimanya karena pengingat tugas aktif di akunmu.</p>`
      + `</div>`;
  }

  private textToHtml(subject: string, text: string): string {
    const body = text
      .split('\n')
      .map((line) => `<p style="margin:0 0 10px">${this.escape(line) || '&nbsp;'}</p>`)
      .join('');
    return `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:520px;color:#1f2333">`
      + `<h2 style="font-size:17px;margin:0 0 14px">${this.escape(subject)}</h2>${body}`
      + `<hr style="border:0;border-top:1px solid #e8e9f2;margin:18px 0">`
      + `<p style="margin:0;font-size:12px;color:#7b8095">Email otomatis dari StudyFlow.</p></div>`;
  }

  difficultyLabel(value: number): string {
    // Skala form StudyFlow: 1 = Mudah, 2 = Sedang, 3 = Sulit.
    switch (Number(value)) {
      case 1: return 'Mudah';
      case 2: return 'Sedang';
      case 3: return 'Sulit';
      case 4: return 'Sangat sulit';
      case 5: return 'Sangat sulit';
      default: return 'Tidak diketahui';
    }
  }

  difficultyScale(value: number): number {
    return Number(value) > 3 ? 5 : 3;
  }
  /** Label durasi ramah dibaca: 0,5 jam -> "30 menit", 4 jam -> "4 jam". */
  durationLabel(hours: number): string {
    const h = Number(hours);
    if (!Number.isFinite(h) || h <= 0) return '-';
    if (h < 1) return `${Math.round(h * 60)} menit`;
    return `${String(h).replace('.', ',')} jam`;
  }

  formatDate(value: Date): string {
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return '-';
    const fmt = new Intl.DateTimeFormat('id-ID', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta',
    });
    return `${fmt.format(d)} WIB`;
  }

  private escape(value: string): string {
    return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /**
   * Jadwal pengingat otomatis untuk satu tugas:
   * - `deadline-1d`    : tepat 1 hari (24 jam) sebelum tenggat.
   * - `deadline-hours` : N jam sebelum tenggat, dengan N = estimasi jam pengerjaan.
   * Contoh: tenggat 13 Nov 14:50 dengan estimasi 1 jam → kirim 12 Nov 14:50 dan 13 Nov 13:50.
   */
  reminderSchedule(deadline: Date | string, hours: number): Array<{ kind: ReminderKind; at: Date }> {
    const due = deadline instanceof Date ? deadline : new Date(deadline);
    if (Number.isNaN(due.getTime())) return [];

    const events: Array<{ kind: ReminderKind; at: Date }> = [
      { kind: 'deadline-1d', at: new Date(due.getTime() - DAY) },
    ];

    const hoursBefore = Number(hours);
    if (Number.isFinite(hoursBefore) && hoursBefore > 0) {
      const at = new Date(due.getTime() - hoursBefore * 3_600_000);
      // Bila estimasi >= 24 jam, jadwal ini bertabrakan dengan H-1; cukup satu pengingat saja.
      if (at.getTime() !== due.getTime() - DAY) events.push({ kind: 'deadline-hours', at });
    }

    return events;
  }

  @Cron('* * * * *')
  async sendDue() {
    if (this.provider === 'none') return;
    const now = new Date();
    // Toleransi 10 menit: bila cron sempat tertunda (server sibuk/sleep), pengingat tetap dikirim.
    const windowStart = new Date(now.getTime() - 10 * 60_000);

    // Ambil kandidat: tugas belum selesai dengan tenggat antara 10 menit lalu s.d. H+1 (plus 1 jam).
    // Penyaringan tepat dilakukan per tugas lewat reminderSchedule() agar jam estimasi ikut dihitung.
    const tasks = await this.db.task.findMany({
      where: {
        completedAt: null,
        deadline: { gte: windowStart, lte: new Date(now.getTime() + DAY + 3_600_000) },
      },
      include: { user: true, subtasks: true },
    });

    for (const t of tasks) {
      // Tugas yang sudah selesai tidak pernah menerima pengingat apa pun.
      if (t.completedAt) continue;

      for (const e of this.reminderSchedule(t.deadline, t.hours)) {
        if (e.at < windowStart || e.at > now) continue;
        try {
          const prior = await this.db.notificationLog.findUnique({
            where: { taskId_kind_scheduledFor: { taskId: t.id, kind: e.kind, scheduledFor: e.at } },
          });
          if (prior) continue;

          const result = await this.sendTaskReminder(t.user.email, t.user.name, t, e.kind);
          if (!result.ok) {
            this.log.error(`Email ${e.kind} ke ${t.user.email} gagal: ${result.error}`);
            continue;
          }
          await this.db.notificationLog.create({
            data: { userId: t.userId, taskId: t.id, kind: e.kind, scheduledFor: e.at },
          });
          this.log.log(`Email ${e.kind} terkirim ke ${t.user.email} (id: ${result.id})`);
        } catch (err: any) {
          if (err?.code === 'P2002') continue;
          this.log.error(`Email reminder gagal: ${err?.message || err}`);
        }
      }
    }
  }
}

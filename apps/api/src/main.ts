import 'reflect-metadata';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser = require('cookie-parser');
import { AppModule } from './app.module';
async function bootstrap() {
 const app = await NestFactory.create(AppModule);
 app.setGlobalPrefix('api'); app.use(cookieParser());
 // Allowlist dinamis: origin dikonfigurasi + localhost/127.0.0.1/IP LAN pada port web apa pun.
 const extraOrigins = (process.env.WEB_ORIGIN || '').split(',').map(v => v.trim()).filter(Boolean);
 const isAllowedOrigin = (origin?: string) => {
  if (!origin) return true; // same-origin / non-browser (curl, health check)
  if (extraOrigins.includes(origin)) return true;
  try {
   const u = new URL(origin);
   if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
   return ['localhost', '127.0.0.1', '::1'].includes(u.hostname) || /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(u.hostname);
  } catch { return false; }
 };
 app.enableCors({
  origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => cb(null, isAllowedOrigin(origin)),
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
 });
 app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true, exceptionFactory: errors => new BadRequestException(errors.flatMap(error=>Object.entries(error.constraints||{}).map(([constraint])=>{const field=(({name:'Nama',email:'Email',password:'Kata sandi',course:'Mata kuliah',weight:'Bobot penilaian',difficulty:'Tingkat kesulitan',hours:'Estimasi waktu',deadline:'Tenggat',startAt:'Waktu mulai',subtasks:'Daftar subtugas',done:'Status'}) as Record<string,string>)[error.property]||`Kolom ${error.property}`;if(constraint==='whitelistValidation')return `${field} tidak diizinkan.`;if(constraint==='isEmail')return 'Format alamat email tidak valid.';if(constraint==='minLength')return `${field} belum memenuhi panjang minimum.`;if(constraint==='maxLength')return `${field} terlalu panjang.`;if(constraint==='isNotEmpty')return `${field} wajib diisi.`;if(constraint==='isString')return `${field} harus berupa teks.`;if(constraint==='isArray')return `${field} harus berupa daftar.`;if(constraint==='nestedValidation')return `${field} berisi data yang tidak valid.`;if(constraint==='isDateString')return `${field} harus berupa tanggal yang valid.`;if(constraint==='isNumber')return `${field} harus berupa angka.`;if(constraint==='min')return `${field} berada di bawah batas minimum.`;if(constraint==='max')return `${field} melebihi batas maksimum.`;if(constraint==='isBoolean')return `${field} harus bernilai benar atau salah.`;return `${field} tidak valid.`;})))}));
 await app.listen(Number(process.env.PORT || 4000), '0.0.0.0');
}
bootstrap();

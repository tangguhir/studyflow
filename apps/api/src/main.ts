import 'reflect-metadata';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser = require('cookie-parser');
import { AppModule } from './app.module';
async function bootstrap() {
 const app = await NestFactory.create(AppModule);
 app.setGlobalPrefix('api'); app.use(cookieParser());
 app.enableCors({ origin: process.env.WEB_ORIGIN || 'http://localhost:3000', credentials: true });
 app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true, exceptionFactory: errors => new BadRequestException(errors.flatMap(error=>Object.entries(error.constraints||{}).map(([constraint])=>{const field=(({name:'Nama',email:'Email',password:'Kata sandi',course:'Mata kuliah',weight:'Bobot penilaian',difficulty:'Tingkat kesulitan',hours:'Estimasi waktu',deadline:'Tenggat',startAt:'Waktu mulai',subtasks:'Daftar subtugas',done:'Status'}) as Record<string,string>)[error.property]||`Kolom ${error.property}`;if(constraint==='whitelistValidation')return `${field} tidak diizinkan.`;if(constraint==='isEmail')return 'Format alamat email tidak valid.';if(constraint==='minLength')return `${field} belum memenuhi panjang minimum.`;if(constraint==='isDateString')return `${field} harus berupa tanggal yang valid.`;if(constraint==='isNumber')return `${field} harus berupa angka.`;if(constraint==='min')return `${field} berada di bawah batas minimum.`;if(constraint==='max')return `${field} melebihi batas maksimum.`;if(constraint==='isBoolean')return `${field} harus bernilai benar atau salah.`;return `${field} tidak valid.`;})))}));
 await app.listen(Number(process.env.PORT || 4000), '0.0.0.0');
}
bootstrap();

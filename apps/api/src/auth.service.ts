import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt'; import * as bcrypt from 'bcryptjs'; import { PrismaService } from './prisma.service';
@Injectable() export class AuthService { constructor(private db:PrismaService,private jwt:JwtService){}
 async register(d:{email:string;password:string;name:string}){const email=d.email.toLowerCase().trim();if(await this.db.user.findUnique({where:{email}}))throw new ConflictException('Email sudah terdaftar');const user=await this.db.user.create({data:{email,name:d.name.trim(),passwordHash:await bcrypt.hash(d.password,12)}});return {user:{id:user.id,email:user.email,name:user.name},token:this.jwt.sign({sub:user.id,email:user.email})};}
 async login(d:{email:string;password:string}){const user=await this.db.user.findUnique({where:{email:d.email.toLowerCase().trim()}});if(!user||!(await bcrypt.compare(d.password,user.passwordHash)))throw new UnauthorizedException('Email atau kata sandi salah');return {user:{id:user.id,email:user.email,name:user.name},token:this.jwt.sign({sub:user.id,email:user.email})};}
 async profile(id:string){const user=await this.db.user.findUnique({where:{id},select:{id:true,email:true,name:true}});if(!user)throw new UnauthorizedException('Sesi tidak valid atau telah berakhir. Silakan masuk kembali.');return user;}
}

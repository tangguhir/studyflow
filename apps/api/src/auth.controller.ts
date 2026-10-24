import { Body, Controller, HttpCode, HttpStatus, Post, Res, Req, UseGuards, Get } from '@nestjs/common';
import { IsEmail, IsString, IsOptional, MinLength } from 'class-validator';
import { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
export class CredentialsDto { @IsEmail() email: string; @IsString() @MinLength(8) password: string; }
export class RegisterDto extends CredentialsDto { @IsString() @MinLength(2) name: string; }
export class LoginDto extends CredentialsDto { @IsOptional() @IsString() name?: string; }
@Controller('auth') export class AuthController {
 constructor(private auth: AuthService) {}
 @Post('register') async register(@Body() dto:RegisterDto,@Req() req:Request,@Res({passthrough:true}) res:Response){const result=await this.auth.register(dto);this.setCookie(req,res,result.token);return result.user;}
 @Post('login') @HttpCode(HttpStatus.OK) async login(@Body() dto:LoginDto,@Req() req:Request,@Res({passthrough:true}) res:Response){const result=await this.auth.login(dto);this.setCookie(req,res,result.token);return result.user;}
 @Post('logout') @HttpCode(HttpStatus.OK) logout(@Req() req:Request,@Res({passthrough:true}) res:Response){res.clearCookie('sf_token',{...this.baseOptions(req),maxAge:undefined});return {ok:true};}
 @UseGuards(AuthGuard) @Get('me') me(@Req() req:Request){return this.auth.profile(req['user'].id);}
 /**
  * Flag Secure hanya dipasang bila request benar-benar lewat HTTPS.
  * Sebelumnya mengikuti NODE_ENV, sehingga saat aplikasi dibuka lewat
  * http://localhost, http://127.0.0.1, atau http://<IP-LAN> browser membuang
  * cookie sesi dan pengguna terlempar keluar ("sambungan terputus").
  */
 private isHttps(req:Request){const proto=(req.headers['x-forwarded-proto'] as string|undefined)?.split(',')[0]?.trim();return proto?proto==='https':req.secure;}
 private baseOptions(req:Request){return {httpOnly:true,sameSite:'lax' as const,secure:this.isHttps(req),path:'/'};}
 private setCookie(req:Request,res:Response,token:string){res.cookie('sf_token',token,{...this.baseOptions(req),maxAge:7*24*60*60*1000});}
}

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
 @Post('register') async register(@Body() dto:RegisterDto,@Res({passthrough:true}) res:Response){const result=await this.auth.register(dto);this.setCookie(res,result.token);return result.user;}
 @Post('login') @HttpCode(HttpStatus.OK) async login(@Body() dto:LoginDto,@Res({passthrough:true}) res:Response){const result=await this.auth.login(dto);this.setCookie(res,result.token);return result.user;}
 @Post('logout') @HttpCode(HttpStatus.OK) logout(@Res({passthrough:true}) res:Response){res.clearCookie('sf_token',{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/'});return {ok:true};}
 @UseGuards(AuthGuard) @Get('me') me(@Req() req:Request){return this.auth.profile(req['user'].id);}
 private setCookie(res:Response,token:string){res.cookie('sf_token',token,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:7*24*60*60*1000});}
}

import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { IsArray, IsBoolean, IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { Request } from 'express';
import { TasksService } from './tasks.service';
import { AuthGuard } from './auth.guard';
class SubtaskDto { @IsString() @IsNotEmpty() @MaxLength(200) name: string; }
class SubtaskUpdateDto { @IsOptional() @IsString() @IsNotEmpty() @MaxLength(200) name?: string; @IsOptional() @IsBoolean() done?: boolean; }
class SubtaskReorderDto { @IsArray() @IsString({ each: true }) ids: string[]; }
class CompleteDto { @IsBoolean() done: boolean; }
class ReminderToggleDto { @IsBoolean() enabled: boolean; }
class CreateTaskDto { @IsString() @IsNotEmpty() @MaxLength(255) name: string; @IsString() @IsNotEmpty() @MaxLength(255) course: string; @IsNumber() @Min(1) @Max(100) weight: number; @IsNumber() @Min(1) @Max(5) difficulty: number; @IsNumber() @Min(0.5) @Max(1000) hours: number; @IsDateString() deadline: string; @IsOptional() @IsDateString() startAt?: string | null; @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => SubtaskDto) subtasks?: SubtaskDto[]; @IsOptional() @IsBoolean() emailReminder?: boolean; }
class UpdateTaskDto { @IsOptional() @IsString() @IsNotEmpty() @MaxLength(255) name?: string; @IsOptional() @IsString() @IsNotEmpty() @MaxLength(255) course?: string; @IsOptional() @IsNumber() @Min(1) @Max(100) weight?: number; @IsOptional() @IsNumber() @Min(1) @Max(5) difficulty?: number; @IsOptional() @IsNumber() @Min(0.5) @Max(1000) hours?: number; @IsOptional() @IsDateString() deadline?: string; @IsOptional() @IsDateString() startAt?: string | null; @IsOptional() @IsBoolean() emailReminder?: boolean; }
@Controller('tasks') @UseGuards(AuthGuard) export class TasksController {
  constructor(private service: TasksService) {}
  @Get() list(@Req() r: Request) { return this.service.list(r['user'].id); }
  @Post() create(@Req() r: Request, @Body() d: CreateTaskDto) { return this.service.create(r['user'].id, d); }
  @Patch(':id') update(@Req() r: Request, @Param('id') id: string, @Body() d: UpdateTaskDto) { return this.service.update(r['user'].id, id, d); }
  @Patch(':id/complete') complete(@Req() r: Request, @Param('id') id: string, @Body() d: CompleteDto) { return this.service.complete(r['user'].id, id, d.done); }
  @Patch(':id/reminder') reminder(@Req() r: Request, @Param('id') id: string, @Body() d: ReminderToggleDto) { return this.service.setEmailReminder(r['user'].id, id, d.enabled); }
  @Post(':id/subtasks') addSubtask(@Req() r: Request, @Param('id') id: string, @Body() d: SubtaskDto) { return this.service.addSubtask(r['user'].id, id, d.name); }
  @Patch(':id/subtasks/reorder') reorderSubtasks(@Req() r: Request, @Param('id') id: string, @Body() d: SubtaskReorderDto) { return this.service.reorderSubtasks(r['user'].id, id, d.ids); }
  @Patch(':id/subtasks/:sid') updateSubtask(@Req() r: Request, @Param('id') id: string, @Param('sid') sid: string, @Body() d: SubtaskUpdateDto) { return this.service.updateSubtask(r['user'].id, id, sid, d); }
  @Delete(':id/subtasks/:sid') removeSubtask(@Req() r: Request, @Param('id') id: string, @Param('sid') sid: string) { return this.service.removeSubtask(r['user'].id, id, sid); }
  @Delete(':id') remove(@Req() r: Request, @Param('id') id: string) { return this.service.remove(r['user'].id, id); }
}

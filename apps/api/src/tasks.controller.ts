import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { IsArray, IsBoolean, IsDateString, IsNumber, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { Request } from 'express';
import { TasksService } from './tasks.service';
import { AuthGuard } from './auth.guard';
class SubtaskDto { @IsString() name: string; }
class SubtaskUpdateDto { @IsOptional() @IsString() name?: string; @IsOptional() @IsBoolean() done?: boolean; }
class SubtaskReorderDto { @IsArray() @IsString({ each: true }) ids: string[]; }
class CreateTaskDto { @IsString() name: string; @IsString() course: string; @IsNumber() @Min(1) @Max(100) weight: number; @IsNumber() @Min(1) @Max(3) difficulty: number; @IsNumber() @Min(0.5) hours: number; @IsDateString() deadline: string; @IsOptional() @IsDateString() startAt?: string; @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => SubtaskDto) subtasks?: SubtaskDto[]; }
@Controller('tasks') @UseGuards(AuthGuard) export class TasksController {
  constructor(private service: TasksService) {}
  @Get() list(@Req() r: Request) { return this.service.list(r['user'].id); }
  @Post() create(@Req() r: Request, @Body() d: CreateTaskDto) { return this.service.create(r['user'].id, d); }
  @Patch(':id') update(@Req() r: Request, @Param('id') id: string, @Body() d: Partial<CreateTaskDto>) { return this.service.update(r['user'].id, id, d); }
  @Patch(':id/complete') complete(@Req() r: Request, @Param('id') id: string, @Body() d: { done: boolean }) { return this.service.complete(r['user'].id, id, d.done); }
  @Post(':id/subtasks') addSubtask(@Req() r: Request, @Param('id') id: string, @Body() d: SubtaskDto) { return this.service.addSubtask(r['user'].id, id, d.name); }
  @Patch(':id/subtasks/reorder') reorderSubtasks(@Req() r: Request, @Param('id') id: string, @Body() d: SubtaskReorderDto) { return this.service.reorderSubtasks(r['user'].id, id, d.ids); }
  @Patch(':id/subtasks/:sid') updateSubtask(@Req() r: Request, @Param('id') id: string, @Param('sid') sid: string, @Body() d: SubtaskUpdateDto) { return this.service.updateSubtask(r['user'].id, id, sid, d); }
  @Delete(':id/subtasks/:sid') removeSubtask(@Req() r: Request, @Param('id') id: string, @Param('sid') sid: string) { return this.service.removeSubtask(r['user'].id, id, sid); }
  @Delete(':id') remove(@Req() r: Request, @Param('id') id: string) { return this.service.remove(r['user'].id, id); }
}

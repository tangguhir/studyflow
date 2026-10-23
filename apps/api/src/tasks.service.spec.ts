import { BadRequestException } from '@nestjs/common';
import { TasksService } from './tasks.service';

describe('TasksService completion rules', () => {
  const task = {
    id: 'task-1',
    userId: 'user-1',
    completedAt: null as Date | null,
    subtasks: [
      { id: 'sub-1', taskId: 'task-1', done: true },
      { id: 'sub-2', taskId: 'task-1', done: false },
    ],
  };
  let db: any;
  let service: TasksService;

  beforeEach(() => {
    db = {
      task: {
        findFirst: jest.fn().mockResolvedValue(task),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...task, ...data })),
      },
      subtask: {
        findFirst: jest.fn().mockResolvedValue(task.subtasks[1]),
        update: jest.fn().mockResolvedValue({ id: 'sub-2', done: true }),
        findMany: jest.fn().mockResolvedValue([{ done: true }, { done: true }]),
        aggregate: jest.fn().mockResolvedValue({ _max: { position: 1 } }),
        create: jest.fn(),
        delete: jest.fn().mockResolvedValue({ id: 'sub-2' }),
      },
    };
    service = new TasksService(db);
  });

  it('blocks manually completing a task while any subtask is unchecked', async () => {
    await expect(service.complete('user-1', 'task-1', true)).rejects.toBeInstanceOf(BadRequestException);
    expect(db.task.update).not.toHaveBeenCalled();
  });

  it('does not automatically complete the parent when the last subtask is checked', async () => {
    await service.toggleSubtask('user-1', 'task-1', 'sub-2', true);
    expect(db.task.update).not.toHaveBeenCalled();
  });

  it('reopens the parent when a completed subtask is unchecked', async () => {
    db.task.findFirst.mockResolvedValue({ ...task, completedAt: new Date() });
    db.subtask.findFirst.mockResolvedValue({ id: 'sub-1', taskId: 'task-1', done: true });
    db.subtask.update.mockResolvedValue({ id: 'sub-1', done: false });
    db.subtask.findMany.mockResolvedValue([{ done: false }, { done: true }]);
    await service.toggleSubtask('user-1', 'task-1', 'sub-1', false);
    expect(db.task.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'task-1' }, data: { completedAt: null },
    }));
  });

  it('deletes a subtask belonging to the selected task', async () => {
    await service.removeSubtask('user-1', 'task-1', 'sub-2');
    expect(db.subtask.delete).toHaveBeenCalledWith({ where: { id: 'sub-2' } });
  });

  it('persists a user-requested subtask order by position', async () => {
    db.subtask.findMany.mockResolvedValue([{ id: 'sub-1' }, { id: 'sub-2' }]);
    db.subtask.update.mockResolvedValue({});
    db.$transaction = jest.fn((operations) => Promise.all(operations));

    await service.reorderSubtasks('user-1', 'task-1', ['sub-2', 'sub-1']);

    expect(db.subtask.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'sub-2' }, data: { position: 0 },
    });
    expect(db.subtask.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'sub-1' }, data: { position: 1 },
    });
  });

  it('rejects reorders that include an id outside the task', async () => {
    db.subtask.findMany.mockResolvedValue([{ id: 'sub-1' }, { id: 'sub-2' }]);
    db.$transaction = jest.fn((operations) => Promise.all(operations));

    await expect(service.reorderSubtasks('user-1', 'task-1', ['sub-1', 'not-in-task']))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(db.subtask.update).not.toHaveBeenCalled();
  });

  it('does not complete the parent when a subtask is edited as done', async () => {
    db.subtask.findFirst.mockResolvedValue({ id: 'sub-2', taskId: 'task-1', done: false });
    db.subtask.update.mockResolvedValue({ id: 'sub-2', done: true });

    await service.updateSubtask('user-1', 'task-1', 'sub-2', { done: true });

    expect(db.task.update).not.toHaveBeenCalled();
  });
});

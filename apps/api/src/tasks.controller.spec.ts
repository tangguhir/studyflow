import { TasksController } from './tasks.controller';

describe('TasksController subtask routes', () => {
  it('routes subtask edit requests to the edit service without completing the parent', async () => {
    const service = {
      updateSubtask: jest.fn().mockResolvedValue({ id: 'sub-1', name: 'Edited', done: true }),
      complete: jest.fn(),
    };
    const controller = new TasksController(service as any);

    await controller.updateSubtask({ user: { id: 'user-1' } } as any, 'task-1', 'sub-1', {
      name: 'Edited',
      done: true,
    });

    expect(service.updateSubtask).toHaveBeenCalledWith('user-1', 'task-1', 'sub-1', {
      name: 'Edited',
      done: true,
    });
    expect(service.complete).not.toHaveBeenCalled();
  });

  it('routes drag reorder requests to the service', async () => {
    const service = { reorderSubtasks: jest.fn().mockResolvedValue([{ id: 'sub-2' }, { id: 'sub-1' }]) };
    const controller = new TasksController(service as any);

    await controller.reorderSubtasks({ user: { id: 'user-1' } } as any, 'task-1', {
      ids: ['sub-2', 'sub-1'],
    });

    expect(service.reorderSubtasks).toHaveBeenCalledWith('user-1', 'task-1', ['sub-2', 'sub-1']);
  });

  it('routes subtask deletion to the subtask delete service', async () => {
    const service = { removeSubtask: jest.fn().mockResolvedValue({ ok: true }) };
    const controller = new TasksController(service as any);

    await controller.removeSubtask({ user: { id: 'user-1' } } as any, 'task-1', 'sub-1');

    expect(service.removeSubtask).toHaveBeenCalledWith('user-1', 'task-1', 'sub-1');
  });
});

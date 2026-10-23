import { compareTasksByPriority, filterTasksBySearch, sortTasksByPriority, type PrioritizableTask } from '../../../src/app/task-priority';

const due = '2026-12-15T12:00:00.000Z';
function task(overrides: Partial<PrioritizableTask> = {}): PrioritizableTask {
  return { id: 't', name: 'Tugas', course: 'Mata Kuliah', deadline: due, weight: 50, difficulty: 2, hours: 2, completedAt: null, ...overrides };
}

describe('task priority', () => {
  it('prioritizes an earlier deadline over shorter work and lower difficulty', () => {
    const soon = task({ id: 'soon', deadline: '2026-10-31T12:00:00.000Z', hours: 0.5, difficulty: 1 });
    const later = task({ id: 'later', deadline: '2026-11-01T12:00:00.000Z', hours: 12, difficulty: 3 });
    expect(compareTasksByPriority(soon, later)).toBeLessThan(0);
  });

  it('prioritizes shorter estimates when deadlines are identical', () => {
    const short = task({ id: 'short', hours: 0.5, difficulty: 3 });
    const long = task({ id: 'long', hours: 12, difficulty: 1 });
    expect(compareTasksByPriority(short, long)).toBeLessThan(0);
  });

  it('prioritizes easier tasks when deadline and estimate are identical', () => {
    const easy = task({ id: 'easy', difficulty: 1 });
    const hard = task({ id: 'hard', difficulty: 3 });
    expect(compareTasksByPriority(easy, hard)).toBeLessThan(0);
  });

  it('orders the list by deadline, then short estimate, then low difficulty', () => {
    const ordered = sortTasksByPriority([
      task({ id: 'hard', difficulty: 3 }),
      task({ id: 'long', hours: 8, difficulty: 1 }),
      task({ id: 'later', deadline: '2026-12-16T12:00:00.000Z', hours: 0.5, difficulty: 1 }),
      task({ id: 'easy', difficulty: 1 }),
      task({ id: 'completed', completedAt: '2026-10-01T12:00:00.000Z' }),
    ]);
    expect(ordered.map((item) => item.id)).toEqual(['easy', 'hard', 'long', 'later', 'completed']);
  });

  it('keeps completed tasks below all active tasks', () => {
    const active = task({ id: 'active' });
    const completed = task({ id: 'completed', completedAt: '2026-12-01T12:00:00.000Z' });
    expect(sortTasksByPriority([completed, active]).map((item) => item.id)).toEqual(['active', 'completed']);
  });

  it('finds tasks by case-insensitive name or course', () => {
    const tasks = [
      { ...task(), id: 'name-match', name: 'Makalah Ekonomi', course: 'Dasar Manajemen' },
      { ...task(), id: 'course-match', name: 'Ujian Akhir', course: 'Ekonomi Makro' },
      { ...task(), id: 'no-match', name: 'Praktikum', course: 'Kimia' },
    ];
    expect(filterTasksBySearch(tasks, 'ekonomi').map((item) => item.id)).toEqual(['name-match', 'course-match']);
  });

  it('does not use weight to override the stated priority criteria', () => {
    const lowWeight = task({ id: 'a', weight: 1 });
    const highWeight = task({ id: 'z', weight: 100 });
    expect(compareTasksByPriority(lowWeight, highWeight)).toBeLessThan(0);
  });
});

export type PrioritizableTask = {
  id: string;
  name: string;
  course: string;
  deadline: string;
  weight: number;
  difficulty: number;
  hours: number;
  completedAt?: string | Date | null;
};

export function compareTasksByPriority(a: PrioritizableTask, b: PrioritizableTask): number {
  const aCompleted = Boolean(a.completedAt);
  const bCompleted = Boolean(b.completedAt);
  if (aCompleted !== bCompleted) return aCompleted ? 1 : -1;

  const parsedADeadline = new Date(a.deadline).getTime();
  const parsedBDeadline = new Date(b.deadline).getTime();
  const aDeadline = Number.isFinite(parsedADeadline) ? parsedADeadline : Number.POSITIVE_INFINITY;
  const bDeadline = Number.isFinite(parsedBDeadline) ? parsedBDeadline : Number.POSITIVE_INFINITY;
  if (aDeadline < bDeadline) return -1;
  if (aDeadline > bDeadline) return 1;

  if (a.hours < b.hours) return -1;
  if (a.hours > b.hours) return 1;
  if (a.difficulty < b.difficulty) return -1;
  if (a.difficulty > b.difficulty) return 1;

  return a.id.localeCompare(b.id);
}

export function filterTasksBySearch<T extends { name: string; course: string }>(tasks: T[], query: string): T[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return tasks;
  return tasks.filter((task) => `${task.name} ${task.course}`.toLocaleLowerCase().includes(normalized));
}

export function sortTasksByPriority<T extends PrioritizableTask>(tasks: T[]): T[] {
  return [...tasks].sort(compareTasksByPriority);
}

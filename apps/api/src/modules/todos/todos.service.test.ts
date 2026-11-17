import { describe, expect, it } from 'vitest';
import { InMemoryTodosRepository } from './todos.repository.memory';
import { TodosService } from './todos.service';

describe('TodosService', () => {
  const repo = new InMemoryTodosRepository();
  const service = new TodosService(repo);
  const employeeA = 'emp-001';
  const employeeB = 'emp-002';

  it('creates, lists and toggles personal to-dos for an employee with pagination', async () => {
    repo.clear();

    const todo1 = await service.create(employeeA, {
      title: 'Submit weekly report',
      description: 'Prepare metrics for Q4 sprint',
      dueDate: '2026-11-10',
    });

    expect(todo1.id).toBeDefined();
    expect(todo1.title).toBe('Submit weekly report');
    expect(todo1.isCompleted).toBe(false);
    expect(todo1.dueDate).toBe('2026-11-10');

    // Employee B should not see Employee A's to-dos
    const resB = await service.list(employeeB);
    expect(resB.data).toHaveLength(0);
    expect(resB.meta.total).toBe(0);

    // Employee A lists to-dos
    const resA = await service.list(employeeA);
    expect(resA.data).toHaveLength(1);
    expect(resA.data[0]?.id).toBe(todo1.id);
    expect(resA.meta.total).toBe(1);
    expect(resA.meta.hasMore).toBe(false);

    // Toggle completion
    const toggled = await service.toggle(todo1.id, employeeA);
    expect(toggled.isCompleted).toBe(true);
    expect(toggled.completedAt).toBeDefined();

    // Toggle back
    const toggledBack = await service.toggle(todo1.id, employeeA);
    expect(toggledBack.isCompleted).toBe(false);
    expect(toggledBack.completedAt).toBeNull();

    // Update
    const updated = await service.update(todo1.id, employeeA, {
      title: 'Submit updated weekly report',
    });
    expect(updated.title).toBe('Submit updated weekly report');

    // Delete
    await service.delete(todo1.id, employeeA);
    const afterDelete = await service.list(employeeA);
    expect(afterDelete.data).toHaveLength(0);
    expect(afterDelete.meta.total).toBe(0);
  });

  it('paginates to-dos with limit and offset', async () => {
    repo.clear();
    for (let i = 1; i <= 5; i++) {
      await service.create(employeeA, { title: `Task ${i}` });
    }

    const page1 = await service.list(employeeA, { limit: 2, offset: 0 });
    expect(page1.data).toHaveLength(2);
    expect(page1.meta.total).toBe(5);
    expect(page1.meta.limit).toBe(2);
    expect(page1.meta.offset).toBe(0);
    expect(page1.meta.hasMore).toBe(true);

    const page2 = await service.list(employeeA, { limit: 2, offset: 2 });
    expect(page2.data).toHaveLength(2);
    expect(page2.meta.hasMore).toBe(true);

    const page3 = await service.list(employeeA, { limit: 2, offset: 4 });
    expect(page3.data).toHaveLength(1);
    expect(page3.meta.hasMore).toBe(false);
  });

  it('rejects accessing or mutating another employee to-do', async () => {
    repo.clear();
    const todo = await service.create(employeeA, { title: 'Private task' });

    await expect(service.get(todo.id, employeeB)).rejects.toThrow('To-do item not found');
    await expect(service.update(todo.id, employeeB, { title: 'Hacked' })).rejects.toThrow(
      'To-do item not found',
    );
    await expect(service.toggle(todo.id, employeeB)).rejects.toThrow('To-do item not found');
    await expect(service.delete(todo.id, employeeB)).rejects.toThrow('To-do item not found');
  });
});

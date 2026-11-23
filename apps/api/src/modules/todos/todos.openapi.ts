import { z } from 'zod';
import { registerRoute } from '../../openapi/registry';
import {
  createTodoSchema,
  listTodosQuerySchema,
  todoIdParamsSchema,
  updateTodoSchema,
} from './todos.schemas';

const tags = ['Todos'];

const todoSchema = z
  .object({
    id: z.string().uuid(),
    employeeId: z.string().uuid(),
    title: z.string(),
    description: z.string().nullable(),
    dueDate: z.string().nullable(),
    isCompleted: z.boolean(),
    completedAt: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .meta({ id: 'PersonalTodo' });

const one = z.object({ data: todoSchema });
const notYours = { 404: 'No such to-do item among your own' };

registerRoute({
  method: 'get',
  path: '/todos',
  tags,
  summary: 'Your own to-do items',
  permission: 'todos.manage',
  query: listTodosQuerySchema,
  success: {
    status: 200,
    description: 'Your to-do items, newest first, with offset pagination',
    schema: z.object({
      data: z.array(todoSchema),
      meta: z.object({
        total: z.number(),
        limit: z.number(),
        offset: z.number(),
        hasMore: z.boolean(),
      }),
    }),
  },
});

registerRoute({
  method: 'post',
  path: '/todos',
  tags,
  summary: 'Add a to-do item for yourself',
  permission: 'todos.manage',
  body: createTodoSchema,
  success: { status: 201, description: 'The new to-do item', schema: one },
});

registerRoute({
  method: 'get',
  path: '/todos/{id}',
  tags,
  summary: 'One of your own to-do items',
  permission: 'todos.manage',
  params: todoIdParamsSchema,
  extraResponses: notYours,
  success: { status: 200, description: 'The to-do item', schema: one },
});

registerRoute({
  method: 'patch',
  path: '/todos/{id}',
  tags,
  summary: 'Change one of your own to-do items',
  permission: 'todos.manage',
  params: todoIdParamsSchema,
  body: updateTodoSchema,
  extraResponses: notYours,
  success: { status: 200, description: 'The to-do item after the change', schema: one },
});

registerRoute({
  method: 'post',
  path: '/todos/{id}/toggle',
  tags,
  summary: 'Mark one of your own to-do items done, or open again',
  permission: 'todos.manage',
  params: todoIdParamsSchema,
  extraResponses: notYours,
  success: { status: 200, description: 'The to-do item after the change', schema: one },
});

registerRoute({
  method: 'delete',
  path: '/todos/{id}',
  tags,
  summary: 'Delete one of your own to-do items',
  permission: 'todos.manage',
  params: todoIdParamsSchema,
  extraResponses: notYours,
  success: { status: 204, description: 'Deleted' },
});

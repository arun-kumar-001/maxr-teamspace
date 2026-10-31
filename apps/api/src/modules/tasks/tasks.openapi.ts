import { z } from 'zod';
import { registerRoute } from '../../openapi/registry';
import {
  changeStatusSchema,
  createTaskSchema,
  listMyTasksQuerySchema,
  listTeamTasksQuerySchema,
  taskIdParamsSchema,
  taskSchema,
  updateTaskSchema,
} from './tasks.schemas';

const tags = ['Tasks'];
const one = z.object({ data: taskSchema });
const page = z.object({
  data: z.array(taskSchema),
  meta: z.object({
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
    totalPages: z.number().int(),
  }),
});
const notParty = { 404: 'You are not party to this task, and do not manage its assignee' };

registerRoute({
  method: 'post',
  path: '/tasks',
  tags,
  summary:
    'Create and assign a task (Team Lead, Admin). A Team Lead assigns to themselves or their direct reports; an Admin to any active employee. With a project, the assignee must be one of its members',
  permission: 'tasks.create',
  idempotent: true,
  body: createTaskSchema,
  extraResponses: {
    403: 'The assignee is outside your team',
    422: 'The assignee is not active, the due date is in the past, or the project is unusable (unknown, archived, you are not in it, or the assignee is not a member)',
  },
  success: { status: 201, description: 'The new task, `todo`', schema: one },
});

registerRoute({
  method: 'get',
  path: '/tasks/me',
  tags,
  summary:
    'Tasks assigned to you: open work first, soonest due first, then by priority. `overdue=true` lists the ones past their due date',
  permission: 'tasks.read_own',
  query: listMyTasksQuerySchema,
  success: { status: 200, description: 'A page of your tasks', schema: page },
});

registerRoute({
  method: 'get',
  path: '/tasks',
  tags,
  summary:
    'The team board: tasks you assigned and tasks assigned to your direct reports (Team Lead); every task (Admin)',
  permission: 'tasks.read_team',
  query: listTeamTasksQuerySchema,
  success: { status: 200, description: 'A page of tasks', schema: page },
});

registerRoute({
  method: 'get',
  path: '/tasks/{id}',
  tags,
  summary:
    'One task: yours, one you assigned, one assigned to a direct report, or any task for an Admin',
  permission: 'tasks.read_own',
  params: taskIdParamsSchema,
  extraResponses: notParty,
  success: { status: 200, description: 'The task', schema: one },
});

registerRoute({
  method: 'put',
  path: '/tasks/{id}',
  tags,
  summary:
    'Edit a task that is not completed (the person who assigned it, or an Admin). Send the `version` you read. Giving it to someone else restarts it as `todo`',
  permission: 'tasks.create',
  params: taskIdParamsSchema,
  body: updateTaskSchema,
  extraResponses: {
    ...notParty,
    403: 'You did not assign this task, or the new assignee is outside your team',
    409: 'Someone changed it since you read it',
    422: 'The task is completed, or the due date, assignee or project is unusable',
  },
  success: { status: 200, description: 'The task after the change', schema: one },
});

registerRoute({
  method: 'post',
  path: '/tasks/{id}/status',
  tags,
  summary:
    'Move a task along todo, in_progress, in_review, completed (and blocked). The assignee moves it as far as in_review; only the person who assigned it, or an Admin, completes or reopens it. Repeating the status it already has is a 200',
  permission: 'tasks.update_status',
  params: taskIdParamsSchema,
  body: changeStatusSchema,
  extraResponses: {
    ...notParty,
    403: 'You may not make this move on this task',
    422: 'That move is not in the transition table',
  },
  success: { status: 200, description: 'The task after the move', schema: one },
});

import { z } from 'zod';
import { registerRoute } from '../openapi/registry';

const dependency = z.object({
  status: z.enum(['up', 'down']),
  latencyMs: z.number(),
});

registerRoute({
  method: 'get',
  path: '/health',
  tags: ['Health'],
  summary: 'Liveness and dependency check (database and Redis); used by the load balancer',
  access: 'Public',
  success: {
    status: 200,
    description: 'The service and its dependencies are up',
    schema: z.object({
      status: z.string(),
      service: z.string(),
      version: z.string(),
      environment: z.string(),
      uptimeSeconds: z.number(),
      timestamp: z.string(),
      dependencies: z.object({ database: dependency, redis: dependency }),
    }),
  },
  extraResponses: { 503: 'The database is down' },
});

import { Router } from 'express';
import { TemplateRepository } from './template.repository';
import { TemplateService } from './template.service';
import { TemplateController } from './template.controller';

/**
 * Creates and registers routes for the template module.
 * Path prefix: /api/v1/templates
 */
export function createTemplateRouter(): Router {
  const router = Router();

  const repository = new TemplateRepository();
  const service = new TemplateService(repository);
  const controller = new TemplateController(service);

  router.get('/', controller.list);
  router.post('/', controller.create);
  router.get('/:id', controller.getById);
  router.put('/:id', controller.update);
  router.post('/:id/deactivate', controller.deactivate);

  return router;
}

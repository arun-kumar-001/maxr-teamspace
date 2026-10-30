import { generateDocument } from './registry';
// Each module registers its routes by being imported here.
import '../modules/_template/template.openapi';
import '../modules/auth/auth.openapi';
import '../modules/reports/report.openapi';
import '../modules/settings/settings.openapi';
import '../modules/employees/departments/department.openapi';
import '../modules/employees/designations/designation.openapi';
import '../platform/storage/files.openapi';

export function buildOpenApiDocument() {
  return generateDocument();
}

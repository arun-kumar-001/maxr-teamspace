import { generateDocument } from './registry';
// Each module registers its routes by being imported here.
import '../modules/_template/template.openapi';
import '../modules/audit-logs/audit-log.openapi';
import '../modules/auth/auth.openapi';
import '../modules/reports/report.openapi';
import '../modules/approvals/approvals.openapi';
import '../modules/employees/creation/creation.openapi';
import '../modules/employees/deactivation/deactivation.openapi';
import '../modules/employees/hierarchy/hierarchy.openapi';
import '../modules/employees/detail/detail.openapi';
import '../modules/settings/settings.openapi';
import '../modules/users/users.openapi';
import '../modules/employees/departments/department.openapi';
import '../modules/employees/designations/designation.openapi';
import '../modules/employees/directory/directory.openapi';
import '../platform/storage/files.openapi';

export function buildOpenApiDocument() {
  return generateDocument();
}

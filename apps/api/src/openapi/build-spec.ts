import { generateDocument } from './registry';
// Each module registers its routes by being imported here.
import '../modules/_template/template.openapi';
import '../platform/storage/files.openapi';

export function buildOpenApiDocument() {
  return generateDocument();
}

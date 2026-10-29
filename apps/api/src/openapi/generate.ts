import fs from 'fs';
import path from 'path';
import { buildOpenApiDocument } from './build-spec';

/** Writes docs/architecture/openapi.json. Run with `npm run openapi:generate`. */
export const OPENAPI_OUTPUT = path.resolve(__dirname, '../../../../docs/architecture/openapi.json');

export function renderOpenApiJson(): string {
  return `${JSON.stringify(buildOpenApiDocument(), null, 2)}\n`;
}

if (require.main === module) {
  fs.writeFileSync(OPENAPI_OUTPUT, renderOpenApiJson());
  // eslint-disable-next-line no-console
  console.info(`[OpenAPI] Wrote ${path.relative(process.cwd(), OPENAPI_OUTPUT)}`);
}

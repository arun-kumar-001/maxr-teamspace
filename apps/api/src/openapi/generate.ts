import fs from 'fs';
import path from 'path';
import { format, resolveConfig } from 'prettier';
import { buildOpenApiDocument } from './build-spec';

/** Writes docs/architecture/openapi.json. Run with `npm run openapi:generate`. */
export const OPENAPI_OUTPUT = path.resolve(__dirname, '../../../../docs/architecture/openapi.json');

export async function renderOpenApiJson(): Promise<string> {
  return format(JSON.stringify(buildOpenApiDocument(), null, 2), {
    ...(await resolveConfig(OPENAPI_OUTPUT)),
    parser: 'json',
    endOfLine: 'lf',
  });
}

if (require.main === module) {
  void renderOpenApiJson().then((json) => {
    fs.writeFileSync(OPENAPI_OUTPUT, json);
    // eslint-disable-next-line no-console
    console.info(`[OpenAPI] Wrote ${path.relative(process.cwd(), OPENAPI_OUTPUT)}`);
  });
}

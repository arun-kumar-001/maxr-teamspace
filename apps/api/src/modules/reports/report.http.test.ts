import { z } from 'zod';
import { describe, expect, it } from 'vitest';
import { makeApp } from '../../test/helpers';
import { ScopeFilter, scopeAllows } from '../rbac';
import { ALL_ROLES, signInAs } from '../rbac/rbac.testing';
import { ReportDefinition, ReportRegistry } from './index';
import { PdfDocumentInput, PdfExporter } from './pdf/pdf-exporter';
import { MAX_EXPORT_ROWS, MAX_PDF_ROWS } from './report.service';

type Row = {
  name: string;
  department: string;
  ownerEmployeeId: string;
  managerId: string | null;
  bank: string;
};

/** Builds an app whose reports read an in-memory list through the scope filter. */
function setup(
  extra: Partial<ReportDefinition> = {},
  rows?: (e: Record<string, string>) => Row[],
  reportPdfExporter?: PdfExporter,
) {
  const registry = new ReportRegistry();
  const seen: Array<{ scope: ScopeFilter; limit: number; filters: unknown }> = [];
  const ctx = makeApp({ reportRegistry: registry, reportPdfExporter });
  const { users } = ctx.authKit;
  const data: Row[] = rows
    ? rows({
        staff: users.staff.employeeId,
        lead: users.team_lead.employeeId,
        hr: users.hr_manager.employeeId,
        admin: users.admin.employeeId,
      })
    : [
        {
          name: '=cmd|calc',
          department: 'Eng',
          ownerEmployeeId: users.staff.employeeId,
          managerId: users.team_lead.employeeId,
          bank: 'ACC-1',
        },
        {
          name: 'Lead',
          department: 'Eng',
          ownerEmployeeId: users.team_lead.employeeId,
          managerId: null,
          bank: 'ACC-2',
        },
        {
          name: 'Hr',
          department: 'People',
          ownerEmployeeId: users.hr_manager.employeeId,
          managerId: null,
          bank: 'ACC-3',
        },
      ];
  const definition: ReportDefinition = {
    name: 'headcount',
    title: 'Headcount',
    description: 'People by department',
    module: 'employees',
    dataPermissions: ['employees.list'],
    filters: z.object({ department: z.string().max(50).optional() }),
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'department', label: 'Department' },
    ],
    async run({ filters, scope, offset, limit }) {
      seen.push({ scope, limit, filters });
      const f = filters as { department?: string };
      const rowsInScope = data.filter(
        (r) =>
          scopeAllows(scope, r.ownerEmployeeId, r.managerId) &&
          (!f.department || r.department === f.department),
      );
      return { rows: rowsInScope.slice(offset, offset + limit), total: rowsInScope.length };
    },
    ...extra,
  };
  registry.register(definition);
  return { ...ctx, seen, registry, definition };
}

describe('reports: access by role', () => {
  it('401 without a session on every route', async () => {
    const { app } = setup();
    const request = (await import('supertest')).default;
    for (const path of [
      '/api/v1/reports',
      '/api/v1/reports/headcount',
      '/api/v1/reports/headcount/export',
    ]) {
      expect((await request(app).get(path)).status, path).toBe(401);
    }
  });

  it.each([
    ['admin', 200],
    ['hr_manager', 200],
    ['team_lead', 200],
    ['staff', 403],
  ] as const)('%s opening the catalog gets %i', async (role, status) => {
    const { app, authKit } = setup();
    const res = await (await signInAs(app, authKit, role)).get('/api/v1/reports');
    expect(res.status).toBe(status);
  });

  it('the catalog lists only reports the role can run', async () => {
    const { app, authKit, registry } = setup();
    registry.register({
      ...setup().definition,
      name: 'company-only',
      dataPermissions: ['users.list'],
    });
    const lead = await signInAs(app, authKit, 'team_lead');
    const hr = await signInAs(app, authKit, 'hr_manager');
    expect(
      (await lead.get('/api/v1/reports')).body.data.map((r: { name: string }) => r.name),
    ).toEqual(['headcount']);
    expect(
      (await hr.get('/api/v1/reports')).body.data.map((r: { name: string }) => r.name),
    ).toEqual(['company-only', 'headcount']);
  });

  it('a report outside the role looks exactly like an unknown one (404)', async () => {
    const { app, authKit, registry } = setup();
    registry.register({
      ...setup().definition,
      name: 'company-only',
      dataPermissions: ['users.list'],
    });
    const lead = await signInAs(app, authKit, 'team_lead');
    const denied = await lead.get('/api/v1/reports/company-only');
    const missing = await lead.get('/api/v1/reports/no-such-report');
    expect(denied.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(denied.body.error.message).toBe(missing.body.error.message);
    expect((await lead.get('/api/v1/reports/company-only/export')).status).toBe(404);
  });
});

describe('reports: scope inside the query', () => {
  it.each([
    ['admin', ['=cmd|calc', 'Hr', 'Lead']],
    ['hr_manager', ['=cmd|calc', 'Hr', 'Lead']],
    ['team_lead', ['=cmd|calc']],
  ] as const)('%s previews only rows in scope', async (role, names) => {
    const { app, authKit } = setup();
    const res = await (await signInAs(app, authKit, role)).get('/api/v1/reports/headcount');
    expect(res.status).toBe(200);
    expect(res.body.data.map((r: { name: string }) => r.name).sort()).toEqual([...names].sort());
    expect(res.body.meta.total).toBe(names.length);
  });

  it('passes the widest scope and the validated filters to the report', async () => {
    const { app, authKit, seen } = setup();
    const lead = await signInAs(app, authKit, 'team_lead');
    await lead.get('/api/v1/reports/headcount?department=Eng&pageSize=5');
    expect(seen[0]).toMatchObject({
      scope: { kind: 'team', managerId: authKit.users.team_lead.employeeId },
      filters: { department: 'Eng' },
    });
  });

  it('only the declared columns leave the API', async () => {
    const { app, authKit } = setup();
    const res = await (await signInAs(app, authKit, 'admin')).get('/api/v1/reports/headcount');
    expect(JSON.stringify(res.body)).not.toContain('ACC-');
  });
});

describe('reports: input validation', () => {
  it('rejects unknown query keys and bad values with 400', async () => {
    const { app, authKit } = setup();
    const admin = await signInAs(app, authKit, 'admin');
    expect((await admin.get('/api/v1/reports/headcount?bogus=1')).status).toBe(400);
    expect((await admin.get('/api/v1/reports/headcount?pageSize=101')).status).toBe(400);
    expect((await admin.get('/api/v1/reports/headcount?department=' + 'x'.repeat(51))).status).toBe(
      400,
    );
    expect((await admin.get('/api/v1/reports/headcount/export?format=docx')).status).toBe(400);
    expect((await admin.get('/api/v1/reports/Not_Valid!')).status).toBe(400);
  });
});

describe('reports: export', () => {
  it('staff cannot export (403)', async () => {
    const { app, authKit } = setup();
    const res = await (
      await signInAs(app, authKit, 'staff')
    ).get('/api/v1/reports/headcount/export');
    expect(res.status).toBe(403);
  });

  it("downloads a safe CSV for the caller's scope and audits it", async () => {
    const { app, authKit, auditStore } = setup();
    const lead = await signInAs(app, authKit, 'team_lead');
    const res = await lead.get('/api/v1/reports/headcount/export?department=Eng');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/^text\/csv; charset=utf-8/);
    expect(res.headers['content-disposition']).toMatch(
      /^attachment; .*headcount-\d{4}-\d{2}-\d{2}\.csv/,
    );
    expect(res.headers['cache-control']).toBe('private, no-store');
    const text = res.text;
    expect(text).toContain('Name,Department');
    expect(text).toContain("'=cmd|calc,Eng"); // formula neutralised, only the team's row
    expect(text).not.toContain('Hr,');
    expect(text).not.toContain('ACC-');

    const entry = auditStore.list().find((e) => e.action === 'report.export');
    expect(entry).toMatchObject({
      outcome: 'success',
      entityType: 'report',
      entityId: 'headcount',
      actorId: authKit.users.team_lead.id,
      metadata: { format: 'csv', rows: 1, filters: ['department'] },
    });
    expect(JSON.stringify(entry)).not.toContain('Eng'); // filter names only, never values
  });

  it('fails closed: if the audit entry cannot be written, no file is delivered', async () => {
    const { app, authKit, auditStore } = setup();
    const admin = await signInAs(app, authKit, 'admin');
    auditStore.failNextWith(new Error('audit database down'));
    const res = await admin.get('/api/v1/reports/headcount/export');
    expect(res.status).toBe(500);
    expect(res.text).not.toContain('=cmd');
  });

  it('refuses more than the row limit with 422 and records the refusal', async () => {
    const big = Array.from({ length: MAX_EXPORT_ROWS + 5 }, (_, i) => ({
      name: `n${i}`,
      department: 'Eng',
      ownerEmployeeId: `e${i}`,
      managerId: null,
      bank: 'x',
    }));
    const { app, authKit, auditStore } = setup({}, () => big);
    const res = await (
      await signInAs(app, authKit, 'admin')
    ).get('/api/v1/reports/headcount/export');
    expect(res.status).toBe(422);
    expect(res.body.error.message).toMatch(/Narrow the filters/);
    const entry = auditStore.list().find((e) => e.action === 'report.export');
    expect(entry).toMatchObject({ outcome: 'failure', metadata: { reason: 'too_many_rows' } });
  });

  it('exports exactly at the limit', async () => {
    const exact = Array.from({ length: MAX_EXPORT_ROWS }, (_, i) => ({
      name: `n${i}`,
      department: 'Eng',
      ownerEmployeeId: `e${i}`,
      managerId: null,
      bank: 'x',
    }));
    const { app, authKit } = setup({}, () => exact);
    const res = await (
      await signInAs(app, authKit, 'admin')
    ).get('/api/v1/reports/headcount/export');
    expect(res.status).toBe(200);
  });
});

/** Records what it was asked to render and returns a tiny PDF, so the cap and audit tests stay fast. */
class FakePdf implements PdfExporter {
  calls: Array<{ input: PdfDocumentInput; ownerKey: string }> = [];
  failWith?: Error;
  async render(input: PdfDocumentInput, ownerKey: string): Promise<Buffer> {
    this.calls.push({ input, ownerKey });
    if (this.failWith) throw this.failWith;
    return Buffer.from('%PDF-1.7 fake');
  }
}

const people = (n: number): Row[] =>
  Array.from({ length: n }, (_, i) => ({
    name: `n${i}`,
    department: 'Eng',
    ownerEmployeeId: `e${i}`,
    managerId: null,
    bank: 'x',
  }));

describe('reports: PDF export (ADR D-08)', () => {
  it('staff cannot export a PDF (403) and an unknown format is 400', async () => {
    const { app, authKit } = setup({}, undefined, new FakePdf());
    expect(
      (
        await (
          await signInAs(app, authKit, 'staff')
        ).get('/api/v1/reports/headcount/export?format=pdf')
      ).status,
    ).toBe(403);
    expect(
      (
        await (
          await signInAs(app, authKit, 'admin')
        ).get('/api/v1/reports/headcount/export?format=docx')
      ).status,
    ).toBe(400);
  });

  it("downloads a PDF for the caller's scope only, with declared columns, and audits it", async () => {
    const pdf = new FakePdf();
    const { app, authKit, auditStore } = setup({}, undefined, pdf);
    const lead = await signInAs(app, authKit, 'team_lead');
    const res = await lead.get('/api/v1/reports/headcount/export?format=pdf&department=Eng');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toMatch(/headcount-\d{4}-\d{2}-\d{2}\.pdf/);
    expect(res.headers['cache-control']).toBe('private, no-store');
    expect(Buffer.from(res.body).subarray(0, 5).toString()).toBe('%PDF-');

    expect(pdf.calls).toHaveLength(1);
    const [{ input, ownerKey }] = pdf.calls as [(typeof pdf.calls)[number]];
    expect(ownerKey).toBe(authKit.users.team_lead.id);
    expect(input.columns.map((c) => c.key)).toEqual(['name', 'department']);
    expect(input.rows.map((r) => r.name)).toEqual(['=cmd|calc']); // the team's row only

    const entry = auditStore.list().find((e) => e.action === 'report.export');
    expect(entry).toMatchObject({
      outcome: 'success',
      entityId: 'headcount',
      metadata: { format: 'pdf', rows: 1, filters: ['department'] },
    });
  });

  it('allows exactly the PDF row limit and refuses one more with 422 and an audited failure', async () => {
    const ok = setup({}, () => people(MAX_PDF_ROWS), new FakePdf());
    expect(
      (
        await (
          await signInAs(ok.app, ok.authKit, 'admin')
        ).get('/api/v1/reports/headcount/export?format=pdf')
      ).status,
    ).toBe(200);

    const over = setup({}, () => people(MAX_PDF_ROWS + 1), new FakePdf());
    const res = await (
      await signInAs(over.app, over.authKit, 'admin')
    ).get('/api/v1/reports/headcount/export?format=pdf');
    expect(res.status).toBe(422);
    expect(res.body.error.message).toMatch(/PDF can hold at most 2000 rows/);
    expect(over.auditStore.list().find((e) => e.action === 'report.export')).toMatchObject({
      outcome: 'failure',
      metadata: { format: 'pdf', reason: 'too_many_rows', limit: MAX_PDF_ROWS },
    });
    // The same rows are fine as CSV (limit 10,000).
    expect(
      (
        await (
          await signInAs(over.app, over.authKit, 'admin')
        ).get('/api/v1/reports/headcount/export')
      ).status,
    ).toBe(200);
  });

  it('a render failure is a generic 500, audited as a failure, and no file is sent', async () => {
    const pdf = new FakePdf();
    pdf.failWith = new Error('layout exploded with secret detail');
    const { app, authKit, auditStore } = setup({}, undefined, pdf);
    const res = await (
      await signInAs(app, authKit, 'admin')
    ).get('/api/v1/reports/headcount/export?format=pdf');
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain('secret detail');
    expect(auditStore.list().find((e) => e.action === 'report.export')).toMatchObject({
      outcome: 'failure',
      metadata: { format: 'pdf', reason: 'render_failed' },
    });
  });

  it('fails closed: if the audit entry cannot be written, no PDF is delivered', async () => {
    const { app, authKit, auditStore } = setup({}, undefined, new FakePdf());
    const admin = await signInAs(app, authKit, 'admin');
    auditStore.failNextWith(new Error('audit database down'));
    const res = await admin.get('/api/v1/reports/headcount/export?format=pdf');
    expect(res.status).toBe(500);
    expect(res.headers['content-type']).not.toBe('application/pdf');
  });

  it('with the real renderer, Tamil names end up in a real PDF', async () => {
    const tamil = (): Row[] => [
      {
        name: 'அருண் குமார்',
        department: 'Eng',
        ownerEmployeeId: 'e1',
        managerId: null,
        bank: 'x',
      },
    ];
    const { app, authKit } = setup({}, tamil);
    const res = await (
      await signInAs(app, authKit, 'admin')
    )
      .get('/api/v1/reports/headcount/export?format=pdf')
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect((res.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
    expect((res.body as Buffer).toString('latin1')).toContain('Tamil');
  }, 30_000);
});

describe('ReportRegistry', () => {
  const base = () => setup().definition;

  it('rejects bad names, duplicates, no permission and no columns', () => {
    const registry = new ReportRegistry();
    expect(() => registry.register({ ...base(), name: 'Bad_Name' })).toThrow(/kebab-case/);
    registry.register(base());
    expect(() => registry.register(base())).toThrow(/already registered/);
    expect(() => registry.register({ ...base(), name: 'x', dataPermissions: [] })).toThrow(
      /permission/,
    );
    expect(() => registry.register({ ...base(), name: 'y', columns: [] })).toThrow(/columns/);
  });

  it('knows every role (sanity for the table helpers)', () => {
    expect(ALL_ROLES).toHaveLength(4);
  });
});

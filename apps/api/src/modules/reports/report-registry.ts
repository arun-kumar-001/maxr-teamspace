import { REPORT_NAME, ReportDefinition } from './report-definition';

// A definition's filter shape differs per report; the registry only stores and looks them up.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDefinition = ReportDefinition<any>;

/** Modules register their report definitions once, when the app is composed. */
export class ReportRegistry {
  private readonly definitions = new Map<string, AnyDefinition>();

  register(definition: AnyDefinition): void {
    if (!REPORT_NAME.test(definition.name)) {
      throw new Error(`Invalid report name "${definition.name}" (use kebab-case)`);
    }
    if (this.definitions.has(definition.name)) {
      throw new Error(`Report "${definition.name}" is already registered`);
    }
    if (definition.dataPermissions.length === 0) {
      throw new Error(`Report "${definition.name}" must name at least one data permission`);
    }
    if (definition.columns.length === 0) {
      throw new Error(`Report "${definition.name}" must declare its columns`);
    }
    this.definitions.set(definition.name, definition);
  }

  get(name: string): AnyDefinition | undefined {
    return this.definitions.get(name);
  }

  all(): AnyDefinition[] {
    return [...this.definitions.values()].sort((a, b) => a.name.localeCompare(b.name));
  }
}

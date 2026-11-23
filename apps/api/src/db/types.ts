/** Result of probing one dependency. Never contains error text: that goes to the log only. */
export interface DependencyStatus {
  status: 'up' | 'down';
  latencyMs: number;
}

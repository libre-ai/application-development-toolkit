export async function withDiagnosticCleanup(
  scenario: () => Promise<void>,
  cleanup: () => Promise<void>,
): Promise<void> {
  let primary: { error: unknown } | null = null;
  try {
    await scenario();
  } catch (error: unknown) {
    primary = { error };
  }
  try {
    await cleanup();
  } catch (error: unknown) {
    if (primary !== null) {
      // Teardown must not replace the failure that initiated it.
      throw new AggregateError([primary.error, error], "Scenario and diagnostic cleanup failed", {
        cause: primary.error,
      });
    }
    throw error;
  }
  if (primary !== null) throw primary.error;
}

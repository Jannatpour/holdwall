/**
 * Golden Sets Evaluation Tests
 */

import { getGoldenSetManager } from "@/lib/evaluation/golden-sets";

describe("Golden Sets", () => {
  const manager = getGoldenSetManager();

  test("should load claims golden set", async () => {
    const goldenSet = await manager.getGoldenSet("claims");
    expect(goldenSet).not.toBeNull();
    expect(goldenSet?.domain).toBe("claims");
    expect(goldenSet?.examples.length).toBeGreaterThan(0);
  });

  test("should load evidence linking golden set", async () => {
    const goldenSet = await manager.getGoldenSet("evidence_linking");
    expect(goldenSet).not.toBeNull();
    expect(goldenSet?.domain).toBe("evidence_linking");
    expect(goldenSet?.examples.length).toBeGreaterThan(0);
  });

  test("should load graph updates golden set", async () => {
    const goldenSet = await manager.getGoldenSet("graph_updates");
    expect(goldenSet).not.toBeNull();
    expect(goldenSet?.domain).toBe("graph_updates");
    expect(goldenSet?.examples.length).toBeGreaterThan(0);
  });

  test("should load AAAL outputs golden set", async () => {
    const goldenSet = await manager.getGoldenSet("aaal_outputs");
    expect(goldenSet).not.toBeNull();
    expect(goldenSet?.domain).toBe("aaal_outputs");
    expect(goldenSet?.examples.length).toBeGreaterThan(0);
  });

  test("should get examples for domain", async () => {
    const examples = await manager.getExamples("claims");
    expect(examples.length).toBeGreaterThan(0);
    expect(examples[0]).toHaveProperty("id");
    expect(examples[0]).toHaveProperty("domain");
    expect(examples[0]).toHaveProperty("input");
    expect(examples[0]).toHaveProperty("expectedOutput");
  });
});

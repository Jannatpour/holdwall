/**
 * Cache Strategy Tests
 */

import { CacheManager } from "@/lib/cache/strategy";

describe("CacheManager", () => {
  let cacheManager: CacheManager;

  beforeEach(() => {
    cacheManager = new CacheManager();
  });

  afterEach(async () => {
    await cacheManager.clear();
  });

  it("should set and get cached values", async () => {
    await cacheManager.set("test-key", { data: "test" }, { ttl: 60 });
    const value = await cacheManager.get("test-key");
    expect(value).toEqual({ data: "test" });
  });

  it("should respect TTL", async () => {
    await cacheManager.set("test-key", { data: "test" }, { ttl: 1 });
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const value = await cacheManager.get("test-key");
    expect(value).toBeNull();
  });

  it("should invalidate by tag", async () => {
    await cacheManager.set("key1", { data: "1" }, {
      ttl: 60,
      tags: [{ type: "claim", id: "123" }],
    });
    await cacheManager.set("key2", { data: "2" }, {
      ttl: 60,
      tags: [{ type: "claim", id: "123" }],
    });

    await cacheManager.invalidateTag({ type: "claim", id: "123" });

    expect(await cacheManager.get("key1")).toBeNull();
    expect(await cacheManager.get("key2")).toBeNull();
  });

  it("should check version", async () => {
    await cacheManager.set("test-key", { data: "test" }, { version: 1 });
    expect(await cacheManager.get("test-key", 1)).not.toBeNull();
    expect(await cacheManager.get("test-key", 2)).toBeNull();
  });
});

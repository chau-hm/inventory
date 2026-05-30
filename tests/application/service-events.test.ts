import { describe, expect, it } from "vitest";
import { ServiceEventService, type ServiceEventRepository } from "../../src/application/service-events.js";
import type { SavedServiceEvent } from "../../src/domain/service-event.js";

class MemoryServiceEventRepository implements ServiceEventRepository {
  events: SavedServiceEvent[] = [];

  async list(): Promise<SavedServiceEvent[]> {
    return this.events;
  }

  async saveAll(events: SavedServiceEvent[]): Promise<void> {
    this.events = events;
  }
}

function createService(repository = new MemoryServiceEventRepository()): {
  repository: MemoryServiceEventRepository;
  service: ServiceEventService;
} {
  let id = 0;
  return {
    repository,
    service: new ServiceEventService({
      repository,
      now: () => "2026-05-30T12:00:00Z",
      idGenerator: () => `evt_test_${++id}`
    })
  };
}

describe("ServiceEventService", () => {
  it("adds and lists service events", async () => {
    const { service } = createService();

    const event = await service.add({ itemId: "itm_1", kind: "maintenance", title: "Clean filter", dueOn: "2026-06-10" });

    expect(event).toMatchObject({
      id: "evt_test_1",
      itemId: "itm_1",
      kind: "maintenance",
      title: "Clean filter",
      status: "active"
    });
    await expect(service.list({ itemId: "itm_1" })).resolves.toEqual([event]);
  });

  it("soft deletes service events", async () => {
    const { service } = createService();
    const event = await service.add({ itemId: "itm_1", kind: "repair", title: "Keyboard repair", occurredOn: "2026-05-01" });

    const deleted = await service.delete(event.id);

    expect(deleted).toMatchObject({ id: event.id, status: "deleted", deletedAt: "2026-05-30T12:00:00Z" });
    await expect(service.list()).resolves.toEqual([]);
    await expect(service.list({ status: "deleted" })).resolves.toEqual([deleted]);
  });
});


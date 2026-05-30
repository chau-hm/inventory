import { randomUUID } from "node:crypto";
import type { SavedServiceEvent, ServiceEventDraft } from "../domain/service-event.js";
import { validateSavedServiceEvent, validateServiceEventDraft } from "../domain/service-event.js";

export interface ServiceEventRepository {
  list(): Promise<SavedServiceEvent[]>;
  saveAll(events: SavedServiceEvent[]): Promise<void>;
}

export interface ServiceEventServiceOptions {
  repository: ServiceEventRepository;
  now?: () => string;
  idGenerator?: () => string;
}

export interface ServiceEventListOptions {
  itemId?: string;
  status?: "active" | "deleted" | "all";
}

export class ServiceEventService {
  private readonly repository: ServiceEventRepository;
  private readonly now: () => string;
  private readonly idGenerator: () => string;

  constructor(options: ServiceEventServiceOptions) {
    this.repository = options.repository;
    this.now = options.now ?? (() => new Date().toISOString());
    this.idGenerator = options.idGenerator ?? (() => `evt_${randomUUID().replaceAll("-", "").slice(0, 12)}`);
  }

  async add(input: unknown): Promise<SavedServiceEvent> {
    const draft = validateServiceEventDraft(input);
    const timestamp = this.now();
    const event = validateSavedServiceEvent({
      ...draft,
      id: this.idGenerator(),
      status: "active",
      createdAt: timestamp,
      updatedAt: timestamp
    });
    const events = await this.repository.list();
    await this.repository.saveAll([...events, event]);
    return event;
  }

  async list(options: ServiceEventListOptions = {}): Promise<SavedServiceEvent[]> {
    const status = options.status ?? "active";
    const events = await this.repository.list();
    return events.filter((event) => {
      const statusMatches = status === "all" || event.status === status;
      const itemMatches = options.itemId === undefined || event.itemId === options.itemId;
      return statusMatches && itemMatches;
    });
  }

  async delete(eventId: string): Promise<SavedServiceEvent> {
    const events = await this.repository.list();
    const event = events.find((candidate) => candidate.id === eventId && candidate.status !== "deleted");
    if (event === undefined) {
      throw serviceEventError("SERVICE_EVENT_NOT_FOUND", "Service event not found.");
    }
    const timestamp = this.now();
    const deleted = validateSavedServiceEvent({
      ...event,
      status: "deleted",
      deletedAt: timestamp,
      updatedAt: timestamp
    });
    await this.repository.saveAll(events.map((candidate) => (candidate.id === deleted.id ? deleted : candidate)));
    return deleted;
  }
}

export interface ServiceEventError extends Error {
  code: "SERVICE_EVENT_NOT_FOUND";
}

function serviceEventError(code: ServiceEventError["code"], message: string): ServiceEventError {
  const error = new Error(message) as ServiceEventError;
  error.code = code;
  return error;
}


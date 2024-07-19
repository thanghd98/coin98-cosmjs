interface Log {
    readonly msg_index: number;
    readonly log: string;
    readonly events: readonly Event[];
}
  
function isNonNullObject(data: unknown): data is object {
    return typeof data === "object" && data !== null;
}


export function parseEvent(input: unknown): Event {
    if (!isNonNullObject(input)) throw new Error("Event must be a non-null object");
    const { type, attributes } = input as any;
    if (typeof type !== "string" || type === "") {
      throw new Error(`Event type must be a non-empty string`);
    }
    if (!Array.isArray(attributes)) throw new Error("Event's attributes must be an array");
    return {
      type: type,
       //@ts-expect-error
      attributes: attributes.map(parseAttribute),
    };
}

export function parseLog(input: unknown): Log {
    if (!isNonNullObject(input)) throw new Error("Log must be a non-null object");
    const { msg_index, log, events } = input as any;
    if (typeof msg_index !== "number") throw new Error("Log's msg_index must be a number");
    if (typeof log !== "string") throw new Error("Log's log must be a string");
    if (!Array.isArray(events)) throw new Error("Log's events must be an array");
    return {
      msg_index: msg_index,
      log: log,
      events: events.map(parseEvent),
    };
}
  
export function parseLogs(input: unknown): readonly Log[] {
    if (!Array.isArray(input)) throw new Error("Logs must be an array");
    return input.map(parseLog);
}
  
export function parseRawLog(input: string | undefined): readonly Log[] {
    // Cosmos SDK >= 0.50 gives us an empty string here. This should be handled like undefined.
    if (!input) return [];
  
    const logsToParse = JSON.parse(input).map(({ events }: { events: readonly unknown[] }, i: number) => ({
      msg_index: i,
      events,
      log: "",
    }));
    return parseLogs(logsToParse);
}
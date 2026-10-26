/**
 * Common shape for any event source. An adapter connects to its source,
 * converts incoming data to OverlayEvent and calls emitOverlayEvent().
 */
export interface EventAdapter {
  readonly name: string;
  connect(): void | Promise<void>;
  disconnect(): void;
}

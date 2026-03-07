/** EventBus — lightweight typed pub/sub emitter.
 *
 *  Keeps simulation code fully decoupled from UI code. The bus is generic
 *  over any discriminated-union event type using a `type` discriminant.
 *
 *  Usage:
 *    const bus = new EventBus<TankEvent>();
 *    const unsub = bus.on('AddFood', e => console.log(e.payload));
 *    bus.emit({ type: 'AddFood', payload: { ... } });
 *    unsub(); // remove listener
 */

type Handler<T> = (event: T) => void;

export class EventBus<T extends { type: string }> {
  private readonly listeners = new Map<string, Set<Handler<T>>>();

  /** Subscribe to events of a specific type. Returns an unsubscribe function. */
  on<K extends T['type']>(type: K, handler: Handler<Extract<T, { type: K }>>): () => void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    const set = this.listeners.get(type)!;
    set.add(handler as Handler<T>);
    return () => set.delete(handler as Handler<T>);
  }

  /** Emit an event to all registered handlers of its type. */
  emit(event: T): void {
    this.listeners.get(event.type)?.forEach(h => h(event));
  }
}

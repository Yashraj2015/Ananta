import type { RealtimeChannel as RChannel } from './types';

class AnantaRealtimeChannel implements RChannel {
  private listeners: Array<{ event: string; callback: (p: any) => void }> = [];
  private ws: WebSocket | null = null;
  private status = 'CLOSED';

  constructor(private channelName: string, private wsUrl: string, private key: string) {}

  on(event: string, filter: any, callback: (payload: any) => void): this {
    this.listeners.push({ event, callback });
    return this;
  }

  subscribe(callback?: (status: string) => void): this {
    try {
      this.ws = new WebSocket(this.wsUrl + '/realtime/v1/websocket?apikey=' + this.key);
      this.ws.onopen = () => {
        this.status = 'SUBSCRIBED';
        this.ws?.send(JSON.stringify({ topic: 'realtime:' + this.channelName, event: 'phx_join', payload: {}, ref: '1' }));
        callback?.('SUBSCRIBED');
      };
      this.ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          const event = msg.event?.replace('postgres_changes:', '') ?? '';
          this.listeners.filter(l => l.event === event || l.event === '*').forEach(l => l.callback(msg.payload));
        } catch {}
      };
      this.ws.onclose = () => { this.status = 'CLOSED'; callback?.('CLOSED'); };
      this.ws.onerror = () => { this.status = 'CHANNEL_ERROR'; callback?.('CHANNEL_ERROR'); };
    } catch (err) {
      // WebSocket not available (Node.js) — polling fallback would go here
      callback?.('CHANNEL_ERROR');
    }
    return this;
  }

  unsubscribe(): void { this.ws?.close(); this.ws = null; }
  send(payload: any): void { this.ws?.send(JSON.stringify(payload)); }
}

export class RealtimeClient {
  private channels: Map<string, AnantaRealtimeChannel> = new Map();
  private wsUrl: string;

  constructor(baseUrl: string, private key: string) {
    this.wsUrl = baseUrl.replace(/^https?:\/\//, m => m === 'https://' ? 'wss://' : 'ws://');
  }

  channel(name: string): AnantaRealtimeChannel {
    if (!this.channels.has(name)) {
      this.channels.set(name, new AnantaRealtimeChannel(name, this.wsUrl, this.key));
    }
    return this.channels.get(name)!;
  }

  removeChannel(ch: RChannel): void {
    ch.unsubscribe();
  }

  removeAllChannels(): void {
    this.channels.forEach(ch => ch.unsubscribe());
    this.channels.clear();
  }
}

import { RealtimeChannel } from './types';

export class RealtimeChannelImpl implements RealtimeChannel {
  constructor(private baseUrl: string, private apiKey: string, private name: string) {}

  on(event: 'INSERT' | 'UPDATE' | 'DELETE' | '*', callback: Function) { return this; }
  async subscribe() {}
  unsubscribe() {}
}

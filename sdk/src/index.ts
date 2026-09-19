/**
 * @ananta/js — Official Ananta DB SDK
 * Compatible with Supabase SDK surface area for easy migration
 */

export { createClient } from './client';
export type {
  AnantaClient,
  AnantaClientOptions,
  Collection,
  Table,
  AuthClient,
  StorageClient,
  RealtimeClient,
  QueryFilter,
  InsertOptions,
  UpdateOptions,
  FetchOptions,
  User,
  Session,
  AuthResponse,
  StorageObject,
  RealtimeChannel,
} from './types';

// Version
export const version = '0.1.0';

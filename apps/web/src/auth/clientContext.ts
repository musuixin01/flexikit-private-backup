import { isDesktopRuntime } from '@/api/runtime';

export type AuthClientType = 'web' | 'desktop' | 'mobile' | 'extension' | 'unknown';
export type AuthClientInputType = Exclude<AuthClientType, 'unknown'>;

export interface AuthClientContextPayload {
  client_type: AuthClientInputType;
  client_instance_id: string;
  client_name: string;
}

export interface AuthSessionMetadata {
  session_id: string;
  client_type: AuthClientType;
  client_instance_id: string | null;
  client_name: string | null;
}

const CLIENT_INSTANCE_KEY = 'flexikit-auth-client-instance-id-v1';

function storage(): Storage | null {
  return typeof window !== 'undefined' ? window.localStorage : null;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function createClientInstanceId(): string {
  if (typeof crypto === 'undefined' || typeof crypto.randomUUID !== 'function') {
    throw new Error('Secure client instance ID generation is unavailable');
  }
  return crypto.randomUUID();
}

export function getAuthClientContext(): AuthClientContextPayload {
  const store = storage();
  let instanceId = store?.getItem(CLIENT_INSTANCE_KEY) ?? null;

  if (!instanceId || !isUuid(instanceId)) {
    instanceId = createClientInstanceId();
    store?.setItem(CLIENT_INSTANCE_KEY, instanceId);
  }

  const desktop = isDesktopRuntime();
  return {
    client_type: desktop ? 'desktop' : 'web',
    client_instance_id: instanceId,
    client_name: desktop ? 'FlexiKit Desktop' : 'FlexiKit Web',
  };
}

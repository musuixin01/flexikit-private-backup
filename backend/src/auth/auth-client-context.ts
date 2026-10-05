export const AUTH_CLIENT_TYPES = ['web', 'desktop', 'mobile', 'extension'] as const;

export type AuthClientType = (typeof AUTH_CLIENT_TYPES)[number] | 'unknown';

export interface AuthClientContext {
  clientType: AuthClientType;
  clientInstanceId: string | null;
  clientName: string | null;
}

export interface AuthClientContextInput {
  client_type?: (typeof AUTH_CLIENT_TYPES)[number];
  client_instance_id?: string;
  client_name?: string;
}

export function normalizeAuthClientContext(
  input: AuthClientContextInput,
): AuthClientContext {
  const clientName = input.client_name?.trim() || null;

  return {
    clientType: input.client_type ?? 'unknown',
    clientInstanceId: input.client_instance_id ?? null,
    clientName,
  };
}

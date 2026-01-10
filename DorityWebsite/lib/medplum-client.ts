import { MedplumClient } from '@medplum/core';

let medplumClient: MedplumClient | null = null;

// Create a no-op storage adapter for server-side usage with all required methods
const noopStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {},
  length: 0,
  key: () => null,
  // Additional Medplum-specific methods
  getString: () => undefined,
  setString: () => {},
  getObject: () => undefined,
  setObject: () => {},
};

/**
 * Get or create a singleton Medplum client instance
 * This handles authentication with Medplum using client credentials
 */
export async function getMedplumClient(): Promise<MedplumClient> {
  // Return existing client if already authenticated
  if (medplumClient) {
    return medplumClient;
  }

  // Create new Medplum client with no-op storage for server-side usage
  medplumClient = new MedplumClient({
    baseUrl: process.env.MEDPLUM_BASE_URL || 'https://api.medplum.com/',
    clientId: process.env.MEDPLUM_CLIENT_ID,
    clientSecret: process.env.MEDPLUM_CLIENT_SECRET,
    storage: noopStorage as Storage,
  });

  // Authenticate using client credentials flow
  try {
    await medplumClient.startClientLogin(
      process.env.MEDPLUM_CLIENT_ID!,
      process.env.MEDPLUM_CLIENT_SECRET!
    );
    
    console.log('✅ Medplum client authenticated successfully');
  } catch (error) {
    console.error('❌ Failed to authenticate with Medplum:', error);
    medplumClient = null;
    throw error;
  }

  return medplumClient;
}

/**
 * Test function to verify Medplum connection
 */
export async function testMedplumConnection(): Promise<boolean> {
  try {
    const client = await getMedplumClient();
    const profile = await client.getProfile();
    console.log('Connected to Medplum as:', profile.display || profile.id);
    return true;
  } catch (error) {
    console.error('Medplum connection test failed:', error);
    return false;
  }
}

import { logger } from "./logger.js";

const log = logger.child({ module: "zenon" });

// The Zenon SDK is dynamically imported to handle cases where
// the node connection is unavailable during startup
let zenonInstance: ZenonClient | null = null;

export class ZenonClient {
  private zenon: any;
  private keyPair: any;
  private _initialized = false;

  get initialized(): boolean {
    return this._initialized;
  }

  async initialize(httpUrl: string, mnemonic?: string): Promise<void> {
    try {
      const { Zenon } = await import("znn-typescript-sdk");
      this.zenon = Zenon.getInstance();
      await this.zenon.initialize(httpUrl);

      if (mnemonic) {
        const { KeyStore } = await import("znn-typescript-sdk");
        const keyStore = KeyStore.fromMnemonic(mnemonic);
        this.keyPair = keyStore.getKeyPair(0);
        log.info("Zenon wallet loaded from mnemonic");
      }

      this._initialized = true;
      log.info({ url: httpUrl }, "Zenon SDK initialized");
    } catch (err) {
      log.error({ err }, "Failed to initialize Zenon SDK");
      // Don't throw - the bot should still work without Zenon
    }
  }

  get ledger() {
    this.assertInitialized();
    return this.zenon.ledger;
  }

  get embedded() {
    this.assertInitialized();
    return this.zenon.embedded;
  }

  get subscribe() {
    this.assertInitialized();
    return this.zenon.subscribe;
  }

  get stats() {
    this.assertInitialized();
    return this.zenon.stats;
  }

  get hasWallet(): boolean {
    return this.keyPair != null;
  }

  async send(blockTemplate: any): Promise<any> {
    this.assertInitialized();
    if (!this.keyPair) {
      throw new Error("No wallet configured. Set ZENON_MNEMONIC in .env");
    }
    return this.zenon.send(blockTemplate, this.keyPair);
  }

  async disconnect(): Promise<void> {
    if (this.zenon) {
      try {
        await this.zenon.clearConnection();
      } catch {
        // ignore disconnect errors
      }
      this._initialized = false;
    }
  }

  private assertInitialized(): void {
    if (!this._initialized) {
      throw new Error("Zenon SDK not initialized. Call initialize() first.");
    }
  }
}

export function getZenonClient(): ZenonClient {
  if (!zenonInstance) {
    zenonInstance = new ZenonClient();
  }
  return zenonInstance;
}

export async function initializeZenon(
  httpUrl: string,
  mnemonic?: string
): Promise<ZenonClient> {
  const client = getZenonClient();
  await client.initialize(httpUrl, mnemonic);
  return client;
}

export async function disconnectZenon(): Promise<void> {
  if (zenonInstance) {
    await zenonInstance.disconnect();
    zenonInstance = null;
  }
}

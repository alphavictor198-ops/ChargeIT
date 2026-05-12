/**
 * Simulated OCPP 1.6J Engine for Web
 * Mirrors mobile implementation for technical parity.
 */
class OCPPEngine {
    async reserveNow(connectorId: number, expiryDate: Date, idTag: string) {
      console.log(`[OCPP] Sending ReserveNow to connector ${connectorId}...`);
      await new Promise(r => setTimeout(r, 1500));
      return { status: 'Accepted' };
    }
  
    async remoteStartTransaction(connectorId: number, idTag: string) {
      console.log(`[OCPP] Sending RemoteStart for tag ${idTag}...`);
      await new Promise(r => setTimeout(r, 1000));
      return { status: 'Accepted' };
    }
  }
  
  export const ocppEngine = new OCPPEngine();

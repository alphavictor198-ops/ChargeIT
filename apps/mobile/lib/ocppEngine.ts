/**
 * GatiCharge OCPP Simulation Engine
 * Implements standard OCPP 1.6J JSON-over-WebSocket message patterns.
 */

export type OCPPStatus = 'Available' | 'Preparing' | 'Charging' | 'SuspendedEVSE' | 'SuspendedEV' | 'Finishing' | 'Reserved' | 'Unavailable' | 'Faulted';

export interface OCPPMessage {
  messageTypeId: 2 | 3; // 2 = Call, 3 = CallResult
  uniqueId: string;
  action?: string;
  payload: any;
}

class OCPPSimulator {
  private status: OCPPStatus = 'Available';
  private reservationId: number | null = null;

  // Simulates sending a ReserveNow request to a physical charger
  async reserveNow(connectorId: number, expiryDate: Date, idTag: string): Promise<{ status: 'Accepted' | 'Faulted' | 'Occupied' | 'Rejected' | 'Unavailable' }> {
    console.log(`[OCPP] Sending ReserveNow to Connector ${connectorId}...`);
    
    // Simulate Network Latency
    await new Promise(resolve => setTimeout(resolve, 1500));

    if (this.status !== 'Available') {
      return { status: 'Occupied' };
    }

    this.status = 'Reserved';
    this.reservationId = Math.floor(Math.random() * 10000);
    
    console.log(`[OCPP] Connector ${connectorId} status updated to: RESERVED (ID: ${this.reservationId})`);
    return { status: 'Accepted' };
  }

  // Simulates the physical hardware status update
  getStatus(): OCPPStatus {
    return this.status;
  }

  // Resets for demo purposes
  reset() {
    this.status = 'Available';
    this.reservationId = null;
  }
}

export const ocppEngine = new OCPPSimulator();

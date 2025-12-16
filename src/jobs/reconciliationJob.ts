import * as cron from 'node-cron';
import { reconciliationService } from '../services/ReconciliationService';
import { snapshotService } from '../services/SnapshotService';
import { auditService } from '../services/AuditService';
import { config } from '../config';

type ScheduledTask = ReturnType<typeof cron.schedule>;

let reconciliationTask: ScheduledTask | null = null;
let snapshotTask: ScheduledTask | null = null;
let cleanupTask: ScheduledTask | null = null;

export function startReconciliationJob(): void {
  if (!config.reconciliation.enabled) {
    console.log('Reconciliation job is disabled');
    return;
  }
  
  reconciliationTask = cron.schedule(config.reconciliation.cronSchedule, async () => {
    console.log('Starting scheduled reconciliation...');
    try {
      const result = await reconciliationService.runReconciliation();
      console.log(`Reconciliation completed: ${result.status}`);
      console.log(`Total accounts: ${result.totalAccounts}, Balanced: ${result.balancedAccounts}, Imbalanced: ${result.imbalancedAccounts}`);
      
      if (result.discrepancies.length > 0) {
        console.warn('Discrepancies found:', JSON.stringify(result.discrepancies, null, 2));
      }
    } catch (error) {
      console.error('Reconciliation failed:', error);
    }
  });
  
  console.log(`Reconciliation job scheduled: ${config.reconciliation.cronSchedule}`);
}

export function startSnapshotJob(): void {
  snapshotTask = cron.schedule('0 1 * * *', async () => {
    console.log('Starting scheduled balance snapshot...');
    try {
      const snapshots = await snapshotService.createSnapshotsForAllAccounts();
      console.log(`Created ${snapshots.length} balance snapshots`);
    } catch (error) {
      console.error('Snapshot creation failed:', error);
    }
  });
  
  console.log('Snapshot job scheduled: 0 1 * * * (daily at 1 AM)');
}

export function startCleanupJob(): void {
  cleanupTask = cron.schedule('0 2 * * 0', async () => {
    console.log('Starting scheduled cleanup...');
    try {
      const deletedSnapshots = await snapshotService.cleanupOldSnapshots();
      console.log(`Deleted ${deletedSnapshots} old snapshots`);
      
      const deletedAuditLogs = await auditService.cleanupOldLogs();
      console.log(`Deleted ${deletedAuditLogs} old audit logs`);
    } catch (error) {
      console.error('Cleanup failed:', error);
    }
  });
  
  console.log('Cleanup job scheduled: 0 2 * * 0 (weekly on Sunday at 2 AM)');
}

export function stopAllJobs(): void {
  if (reconciliationTask) {
    reconciliationTask.stop();
    reconciliationTask = null;
  }
  if (snapshotTask) {
    snapshotTask.stop();
    snapshotTask = null;
  }
  if (cleanupTask) {
    cleanupTask.stop();
    cleanupTask = null;
  }
  console.log('All scheduled jobs stopped');
}

export function startAllJobs(): void {
  startReconciliationJob();
  startSnapshotJob();
  startCleanupJob();
}

export async function runReconciliationNow(): Promise<void> {
  console.log('Running reconciliation manually...');
  const result = await reconciliationService.runReconciliation();
  console.log(`Reconciliation completed: ${result.status}`);
  if (result.discrepancies.length > 0) {
    console.warn('Discrepancies found:', JSON.stringify(result.discrepancies, null, 2));
  }
}

export async function runSnapshotNow(): Promise<void> {
  console.log('Running snapshot manually...');
  const snapshots = await snapshotService.createSnapshotsForAllAccounts();
  console.log(`Created ${snapshots.length} balance snapshots`);
}

import cron from 'node-cron';
import { config } from '../config';
import { logger } from '../utils/logger';
import { userQuestService } from './user-quest.service';

export class SchedulerService {
  private dailyResetJob: cron.ScheduledTask | null = null;
  private weeklyResetJob: cron.ScheduledTask | null = null;
  private expirationJob: cron.ScheduledTask | null = null;

  start(): void {
    this.scheduleDailyReset();
    this.scheduleWeeklyReset();
    this.scheduleExpirationCheck();
    logger.info('Quest scheduler started');
  }

  stop(): void {
    if (this.dailyResetJob) {
      this.dailyResetJob.stop();
      this.dailyResetJob = null;
    }
    if (this.weeklyResetJob) {
      this.weeklyResetJob.stop();
      this.weeklyResetJob = null;
    }
    if (this.expirationJob) {
      this.expirationJob.stop();
      this.expirationJob = null;
    }
    logger.info('Quest scheduler stopped');
  }

  private scheduleDailyReset(): void {
    const hour = config.quest.dailyResetHour;
    const cronExpression = `0 ${hour} * * *`;

    this.dailyResetJob = cron.schedule(cronExpression, async () => {
      try {
        logger.info('Running daily quest reset...');
        await userQuestService.resetDailyQuests();
      } catch (error) {
        logger.error('Error during daily quest reset:', error);
      }
    }, {
      timezone: 'UTC'
    });

    logger.info(`Daily quest reset scheduled at ${hour}:00 UTC`);
  }

  private scheduleWeeklyReset(): void {
    const day = config.quest.weeklyResetDay;
    const cronExpression = `0 0 * * ${day}`;

    this.weeklyResetJob = cron.schedule(cronExpression, async () => {
      try {
        logger.info('Running weekly quest reset...');
        await userQuestService.resetWeeklyQuests();
      } catch (error) {
        logger.error('Error during weekly quest reset:', error);
      }
    }, {
      timezone: 'UTC'
    });

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    logger.info(`Weekly quest reset scheduled for ${dayNames[day]} at 00:00 UTC`);
  }

  private scheduleExpirationCheck(): void {
    this.expirationJob = cron.schedule('*/15 * * * *', async () => {
      try {
        const expiredCount = await userQuestService.expireUserQuests();
        if (expiredCount > 0) {
          logger.info(`Expired ${expiredCount} user quests`);
        }
      } catch (error) {
        logger.error('Error during quest expiration check:', error);
      }
    });

    logger.info('Quest expiration check scheduled every 15 minutes');
  }
}

export const schedulerService = new SchedulerService();

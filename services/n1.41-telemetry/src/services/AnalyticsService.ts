import {
  UserBehavior,
  FunnelAnalysis,
  FunnelStep,
  StoredEvent
} from '../types';
import { logger } from '../utils/logger';
import { calculateAverage, groupBy } from '../utils/helpers';
import { eventService } from './EventService';
import { sessionService } from './SessionService';

export class AnalyticsService {
  public getUserBehavior(userId: string): UserBehavior | undefined {
    const sessions = sessionService.getSessionsByUser(userId);
    const events = eventService.getEventsByUser(userId);

    if (sessions.length === 0 && events.length === 0) {
      return undefined;
    }

    const durations = sessions
      .filter(s => s.duration !== undefined)
      .map(s => s.duration as number);

    const eventCounts = this.countEventsByName(events);
    const topEvents = Object.entries(eventCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const allTimestamps = [
      ...sessions.map(s => s.startTime),
      ...events.map(e => e.timestamp)
    ];

    return {
      userId,
      totalSessions: sessions.length,
      totalEvents: events.length,
      firstSeen: Math.min(...allTimestamps),
      lastSeen: Math.max(...allTimestamps),
      averageSessionDuration: calculateAverage(durations),
      topEvents
    };
  }

  public getUsersBehavior(userIds: string[]): UserBehavior[] {
    const behaviors: UserBehavior[] = [];
    
    for (const userId of userIds) {
      const behavior = this.getUserBehavior(userId);
      if (behavior !== undefined) {
        behaviors.push(behavior);
      }
    }

    return behaviors;
  }

  public analyzeFunnel(
    funnelName: string,
    steps: Array<{ name: string; eventName: string }>,
    startTime?: number,
    endTime?: number
  ): FunnelAnalysis {
    const queryOptions = { startTime, endTime };
    const allEvents = eventService.queryEvents(queryOptions).data;

    const userEventMap = groupBy(allEvents, event => event.userId ?? 'anonymous');
    const uniqueUsers = Object.keys(userEventMap);

    const funnelSteps: FunnelStep[] = [];
    let previousStepUsers = new Set(uniqueUsers);

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      if (step === undefined) continue;

      const usersWithEvent = new Set<string>();

      for (const userId of previousStepUsers) {
        const userEvents = userEventMap[userId];
        if (userEvents !== undefined) {
          const hasEvent = userEvents.some(e => e.name === step.eventName);
          if (hasEvent) {
            usersWithEvent.add(userId);
          }
        }
      }

      const count = usersWithEvent.size;
      const conversionRate = previousStepUsers.size > 0 
        ? count / previousStepUsers.size 
        : 0;
      const dropoffRate = 1 - conversionRate;

      funnelSteps.push({
        name: step.name,
        eventName: step.eventName,
        count,
        conversionRate,
        dropoffRate
      });

      previousStepUsers = usersWithEvent;
    }

    const firstStep = funnelSteps[0];
    const lastStep = funnelSteps[funnelSteps.length - 1];
    const overallConversionRate = firstStep !== undefined && lastStep !== undefined && firstStep.count > 0
      ? lastStep.count / firstStep.count
      : 0;

    logger.debug('Funnel analysis completed', { funnelName, steps: funnelSteps.length });

    return {
      name: funnelName,
      steps: funnelSteps,
      overallConversionRate,
      totalUsers: uniqueUsers.length
    };
  }

  public getEngagementMetrics(
    startTime?: number,
    endTime?: number
  ): {
    totalUsers: number;
    activeUsers: number;
    newUsers: number;
    returningUsers: number;
    averageEventsPerUser: number;
    averageSessionsPerUser: number;
  } {
    const queryOptions = { startTime, endTime };
    const events = eventService.queryEvents(queryOptions).data;
    const sessions = sessionService.querySessions(queryOptions);

    const userEventCounts = new Map<string, number>();
    const userSessionCounts = new Map<string, number>();
    const userFirstSeen = new Map<string, number>();

    for (const event of events) {
      const userId = event.userId ?? 'anonymous';
      const currentCount = userEventCounts.get(userId) ?? 0;
      userEventCounts.set(userId, currentCount + 1);

      const firstSeen = userFirstSeen.get(userId);
      if (firstSeen === undefined || event.timestamp < firstSeen) {
        userFirstSeen.set(userId, event.timestamp);
      }
    }

    for (const session of sessions) {
      const userId = session.userId ?? 'anonymous';
      const currentCount = userSessionCounts.get(userId) ?? 0;
      userSessionCounts.set(userId, currentCount + 1);
    }

    const totalUsers = userEventCounts.size;
    const activeSessions = sessionService.getActiveSessions();
    const activeUserIds = new Set(activeSessions.map(s => s.userId ?? 'anonymous'));
    const activeUsers = activeUserIds.size;

    const effectiveStartTime = startTime ?? 0;
    let newUsers = 0;
    let returningUsers = 0;

    for (const firstSeenTime of userFirstSeen.values()) {
      if (firstSeenTime >= effectiveStartTime) {
        newUsers++;
      } else {
        returningUsers++;
      }
    }

    const eventCounts = Array.from(userEventCounts.values());
    const sessionCounts = Array.from(userSessionCounts.values());

    return {
      totalUsers,
      activeUsers,
      newUsers,
      returningUsers,
      averageEventsPerUser: calculateAverage(eventCounts),
      averageSessionsPerUser: calculateAverage(sessionCounts)
    };
  }

  public getCohortAnalysis(
    cohortPeriod: 'day' | 'week' | 'month',
    startTime: number,
    endTime: number
  ): Array<{
    cohortDate: number;
    totalUsers: number;
    retentionByPeriod: number[];
  }> {
    const events = eventService.queryEvents({ startTime, endTime }).data;
    const userFirstSeen = new Map<string, number>();

    for (const event of events) {
      const userId = event.userId ?? 'anonymous';
      const firstSeen = userFirstSeen.get(userId);
      if (firstSeen === undefined || event.timestamp < firstSeen) {
        userFirstSeen.set(userId, event.timestamp);
      }
    }

    const periodMs = this.getPeriodMs(cohortPeriod);
    const cohorts = new Map<number, Set<string>>();

    for (const [userId, firstSeen] of userFirstSeen.entries()) {
      const cohortDate = Math.floor(firstSeen / periodMs) * periodMs;
      const existing = cohorts.get(cohortDate);
      if (existing !== undefined) {
        existing.add(userId);
      } else {
        cohorts.set(cohortDate, new Set([userId]));
      }
    }

    const results: Array<{
      cohortDate: number;
      totalUsers: number;
      retentionByPeriod: number[];
    }> = [];

    for (const [cohortDate, users] of cohorts.entries()) {
      const retentionByPeriod: number[] = [];
      const totalUsers = users.size;

      for (let period = 0; period < 12; period++) {
        const periodStart = cohortDate + period * periodMs;
        const periodEnd = periodStart + periodMs;

        if (periodStart > endTime) break;

        let activeInPeriod = 0;
        for (const userId of users) {
          const userEvents = events.filter(
            e => e.userId === userId && 
                 e.timestamp >= periodStart && 
                 e.timestamp < periodEnd
          );
          if (userEvents.length > 0) {
            activeInPeriod++;
          }
        }

        retentionByPeriod.push(totalUsers > 0 ? activeInPeriod / totalUsers : 0);
      }

      results.push({
        cohortDate,
        totalUsers,
        retentionByPeriod
      });
    }

    return results.sort((a, b) => a.cohortDate - b.cohortDate);
  }

  private getPeriodMs(period: 'day' | 'week' | 'month'): number {
    switch (period) {
      case 'day':
        return 24 * 60 * 60 * 1000;
      case 'week':
        return 7 * 24 * 60 * 60 * 1000;
      case 'month':
        return 30 * 24 * 60 * 60 * 1000;
    }
  }

  private countEventsByName(events: StoredEvent[]): Record<string, number> {
    const counts: Record<string, number> = {};
    
    for (const event of events) {
      const current = counts[event.name] ?? 0;
      counts[event.name] = current + 1;
    }

    return counts;
  }
}

export const analyticsService = new AnalyticsService();

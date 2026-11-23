import type { Job } from '../../platform/jobs/job-runner';
import type { NotificationsService } from './notifications.service';

/** The background jobs of notifications: approval reminders (D-15) and the 90-day retention. */
export function createNotificationJobs(service: NotificationsService): Job[] {
  return [
    {
      name: 'notification-reminders',
      run: async (now) => void (await service.sendApprovalReminders(now)),
    },
    {
      name: 'notification-task-due',
      run: async (now) => void (await service.sendTaskDueReminders(now)),
    },
    { name: 'notification-retention', run: async (now) => void (await service.purgeRead(now)) },
  ];
}

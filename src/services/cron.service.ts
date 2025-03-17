import { Cron } from 'croner';
import { CronExpression } from '../constants/cron';
import convaiService from './convai.service';

new Cron(CronExpression.EVERY_MONTH, { timezone: 'UTC' }, async () => {
  try {
    await convaiService.getCharacterVoiceTypes();
    await convaiService.getAvailableLanguages();
  } catch (error) {
    console.warn(error);
    console.warn('Cronjob threw an error; skipping...');
  }
});

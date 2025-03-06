/**
 * https://github.com/mswjs/interceptors#nodejs-preset
 * https://github.com/mswjs/interceptors#mocking-responses
 */

import { BatchInterceptor } from '@mswjs/interceptors';
import nodeInterceptors from '@mswjs/interceptors/presets/node';
import mailConfig from '../../src/config/mail.config';

export async function withMockMail(actions: () => Promise<void>) {
  /** Create an interceptor */
  const interceptor = new BatchInterceptor({
    name: 'mail-interceptor',
    interceptors: nodeInterceptors
  });
  interceptor.apply();

  /** Intercept requests on third-party mail service */
  interceptor.on('request', ({ request, controller }) => {
    const reqUrlObj = new URL(request.url);
    const envUrlObj = new URL(mailConfig.zapierHookUrl);

    const isMailRequest = reqUrlObj.origin === envUrlObj.origin;
    if (!isMailRequest) return;

    /** Just a generic response, to ensure the request succeeds, and not cause app errors */
    controller.respondWith(new Response());
  });

  /** Perform actions, encapsulated in a function, that are dependent on mail service */
  await actions();

  /** Destroy interceptor after use, to ensure it will not intercept requests unintentionally */
  interceptor.dispose();
}

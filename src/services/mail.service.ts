import path from 'path';
import dotenv from 'dotenv';
import Handlebars from 'handlebars';
import fs from 'fs/promises';
import mailConfig from '../config/mail.config';
import createHttpError from 'http-errors';
import serverConfig from '../config/server.config';

dotenv.config();

type Mail = {
  fullName: string;
  to: string;
  subject: string;
};

async function sendMail(
  emailData: Partial<Mail>,
  templateData: { [key: string]: any },
  template: string,
  sendInBackground?: boolean
) {
  try {
    const templatePath = path.join(
      __dirname,
      `../templates/${template}.handlebars`
    );
    const logoUrl = serverConfig.backendUrl
      ? serverConfig.backendUrl + '/images/nudgyt-logo.png'
      : 'https://placehold.co/600x400';
    const templateSource = await fs.readFile(templatePath, 'utf-8');
    const compileTemplate = Handlebars.compile(templateSource);
    const htmlBody = compileTemplate({ ...templateData, logoUrl });

    const processedEmailData = {
      to: emailData.to,
      email: emailData.to,
      message_body: htmlBody,
      subject: emailData.subject
    };

    await fetch(mailConfig.zapierHookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(processedEmailData)
    });
  } catch (e) {
    console.log(e);
    if (!sendInBackground) throw createHttpError.InternalServerError();
  }
}

export default { sendMail };

import convaiConfig from '../config/convai.config';
import ConvaiVoiceType from '../models/convai-voice-type.model';
import ConvaiLanguage from '../models/convai-language.model';

async function getCharacterVoiceTypes() {
  const response = await fetch(
    `${convaiConfig.convaiApiUrl}/tts/get_available_voices`,
    {
      method: 'GET',
      headers: {
        'CONVAI-API-KEY': convaiConfig.convaiApiKey
      }
    }
  );

  if (response.ok) {
    const voices = (await response.json()) as any;
    const result: Array<{
      name: string;
      voice_value: string;
      sample_link: string;
      gender: string;
      lang_codes: string[];
    }> = [];

    if (voices['Convai Voices']) {
      voices['Convai Voices'].forEach((voiceObj: any) => {
        const key = Object.keys(voiceObj)[0];
        result.push({
          name: key,
          voice_value: voiceObj[key].voice_value,
          sample_link: voiceObj[key].sample_link,
          gender: voiceObj[key].gender,
          lang_codes: voiceObj[key].lang_codes
        });
      });
    }

    if (voices['Convai Voices (Experimental)']) {
      voices['Convai Voices (Experimental)'].forEach(
        (voiceObj: any) => {
          const key = Object.keys(voiceObj)[0];
          result.push({
            name: key,
            voice_value: voiceObj[key].voice_value,
            sample_link: voiceObj[key].sample_link,
            gender: voiceObj[key].gender,
            lang_codes: voiceObj[key].lang_codes
          });
        }
      );
    }

    if (voices['Convai Voices (New)']) {
      voices['Convai Voices (New)'].forEach((voiceObj: any) => {
        const key = Object.keys(voiceObj)[0];
        result.push({
          name: key,
          voice_value: voiceObj[key].voice_value,
          sample_link: voiceObj[key].sample_link,
          gender: voiceObj[key].gender,
          lang_codes: voiceObj[key].lang_codes
        });
      });
    }

    await ConvaiVoiceType.insertMany(result);
  }
}

const getAvailableLanguages = async () => {
  const response = await fetch(
    `${convaiConfig.convaiApiUrl}/tts/get_available_languages`,
    {
      method: 'GET',
      headers: {
        'CONVAI-API-KEY': convaiConfig.convaiApiKey
      }
    }
  );

  if (response.ok) {
    const data = (await response.json()) as Array<
      Record<string, { lang_code: string; lang_name: string }>
    >;

    const result = data.map((item) => {
      const langCode = Object.keys(item)[0];
      return {
        lang_code: item[langCode].lang_code,
        lang_name: item[langCode].lang_name
      };
    });

    await ConvaiLanguage.insertMany(result);
  }
};

export default {
  getCharacterVoiceTypes,
  getAvailableLanguages
};

import ConvaiVoiceType from '../models/convai-voice-type.model';
import ConvaiLanguage from '../models/convai-language.model';
import convaiConfig from '../config/convai.config';

async function insertConvaiVoiceTypes() {
  // Clear existing data
  await ConvaiVoiceType.deleteMany({});

  // Fetch voice types from Convai API
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
    console.log(`Inserted ${result.length} Convai voice types`);
  } else {
    console.error('Failed to fetch Convai voice types');
  }
}

async function insertConvaiLanguages() {
  // Clear existing data
  await ConvaiLanguage.deleteMany({});

  // Fetch available languages from Convai API
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
    console.log(`Inserted ${result.length} Convai languages`);
  } else {
    console.error('Failed to fetch Convai languages');
  }
}

async function seedConvaiData() {
  try {
    console.log('Seeding Convai Data...');

    await Promise.all([
      insertConvaiVoiceTypes(),
      insertConvaiLanguages()
    ]);

    console.log('Convai Data seeded.');
  } catch (error) {
    throw new Error(`Error seeding Convai Data: ${error}`);
  }
}

export default seedConvaiData;

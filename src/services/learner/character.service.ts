import convaiConfig from '../../config/convai.config';

async function getCharacterVoiceTypes() {
  return await fetch(
    `${convaiConfig.convaiApiUrl}/tts/get_available_voices`,
    {
      method: 'GET',
      headers: {
        'CONVAI-API-KEY': convaiConfig.convaiApiKey
      }
    }
  ).then(async (data) => {
    const voices = (await data.json()) as any;
    const result: {
      name: string;
      voice_value: string;
      sample_link: string;
      gender: string;
    }[] = [];

    if (voices['Convai Voices']) {
      voices['Convai Voices'].forEach((voiceObj: any) => {
        const key = Object.keys(voiceObj)[0];
        result.push({
          name: key,
          voice_value: voiceObj[key].voice_value,
          sample_link: voiceObj[key].sample_link,
          gender: voiceObj[key].gender
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
            gender: voiceObj[key].gender
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
          gender: voiceObj[key].gender
        });
      });
    }

    return result.sort((a, b) => a.name.localeCompare(b.name));
  });
}

export default {
  getCharacterVoiceTypes
};

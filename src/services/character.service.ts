import ConvaiVoiceType from '../models/convai-voice-type.model';
import ConvaiLanguage from '../models/convai-language.model';

async function getConvaiVoiceTypes() {
  return await ConvaiVoiceType.find();
}

async function getConvaiLanguages() {
  return await ConvaiLanguage.find();
}
export default {
  getConvaiVoiceTypes,
  getConvaiLanguages
};

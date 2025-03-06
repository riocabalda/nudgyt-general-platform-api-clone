import { PersonalityType } from '../models/character.model';

export function generatePrompt({
  name,
  age,
  languages,
  backstory,
  personality,
  hiddenBackstory
}: {
  name?: string;
  age?: string;
  languages: string;
  backstory?: string;
  personality?: PersonalityType;
  hiddenBackstory?: string;
}) {
  return `${name}, ${age} years old, speaks ${languages}. ${backstory}. ${hiddenBackstory}. When it comes to his personality, ${name} has an Openness score of ${personality?.openess} out of 5, with the lowest value being 0 (dislikes changes) and the highest value being 5 (likes exploring). His Meticulousness score is ${personality?.meticulousness} out of 5, with the lowest value being 0 (lets things happen) and the highest value being 5 (pays close attention to details). His Extraversion score is ${personality?.extraversion} out of 5, with the lowest value being 0 (introverted) and the highest value being 5 (extroverted). His Agreeableness score is ${personality?.agreeableness} out of 5, with the lowest value being 0 (competitive) and the highest value being 5 (agreeable). Lastly, his Sensitivity score is ${personality?.sensitivity} out of 5, with the lowest value being 0 (rarely emotional) and the highest value being 5 (highly emotional).`;
}

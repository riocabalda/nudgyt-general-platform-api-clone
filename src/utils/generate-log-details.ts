export const generateLogDetails = ({
  type,
  actor,
  target
}: {
  type: string;
  actor: string;
  target: string;
}): string => {
  return `${actor} ${type} ${target}`;
};

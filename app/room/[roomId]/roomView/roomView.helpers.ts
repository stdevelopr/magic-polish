export function createParticipantName(prefix: string) {
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `${prefix} ${suffix}`;
}

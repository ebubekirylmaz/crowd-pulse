import { randomInt } from "node:crypto";

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateRoomCode(length = 6): string {
  return Array.from(
    { length },
    () => CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)],
  ).join("");
}

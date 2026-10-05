export const TICK_HZ = 128;
export const DT = 1 / TICK_HZ;
export const INPUT_BYTES = 12;
export const enum Button { Forward=1, Back=2, Left=4, Right=8, Jump=16, Slide=32, Fire=64 }
export interface Input { seq: number; yaw: number; pitch: number; buttons: number; weapon: number; phase: number }
const TAU = Math.PI * 2;
export function yawCode(rad: number): number {
  if (!Number.isFinite(rad)) throw new Error('Non-finite yaw');
  return Math.round((((rad % TAU) + TAU) % TAU) * 65536 / TAU) & 65535;
}
export function pitchCode(rad: number): number {
  if (!Number.isFinite(rad)) throw new Error('Non-finite pitch');
  return Math.round(Math.max(-Math.PI/2, Math.min(Math.PI/2, rad)) * 32767 / (Math.PI/2));
}
export function decodeYaw(code: number): number { return code * TAU / 65536; }
export function decodePitch(code: number): number { return code * (Math.PI/2) / 32767; }
// LE wire ABI v1. phase is diagnostic sub-tick input sampling, not an authorized rewind timestamp.
export function encodeInput(input: Input, out = new ArrayBuffer(INPUT_BYTES), offset = 0): ArrayBuffer {
  if (offset < 0 || offset + INPUT_BYTES > out.byteLength) throw new Error('Input buffer bounds');
  if (!Number.isInteger(input.seq) || input.seq < 0 || input.seq > 0xffffffff ||
      !Number.isInteger(input.buttons) || input.buttons < 0 || input.buttons > 127 ||
      !Number.isInteger(input.weapon) || input.weapon < 0 || input.weapon > 1 ||
      !Number.isInteger(input.phase) || input.phase < 0 || input.phase > 65535) throw new Error('Invalid input');
  const v = new DataView(out, offset, INPUT_BYTES);
  v.setUint32(0, input.seq, true); v.setUint16(4, yawCode(input.yaw), true);
  v.setInt16(6, pitchCode(input.pitch), true); v.setUint8(8, input.buttons);
  v.setUint8(9, input.weapon); v.setUint16(10, input.phase, true); return out;
}
export function decodeInput(bytes: Uint8Array, offset=0): Input {
  if (offset < 0 || offset + INPUT_BYTES > bytes.byteLength) throw new Error('Truncated input');
  const v = new DataView(bytes.buffer, bytes.byteOffset + offset, INPUT_BYTES);
  const pitch = v.getInt16(6, true), buttons = v.getUint8(8), weapon = v.getUint8(9);
  if (pitch === -32768 || buttons > 127 || weapon > 1) throw new Error('Noncanonical input');
  return {seq:v.getUint32(0,true), yaw:decodeYaw(v.getUint16(4,true)), pitch:decodePitch(pitch),
    buttons, weapon, phase:v.getUint16(10,true)};
}
export function encodeBatch(inputs: readonly Input[]): ArrayBuffer {
  if (inputs.length < 1 || inputs.length > 8) throw new Error('Batch size');
  const out = new ArrayBuffer(4 + inputs.length * INPUT_BYTES), header = new Uint8Array(out);
  header.set([1, 1, inputs.length, 0]); // type, version, count, reserved
  inputs.forEach((x,i)=>encodeInput(x,out,4+i*INPUT_BYTES)); return out;
}
export function decodeBatch(bytes: Uint8Array): Input[] {
  if (bytes.length < 4 || bytes[0] !== 1 || bytes[1] !== 1 || bytes[3] !== 0 ||
      bytes[2] < 1 || bytes[2] > 8 || bytes.length !== 4 + bytes[2] * INPUT_BYTES) throw new Error('Invalid batch');
  return Array.from({length:bytes[2]},(_,i)=>decodeInput(bytes,4+i*INPUT_BYTES));
}
export function newer(a: number,b: number): boolean { const d=(a-b)>>>0; return d!==0 && d<0x80000000; }
export function canonical(input: Input): Input { return decodeInput(new Uint8Array(encodeInput(input))); }

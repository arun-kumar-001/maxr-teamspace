import { config } from '../config/env';
import { AesGcmFieldCipher, type FieldCipher } from './field-crypto';

let shared: FieldCipher | undefined;

/** The application's cipher, built once from the validated configuration. */
export function getFieldCipher(): FieldCipher {
  shared ??= new AesGcmFieldCipher(config.FIELD_ENCRYPTION_KEY);
  return shared;
}

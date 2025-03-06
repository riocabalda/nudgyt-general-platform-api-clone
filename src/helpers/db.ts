import mongoose, { InferSchemaType, Schema } from 'mongoose';
import dbConfig from '../config/db.config';
import encryptionService from '../services/encryption.service';

export type ProtectedField = InferSchemaType<
  typeof ProtectedFieldSchema
>;

export const ProtectedFieldSchema = new Schema({
  encrypted: { type: String, required: true },
  hash: { type: String, required: true }
});

export function encryptFieldData(value: string): ProtectedField {
  const encrypted = encryptionService.encryptAES(value);
  const hash = encryptionService.generateHashSHA256(value);

  return { encrypted, hash };
}

export function decryptFieldData(field: ProtectedField): string {
  const value = encryptionService.decryptAES(field.encrypted);

  return value;
}

async function connectDb() {
  const response = await mongoose.connect(dbConfig.mongoDbUri!, {
    dbName: dbConfig.dbName
  });

  console.log(`Connected to ${response.connection.host}.`);
}

export default connectDb;

/**
 * Stored files (sugoi File, EntityFile). Defaults: sugoi.db.File and EntityFile new().
 */
import { insert } from '../db/client.js';
import { nowSql } from './util.js';

export type FileRow = { id: number; name: string };

export async function file(input: Partial<{ id: number; name: string; data: Buffer }> = {}): Promise<FileRow> {
  const name = input.name ?? 'fichier.pdf';
  const id = await insert('File', { id: input.id, name, data: input.data ?? Buffer.from('%PDF-1.4\n%%EOF\n'), cdate: nowSql() });
  return { id, name };
}

export type EntityFileRow = { id: number; fileId: number; name: string };

/** A document or image of a group, a catalog or a vendor. `visibility` is what hx keeps in EntityFile.data. */
export async function entityFile(
  input: { entityType: 'group' | 'catalog' | 'vendor'; entityId: number } & Partial<{
    documentType: 'document' | 'media' | 'portrait';
    visibility: string | null;
    name: string;
    data: Buffer;
    /** Force the File id (the id and the key make the public link). */
    fileId: number;
  }>,
): Promise<EntityFileRow> {
  const f = await file({ id: input.fileId, name: input.name ?? 'document.pdf', data: input.data });
  const id = await insert('EntityFile', {
    entityType: input.entityType,
    documentType: input.documentType ?? 'document',
    entityId: input.entityId,
    fileId: f.id,
    data: input.visibility === undefined ? 'members' : input.visibility,
  });
  return { id, fileId: f.id, name: f.name };
}

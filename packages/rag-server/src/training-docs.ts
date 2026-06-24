/**
 * Training Documents → RAG ingestion.
 *
 * Feeds DB-backed TrainingDocument rows into the same vector store the chatbot reads, so the
 * local AI answers from operator-managed knowledge alongside the filesystem docs. Decoupled
 * from the DB: callers (the /api/training-docs route, the doc scanner) read the rows and pass
 * them in. Re-wired v2.82.x (operator: "the local AI should have all the knowledge it can").
 *
 * Note: addChunks() appends. On a NEW doc (fresh id → fresh synthetic filepath) there's no
 * duplicate. Edited docs get clean chunk sets on the next FULL rescan (scan-system-docs clears
 * + rebuilds). For immediate single-doc re-index without dupes, clear by filepath first (TODO).
 */
import { chunkDocument, type DocumentChunk } from './doc-processor';
import { addChunks } from './vector-store';

export interface TrainingDocInput {
  id: string;
  title: string;
  content: string;
  category?: string | null;
  tags?: string | null;      // JSON array string
  fileType?: string | null;
}

/** Synthetic filepath used to namespace a training doc's chunks in the vector store. */
export function trainingDocFilepath(doc: { id: string; category?: string | null; fileType?: string | null }): string {
  const cat = (doc.category || 'general').replace(/[^a-z0-9_-]/gi, '-').toLowerCase();
  return `training-documents/${cat}/${doc.id}.${doc.fileType || 'md'}`;
}

/** Chunk + embed + store the given training docs. Returns the number of chunks indexed. */
export async function indexTrainingDocs(docs: TrainingDocInput[]): Promise<number> {
  const all: DocumentChunk[] = [];
  for (const d of docs) {
    if (!d || !d.content || !d.content.trim()) continue;
    const filepath = trainingDocFilepath(d);
    // Prepend the title as a heading so it's embedded with the body (improves retrieval).
    const body = `# ${d.title}\n\n${d.content}`;
    const chunks = chunkDocument(body, filepath);
    let extraTags: string[] = ['training-docs'];
    if (d.category) extraTags.push(String(d.category).toLowerCase());
    try { if (d.tags) extraTags = extraTags.concat(JSON.parse(d.tags)); } catch { /* tags not JSON — skip */ }
    for (const c of chunks) {
      c.metadata.techTags = Array.from(new Set([...(c.metadata.techTags || []), ...extraTags]));
      if (!c.metadata.heading) c.metadata.heading = d.title;
    }
    all.push(...chunks);
  }
  if (all.length > 0) await addChunks(all);
  return all.length;
}

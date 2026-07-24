import { supabase } from "@/integrations/supabase/client";

export async function uploadFile(bucket: string, file: File, prefix = ""): Promise<string> {
  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${prefix}${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    upsert: false,
    contentType: file.type,
  });
  if (error) throw error;
  return path;
}

/** Returns a signed URL (private buckets). Cache 1h. */
export async function signedUrl(bucket: string, path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

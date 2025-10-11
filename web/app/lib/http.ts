// web/app/lib/http.ts
export async function readJsonSafe(res: Response) {
  const txt = await res.text().catch(() => "");
  let data: any = null;
  try { data = txt ? JSON.parse(txt) : null; } catch {}
  return {
    ok: res.ok,
    status: res.status,
    headers: Object.fromEntries(res.headers.entries()),
    data,
    raw: txt,
  };
}

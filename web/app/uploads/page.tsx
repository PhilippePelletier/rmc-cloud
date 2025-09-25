'use client';
import { useState } from 'react';
import toast from 'react-hot-toast';

export default function Uploads() {
  // State for form inputs
  const [kind, setKind] = useState('sales');
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);        // CSV header columns
  const [mapping, setMapping] = useState<Record<string, string>>({});  // Required field -> CSV column mapping
  const [savedMappings, setSavedMappings] = useState<Array<{id: number, name: string, mapping: Record<string, string>}>>([]);
  const [selectedMappingId, setSelectedMappingId] = useState<string>('');  // for dropdown selection
  const [mappingName, setMappingName] = useState('');         // name for saving new mapping
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  // Define the required fields for each CSV kind
  const requiredFields: { [key: string]: string[] } = {
    sales: [
      "date", "store_id", "sku", "product_name", "units", 
      "net_sales", "discount", "cost", "category", "sub_category"
    ],
    product_master: [
      "sku", "product_name", "category", "sub_category", "default_cost", "status"
    ],
    store_master: [
      "store_id", "store_name", "region", "city", "currency", "is_active"
    ],
    promo_calendar: [
      "start_date", "end_date", "promo_name", "sku", "promo_type", "discount_pct"
    ]
  };

  // Handle Kind selection change – reset file and mapping when switching CSV type
  function onKindChange(newKind: string) {
    setKind(newKind);
    // Clear any existing file/mapping because the fields will differ
    setFile(null);
    setHeaders([]);
    setMapping({});
    setSavedMappings([]);
    setSelectedMappingId('');
    setMappingName('');
    setMsg('');
  }

  // Handle File selection – read headers and fetch saved mappings
  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const newFile = e.target.files?.[0] || null;
    setFile(newFile);
    setHeaders([]);
    setMapping({});
    setSavedMappings([]);
    setSelectedMappingId('');
    setMappingName('');
    if (!newFile) return;
    // Read the first line of the CSV to get headers
    try {
      const text = await newFile.text();
      const firstLine = text.split(/\r?\n/)[0];
      const cols = firstLine.split(',').map(h => h.trim());
      setHeaders(cols);
      // Auto-map CSV columns to required fields by name (case/format-insensitive)
      const reqFields = requiredFields[kind];
      const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, ''); 
      const initialMapping: Record<string, string> = {};
      for (const field of reqFields) {
        // Find a header column that matches the field name (ignoring case, spaces, underscores, etc.)
        const match = cols.find(h => norm(h) === norm(field));
        initialMapping[field] = match || "";  // use matched column or leave blank if not found
      }
      setMapping(initialMapping);
      // Fetch any saved mappings for this kind (to allow user to apply a saved mapping)
      try {
        const res = await fetch(`/api/mappings?kind=${kind}`, { method: 'GET' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load saved mappings');
        setSavedMappings(data.mappings || []);
      } catch (err: any) {
        console.error("Failed to load saved mappings:", err.message);
        // (Non-fatal: continue without saved mappings if error occurs)
      }
    } catch (err: any) {
      toast.error("Could not read CSV headers: " + err.message);
    }
  }

  // Apply a selected saved mapping to the current mapping state
  function applySavedMapping(id: string) {
    setSelectedMappingId(id);
    if (!id) return;
    const saved = savedMappings.find(m => m.id === Number(id));
    if (saved && saved.mapping) {
      // Only apply mapping for fields present in current requiredFields
      const newMap: Record<string, string> = {};
      for (const field of requiredFields[kind]) {
        newMap[field] = saved.mapping[field] ?? ""; 
      }
      setMapping(newMap);
      // Prefill mapping name field with this mapping's name (optional)
      setMappingName(saved.name);
    }
  }

  // Delete a saved mapping by id
  async function deleteMapping(id: string) {
    if (!id) return;
    try {
      const res = await fetch(`/api/mappings?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete mapping');
      toast.success("Mapping removed");
      // Update local savedMappings list
      setSavedMappings(current => current.filter(m => m.id !== Number(id)));
      setSelectedMappingId('');
    } catch (err: any) {
      toast.error("Failed to delete mapping: " + err.message);
    }
  }

  // Save the current mapping configuration with a given name
  async function saveCurrentMapping() {
    if (!file || headers.length === 0) {
      toast.error("Upload a CSV first to save a mapping");
      return;
    }
    if (!mappingName.trim()) {
      toast.error("Please enter a name for the mapping");
      return;
    }
    // Ensure all required fields are mapped
    const reqFields = requiredFields[kind];
    const unmapped = reqFields.filter(f => !mapping[f]);
    if (unmapped.length > 0) {
      toast.error("Cannot save – the following fields are not mapped: " + unmapped.join(", "));
      return;
    }
    // Prepare payload
    const payload = { name: mappingName.trim(), kind, mapping };
    try {
      const res = await fetch('/api/mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save mapping');
      toast.success("Mapping saved");
      // Refresh saved mappings list (to include the new or updated mapping)
      const listRes = await fetch(`/api/mappings?kind=${kind}`);
      const listData = await listRes.json();
      if (listRes.ok) {
        setSavedMappings(listData.mappings || []);
        // If new mapping saved, optionally auto-select it
        const saved = listData.mappings.find((m: any) => m.name === mappingName.trim());
        if (saved) {
          setSelectedMappingId(String(saved.id));
        }
      }
    } catch (err: any) {
      toast.error("Error saving mapping: " + err.message);
    }
  }

  // Handle the file upload submission
  async function send() {
    if (!file) { 
      toast.error('Pick a CSV first'); 
      return;
    }
    // Double-check all required fields are mapped
    const reqFields = requiredFields[kind];
    const missing = reqFields.filter(f => !mapping[f] || mapping[f] === "");
    if (missing.length > 0) {
      toast.error(`Please map all fields before uploading (missing: ${missing.join(", ")})`);
      return;
    }
    setBusy(true);
    setMsg('');
    try {
      // Prepare form data with file, kind, and mapping JSON
      const fd = new FormData();
      fd.append('kind', kind);
      fd.append('file', file);
      fd.append('mapping', JSON.stringify(mapping));
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Upload failed');
      toast.success(`Queued job #${json.job_id}`);
      setMsg(JSON.stringify(json, null, 2));
      // (Optional: Reset file and mapping after successful upload)
      // setFile(null); setHeaders([]); ...
    } catch (e: any) {
      toast.error(e.message);
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  // Determine if mapping is complete (all required fields have a selection)
  const reqs = requiredFields[kind];
  const mappingComplete = reqs.every(field => mapping[field] && mapping[field] !== "");

  return (
    <main className="grid gap-4">
      <div className="card">
        <div className="h2 mb-2">Upload CSV</div>
        {/* Input form for kind and file */}
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <div className="label">Kind</div>
            <select 
              className="input" 
              value={kind} 
              onChange={e => onKindChange(e.target.value)} 
              disabled={busy}
            >
              <option value="sales">sales</option>
              <option value="product_master">product_master</option>
              <option value="store_master">store_master</option>
              <option value="promo_calendar">promo_calendar</option>
            </select>
          </div>
          <div>
            <div className="label">File</div>
            <input 
              className="input" 
              type="file" 
              accept=".csv" 
              onChange={handleFileSelect} 
              disabled={busy}
            />
          </div>
        </div>

        {/* Mapping form: shown after a file is selected (headers extracted) */}
        {headers.length > 0 && (
          <div className="mt-4 border-t pt-3">
            <div className="h3 mb-2">Map Fields</div>
            <p className="text-sm text-muted mb-3">
              Map your CSV columns to the expected fields. You can adjust any pre-filled values. 
              All listed fields are required for the <strong>{kind}</strong> CSV.
            </p>
            {/* Field mapping dropdowns */}
            {requiredFields[kind].map(field => (
              <div key={field} className="mb-2">
                <label className="label">{field}</label>
                <select 
                  className="input" 
                  value={mapping[field] || ""} 
                  onChange={e => 
                    setMapping(prev => ({ ...prev, [field]: e.target.value }))
                  } 
                  disabled={busy}
                >
                  <option value="">-- Select column --</option>
                  {headers.map(col => {
                    // Disable option if it's already used for another field
                    const isUsed = Object.values(mapping).includes(col);
                    const isCurrent = mapping[field] === col;
                    return (
                      <option key={col} value={col} disabled={!isCurrent && isUsed}>
                        {col}
                      </option>
                    );
                  })}
                </select>
              </div>
            ))}
            {/* Warning if not all fields are mapped */}
            {!mappingComplete && (
              <div className="text-red-600 text-sm mb-2">
                * Please map all required fields above.
              </div>
            )}

            {/* Saved mappings section */}
            {savedMappings.length > 0 && (
              <div className="mb-3">
                <div className="label">Saved Mappings</div>
                <div className="flex items-center gap-2">
                  <select 
                    className="input w-auto" 
                    value={selectedMappingId} 
                    onChange={e => applySavedMapping(e.target.value)} 
                    disabled={busy}
                  >
                    <option value="">-- Choose a saved mapping --</option>
                    {savedMappings.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                  {selectedMappingId && (
                    <button 
                      type="button" 
                      className="btn text-sm" 
                      onClick={() => deleteMapping(selectedMappingId)} 
                      disabled={busy}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            )}
            {/* Save current mapping */}
            <div className="mt-2 mb-4">
              <div className="flex items-center gap-2">
                <input 
                  type="text" 
                  className="input w-auto" 
                  placeholder="Mapping name" 
                  value={mappingName} 
                  onChange={e => setMappingName(e.target.value)} 
                  disabled={busy}
                />
                <button 
                  type="button" 
                  className="btn text-sm" 
                  onClick={saveCurrentMapping} 
                  disabled={busy}
                >
                  Save Mapping
                </button>
              </div>
            </div>
            {/* Upload button (enabled when mapping complete) */}
            <div className="flex justify-end">
              <button 
                className="btn" 
                onClick={send} 
                disabled={busy || !mappingComplete}
              >
                {busy ? 'Uploading…' : 'Upload'}
              </button>
            </div>
          </div>
        )}

        {/* Response message / job info */}
        {msg && <pre className="mt-4 whitespace-pre-wrap">{msg}</pre>}
      </div>

      {/* CSV templates info card (unchanged) */}
      <div className="card">
        <div className="h2 mb-2">CSV templates</div>
        <ul className="list-disc pl-6">
          <li>sales.csv — date, store_id, sku, product_name, units, net_sales, discount, cost, category, sub_category</li>
          <li>product_master.csv — sku, product_name, category, sub_category, default_cost, status</li>
          <li>store_master.csv — store_id, store_name, region, city, currency, is_active</li>
          <li>promo_calendar.csv — start_date, end_date, promo_name, sku, promo_type, discount_pct</li>
        </ul>
      </div>
    </main>
  );
}


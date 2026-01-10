'use client';
import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface ParsedCandidate {
  id: string;
  name: string;
  phone_e164: string;
  phoneRaw: string;
  phoneDisplay: string;
  roles: string[];
  driver: 'Yes' | 'No' | 'Unknown';
  dbs_update_service: 'Yes' | 'No' | 'Unknown';
  mandatory_training: 'Yes' | 'No' | 'Unknown';
  source: string;
  sourceType: 'csv' | 'cv';
  confidence: number;
  selected: boolean;
  errors: string[];
  warnings: string[];
  isDuplicate: boolean;
  duplicateOf?: string;
}

interface ExistingCandidate {
  id: string;
  name: string;
  phone_e164: string;
  org_id?: string;
}

interface ColumnMapping {
  field: string;
  label: string;
  columnIndex: number | null;
  required: boolean;
  aiConfidence?: number;
}

interface Props {
  onClose: () => void;
  onImportComplete: () => void;
}

// Smart phone format - handles ANY international number including Excel scientific notation
const formatPhone = (p: string): { formatted: string; valid: boolean; display: string } => {
  if (!p || !p.trim()) return { formatted: '', valid: false, display: '' };
  
  let input = p.trim();
  
  // Handle Excel scientific notation (4.47777E+11 = 447777000000)
  if (/^[\d.]+E\+\d+$/i.test(input)) {
    try {
      const num = parseFloat(input);
      input = Math.round(num).toString();
    } catch { }
  }
  
  // Remove all non-digit characters except leading +
  const hasPlus = input.startsWith('+');
  let digits = input.replace(/[^\d]/g, '');
  
  // Need at least 7 digits for a valid phone
  if (digits.length < 7) return { formatted: p, valid: false, display: p };
  
  // If it's too long (> 15 digits), probably invalid
  if (digits.length > 15) return { formatted: p, valid: false, display: p };
  
  // Format with + prefix
  let formatted = '+' + digits;
  
  // Create display version
  let display = formatted;
  
  // Try to format nicely based on country code
  if (digits.startsWith('44') && digits.length >= 11) {
    display = '+44 ' + digits.slice(2, 6) + ' ' + digits.slice(6, 9) + ' ' + digits.slice(9);
  } else if (digits.startsWith('1') && digits.length >= 10) {
    display = '+1 ' + digits.slice(1, 4) + ' ' + digits.slice(4, 7) + ' ' + digits.slice(7);
  } else if (digits.length >= 10) {
    const cc = digits.length > 11 ? digits.slice(0, 2) : digits.slice(0, 1);
    display = '+' + cc + ' ' + digits.slice(cc.length);
  }
  
  return { formatted, valid: true, display };
};

// Column analysis
const analyzeColumns = (headers: string[], rows: string[][]): ColumnMapping[] => {
  const fields = ['name', 'firstName', 'lastName', 'phone', 'roles', 'driver', 'dbs', 'training'];
  const labels: Record<string, string> = { 
    name: 'Full Name', firstName: 'First Name', lastName: 'Last Name', 
    phone: 'Phone', roles: 'Roles', driver: 'Driver', dbs: 'DBS', training: 'Training' 
  };
  const required = ['name', 'phone'];
  
  const patterns: Record<string, RegExp[]> = {
    name: [/^name$/i, /full.?name/i, /candidate/i], 
    firstName: [/first.?name/i, /forename/i], 
    lastName: [/last.?name/i, /surname/i],
    phone: [/phone/i, /mobile/i, /cell/i, /tel/i, /whatsapp/i], 
    roles: [/role/i, /position/i, /job/i, /title/i], 
    driver: [/driv/i, /licen[sc]e/i], 
    dbs: [/dbs/i, /crb/i, /disclosure/i],
    training: [/train/i, /certif/i, /qualif/i]
  };
  
  const assignments: Record<string, { col: number; conf: number }> = {};
  const used = new Set<number>();
  
  for (const field of fields) {
    let best = -1, bestScore = 0;
    headers.forEach((h, i) => {
      if (used.has(i)) return;
      let score = 0;
      if (patterns[field]?.some(p => p.test(h))) score += 40;
      const samples = rows.slice(0, 10).map(r => r[i] || '').filter(Boolean);
      if (field === 'phone' && samples.some(s => /^[\d\s\-\+\(\)E.]{7,}$/i.test(s.replace(/\s/g, '')))) score += 40;
      if (field === 'name' && samples.some(s => /^[A-Z][a-z]+/.test(s))) score += 30;
      if (score > bestScore) { bestScore = score; best = i; }
    });
    if (best >= 0 && bestScore >= 30) { 
      assignments[field] = { col: best, conf: bestScore }; 
      used.add(best); 
    }
  }
  
  return fields.map(f => ({ 
    field: f, 
    label: labels[f], 
    columnIndex: assignments[f]?.col ?? null, 
    required: required.includes(f), 
    aiConfidence: assignments[f]?.conf ?? 0 
  }));
};

// Duplicate check
const findDuplicate = (phone: string, existing: ExistingCandidate[]): ExistingCandidate | null => {
  if (!phone) return null;
  return existing.find(e => e.phone_e164 === phone) || null;
};

export default function CandidateImport({ onClose, onImportComplete }: Props) {
  const [step, setStep] = useState<'upload' | 'mapping' | 'review' | 'importing' | 'complete'>('upload');
  const [files, setFiles] = useState<File[]>([]);
  const [csvData, setCsvData] = useState<{ headers: string[]; rows: string[][] }>({ headers: [], rows: [] });
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
  const [candidates, setCandidates] = useState<ParsedCandidate[]>([]);
  const [existing, setExisting] = useState<ExistingCandidate[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState<{ success: number; failed: number; duplicates: number; errors: string[] } | null>(null);
  const [processing, setProcessing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Load existing candidates on mount
  useEffect(() => {
    supabase.from('candidates').select('id, name, phone_e164, org_id').then(({ data }) => { 
      if (data) setExisting(data); 
    });
  }, []);

  // Get org_id from existing candidates
  const orgId = existing.length > 0 && existing[0].org_id ? existing[0].org_id : '00000000-0000-0000-0000-000000000000';

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = Array.from(e.target.files || []);
    if (!fileList.length) return;
    setFiles(f => [...f, ...fileList]);
    setProcessing(true);
    
    for (const file of fileList) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext === 'csv') {
        const text = await file.text();
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        
        const parse = (r: string) => { 
          const v: string[] = []; 
          let c = '', q = false; 
          for (const ch of r) { 
            if (q) { 
              if (ch === '"') q = false; 
              else c += ch; 
            } else { 
              if (ch === '"') q = true; 
              else if (ch === ',') { v.push(c.trim()); c = ''; } 
              else c += ch; 
            } 
          } 
          v.push(c.trim()); 
          return v; 
        };
        
        const headers = parse(lines[0]);
        const rows = lines.slice(1).map(parse).filter(r => r.some(c => c));
        setCsvData({ headers, rows });
        setColumnMappings(analyzeColumns(headers, rows));
        setStep('mapping');
      }
    }
    setProcessing(false);
  };

  const processCandidates = () => {
    const list: ParsedCandidate[] = [];
    const seenPhones = new Set<string>();
    
    const getVal = (r: string[], f: string) => { 
      const m = columnMappings.find(x => x.field === f); 
      return m?.columnIndex != null ? (r[m.columnIndex] || '').trim() : ''; 
    };
    
    const parseYN = (v: string): 'Yes' | 'No' | 'Unknown' => { 
      const l = v.toLowerCase(); 
      if (['yes', 'y', 'true', '1'].some(x => l.includes(x))) return 'Yes'; 
      if (['no', 'n', 'false', '0'].includes(l)) return 'No'; 
      return 'Unknown'; 
    };
    
    csvData.rows.forEach((row, i) => {
      const errors: string[] = [], warnings: string[] = [];
      
      // Get name
      let name = getVal(row, 'name') || [getVal(row, 'firstName'), getVal(row, 'lastName')].filter(Boolean).join(' ');
      if (!name) errors.push('Missing name');
      
      // Get phone
      const phoneRaw = getVal(row, 'phone');
      const { formatted: phone_e164, valid, display: phoneDisplay } = formatPhone(phoneRaw);
      if (!phoneRaw) errors.push('Missing phone');
      else if (!valid) warnings.push('Phone format unclear');
      
      // Check duplicates
      let isDuplicate = false, duplicateOf: string | undefined;
      const dup = findDuplicate(phone_e164, existing);
      if (dup) { 
        isDuplicate = true; 
        duplicateOf = dup.name; 
        warnings.push(`⚠️ DUPLICATE: "${dup.name}"`); 
      } else if (phone_e164 && seenPhones.has(phone_e164)) { 
        isDuplicate = true; 
        warnings.push('Duplicate in file'); 
      }
      if (phone_e164) seenPhones.add(phone_e164);
      
      // Get roles
      const rolesRaw = getVal(row, 'roles');
      const roles = rolesRaw ? rolesRaw.split(/[,;|]/).map(r => r.trim()).filter(Boolean) : [];
      
      list.push({
        id: `csv-${i}`,
        name, 
        phone_e164, 
        phoneRaw, 
        phoneDisplay: phoneDisplay || phone_e164,
        roles,
        driver: parseYN(getVal(row, 'driver')),
        dbs_update_service: parseYN(getVal(row, 'dbs')),
        mandatory_training: parseYN(getVal(row, 'training')),
        source: files.find(f => f.name.endsWith('.csv'))?.name || 'CSV Import',
        sourceType: 'csv',
        confidence: errors.length ? 30 : 90,
        selected: !errors.length && !isDuplicate,
        errors, 
        warnings, 
        isDuplicate, 
        duplicateOf,
      });
    });
    
    setCandidates(list);
    setStep('review');
  };

  const importCandidates = async () => {
    const selected = candidates.filter(c => c.selected);
    if (!selected.length) return;
    
    setStep('importing');
    setProgress({ current: 0, total: selected.length });
    const res = { success: 0, failed: 0, duplicates: 0, errors: [] as string[] };
    
    // Import in batches of 50 for better performance
    const batchSize = 50;
    for (let i = 0; i < selected.length; i += batchSize) {
      const batch = selected.slice(i, i + batchSize);
      
      // Prepare batch insert data - ONLY columns that exist in your table
      const insertData = batch.map(c => ({
        org_id: orgId, // Use org_id from existing candidates
        name: c.name || 'Unknown',
        phone_e164: c.phone_e164 || null,
        roles: c.roles,
        driver: c.driver,
        dbs_update_service: c.dbs_update_service,
        mandatory_training: c.mandatory_training,
        source: c.source,
        status: 'new',
        // last_called_at is NOT set, so these will show as imported
      }));
      
      try {
        const { data, error } = await supabase
          .from('candidates')
          .insert(insertData)
          .select();
        
        if (error) {
          console.error('Insert error:', error);
          res.failed += batch.length;
          res.errors.push(`Batch error: ${error.message}`);
        } else {
          res.success += data?.length || 0;
          console.log(`Inserted ${data?.length} candidates`);
        }
      } catch (err: any) {
        console.error('Batch insert failed:', err);
        res.failed += batch.length;
        res.errors.push(`Error: ${err.message}`);
      }
      
      setProgress({ current: Math.min(i + batchSize, selected.length), total: selected.length });
    }
    
    setResults(res);
    setStep('complete');
  };

  const stats = useMemo(() => {
    const total = candidates.length;
    const valid = candidates.filter(c => !c.errors.length).length;
    const dups = candidates.filter(c => c.isDuplicate).length;
    const sel = candidates.filter(c => c.selected).length;
    return { total, valid, dups, sel };
  }, [candidates]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>📥 Import Candidates</h2>
          <button onClick={onClose} className="close">×</button>
        </div>
        
        <div className="steps">
          {['upload', 'mapping', 'review', 'importing', 'complete'].map((s, i) => (
            <div key={s} className={`step ${step === s ? 'active' : ''}`}>
              <span className="step-num">{i + 1}</span>
              <span>{s.charAt(0).toUpperCase() + s.slice(1)}</span>
            </div>
          ))}
        </div>

        <div className="content">
          {step === 'upload' && (
            <div className="upload-section">
              <div className="dropzone" onClick={() => fileRef.current?.click()}>
                <input ref={fileRef} type="file" accept=".csv" onChange={handleFiles} hidden />
                <div className="icon">📁</div>
                <p><strong>Drop CSV file or click to browse</strong></p>
                <p className="hint">Supports CSV files with candidate data</p>
              </div>
              
              {processing && <div className="processing">Processing file...</div>}
              
              {files.length > 0 && (
                <div className="files-list">
                  {files.map((f, i) => <div key={i} className="file">📊 {f.name}</div>)}
                </div>
              )}
              
              <div className="info-box">
                <h4>🤖 AI Features:</h4>
                <ul>
                  <li>✅ Auto-detect columns (name, phone, roles, etc.)</li>
                  <li>✅ Handle Excel scientific notation (4.47E+11)</li>
                  <li>✅ Duplicate detection</li>
                  <li>✅ Phone number validation</li>
                </ul>
              </div>
            </div>
          )}

          {step === 'mapping' && (
            <div className="mapping-section">
              <h3>🤖 Column Detection</h3>
              <p>Review and adjust column mappings:</p>
              
              <div className="mappings">
                {columnMappings.map((m, i) => (
                  <div key={m.field} className={`mapping-row ${m.required ? 'required' : ''}`}>
                    <span className="field-name">{m.label} {m.required && <span className="req">*</span>}</span>
                    <select value={m.columnIndex ?? ''} onChange={e => {
                      const newM = [...columnMappings];
                      newM[i].columnIndex = e.target.value ? parseInt(e.target.value) : null;
                      setColumnMappings(newM);
                    }}>
                      <option value="">-- Not mapped --</option>
                      {csvData.headers.map((h, j) => <option key={j} value={j}>{h}</option>)}
                    </select>
                    {m.aiConfidence ? <span className="conf">{m.aiConfidence}%</span> : null}
                  </div>
                ))}
              </div>
              
              <div className="actions">
                <button className="btn" onClick={() => setStep('upload')}>← Back</button>
                <button className="btn primary" onClick={processCandidates}>Process {csvData.rows.length} Rows →</button>
              </div>
            </div>
          )}

          {step === 'review' && (
            <div className="review-section">
              <div className="stats-row">
                <div className="stat"><div className="val">{stats.total}</div><div className="label">Total</div></div>
                <div className="stat green"><div className="val">{stats.valid}</div><div className="label">Valid</div></div>
                <div className="stat yellow"><div className="val">{stats.dups}</div><div className="label">Duplicates</div></div>
                <div className="stat blue"><div className="val">{stats.sel}</div><div className="label">Selected</div></div>
              </div>
              
              <div className="select-actions">
                <button onClick={() => setCandidates(c => c.map(x => ({ ...x, selected: !x.errors.length && !x.isDuplicate })))}>Select Valid</button>
                <button onClick={() => setCandidates(c => c.map(x => ({ ...x, selected: true })))}>Select All</button>
                <button onClick={() => setCandidates(c => c.map(x => ({ ...x, selected: false })))}>Clear</button>
              </div>
              
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th><input type="checkbox" checked={stats.sel === stats.total} onChange={e => setCandidates(c => c.map(x => ({ ...x, selected: e.target.checked })))} /></th>
                      <th>Name</th>
                      <th>Phone</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidates.slice(0, 100).map(c => (
                      <tr key={c.id} className={c.errors.length ? 'error' : c.isDuplicate ? 'dup' : ''}>
                        <td><input type="checkbox" checked={c.selected} onChange={e => setCandidates(prev => prev.map(x => x.id === c.id ? { ...x, selected: e.target.checked } : x))} /></td>
                        <td>{c.name || <em>Missing</em>}</td>
                        <td>{c.phoneDisplay || c.phoneRaw || <em>Missing</em>}</td>
                        <td>
                          {c.errors.map((e, i) => <span key={i} className="tag error">{e}</span>)}
                          {c.warnings.map((w, i) => <span key={i} className="tag warn">{w}</span>)}
                          {!c.errors.length && !c.warnings.length && <span className="tag ok">✓ Ready</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {candidates.length > 100 && <p className="more-note">Showing 100 of {candidates.length} candidates</p>}
              </div>
              
              <div className="actions">
                <button className="btn" onClick={() => setStep('mapping')}>← Back</button>
                <button className="btn primary" onClick={importCandidates} disabled={!stats.sel}>Import {stats.sel} Candidates →</button>
              </div>
            </div>
          )}

          {step === 'importing' && (
            <div className="importing">
              <div className="icon">⏳</div>
              <p>Importing {progress.current} / {progress.total}...</p>
              <div className="progress-bar"><div style={{ width: `${(progress.current / progress.total) * 100}%` }} /></div>
            </div>
          )}

          {step === 'complete' && results && (
            <div className="complete">
              <div className="icon">{results.success > 0 ? '✅' : '❌'}</div>
              <h3>Import {results.success > 0 ? 'Complete' : 'Failed'}!</h3>
              <div className="results">
                <div className="result green"><div className="val">{results.success}</div><div>Imported</div></div>
                <div className="result yellow"><div className="val">{results.duplicates}</div><div>Skipped</div></div>
                <div className="result red"><div className="val">{results.failed}</div><div>Failed</div></div>
              </div>
              {results.errors.length > 0 && (
                <div className="error-list">
                  <strong>Errors:</strong>
                  {results.errors.slice(0, 5).map((e, i) => <div key={i}>{e}</div>)}
                </div>
              )}
              <button className="btn primary" onClick={() => { onImportComplete(); onClose(); }}>Done</button>
            </div>
          )}
        </div>

        <style jsx>{`
          .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
          .modal { background: #fff; border-radius: 16px; width: 95%; max-width: 800px; max-height: 90vh; overflow: hidden; display: flex; flex-direction: column; }
          .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 20px 24px; border-bottom: 1px solid #e5e7eb; }
          .modal-header h2 { margin: 0; font-size: 20px; }
          .close { background: none; border: none; font-size: 28px; cursor: pointer; color: #6b7280; }
          .steps { display: flex; justify-content: center; gap: 8px; padding: 16px; background: #f9fafb; border-bottom: 1px solid #e5e7eb; }
          .step { display: flex; align-items: center; gap: 8px; padding: 8px 16px; border-radius: 20px; font-size: 13px; color: #9ca3af; }
          .step.active { background: #3b82f6; color: #fff; }
          .step-num { width: 24px; height: 24px; border-radius: 50%; background: currentColor; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 12px; }
          .step.active .step-num { background: #fff; color: #3b82f6; }
          .content { flex: 1; overflow-y: auto; padding: 24px; }
          .dropzone { border: 2px dashed #d1d5db; border-radius: 12px; padding: 48px; text-align: center; cursor: pointer; transition: all 0.2s; }
          .dropzone:hover { border-color: #3b82f6; background: #eff6ff; }
          .dropzone .icon { font-size: 48px; margin-bottom: 16px; }
          .dropzone .hint { color: #9ca3af; font-size: 13px; }
          .processing { text-align: center; padding: 16px; color: #3b82f6; }
          .files-list { margin: 16px 0; padding: 12px; background: #f9fafb; border-radius: 8px; }
          .file { padding: 8px; background: #fff; border-radius: 6px; margin-bottom: 4px; }
          .info-box { margin-top: 24px; padding: 16px; background: #f0fdf4; border-radius: 8px; }
          .info-box h4 { margin: 0 0 12px; color: #166534; }
          .info-box ul { margin: 0; padding-left: 20px; color: #166534; }
          .mapping-section h3 { margin: 0 0 8px; }
          .mapping-section > p { color: #6b7280; margin: 0 0 16px; }
          .mappings { display: flex; flex-direction: column; gap: 10px; }
          .mapping-row { display: flex; align-items: center; gap: 12px; padding: 10px 12px; background: #f9fafb; border-radius: 8px; }
          .mapping-row.required { background: #fef3c7; }
          .field-name { width: 120px; font-weight: 500; }
          .req { color: #dc2626; }
          .mapping-row select { flex: 1; padding: 8px; border: 1px solid #d1d5db; border-radius: 6px; }
          .conf { padding: 4px 8px; background: #dcfce7; color: #166534; border-radius: 8px; font-size: 12px; }
          .stats-row { display: flex; gap: 12px; margin-bottom: 16px; }
          .stat { flex: 1; padding: 12px; background: #f9fafb; border-radius: 8px; text-align: center; }
          .stat.green { background: #dcfce7; }
          .stat.yellow { background: #fef3c7; }
          .stat.blue { background: #dbeafe; }
          .stat .val { font-size: 24px; font-weight: 700; }
          .stat .label { font-size: 11px; color: #6b7280; }
          .select-actions { display: flex; gap: 8px; margin-bottom: 12px; }
          .select-actions button { padding: 6px 12px; background: #f3f4f6; border: none; border-radius: 6px; cursor: pointer; font-size: 12px; }
          .table-wrap { overflow-x: auto; max-height: 300px; border: 1px solid #e5e7eb; border-radius: 8px; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; }
          th, td { padding: 10px; text-align: left; border-bottom: 1px solid #e5e7eb; }
          th { background: #f9fafb; position: sticky; top: 0; font-weight: 600; }
          tr.error { background: #fef2f2; }
          tr.dup { background: #fffbeb; }
          .tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; margin-right: 4px; }
          .tag.error { background: #fee2e2; color: #991b1b; }
          .tag.warn { background: #fef3c7; color: #92400e; }
          .tag.ok { background: #dcfce7; color: #166534; }
          .more-note { text-align: center; color: #6b7280; font-size: 12px; padding: 8px; }
          .actions { display: flex; justify-content: space-between; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
          .btn { padding: 10px 20px; border-radius: 8px; font-weight: 500; cursor: pointer; border: none; background: #f3f4f6; }
          .btn.primary { background: #3b82f6; color: #fff; }
          .btn.primary:hover { background: #2563eb; }
          .btn:disabled { background: #d1d5db; cursor: not-allowed; }
          .importing, .complete { text-align: center; padding: 48px 24px; }
          .importing .icon, .complete .icon { font-size: 48px; margin-bottom: 16px; }
          .progress-bar { height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden; margin-top: 16px; }
          .progress-bar > div { height: 100%; background: #3b82f6; transition: width 0.3s; }
          .results { display: flex; justify-content: center; gap: 16px; margin: 24px 0; }
          .result { padding: 16px 24px; border-radius: 8px; text-align: center; }
          .result.green { background: #dcfce7; }
          .result.yellow { background: #fef3c7; }
          .result.red { background: #fee2e2; }
          .result .val { font-size: 28px; font-weight: 700; }
          .error-list { background: #fee2e2; padding: 12px; border-radius: 8px; margin-bottom: 16px; text-align: left; font-size: 12px; color: #991b1b; }
        `}</style>
      </div>
    </div>
  );
}

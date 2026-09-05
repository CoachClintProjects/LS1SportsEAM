'use client';

// =============================================================================
// IMPORTS - File upload for meet results (ZIP SUPPORT)
// =============================================================================

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { renderIconSync } from '@/lib/icons';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export function Imports() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ type: string; message: string; details?: any } | null>(null);
  const [importHistory, setImportHistory] = useState<any[]>([]);

  const UploadIcon = renderIconSync('upload');
  const FileTextIcon = renderIconSync('file-text');
  const CheckCircle2Icon = renderIconSync('check-circle-2');
  const AlertTriangleIcon = renderIconSync('alert-triangle');

  // Load import history
  useState(() => {
    loadImportHistory();
  }, []);

  const loadImportHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('competition_import_files')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setImportHistory(data || []);
    } catch (error) {
      console.error('Error loading import history:', error);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setUploadStatus(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setUploadStatus(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      
      // Determine if it's a zip file
      const isZip = file.name.endsWith('.zip');
      formData.append('isZip', String(isZip));

      const response = await fetch('/api/competition-import', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        let message = `✅ Successfully imported ${result.records || 0} records`;
        if (result.files) {
          message += ` from ${result.files} files`;
        }
        setUploadStatus({
          type: 'success',
          message: message,
          details: result.details
        });
        setFile(null);
        await loadImportHistory();
      } else {
        setUploadStatus({
          type: 'error',
          message: `❌ ${result.error || 'Import failed'}`,
          details: result.details
        });
      }
    } catch (error) {
      setUploadStatus({
        type: 'error',
        message: '❌ Network error - please try again',
        details: error
      });
    } finally {
      setUploading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-emerald-400/10 text-emerald-400';
      case 'failed': return 'bg-red-400/10 text-red-400';
      case 'processing': return 'bg-amber-400/10 text-amber-400';
      default: return 'bg-neutral-400/10 text-neutral-400';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  return (
    <div className="p-6 text-white">
      {/* ================================================================
           HEADER
           ================================================================ */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="text-[9px] font-black uppercase tracking-[0.24em] text-[#FA4616]">📥 Imports</div>
          <h1 className="mt-1 text-2xl font-black text-white">Data Imports</h1>
          <p className="text-sm text-neutral-400">Upload meet results, competition data, or zip archives</p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadImportHistory} className="rounded-xl border border-neutral-800 px-4 py-2 text-sm text-neutral-400 hover:border-neutral-600 hover:text-white transition-colors">
            <RefreshCw className="h-4 w-4 inline mr-2" />
            Refresh
          </button>
        </div>
      </div>

      {/* ================================================================
           UPLOAD AREA
           ================================================================ */}
      <div className={`rounded-2xl border-2 border-dashed ${file ? 'border-[#FA4616]' : 'border-neutral-800'} bg-[#090b0b] p-12 text-center transition-colors`}>
        {!file ? (
          <>
            <div className="mx-auto h-12 w-12 text-neutral-600">{UploadIcon}</div>
            <p className="mt-4 text-sm text-neutral-400">Drag and drop your file here, or click to browse</p>
            <p className="mt-1 text-xs text-neutral-500">
              Supported: .HY3, .SD3, .LIF, .EV3, .CSV, .ZIP (archives)
            </p>
            <input 
              type="file" 
              accept=".hy3,.sd3,.lif,.ev3,.csv,.zip" 
              onChange={handleFileChange} 
              className="mt-4 block w-full cursor-pointer rounded-xl border border-neutral-800 bg-black p-3 text-sm text-white file:mr-4 file:rounded-xl file:border-0 file:bg-[#FA4616] file:px-4 file:py-2 file:text-sm file:font-bold file:text-black hover:file:bg-[#FA4616]/90" 
            />
          </>
        ) : (
          <div>
            <div className="mx-auto h-12 w-12 text-[#FA4616]">
              {file.name.endsWith('.zip') ? FileTextIcon : FileTextIcon}
            </div>
            <p className="mt-4 text-sm font-bold text-white">{file.name}</p>
            <p className="text-xs text-neutral-500">{formatFileSize(file.size)}</p>
            {file.name.endsWith('.zip') && (
              <p className="mt-1 text-xs text-[#FA4616]">📦 Zip archive detected</p>
            )}
            <div className="mt-4 flex items-center justify-center gap-3">
              <button 
                onClick={handleUpload} 
                disabled={uploading} 
                className="rounded-xl bg-[#FA4616] px-6 py-2.5 text-sm font-bold text-black hover:bg-[#FA4616]/90 disabled:opacity-50 transition-colors"
              >
                {uploading ? 'Processing...' : file.name.endsWith('.zip') ? 'Extract & Import' : 'Process File'}
              </button>
              <button 
                onClick={() => setFile(null)} 
                className="rounded-xl border border-neutral-800 px-6 py-2.5 text-sm text-neutral-400 hover:border-neutral-600 hover:text-white transition-colors"
              >
                Remove
              </button>
            </div>
            {uploadStatus && (
              <div className={`mt-4 rounded-xl p-3 text-sm ${uploadStatus.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                {uploadStatus.message}
                {uploadStatus.details && (
                  <div className="mt-2 text-xs text-neutral-400">
                    {typeof uploadStatus.details === 'object' ? JSON.stringify(uploadStatus.details, null, 2) : uploadStatus.details}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ================================================================
           IMPORT HISTORY
           ================================================================ */}
      <div className="mt-6">
        <h2 className="text-sm font-bold text-white mb-3">📋 Recent Imports</h2>
        <div className="overflow-x-auto rounded-2xl border border-neutral-800 bg-[#090b0b]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-800 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                <th className="px-4 py-3">File Name</th>
                <th className="px-4 py-3">Format</th>
                <th className="px-4 py-3">Records</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {importHistory.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-neutral-500">
                    No imports yet. Upload a file to test.
                  </td>
                </tr>
              ) : (
                importHistory.map((imp) => (
                  <tr key={imp.id} className="border-b border-neutral-800/50 hover:bg-neutral-800/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-white truncate max-w-[200px]">
                      {imp.file_name || imp.source_file || '—'}
                    </td>
                    <td className="px-4 py-3 text-neutral-400">
                      {imp.format || imp.file_type || '—'}
                    </td>
                    <td className="px-4 py-3 text-neutral-400">
                      {imp.total_lines || imp.records || imp.record_count || 0}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${getStatusColor(imp.status)}`}>
                        {imp.status || 'PENDING'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-neutral-400">
                      {imp.created_at ? new Date(imp.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button className="rounded-lg px-3 py-1 text-xs font-bold text-[#FA4616] hover:bg-[#FA4616]/10 transition-colors">
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Imports;

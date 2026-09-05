'use client';

import { useState } from 'react';
import { renderIconSync } from '@/lib/icons';

export function Imports() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const UploadIcon = renderIconSync('upload');
  const FileTextIcon = renderIconSync('file-text');
  const CheckCircle2Icon = renderIconSync('check-circle-2');
  const AlertTriangleIcon = renderIconSync('alert-triangle');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = () => {
    if (!file) return;
    setUploading(true);
    setTimeout(() => {
      setUploading(false);
      setFile(null);
    }, 2000);
  };

  return (
    <div className="p-6 text-white">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="text-[9px] font-black uppercase tracking-[0.24em] text-[#FA4616]">📥 Imports</div>
          <h1 className="mt-1 text-2xl font-black text-white">Data Imports</h1>
          <p className="text-sm text-neutral-400">Import meet results, rosters, and competition data</p>
        </div>
      </div>

      <div className="rounded-2xl border-2 border-dashed border-neutral-800 bg-[#090b0b] p-12 text-center">
        {!file ? (
          <>
            <div className="mx-auto h-12 w-12 text-neutral-600">{UploadIcon}</div>
            <p className="mt-4 text-sm text-neutral-400">Drag and drop your file here, or click to browse</p>
            <p className="mt-1 text-xs text-neutral-500">Supported formats: .HY3, .SD3, .LIF, .EV3, .CSV</p>
            <input type="file" accept=".hy3,.sd3,.lif,.ev3,.csv" onChange={handleFileChange} className="mt-4 block w-full cursor-pointer rounded-xl border border-neutral-800 bg-black p-3 text-sm text-white file:mr-4 file:rounded-xl file:border-0 file:bg-[#FA4616] file:px-4 file:py-2 file:text-sm file:font-bold file:text-black hover:file:bg-[#FA4616]/90" />
          </>
        ) : (
          <div>
            <div className="mx-auto h-12 w-12 text-[#FA4616]">{FileTextIcon}</div>
            <p className="mt-4 text-sm font-bold text-white">{file.name}</p>
            <p className="text-xs text-neutral-500">{(file.size / 1024).toFixed(2)} KB</p>
            <div className="mt-4 flex items-center justify-center gap-3">
              <button onClick={handleUpload} disabled={uploading} className="rounded-xl bg-[#FA4616] px-6 py-2.5 text-sm font-bold text-black hover:bg-[#FA4616]/90 disabled:opacity-50 transition-colors">
                {uploading ? 'Uploading...' : 'Process File'}
              </button>
              <button onClick={() => setFile(null)} className="rounded-xl border border-neutral-800 px-6 py-2.5 text-sm text-neutral-400 hover:border-neutral-600 hover:text-white transition-colors">Remove</button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-neutral-800 bg-[#090b0b] p-4">
          <div className="flex items-center gap-2">
            <div className="text-emerald-400">{CheckCircle2Icon}</div>
            <div>
              <div className="text-sm font-bold text-white">Last Import</div>
              <div className="text-xs text-neutral-500">Spring Meet Results · 2 hours ago</div>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-neutral-800 bg-[#090b0b] p-4">
          <div className="flex items-center gap-2">
            <div className="text-amber-400">{AlertTriangleIcon}</div>
            <div>
              <div className="text-sm font-bold text-white">Import History</div>
              <div className="text-xs text-neutral-500">12 successful · 3 failed</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Imports;

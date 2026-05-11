import React, { useState, useMemo, useEffect } from 'react';
import { Copy, Edit2, Check, X, Trash2 } from 'lucide-react';
import { JobData } from '../types';

export const AutoDebitNote = ({ jobs }: { jobs: JobData[] }) => {
  const [job, setJob] = useState("");
  const [cont20, setCont20] = useState<number | "">("");
  const [cont40, setCont40] = useState<number | "">("");
  const [vat, setVat] = useState("8");
  const [transit, setTransit] = useState("HCM");
  const [vessel, setVessel] = useState("");
  const [pol, setPol] = useState("");
  const [pod, setPod] = useState("");

  const [priceOverrides, setPriceOverrides] = useState<Record<string, number>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [deletedRowIds, setDeletedRowIds] = useState<Set<string>>(new Set());

  // Auto-fill cont20 and cont40 if job exists
  useEffect(() => {
    if (job && jobs) {
        const foundJob = jobs.find(j => j.jobCode === job);
        if (foundJob) {
            setCont20(foundJob.cont20 || 0);
            setCont40(foundJob.cont40 || 0);
            if (foundJob.transit) setTransit(foundJob.transit);
        }
    }
  }, [job, jobs]);

  const jobCode = useMemo(() => {
    if (!job) return "";
    const current = new Date();
    const yy = current.getFullYear().toString().slice(-2);
    const mm = (current.getMonth() + 1).toString().padStart(2, '0');
    return `K${yy}${mm}${job}`;
  }, [job]);

  const rows = useMemo(() => {
        if (!job || (!cont20 && !cont40) || !transit) return [];

        const c20 = Number(cont20) || 0;
        const c40 = Number(cont40) || 0;
        const vatRate = Number(vat);
        
        const result: any[] = [];
        
        const getPrice = (key: string, defaultPrice: number) => {
            return priceOverrides[key] !== undefined ? priceOverrides[key] : defaultPrice;
        };

        // DO is shared
        const doKey = "DO phí_Bộ";
        const doPrice = getPrice(doKey, 1150000);
        result.push({
            id: doKey,
            fee: "DO phí",
            price: doPrice,
            unit: "Bộ",
            quantity: 1,
            vat: vatRate,
            total: doPrice * 1 * (1 + vatRate / 100),
            jobCode: jobCode
        });

        if (c20 > 0) {
            const thc = 3700000;
            const cln = 400000;
            const emc = 770000;
            const cic = transit === 'HCM' ? 1300000 : 3300000;

            const unit = (c20 > 0 && c40 > 0) ? "Cont 20'" : "Cont";

            const pushFee = (feeName: string, defaultPrice: number) => {
                const key = `${feeName}_${unit}`;
                const rp = getPrice(key, defaultPrice);
                result.push({
                    id: key,
                    fee: feeName,
                    price: rp,
                    unit: unit,
                    quantity: c20,
                    vat: vatRate,
                    total: rp * c20 * (1 + vatRate / 100),
                    jobCode
                });
            };

            pushFee("THC", thc);
            pushFee("Cleaning container fee", cln);
            pushFee("EMC FEE", emc);
            pushFee("CIC", cic);
        }

        if (c40 > 0) {
            const thc = 5500000;
            const cln = 520000;
            const emc = 1150000;
            const cic = transit === 'HCM' ? 2600000 : 6600000;

            const unit = (c20 > 0 && c40 > 0) ? "Cont 40'" : "Cont";

            const pushFee = (feeName: string, defaultPrice: number) => {
                const key = `${feeName}_${unit}`;
                const rp = getPrice(key, defaultPrice);
                result.push({
                    id: key,
                    fee: feeName,
                    price: rp,
                    unit: unit,
                    quantity: c40,
                    vat: vatRate,
                    total: rp * c40 * (1 + vatRate / 100),
                    jobCode
                });
            };

            pushFee("THC", thc);
            pushFee("Cleaning container fee", cln);
            pushFee("EMC FEE", emc);
            pushFee("CIC", cic);
        }

        const baseRows =  result;
        return baseRows.filter(r => !deletedRowIds.has(r.id));
  }, [jobCode, cont20, cont40, vat, transit, job, priceOverrides, deletedRowIds]);

  const handleCopyColumn = (field: string) => {
      if (rows.length === 0) return;
      let text = "";
      if (field === 'vat') {
          text = rows.map(r => `${r.vat}%`).join('\n');
      } else if (field === 'group') {
          text = rows.map(r => `${r.unit}\t${r.quantity}\t${r.price}`).join('\n');
      } else {
          text = rows.map(r => r[field]).join('\n');
      }
      navigator.clipboard.writeText(text);
  };

  const handleCopyJobString = () => {
      if (!job) return;
      navigator.clipboard.writeText(`BILL ${job}`);
  };

  const handleCopyNote = () => {
      const text = `Vessel/Voy: ${vessel || '...'}\nPOL: ${pol || '...'}\nPOD: ${pod || '...'}`;
      navigator.clipboard.writeText(text);
  };

  const handleEditStart = (id: string, price: number) => {
      setEditingId(id);
      setEditValue(price.toString());
  };

  const handleEditSave = (id: string) => {
      const val = parseInt(editValue.replace(/[^0-9]/g, ''));
      if (!isNaN(val)) {
          setPriceOverrides(prev => ({ ...prev, [id]: val }));
      }
      setEditingId(null);
  };

  const handleDeleteRow = (id: string) => {
      setDeletedRowIds(prev => {
          const next = new Set(prev);
          next.add(id);
          return next;
      });
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold">Debit Note Lập Bảng Tự Động</h1>
        
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 grid grid-cols-1 md:grid-cols-4 gap-4 flex-wrap">
            <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700 flex justify-between items-center">
                    Số Job
                    {job && (
                        <button onClick={handleCopyJobString} className="text-teal-600 hover:text-teal-800" title="Copy BILL + Số Job">
                            <Copy className="w-3.5 h-3.5" />
                        </button>
                    )}
                </label>
                <input className="w-full px-3 py-2 border border-slate-300 rounded-md outline-none focus:border-teal-500" value={job} onChange={e => setJob(e.target.value)} placeholder="Nhập số job..." />
            </div>
            <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Cont 20</label>
                <input className="w-full px-3 py-2 border border-slate-300 rounded-md outline-none focus:border-teal-500" type="number" min="0" value={cont20} onChange={e => setCont20(e.target.value ? parseInt(e.target.value) : "")} placeholder="Số lượng cont 20" />
            </div>
            <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Cont 40</label>
                <input className="w-full px-3 py-2 border border-slate-300 rounded-md outline-none focus:border-teal-500" type="number" min="0" value={cont40} onChange={e => setCont40(e.target.value ? parseInt(e.target.value) : "")} placeholder="Số lượng cont 40" />
            </div>
            <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">VAT</label>
                <select className="w-full px-3 py-2 border border-slate-300 rounded-md outline-none focus:border-teal-500 bg-white" value={vat} onChange={e => setVat(e.target.value)}>
                    <option value="8">8%</option>
                    <option value="0">0%</option>
                </select>
            </div>
            <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Transit</label>
                <select className="w-full px-3 py-2 border border-slate-300 rounded-md outline-none focus:border-teal-500 bg-white" value={transit} onChange={e => setTransit(e.target.value)}>
                    <option value="HCM">HCM</option>
                    <option value="HPH">HPH</option>
                </select>
            </div>
            <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Vessel/Voy</label>
                <input className="w-full px-3 py-2 border border-slate-300 rounded-md outline-none focus:border-teal-500" value={vessel} onChange={e => setVessel(e.target.value)} placeholder="Vessel/Voy..." />
            </div>
            <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">POL</label>
                <input className="w-full px-3 py-2 border border-slate-300 rounded-md outline-none focus:border-teal-500" value={pol} onChange={e => setPol(e.target.value)} placeholder="POL..." />
            </div>
            <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">POD</label>
                <input className="w-full px-3 py-2 border border-slate-300 rounded-md outline-none focus:border-teal-500" value={pod} onChange={e => setPod(e.target.value)} placeholder="POD..." />
            </div>
        </div>

        {rows.length > 0 && (
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Bảng Tính Fee</h2>
                </div>
                
                <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto shadow-sm">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 border-b border-gray-200 text-slate-600 uppercase text-xs">
                            <tr>
                                <th className="p-3 font-semibold">
                                    <div className="flex items-center gap-2">
                                        Fee
                                        <button onClick={() => handleCopyColumn('fee')} className="text-teal-600 hover:text-teal-800" title="Copy cột Fee"><Copy className="w-3.5 h-3.5" /></button>
                                    </div>
                                </th>
                                <th className="p-3 text-center font-semibold">
                                    <div className="flex items-center justify-center gap-2">
                                        ĐVT
                                        <button onClick={() => handleCopyColumn('unit')} className="text-teal-600 hover:text-teal-800" title="Copy cột ĐVT"><Copy className="w-3.5 h-3.5" /></button>
                                    </div>
                                </th>
                                <th className="p-3 text-center font-semibold">
                                    <div className="flex items-center justify-center gap-2">
                                        SL
                                        <button onClick={() => handleCopyColumn('quantity')} className="text-teal-600 hover:text-teal-800" title="Copy cột Số lượng"><Copy className="w-3.5 h-3.5" /></button>
                                    </div>
                                </th>
                                <th className="p-3 text-right font-semibold">
                                    <div className="flex items-center justify-end gap-2">
                                        Đơn giá
                                        <button onClick={() => handleCopyColumn('price')} className="text-teal-600 hover:text-teal-800" title="Copy cột Đơn giá"><Copy className="w-3.5 h-3.5" /></button>
                                    </div>
                                </th>
                                <th className="p-3 text-center font-semibold">
                                    <div className="flex items-center justify-center gap-2">
                                        VAT
                                        <button onClick={() => handleCopyColumn('vat')} className="text-teal-600 hover:text-teal-800" title="Copy cột VAT"><Copy className="w-3.5 h-3.5" /></button>
                                    </div>
                                </th>
                                <th className="p-3 text-right font-semibold">
                                    <div className="flex items-center justify-end gap-2">
                                        Thành tiền (Thuế)
                                        <button onClick={() => handleCopyColumn('total')} className="text-teal-600 hover:text-teal-800" title="Copy cột Thành tiền"><Copy className="w-3.5 h-3.5" /></button>
                                    </div>
                                </th>
                                <th className="p-3 font-semibold">
                                    <div className="flex items-center gap-2">
                                        Công trình
                                        <button onClick={() => handleCopyColumn('jobCode')} className="text-teal-600 hover:text-teal-800" title="Copy cột Công trình"><Copy className="w-3.5 h-3.5" /></button>
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {rows.map((r) => (
                                <tr key={r.id} className="hover:bg-slate-50 transition-colors group">
                                    <td className="p-3 font-medium text-slate-800">{r.fee}</td>
                                    <td className="p-3 text-center text-slate-600">{r.unit}</td>
                                    <td className="p-3 text-center text-slate-600">{r.quantity}</td>
                                    <td className="p-3 text-right text-slate-600">
                                        {editingId === r.id ? (
                                            <div className="flex items-center justify-end gap-2">
                                                <input 
                                                    autoFocus
                                                    type="text" 
                                                    className="w-24 px-2 py-1 border border-teal-500 rounded text-right outline-none text-sm" 
                                                    value={editValue} 
                                                    onChange={e => setEditValue(e.target.value)}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') handleEditSave(r.id);
                                                        if (e.key === 'Escape') handleEditCancel();
                                                    }}
                                                />
                                                <div className="flex flex-col gap-0.5">
                                                    <button onClick={() => handleEditSave(r.id)} className="text-teal-600 hover:bg-teal-50 p-0.5 rounded"><Check className="w-3.5 h-3.5" /></button>
                                                    <button onClick={handleEditCancel} className="text-gray-400 hover:bg-gray-100 p-0.5 rounded"><X className="w-3.5 h-3.5" /></button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-end gap-2">
                                                <span>{r.price.toLocaleString('vi-VN')}</span>
                                                <button onClick={() => handleEditStart(r.id, r.price)} className="text-gray-400 hover:text-teal-600 opacity-0 group-hover:opacity-100 transition-opacity" title="Sửa đơn giá">
                                                    <Edit2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-3 text-center text-slate-600">{r.vat}%</td>
                                    <td className="p-3 text-right font-bold text-slate-800">{r.total.toLocaleString('vi-VN')}</td>
                                    <td className="p-3 text-gray-500 font-mono text-xs">{r.jobCode}</td>
                                    <td className="p-3 text-center">
                                        <button onClick={() => handleDeleteRow(r.id)} className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors" title="Xóa dòng">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="flex justify-end">
                    <div className="text-red-600 font-bold text-lg bg-red-50 px-4 py-2 rounded-lg border border-red-100 inline-block">
                        Tổng cộng: {rows.reduce((sum, r) => sum + r.total, 0).toLocaleString('vi-VN')}
                    </div>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 space-y-2 mt-4 text-sm text-yellow-800 shadow-sm">
                    <div className="flex items-center justify-between border-b border-yellow-200/60 pb-2 mb-2">
                        <span className="font-semibold text-yellow-900 uppercase text-xs tracking-wider">Note</span>
                        <button onClick={handleCopyNote} className="text-yellow-700 hover:text-yellow-900" title="Copy Note">
                            <Copy className="w-4 h-4" />
                        </button>
                    </div>
                    <p><strong>Vessel/Voy:</strong> {vessel || '...'}</p>
                    <p><strong>POL:</strong> {pol || '...'}</p>
                    <p><strong>POD:</strong> {pod || '...'}</p>
                </div>
            </div>
        )}
    </div>
  );
};

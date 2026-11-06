import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Copy, Edit2, Check, X, Trash2, FileText, ChevronDown, Eye, ExternalLink } from 'lucide-react';
import { JobData, Customer } from '../types';
import { MONTHS, YEARS } from '../constants';
import { useNotification } from '../contexts/NotificationContext';
import { DebitNotePreviewModal } from '../components/DebitNotePreviewModal';
import { lookupCompanyTaxInfo } from '../utils';

interface AutoDebitNoteProps {
  jobs: JobData[];
  customers?: Customer[];
  onEditJob?: (job: JobData) => void;
}

export const AutoDebitNote = ({ jobs, customers, onEditJob }: AutoDebitNoteProps) => {
  const { alert: showAlert } = useNotification();
  const currentYear = new Date().getFullYear();
  const currentMonth = (new Date().getMonth() + 1).toString();

  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth);

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

  // Modal Preview A4 state
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Checkbox states for Fee table
  const [ppCic, setPpCic] = useState(false);
  const [dgCic, setDgCic] = useState(false);
  const [pcsFee, setPcsFee] = useState(false);

  const handleToggleDg = (checked: boolean) => {
    setDgCic(checked);
    if (checked) {
      setPriceOverrides((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((k) => {
          if (k.startsWith("CIC_")) delete next[k];
        });
        return next;
      });
    }
  };

  // Filter jobs in selected month & year that have no Amount in Thu (Invoices)
  const eligibleJobs = useMemo(() => {
    if (!jobs || !Array.isArray(jobs)) return [];
    return jobs.filter((j) => {
      const matchYear = selectedYear ? Number(j.year) === Number(selectedYear) : true;
      const matchMonth = selectedMonth ? String(j.month) === String(selectedMonth) : true;
      const hasNoAmount = !j.localChargeTotal || Number(j.localChargeTotal) === 0;
      return matchYear && matchMonth && hasNoAmount;
    }).sort((a, b) => {
      const codeA = String(a.jobCode || '');
      const codeB = String(b.jobCode || '');
      return codeA.localeCompare(codeB);
    });
  }, [jobs, selectedYear, selectedMonth]);

  const [showJobList, setShowJobList] = useState(false);
  const jobDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (jobDropdownRef.current && !jobDropdownRef.current.contains(event.target as Node)) {
        setShowJobList(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredEligibleJobs = useMemo(() => {
    if (!job) return eligibleJobs;
    const q = job.toLowerCase();
    return eligibleJobs.filter(j => 
      j.jobCode?.toLowerCase().includes(q) || 
      j.customerName?.toLowerCase().includes(q)
    );
  }, [eligibleJobs, job]);

  // Tax lookup state
  const [taxCode, setTaxCode] = useState("");
  const [taxName, setTaxName] = useState("");
  const [taxAddress, setTaxAddress] = useState("");
  const [isLookingUpTax, setIsLookingUpTax] = useState(false);

  const [emailExtractInput, setEmailExtractInput] = useState("");
  const [emailExtractOutput, setEmailExtractOutput] = useState("");

  // Auto-fill cont20 and cont40 if job exists
  useEffect(() => {
    if (job && jobs) {
        const foundJob = jobs.find(j => j.jobCode === job);
        if (foundJob) {
            setCont20(foundJob.cont20 || 0);
            setCont40(foundJob.cont40 || 0);
            if (foundJob.transit) setTransit(foundJob.transit);
        } else {
            setCont20("");
            setCont40("");
            setTransit("");
        }
    } else if (!job) {
        setCont20("");
        setCont40("");
        setTransit("HCM"); // default when no job is typed
    }
  }, [job, jobs]);

  const jobCode = useMemo(() => {
    if (!job) return "";
    const current = new Date();
    const yy = current.getFullYear().toString().slice(-2);
    const mm = (current.getMonth() + 1).toString().padStart(2, '0');
    return `K${yy}${mm}${job}`;
  }, [job]);

  const matchedJob = useMemo(() => {
    if (!job || !jobs) return null;
    return jobs.find((j) => j.jobCode === job || j.jobCode === jobCode);
  }, [job, jobCode, jobs]);

  const matchedCustomer = useMemo(() => {
    if (!customers || !matchedJob) return null;
    return customers.find(c => c.id === matchedJob.customerId || c.code === matchedJob.customerId || c.name === matchedJob.customerName) || null;
  }, [customers, matchedJob]);

  const fetchAddressForTaxCode = async (code: string) => {
    const cleanCode = code ? code.trim() : '';
    if (!cleanCode || cleanCode.length < 8) return;
    try {
      setIsLookingUpTax(true);
      const info = await lookupCompanyTaxInfo(cleanCode);
      if (info && info.address) {
        setTaxAddress(info.address);
        if (info.name && !taxName) {
          setTaxName(info.name);
        }
      }
    } catch {
      // Non-blocking: silent catch
    } finally {
      setIsLookingUpTax(false);
    }
  };

  // Luôn tự động lấy Tên đơn vị và Mã số thuế từ thông tin Khách hàng (KH) của Job
  useEffect(() => {
    if (matchedJob) {
      const cust = matchedCustomer || (customers && customers.find(c => 
        (matchedJob.customerId && (c.id === matchedJob.customerId || c.code === matchedJob.customerId)) || 
        (matchedJob.customerName && c.name?.trim().toLowerCase() === matchedJob.customerName.trim().toLowerCase())
      ));

      const newTaxCode = cust?.mst || '';
      const newTaxName = cust?.name || matchedJob.customerName || '';

      setTaxCode(newTaxCode);
      setTaxName(newTaxName);

      // Thử tự động tra cứu địa chỉ nếu có MST
      if (newTaxCode) {
        fetchAddressForTaxCode(newTaxCode);
      } else {
        setTaxAddress('');
      }
    } else if (!job) {
      setTaxCode('');
      setTaxName('');
      setTaxAddress('');
    }
  }, [matchedJob, matchedCustomer, customers]);

  const displayJobCode = useMemo(() => {
    if (!job) return "";
    if (matchedJob) return matchedJob.jobCode;
    if (job.startsWith("K") || job.startsWith("JOB") || job.includes("-"))
      return job;
    return jobCode;
  }, [job, matchedJob, jobCode]);

  const rows = useMemo(() => {
    if (!job || (!cont20 && !cont40) || !transit) return [];

    const c20 = Number(cont20) || 0;
    const c40 = Number(cont40) || 0;
    const vatRate = Number(vat);

    const result: any[] = [];

    const getPrice = (key: string, defaultPrice: number) => {
      return priceOverrides[key] !== undefined
        ? priceOverrides[key]
        : defaultPrice;
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
      jobCode: displayJobCode,
    });

    if (c20 > 0) {
      const thc = 3700000;
      const cln = 400000;
      const emc = 770000;
      const cic = dgCic ? 0 : (transit === "HCM" ? 1300000 : 3300000);

      const unit = c20 > 0 && c40 > 0 ? "Cont 20'" : "Cont";

      const pushFee = (feeName: string, defaultPrice: number, customUnit?: string) => {
        const u = customUnit || unit;
        const key = customUnit && c20 > 0 && c40 > 0 ? `${feeName}_${u}_20` : `${feeName}_${u}`;
        const rp = getPrice(key, defaultPrice);
        result.push({
          id: key,
          fee: feeName,
          price: rp,
          unit: u,
          quantity: c20,
          vat: vatRate,
          total: rp * c20 * (1 + vatRate / 100),
          jobCode: displayJobCode,
        });
      };

      pushFee("THC", thc);
      pushFee("Cleaning container fee", cln);
      pushFee("EMC FEE", emc);
      if (!ppCic) {
        pushFee("CIC", cic);
      }
      if (pcsFee) {
        pushFee("PCS FEE", 1318050, "Cont");
      }
    }

    if (c40 > 0) {
      const thc = 5500000;
      const cln = 520000;
      const emc = 1150000;
      const cic = dgCic ? 0 : (transit === "HCM" ? 2600000 : 6600000);

      const unit = c20 > 0 && c40 > 0 ? "Cont 40'" : "Cont";

      const pushFee = (feeName: string, defaultPrice: number, customUnit?: string) => {
        const u = customUnit || unit;
        const key = customUnit && c20 > 0 && c40 > 0 ? `${feeName}_${u}_40` : `${feeName}_${u}`;
        const rp = getPrice(key, defaultPrice);
        result.push({
          id: key,
          fee: feeName,
          price: rp,
          unit: u,
          quantity: c40,
          vat: vatRate,
          total: rp * c40 * (1 + vatRate / 100),
          jobCode: displayJobCode,
        });
      };

      pushFee("THC", thc);
      pushFee("Cleaning container fee", cln);
      pushFee("EMC FEE", emc);
      if (!ppCic) {
        pushFee("CIC", cic);
      }
      if (pcsFee) {
        pushFee("PCS FEE", 2632100, "Cont");
      }
    }

    const baseRows = result;
    return baseRows.filter((r) => !deletedRowIds.has(r.id));
  }, [
    displayJobCode,
    cont20,
    cont40,
    vat,
    transit,
    job,
    priceOverrides,
    deletedRowIds,
    ppCic,
    dgCic,
    pcsFee,
  ]);

  const currentTotal = useMemo(() => rows.reduce((sum, r) => sum + r.total, 0), [rows]);

  const showUpdateButton = useMemo(() => {
    if (!matchedJob || currentTotal === 0) return false;
    const existingAmount = Number(matchedJob.localChargeTotal) || 0;
    // Hiển thị nút Update nếu Job chưa có Amount HOẶC số tiền hiện tại khác với Amount có sẵn
    return existingAmount === 0 || currentTotal !== existingAmount;
  }, [matchedJob, currentTotal]);

  const handleUpdateJobAmount = () => {
    if (!matchedJob || !onEditJob) return;
    const grandTotal = currentTotal;
    const rate = Number(vat);
    const net = grandTotal / (1 + rate / 100);
    const vatAmount = grandTotal - net;

    const updated: JobData = {
      ...matchedJob,
      localChargeTotal: grandTotal,
      localChargeNet: Math.round(net),
      localChargeVat: Math.round(vatAmount),
    };
    onEditJob(updated);
    if (showAlert) {
      showAlert(
        `Đã cập nhật tổng tiền thu ${grandTotal.toLocaleString("vi-VN")} VND vào phần Amount của Job ${matchedJob.jobCode} thành công!`,
      );
    } else {
      alert(
        `Đã cập nhật tổng tiền thu ${grandTotal.toLocaleString("vi-VN")} VND vào phần Amount của Job ${matchedJob.jobCode} thành công!`,
      );
    }
  };

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
    const codeToCopy = displayJobCode || job;
    if (!codeToCopy) return;
    navigator.clipboard.writeText(`BILL ${codeToCopy}`);
  };

  const handleCopyNote = () => {
      const text = `Vessel/Voy: ${vessel || '...'}\nPOL: ${pol || '...'}\nPOD: ${pod || '...'}`;
      navigator.clipboard.writeText(text);
  };

  const handleLookupTax = async () => {
      if (!taxCode) return;
      setIsLookingUpTax(true);
      try {
          const info = await lookupCompanyTaxInfo(taxCode.trim());
          if (info && info.address) {
              setTaxAddress(info.address);
              if (info.name) setTaxName(info.name);
          } else {
              window.open(`https://masothue.com/Search/?q=${encodeURIComponent(taxCode.trim())}`, '_blank');
          }
      } catch (err) {
          console.error("Lỗi tra cứu MST", err);
          window.open(`https://masothue.com/Search/?q=${encodeURIComponent(taxCode.trim())}`, '_blank');
      } finally {
          setIsLookingUpTax(false);
      }
  };

  const handleCopyTaxAddress = () => {
      if (!taxAddress) return;
      navigator.clipboard.writeText(taxAddress);
  };

  const handleOpenMasothue = () => {
      if (!taxCode) return;
      window.open(`https://masothue.com/Search/?q=${taxCode}`, '_blank');
  };

  const handleExtractEmails = (text: string) => {
      setEmailExtractInput(text);
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const foundEmails = text.match(emailRegex);
      if (foundEmails) {
          const uniqueEmails = Array.from(new Set(foundEmails.map(e => e.toLowerCase())));
          setEmailExtractOutput(uniqueEmails.join("; "));
      } else {
          setEmailExtractOutput("");
      }
  };

  const handleCopyEmails = () => {
      if (!emailExtractOutput) return;
      navigator.clipboard.writeText(emailExtractOutput);
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

  const handleEditCancel = () => {
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <FileText className="w-6 h-6 text-teal-600" />
            Debit Note Lập Bảng Tự Động
          </h1>
        </div>
        
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 space-y-4">
            {/* Hàng 1: Tháng / Năm, Cont 20, Cont 40, VAT, Transit */}
            {/* Hàng 1: Tháng / Năm, Cont 20 + Cont 40 + VAT, Transit */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                {/* Tháng / Năm (md:col-span-3 - kích thước bằng ô Số Job) */}
                <div className="md:col-span-3 space-y-1">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                      Tháng / Năm
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <select
                        className="w-full px-2.5 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-teal-500 bg-white text-sm font-medium"
                        value={selectedMonth}
                        onChange={(e) => {
                          setSelectedMonth(e.target.value);
                          setJob("");
                        }}
                      >
                        {MONTHS.map((m) => (
                          <option key={m.value} value={m.value}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                      <select
                        className="w-full px-2.5 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-teal-500 bg-white text-sm font-medium"
                        value={selectedYear}
                        onChange={(e) => {
                          setSelectedYear(Number(e.target.value));
                          setJob("");
                        }}
                      >
                        {YEARS.map((y) => (
                          <option key={y} value={y}>
                            {y}
                          </option>
                        ))}
                      </select>
                    </div>
                </div>

                {/* Nhóm: Cont 20 + Cont 40 + VAT (md:col-span-7 - kích thước bằng Vessel/Voy + POL) */}
                <div className="md:col-span-7 grid grid-cols-3 gap-4">
                    {/* Cont 20 */}
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Cont 20</label>
                        <input 
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-teal-500 text-sm" 
                          type="number" 
                          min="0" 
                          value={cont20} 
                          onChange={e => setCont20(e.target.value ? parseInt(e.target.value) : "")} 
                          placeholder="SL 20" 
                        />
                    </div>

                    {/* Cont 40 */}
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Cont 40</label>
                        <input 
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-teal-500 text-sm" 
                          type="number" 
                          min="0" 
                          value={cont40} 
                          onChange={e => setCont40(e.target.value ? parseInt(e.target.value) : "")} 
                          placeholder="SL 40" 
                        />
                    </div>

                    {/* VAT */}
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">VAT</label>
                        <select 
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-teal-500 bg-white text-sm" 
                          value={vat} 
                          onChange={e => setVat(e.target.value)}
                        >
                            <option value="8">8%</option>
                            <option value="0">0%</option>
                        </select>
                    </div>
                </div>

                {/* Transit (md:col-span-2 - kích thước bằng POD) */}
                <div className="md:col-span-2 space-y-1">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Transit</label>
                    <select 
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-teal-500 bg-white text-sm" 
                      value={transit} 
                      onChange={e => setTransit(e.target.value)}
                    >
                        <option value="">-- Chọn --</option>
                        <option value="HCM">HCM</option>
                        <option value="HPH">HPH</option>
                    </select>
                </div>
            </div>

            {/* Hàng 2: Số Job, Vessel/Voy + POL, POD */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end pt-1">
                {/* Số Job (md:col-span-3 - kích thước bằng Tháng / Năm) */}
                <div className="md:col-span-3 space-y-1 relative" ref={jobDropdownRef}>
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider flex justify-between items-center">
                        <span>Số Job</span>
                        {job && (
                            <button 
                              type="button"
                              onClick={handleCopyJobString} 
                              className="text-teal-600 hover:text-teal-800 flex items-center gap-1 text-[11px] font-medium" 
                              title="Copy BILL + Số Job"
                            >
                                <Copy className="w-3 h-3" />
                                BILL {displayJobCode || job}
                            </button>
                        )}
                    </label>
                    <div className="relative">
                      <input 
                        type="text"
                        className="w-full px-3 py-2 pr-12 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-teal-500 text-sm font-medium bg-white" 
                        value={job} 
                        onChange={e => {
                          const val = e.target.value;
                          setJob(val);
                          const found = jobs.find(j => j.jobCode === val);
                          if (found) {
                            setCont20(found.cont20 || 0);
                            setCont40(found.cont40 || 0);
                            if (found.transit) setTransit(found.transit);
                          }
                        }} 
                        onFocus={() => {
                          if (eligibleJobs.length > 0) setShowJobList(true);
                        }}
                        placeholder="Nhập số job..." 
                      />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        {job && (
                          <button
                            type="button"
                            onClick={() => {
                              setJob("");
                              setShowJobList(false);
                            }}
                            className="text-slate-400 hover:text-slate-600 p-0.5"
                            title="Xóa ô Số Job"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {eligibleJobs.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setShowJobList(!showJobList)}
                            className="text-slate-400 hover:text-slate-700 p-0.5 rounded transition-colors"
                            title="Danh sách Job trong tháng"
                          >
                            <ChevronDown className={`w-4 h-4 transition-transform duration-150 ${showJobList ? 'rotate-180' : ''}`} />
                          </button>
                        )}
                      </div>

                      {showJobList && eligibleJobs.length > 0 && (
                        <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-56 overflow-y-auto bg-white rounded-lg shadow-xl border border-slate-200 py-1 divide-y divide-slate-100">
                          {(filteredEligibleJobs.length > 0 ? filteredEligibleJobs : eligibleJobs).map((j) => (
                            <button
                              key={j.id}
                              type="button"
                              onClick={() => {
                                setJob(j.jobCode);
                                setCont20(j.cont20 || 0);
                                setCont40(j.cont40 || 0);
                                if (j.transit) setTransit(j.transit);
                                setShowJobList(false);
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-teal-50 transition-colors flex items-center justify-between text-xs"
                            >
                              <div className="flex flex-col min-w-0 pr-2">
                                <span className="font-bold text-teal-800">{j.jobCode}</span>
                                <span className="text-slate-500 truncate max-w-[170px]">{j.customerName || 'Chưa có tên KH'}</span>
                              </div>
                              <span className="text-[11px] text-slate-400 shrink-0">
                                {j.cont20 ? `${j.cont20}x20'` : ''}{j.cont20 && j.cont40 ? ', ' : ''}{j.cont40 ? `${j.cont40}x40'` : ''}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                </div>

                {/* Nhóm: Vessel/Voy + POL (md:col-span-7 - kích thước bằng Cont 20 + Cont 40 + VAT) */}
                <div className="md:col-span-7 grid grid-cols-1 sm:grid-cols-5 gap-4">
                    {/* Vessel/Voy (sm:col-span-3) */}
                    <div className="sm:col-span-3 space-y-1">
                        <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Vessel/Voy</label>
                        <input 
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-teal-500 text-sm" 
                          value={vessel} 
                          onChange={e => setVessel(e.target.value)} 
                          placeholder="Vessel/Voy..." 
                        />
                    </div>

                    {/* POL (sm:col-span-2) */}
                    <div className="sm:col-span-2 space-y-1">
                        <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">POL</label>
                        <input 
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-teal-500 text-sm" 
                          value={pol} 
                          onChange={e => setPol(e.target.value)} 
                          placeholder="POL..." 
                        />
                    </div>
                </div>

                {/* POD (md:col-span-2 - kích thước bằng Transit) */}
                <div className="md:col-span-2 space-y-1">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">POD</label>
                    <input 
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-teal-500 text-sm" 
                      value={pod} 
                      onChange={e => setPod(e.target.value)} 
                      placeholder="POD..." 
                    />
                </div>
            </div>

            {/* Thông tin Job đã khớp */}
            {matchedJob && (
              <div className="bg-teal-50/70 border border-teal-200 rounded-lg p-2.5 text-xs text-teal-900 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-bold text-teal-800">{matchedJob.jobCode}</span>
                  {matchedJob.customerName && <span>KH: <strong>{matchedJob.customerName}</strong></span>}
                  {matchedJob.booking && <span>Booking: <strong>{matchedJob.booking}</strong></span>}
                  {matchedJob.line && <span>Hãng tàu: <strong>{matchedJob.line}</strong></span>}
                  {matchedJob.hbl && <span>HBL: <strong>{matchedJob.hbl}</strong></span>}
                </div>
                {matchedJob.localChargeTotal ? (
                  <div className="font-semibold text-slate-700">
                    Thu (Invoices): <span className="text-blue-700">{matchedJob.localChargeTotal.toLocaleString('vi-VN')} đ</span>
                  </div>
                ) : null}
              </div>
            )}
        </div>

        {rows.length > 0 && (
            <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-lg font-semibold text-slate-800">Bảng Tính Fee</h2>
                        <div className="flex items-center gap-2.5 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer select-none hover:text-teal-700" title="Bỏ đi phí CIC ra khỏi bảng">
                                <input
                                    type="checkbox"
                                    checked={ppCic}
                                    onChange={(e) => setPpCic(e.target.checked)}
                                    className="w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500 cursor-pointer"
                                />
                                <span>PP CIC</span>
                            </label>
                            <span className="w-px h-4 bg-slate-200" />
                            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer select-none hover:text-teal-700" title="Phí CIC sẽ có đơn giá là 0 để tự nhập thủ công">
                                <input
                                    type="checkbox"
                                    checked={dgCic}
                                    onChange={(e) => handleToggleDg(e.target.checked)}
                                    className="w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500 cursor-pointer"
                                />
                                <span>DG</span>
                            </label>
                            <span className="w-px h-4 bg-slate-200" />
                            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer select-none hover:text-teal-700" title="Thêm dòng PCS FEE (ĐVT: Cont, SL như THC, đơn giá: 2.632.100 đ / 40', 1.318.050 đ / 20')">
                                <input
                                    type="checkbox"
                                    checked={pcsFee}
                                    onChange={(e) => setPcsFee(e.target.checked)}
                                    className="w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500 cursor-pointer"
                                />
                                <span>PCS</span>
                            </label>
                        </div>
                    </div>
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

                <div className="flex flex-wrap justify-between items-center gap-3 bg-slate-50 p-4 rounded-xl border border-gray-200">
                    <div className="flex flex-wrap items-center gap-3">
                        {showUpdateButton ? (
                            <div className="flex flex-wrap items-center gap-2">
                                {matchedJob?.localChargeTotal ? (
                                    <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1.5 rounded-lg font-medium">
                                        Sẵn có: Job {matchedJob.jobCode} đã có giá trị Amount ({matchedJob.localChargeTotal?.toLocaleString('vi-VN')} VND)
                                    </span>
                                ) : null}
                                <button
                                    onClick={handleUpdateJobAmount}
                                    className="bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
                                    title="Cập nhật tổng tiền vào Amount của Job"
                                >
                                    <Check className="w-4 h-4" />
                                    {matchedJob?.localChargeTotal ? `Update Amount (${currentTotal.toLocaleString('vi-VN')} VND)` : 'Cập nhật Tổng cộng vào Amount của Job'}
                                </button>
                            </div>
                        ) : matchedJob ? (
                            <span className="text-xs text-slate-500 font-medium italic flex items-center gap-1.5">
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                                Sẵn có: Job {matchedJob.jobCode} đã có giá trị Amount ({matchedJob.localChargeTotal?.toLocaleString('vi-VN')} VND)
                            </span>
                        ) : null}

                        {/* NÚT XEM HOÁ ĐƠN NHÁP */}
                        <button
                            type="button"
                            onClick={() => setIsPreviewOpen(true)}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
                            title="Xem Hoá đơn Nháp khổ A4 (mẫu MISA meInvoice)"
                        >
                            <Eye className="w-4 h-4" />
                            Hoá đơn Nháp
                        </button>
                    </div>
                    <div className="text-red-600 font-bold text-lg bg-red-50 px-4 py-2 rounded-lg border border-red-100 inline-block">
                        Tổng cộng: {currentTotal.toLocaleString('vi-VN')}
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

        {/* Tax Lookup Group */}
        <div className="bg-white p-4 lg:p-6 rounded-lg shadow-sm border border-gray-200 mt-6 space-y-4">
            <div className="flex flex-wrap justify-between items-center gap-2">
                <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-slate-800">
                        Thông Tin Khách Hàng & Tra Cứu Thuế (masothue.com)
                    </h2>
                    {matchedCustomer && (
                        <span className="text-[11px] bg-teal-50 text-teal-700 font-semibold px-2 py-0.5 rounded border border-teal-200">
                            KH: {matchedCustomer.code} - {matchedCustomer.name}
                        </span>
                    )}
                </div>
                <div className="text-xs text-slate-500 flex items-center gap-2">
                    <button 
                        type="button"
                        onClick={handleOpenMasothue} 
                        className="text-blue-600 hover:text-blue-800 font-semibold hover:underline flex items-center gap-1.5 bg-blue-50 px-3 py-1 rounded border border-blue-200 transition-colors cursor-pointer"
                        title="Mở trang masothue.com để tra cứu thông tin và copy địa chỉ"
                    >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Mở masothue.com {taxCode ? `(MST: ${taxCode})` : ''}
                    </button>
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-600 h-6 flex items-center justify-between">
                        <span>Mã số thuế (MST)</span>
                        {taxCode && (
                            <span className="text-[10px] text-teal-600 font-semibold">Tự điền từ Job</span>
                        )}
                    </label>
                    <div className="flex">
                        <input 
                            className="w-full px-3 py-2 border border-slate-300 rounded-s-md outline-none focus:border-teal-500 text-sm font-mono" 
                            placeholder="Nhập MST..." 
                            value={taxCode}
                            onChange={(e) => setTaxCode(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleLookupTax()}
                        />
                        <button 
                            onClick={handleLookupTax}
                            disabled={isLookingUpTax || !taxCode}
                            className="bg-teal-600 hover:bg-teal-700 text-white px-3.5 rounded-e-md text-sm font-medium transition-colors disabled:opacity-50 min-w-[80px] shrink-0"
                            title="Tra cứu tên và địa chỉ công ty"
                        >
                            {isLookingUpTax ? 'Đang tra...' : 'Tra cứu'}
                        </button>
                    </div>
                </div>
                
                <div className="space-y-1 md:col-span-1">
                    <label className="text-xs font-medium text-slate-600 h-6 flex items-center">
                        Tên đơn vị (Khách hàng)
                    </label>
                    <input 
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md outline-none focus:border-teal-500 text-sm text-slate-800" 
                        value={taxName}
                        onChange={(e) => setTaxName(e.target.value)}
                        placeholder="Tên đơn vị KH (lấy từ job hoặc tra cứu)..."
                    />
                </div>
                
                <div className="space-y-1 md:col-span-2">
                    <label className="text-xs font-medium text-slate-600 h-6 flex justify-between items-center">
                        <span>Địa chỉ (Tra từ masothue.com rồi đưa vào)</span>
                        <div className="flex items-center gap-2">
                            <button 
                                type="button"
                                onClick={handleOpenMasothue}
                                className="text-blue-600 hover:text-blue-800 text-[11px] underline flex items-center gap-0.5"
                                title="Mở masothue.com để tìm địa chỉ"
                            >
                                <ExternalLink className="w-3 h-3" />
                                Tra masothue.com
                            </button>
                            {taxAddress && (
                                <button onClick={handleCopyTaxAddress} className="text-teal-600 hover:text-teal-800 flex items-center gap-1 bg-teal-50 px-2 py-0.5 rounded border border-teal-200" title="Copy Địa chỉ">
                                    <Copy className="w-3 h-3" />
                                    <span className="text-[10px] font-bold uppercase tracking-wider">Copy</span>
                                </button>
                            )}
                        </div>
                    </label>
                    <input 
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md outline-none focus:border-teal-500 text-sm text-slate-800" 
                        value={taxAddress}
                        onChange={(e) => setTaxAddress(e.target.value)}
                        placeholder="Nhập hoặc dán địa chỉ tra từ masothue.com vào đây..."
                    />
                </div>
            </div>

            <div className="border-t border-slate-100 pt-4 mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-600 h-6 flex items-center">Trích xuất Email từ nội dung</label>
                    <textarea 
                        className="w-full px-3 py-2 border border-slate-300 rounded-md outline-none focus:border-teal-500 text-sm h-20 resize-none" 
                        placeholder="Dán nội dung (copy từ web, email,...) vào đây để lọc các email..."
                        value={emailExtractInput}
                        onChange={(e) => handleExtractEmails(e.target.value)}
                    />
                </div>
                
                <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-600 h-6 flex justify-between items-center">
                        Kết quả Email (đã lọc trùng)
                        {emailExtractOutput && (
                            <button onClick={handleCopyEmails} className="text-teal-600 hover:text-teal-800 flex items-center gap-1 bg-teal-50 px-2 py-0.5 rounded" title="Copy tất cả Email">
                                <Copy className="w-3 h-3" />
                                <span className="text-[10px] font-bold uppercase tracking-wider">Copy</span>
                            </button>
                        )}
                    </label>
                    <textarea 
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md outline-none text-sm text-slate-700 h-20 resize-none" 
                        readOnly 
                        value={emailExtractOutput}
                        placeholder="Kết quả email cách nhau bằng dấu chấm phẩy..."
                    />
                </div>
            </div>
        </div>
        
        {/* Modal Xem Trước Hóa Đơn A4 */}
        <DebitNotePreviewModal
            isOpen={isPreviewOpen}
            onClose={() => setIsPreviewOpen(false)}
            jobCode={job}
            matchedJob={matchedJob}
            customer={matchedCustomer}
            rows={rows}
            vatRate={Number(vat) || 8}
            initialTaxCode={taxCode || matchedCustomer?.mst || ''}
            initialTaxName={taxName || matchedCustomer?.name || matchedJob?.customerName || ''}
            initialTaxAddress={taxAddress || ''}
            vessel={vessel}
            pol={pol}
            pod={pod}
        />
    </div>
  );
};

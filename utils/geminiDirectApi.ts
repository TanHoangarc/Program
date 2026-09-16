import { getActiveApiKey } from './apiKeyManager';

export interface ExtractedInvoiceData {
    invoice: string;
    date: string; // Định dạng chuẩn YYYY-MM-DD
    net: number;
    vat: number;
    total: number;
}

/**
 * Lấy API key cho Gemini từ nhiều nguồn:
 * 1. Khóa tùy chỉnh truyền vào
 * 2. Khóa active từ apiKeyManager (localStorage)
 * 3. Khóa từ localStorage (gemini_api_key)
 * 4. Khóa từ biến môi trường Vite (VITE_GEMINI_API_KEY)
 * 5. Khóa từ process.env (nếu chạy ở môi trường có hỗ trợ)
 */
export function getGeminiApiKey(customKey?: string): string {
    if (customKey && customKey.trim()) return customKey.trim();
    try {
        const active = getActiveApiKey();
        if (active && active.trim()) return active.trim();
    } catch {}

    try {
        const legacy = localStorage.getItem('gemini_api_key');
        if (legacy && legacy.trim()) return legacy.trim();
    } catch {}

    try {
        const viteKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;
        if (viteKey && viteKey.trim()) return viteKey.trim();
    } catch {}

    try {
        if (typeof process !== 'undefined' && process.env) {
            if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
            if (process.env.API_KEY) return process.env.API_KEY;
        }
    } catch {}

    return '';
}

/**
 * Gọi Google Gemini REST API trực tiếp từ trình duyệt (hỗ trợ CORS đầy đủ)
 */
export async function callGeminiDirect({
    prompt,
    base64Data,
    mimeType = 'application/pdf',
    customApiKey,
    preferredModel = 'gemini-2.5-flash',
    jsonMode = true
}: {
    prompt: string;
    base64Data?: string;
    mimeType?: string;
    customApiKey?: string;
    preferredModel?: string;
    jsonMode?: boolean;
}): Promise<string> {
    const apiKey = getGeminiApiKey(customApiKey);

    if (!apiKey) {
        throw new Error(
            'Chưa có API Key cho Gemini. Vui lòng bấm vào biểu tượng Chìa khóa (🔑) hoặc vào Cài đặt để nhập Gemini API Key.'
        );
    }

    const modelsToTry = [
        preferredModel,
        'gemini-2.5-flash',
        'gemini-3.8-flash',
        'gemini-3.1-flash-lite'
    ].filter((m, idx, arr) => arr.indexOf(m) === idx);

    let lastError: any = null;

    for (const model of modelsToTry) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

            const parts: any[] = [];
            if (base64Data) {
                parts.push({
                    inlineData: {
                        mimeType: mimeType.startsWith('image/') ? mimeType : 'application/pdf',
                        data: base64Data
                    }
                });
            }
            parts.push({ text: prompt });

            const payload: any = {
                contents: [{ parts }]
            };

            if (jsonMode) {
                payload.generationConfig = {
                    responseMimeType: 'application/json'
                };
            }

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (!response.ok) {
                const errMsg = data?.error?.message || response.statusText || 'Lỗi gọi Gemini API';
                if (response.status === 429 || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('Quota')) {
                    const err = new Error(`Hết hạn mức Quota Gemini (429): ${errMsg}`);
                    (err as any).status = 429;
                    throw err;
                }
                if (response.status === 400 || response.status === 403 || errMsg.includes('API_KEY_INVALID')) {
                    const err = new Error(`API Key Gemini không hợp lệ: ${errMsg}`);
                    (err as any).status = response.status;
                    throw err;
                }
                throw new Error(errMsg);
            }

            const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (candidateText !== undefined && candidateText !== null) {
                return candidateText;
            }

            throw new Error('Mô hình AI không trả về nội dung.');
        } catch (err: any) {
            lastError = err;
            if (err.status === 429 || err.message?.includes('Hết hạn mức Quota') || err.message?.includes('không hợp lệ')) {
                throw err;
            }
            console.warn(`Thử model ${model} thất bại, chuyển sang model kế tiếp:`, err.message || err);
        }
    }

    throw lastError || new Error('Không thể kết nối với Gemini API');
}

/**
 * Xử lý số từ kết quả AI (hỗ trợ cả định dạng VN 1.250.000 và US 1,250,000.00)
 */
export function parseAINumber(val: any): number {
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    if (typeof val === 'string') {
        let clean = val.replace(/[^0-9.,]/g, '').trim();
        if (!clean) return 0;

        const hasComma = clean.includes(',');
        const hasDot = clean.includes('.');

        if (hasComma && hasDot) {
            const lastComma = clean.lastIndexOf(',');
            const lastDot = clean.lastIndexOf('.');
            if (lastComma > lastDot) {
                // VN: 1.234.567,89 -> 1234567.89
                clean = clean.replace(/\./g, '').replace(',', '.');
            } else {
                // US: 1,234,567.89 -> 1234567.89
                clean = clean.replace(/,/g, '');
            }
            const n = parseFloat(clean);
            return isNaN(n) ? 0 : Math.round(n);
        }

        if (hasComma) {
            const parts = clean.split(',');
            if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
                // 1,234,567
                clean = clean.replace(/,/g, '');
            } else {
                // 1234,50
                clean = clean.replace(',', '.');
            }
            const n = parseFloat(clean);
            return isNaN(n) ? 0 : Math.round(n);
        }

        if (hasDot) {
            const parts = clean.split('.');
            if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
                // 1.234.567
                clean = clean.replace(/\./g, '');
            } else {
                // 1234.50
            }
            const n = parseFloat(clean);
            return isNaN(n) ? 0 : Math.round(n);
        }

        const n = parseFloat(clean);
        return isNaN(n) ? 0 : Math.round(n);
    }
    return 0;
}

/**
 * Chuẩn hóa ngày thành định dạng YYYY-MM-DD cho ô input type="date"
 */
export function normalizeDateToYYYYMMDD(rawDate: string): string {
    if (!rawDate) return '';
    const clean = rawDate.trim();

    // Nếu đã là YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;

    // DD/MM/YYYY hoặc DD-MM-YYYY
    const dmyMatch = clean.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dmyMatch) {
        const day = dmyMatch[1].padStart(2, '0');
        const month = dmyMatch[2].padStart(2, '0');
        const year = dmyMatch[3];
        return `${year}-${month}-${day}`;
    }

    // YYYY/MM/DD
    const ymdMatch = clean.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    if (ymdMatch) {
        const year = ymdMatch[1];
        const month = ymdMatch[2].padStart(2, '0');
        const day = ymdMatch[3].padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    return clean;
}

/**
 * Trích xuất dữ liệu hóa đơn (Local Charge, Extension, Hóa đơn logistics)
 */
export async function extractInvoiceDataDirect({
    fileUrl,
    blob,
    base64Data,
    mimeType,
    customApiKey,
    invoiceType = 'Local Charge'
}: {
    fileUrl?: string;
    blob?: Blob;
    base64Data?: string;
    mimeType?: string;
    customApiKey?: string;
    invoiceType?: string;
}): Promise<ExtractedInvoiceData> {
    let finalBase64 = base64Data;
    let finalMime = mimeType || 'application/pdf';

    // 1. Tải file nếu chưa có base64
    if (!finalBase64) {
        let activeBlob = blob;
        if (!activeBlob && fileUrl) {
            const resp = await fetch(fileUrl);
            if (!resp.ok) {
                throw new Error(`Không thể tải file từ đường dẫn: ${fileUrl}`);
            }
            activeBlob = await resp.blob();
        }

        if (!activeBlob) {
            throw new Error('Không tìm thấy file hóa đơn để phân tích.');
        }

        finalMime = activeBlob.type || 'application/pdf';
        finalBase64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const res = reader.result as string;
                resolve(res.split(',')[1]);
            };
            reader.onerror = reject;
            reader.readAsDataURL(activeBlob);
        });
    }

    const prompt = `Bạn là một chuyên gia kế toán chứng từ logistics hàng đầu. Hãy đọc kỹ toàn bộ hóa đơn/chứng từ này (loại: ${invoiceType}) và trích xuất chính xác 4 trường thông tin:
1. "invoice": Số hóa đơn (Invoice Number / Ký hiệu số hóa đơn). Chỉ lấy số hoặc ký hiệu chính xác, không kèm chữ thừa.
2. "date": Ngày lập hóa đơn (Invoice Date). Trả về theo định dạng YYYY-MM-DD (ví dụ: 2026-05-18).
3. "net": Tổng tiền hàng trước thuế (Total Net Amount / Cộng tiền hàng chưa thuế / Trị giá tính thuế). Chỉ trả về số nguyên (VNĐ).
4. "vat": Tiền thuế giá trị gia tăng (Total VAT Amount / Tiền thuế GTGT). Chỉ trả về số nguyên (VNĐ).

Trả về DUY NHẤT một chuỗi JSON hợp lệ theo cấu trúc:
{
  "invoice": "string",
  "date": "YYYY-MM-DD",
  "net": 0,
  "vat": 0
}`;

    const rawResponse = await callGeminiDirect({
        prompt,
        base64Data: finalBase64,
        mimeType: finalMime,
        customApiKey,
        preferredModel: 'gemini-2.5-flash',
        jsonMode: true
    });

    try {
        const cleanJson = rawResponse.replace(/```json/gi, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJson);

        const net = parseAINumber(parsed.net);
        const vat = parseAINumber(parsed.vat);
        const date = normalizeDateToYYYYMMDD(parsed.date || '');
        const invoice = String(parsed.invoice || '').trim();

        return {
            invoice,
            date,
            net,
            vat,
            total: net + vat
        };
    } catch (e: any) {
        console.error('Lỗi phân tích JSON hóa đơn từ AI:', rawResponse, e);
        throw new Error('Không thể phân tích dữ liệu JSON trả về từ AI: ' + rawResponse.substring(0, 80));
    }
}

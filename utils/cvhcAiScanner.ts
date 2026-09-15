import axios from 'axios';
import { getActiveApiKey } from './apiKeyManager';

export interface CVHCExtractedData {
    jobCode: string;
    customerName: string;
    amount: number;
    accountNumber: string;
    bankName?: string;
    accountHolder?: string;
    notes?: string;
}

const CVHC_READER_PROMPT = `Bạn là một nhân viên chứng từ/kế toán logistics xuất nhập khẩu chuyên nghiệp, cẩn trọng và tỉ mỉ. Bạn đang đóng vai trò là: "1 NGƯỜI ĐỌC TỪNG TRANG FILE ĐÍNH KÈM VÀ GHI LẠI DỮ LIỆU CHÍNH XÁC VÀO CÁC DÒNG".

Nhiệm vụ của bạn: Hãy quan sát và đọc kỹ toàn bộ trang tài liệu này (Công văn hoàn cược - CVHC, Giấy đề nghị thanh toán/hoàn tiền cược container, Biên bản bàn giao cont, Giấy báo thu hoặc Vận đơn B/L). Trích xuất thật chính xác các thông tin sau để điền vào dòng tương ứng:

1. "jobCode" (Số BL / Số Job / Mã Vận Đơn):
   - Tìm kiếm số B/L No, Bill of Lading, Booking No, MBL, HBL, Mã Job, Số vận đơn.
   - Thường nằm ở tiêu đề công văn ("V/v: Hoàn trả tiền cược cont lô hàng theo B/L số..."), hoặc bảng kê cont/seal.
   - Nếu trên trang này có nhiều số BL được kê khai, hãy lấy tất cả và ngăn cách nhau bằng dấu phẩy (Ví dụ: "SGN2405012, SGN2405013").

2. "customerName" (Tên Khách Hàng / Đơn Vị Đề Nghị Hoàn Cược):
   - Đọc tên công ty/doanh nghiệp làm công văn xin hoàn cược (Ví dụ: "CÔNG TY TNHH THƯƠNG MẠI XNK ĐẠI DƯƠNG", "CÔNG TY CP TIẾP VẬN VÀ TIẾP VẬN SAO BIỂN"...).
   - Thường nằm ở góc trái trên cùng (Đơn vị gửi) hoặc phần mở đầu: "Kính gửi Hãng tàu... Tên công ty chúng tôi là...".

3. "amount" (Số Tiền Cược / Tiền Đề Nghị Hoàn Trả):
   - Số tiền đề nghị hoàn trả lại bằng số nguyên (VNĐ).
   - Tìm ở các dòng: "Số tiền:", "Số tiền cược:", "Số tiền đề nghị hoàn cược:", "Bằng số:".
   - Ví dụ: 2.000.000 đ -> 2000000; 5,000,000 VND -> 5000000. Bỏ dấu chấm, dấu phẩy, chữ đ/VND.
   - Nếu trên văn bản không ghi số tiền hoặc không tìm thấy, trả về 0.

4. "accountNumber" (Số Tài Khoản Ngân Hàng Thụ Hưởng):
   - Dãy số tài khoản ngân hàng để chuyển trả tiền cược.
   - Chỉ lấy các chữ số liên tục (Ví dụ: "0071001234567", "19034567890123"). Bỏ qua dấu cách, dấu gạch ngang.
   - Tìm ở mục: "Số tài khoản:", "STK:", "A/C:", "Tài khoản thụ hưởng:".

5. "bankName" (Tên Ngân Hàng Thụ Hưởng):
   - Chỉ lấy tên thương hiệu ngân hàng chính ngắn gọn (Ví dụ: "Vietcombank", "VietinBank", "Techcombank", "BIDV", "Agribank", "ACB", "MB Bank", "VPBank", "TPBank", "Sacombank", "VIB", "HDBank", "MSB", "OCB", "Eximbank", "SHB"...).
   - TUYỆT ĐỐI KHÔNG ghi chi nhánh (như "CN Tân Bình", "Chi nhánh Ba Đình", "Hội sở", "PGD..."). Chỉ ghi đúng tên ngân hàng cho ngắn gọn.

6. "accountHolder" (Tên Chủ Tài Khoản / Người Thụ Hưởng):
   - Tên cá nhân hoặc công ty đứng tên tài khoản ngân hàng thụ hưởng.
   - Chú ý quan sát kỹ nếu người thụ hưởng là cá nhân (ví dụ: "Nguyễn Văn A", "Trần Thị B"), hãy ghi rõ họ và tên đầy đủ của cá nhân đó.

7. "notes" (Ghi Chú):
   - Ghi chú vắn tắt nếu có thông tin đặc biệt.

Yêu cầu chất lượng:
- Đọc kỹ, chính xác từng ký tự như một người kiểm chứng thực tế, không bịa đặt hoặc suy đoán.
- Trả về JSON đúng cấu trúc:
{
  "jobCode": "...",
  "customerName": "...",
  "amount": 0,
  "accountNumber": "...",
  "bankName": "...",
  "accountHolder": "...",
  "notes": "..."
}`;

// Helper: Gọi trực tiếp Google Gemini API từ trình duyệt (Dành cho môi trường Vercel hoặc khi backend không khả dụng)
async function scanPageWithDirectGemini(
    base64Data: string,
    mimeType: string,
    apiKey: string
): Promise<CVHCExtractedData> {
    const modelsToTry = [
        "gemini-2.5-flash",
        "gemini-3.8-flash",
        "gemini-3.1-flash-lite"
    ];

    let lastError: any = null;

    for (const model of modelsToTry) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                {
                                    inlineData: {
                                        mimeType: mimeType || "application/pdf",
                                        data: base64Data
                                    }
                                },
                                {
                                    text: CVHC_READER_PROMPT
                                }
                            ]
                        }
                    ],
                    generationConfig: {
                        responseMimeType: "application/json"
                    }
                })
            });

            const data = await response.json();

            if (!response.ok) {
                const errMsg = data?.error?.message || response.statusText || "Lỗi gọi Gemini API";
                if (response.status === 429 || errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.includes("Quota")) {
                    const err = new Error(`RESOURCE_EXHAUSTED: ${errMsg}`);
                    (err as any).status = 429;
                    throw err;
                }
                throw new Error(errMsg);
            }

            const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
            const cleanJsonText = candidateText.replace(/```json/gi, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleanJsonText);

            // Normalize fields
            let amount = 0;
            if (typeof parsed.amount === 'number') amount = parsed.amount;
            else if (typeof parsed.amount === 'string') {
                const num = parseInt(parsed.amount.replace(/[^0-9]/g, ''), 10);
                amount = isNaN(num) ? 0 : num;
            }

            let accountNumber = '';
            if (typeof parsed.accountNumber === 'string') {
                accountNumber = parsed.accountNumber.replace(/[^0-9]/g, '').trim();
            }

            return {
                jobCode: (parsed.jobCode || '').trim(),
                customerName: (parsed.customerName || '').trim(),
                amount,
                accountNumber,
                bankName: (parsed.bankName || '').trim(),
                accountHolder: (parsed.accountHolder || '').trim(),
                notes: (parsed.notes || '').trim()
            };
        } catch (err: any) {
            lastError = err;
            if (err.status === 429 || err.message?.includes("RESOURCE_EXHAUSTED")) {
                throw err; // Don't try other models if quota is exhausted
            }
            console.warn(`Direct Gemini scan with ${model} failed, trying next model:`, err);
        }
    }

    throw lastError || new Error("Không thể trích xuất dữ liệu từ trang qua Gemini API");
}

/**
 * Hàm điều phối trích xuất thông tin trang CVHC:
 * 1. Thử gọi backend `/api/cvhc/scan-page` (Hoạt động tốt trên AI Studio / Vercel Serverless).
 * 2. Nếu backend bị 404 (Do Vercel triển khai dạng tĩnh) hoặc lỗi máy chủ, tự động chuyển sang gọi trực tiếp Gemini API từ trình duyệt bằng API Key đã lưu.
 */
export async function scanCVHCPage(
    base64Data: string,
    mimeType: string,
    customApiKey?: string
): Promise<CVHCExtractedData> {
    const activeKey = customApiKey || getActiveApiKey() || (import.meta as any).env?.VITE_GEMINI_API_KEY || '';

    // 1. Thử gọi backend API
    try {
        const response = await axios.post('/api/cvhc/scan-page', {
            base64Data,
            mimeType,
            apiKey: activeKey || undefined
        }, {
            headers: activeKey ? { 'x-gemini-api-key': activeKey } : undefined,
            timeout: 60000 // 60s timeout
        });

        if (response.data && response.data.success && response.data.data) {
            return response.data.data as CVHCExtractedData;
        }
    } catch (apiErr: any) {
        const status = apiErr.response?.status;
        const errMsg = apiErr.response?.data?.error || apiErr.message || '';

        console.warn('Backend /api/cvhc/scan-page returned error or not found:', { status, errMsg });

        // Nếu là lỗi hạn mức (Quota / 429), rethrow ngay
        if (status === 429 || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('Quota')) {
            const err = new Error(errMsg || 'RESOURCE_EXHAUSTED');
            (err as any).status = 429;
            throw err;
        }

        // 2. Nếu backend bị 404 (đặc trưng khi deploy trên Vercel không có backend Node) hoặc lỗi server:
        // Chuyển sang gọi trực tiếp Google Gemini API từ browser nếu có API Key
        if (activeKey) {
            console.info('Falling back to client-side direct Gemini API call on browser...');
            return await scanPageWithDirectGemini(base64Data, mimeType, activeKey);
        }

        // Nếu không có API Key và backend bị 404
        if (status === 404 || errMsg.includes('404')) {
            throw new Error(
                'Máy chủ backend (/api/cvhc/scan-page) không tồn tại trên Vercel. Vui lòng bấm vào biểu tượng Chìa khóa (🔑) để nhập Gemini API Key cá nhân để trình duyệt gọi trực tiếp, hoặc cấu hình GEMINI_API_KEY trên Vercel.'
            );
        }

        throw new Error(errMsg || 'Lỗi kết nối máy chủ AI');
    }

    throw new Error('Không nhận được dữ liệu từ API');
}

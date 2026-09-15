import { GoogleGenAI, Type } from "@google/genai";

const cvhcReaderPrompt = `Bạn là một nhân viên chứng từ/kế toán logistics xuất nhập khẩu chuyên nghiệp, cẩn trọng và tỉ mỉ. Bạn đang đóng vai trò là: "1 NGƯỜI ĐỌC TỪNG TRANG FILE ĐÍNH KÈM VÀ GHI LẠI DỮ LIỆU CHÍNH XÁC VÀO CÁC DÒNG".

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
   - Chỉ lấy tên thương hiệu ngân hàng chính ngắn gọn (Ví dụ: "Vietcombank", "Vietinbank", "Techcombank", "BIDV", "Agribank", "ACB", "MB Bank", "VPBank", "TPBank", "Sacombank", "VIB", "HDBank", "MSB", "OCB", "Eximbank", "SHB"...).
   - TUYỆT ĐỐI KHÔNG ghi chi nhánh (như "CN Tân Bình", "Chi nhánh Ba Đình", "Hội sở", "PGD..."). Chỉ ghi đúng tên ngân hàng cho ngắn gọn.

6. "accountHolder" (Tên Chủ Tài Khoản / Người Thụ Hưởng):
   - Tên cá nhân hoặc công ty đứng tên tài khoản ngân hàng thụ hưởng.
   - Chú ý quan sát kỹ nếu người thụ hưởng là cá nhân (ví dụ: "Nguyễn Văn A", "Trần Thị B"), hãy ghi rõ họ và tên đầy đủ của cá nhân đó.

7. "notes" (Ghi Chú):
   - Ghi chú vắn tắt nếu có thông tin đặc biệt.

Yêu cầu chất lượng:
- Đọc kỹ, chính xác từng ký tự như một người kiểm chứng thực tế, không bịa đặt hoặc suy đoán.
- Trả về JSON đúng cấu trúc.`;

export default async function handler(req: any, res: any) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, x-gemini-api-key'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    try {
        const { base64Data, mimeType, apiKey: clientApiKey } = req.body || {};
        const headerApiKey = req.headers['x-gemini-api-key'] as string;
        const apiKey = clientApiKey || headerApiKey || process.env.GEMINI_API_KEY || process.env.API_KEY;

        if (!apiKey) {
            return res.status(401).json({
                success: false,
                error: 'Thiếu GEMINI_API_KEY. Vui lòng cấu hình GEMINI_API_KEY trên Vercel hoặc nhập API Key trên giao diện.'
            });
        }

        if (!base64Data) {
            return res.status(400).json({ success: false, error: 'Missing base64Data' });
        }

        const ai = new GoogleGenAI({ apiKey });
        const modelsToTry = [
            'gemini-2.5-flash',
            'gemini-3.8-flash',
            'gemini-3.1-flash-lite',
            'gemini-3.1-pro-preview'
        ];

        let lastError: any = null;
        let resultData: any = null;

        for (const model of modelsToTry) {
            try {
                const result = await ai.models.generateContent({
                    model,
                    contents: {
                        parts: [
                            { inlineData: { mimeType: mimeType || 'application/pdf', data: base64Data } },
                            { text: cvhcReaderPrompt }
                        ]
                    },
                    config: {
                        responseMimeType: 'application/json',
                        responseSchema: {
                            type: Type.OBJECT,
                            properties: {
                                jobCode: {
                                    type: Type.STRING,
                                    description: 'Số Vận đơn, B/L No, Booking No, Mã Job.'
                                },
                                customerName: {
                                    type: Type.STRING,
                                    description: 'Tên công ty hoặc khách hàng đề nghị hoàn cược.'
                                },
                                amount: {
                                    type: Type.NUMBER,
                                    description: 'Số tiền cược đề nghị hoàn trả (số nguyên VNĐ).'
                                },
                                accountNumber: {
                                    type: Type.STRING,
                                    description: 'Số tài khoản ngân hàng thụ hưởng.'
                                },
                                bankName: {
                                    type: Type.STRING,
                                    description: 'Tên ngân hàng thụ hưởng ngắn gọn, không ghi chi nhánh.'
                                },
                                accountHolder: {
                                    type: Type.STRING,
                                    description: 'Tên chủ tài khoản hoặc người thụ hưởng.'
                                },
                                notes: {
                                    type: Type.STRING,
                                    description: 'Ghi chú ngắn về nội dung trang.'
                                }
                            },
                            required: ['jobCode', 'customerName', 'amount', 'accountNumber']
                        }
                    }
                });

                let jsonText = '';
                try {
                    jsonText = result.text || '{}';
                } catch {
                    jsonText = '{}';
                }
                jsonText = jsonText.replace(/```json/gi, '').replace(/```/g, '').trim();
                resultData = JSON.parse(jsonText);

                if (resultData) {
                    if (typeof resultData.amount === 'string') {
                        const num = parseInt(resultData.amount.replace(/[^0-9]/g, ''), 10);
                        resultData.amount = isNaN(num) ? 0 : num;
                    }
                    if (typeof resultData.accountNumber === 'string') {
                        resultData.accountNumber = resultData.accountNumber.replace(/[^0-9]/g, '');
                    }
                }

                if (resultData && (resultData.jobCode || resultData.accountNumber || resultData.customerName || resultData.amount > 0)) {
                    return res.status(200).json({ success: true, data: resultData, model });
                }
            } catch (err: any) {
                lastError = err;
                console.warn(`Vercel scan function: Model ${model} failed, trying next:`, err.message || err);
            }
        }

        if (resultData) {
            return res.status(200).json({ success: true, data: resultData });
        }

        const errMsg = lastError?.message || 'Trích xuất thất bại';
        return res.status(500).json({ success: false, error: errMsg });
    } catch (e: any) {
        console.error('Vercel API error:', e);
        return res.status(500).json({ success: false, error: e.message || 'Lỗi xử lý tài liệu' });
    }
}

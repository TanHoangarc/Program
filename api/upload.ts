import axios from "axios";

export async function uploadFile(file: File) {
    const formData = new FormData();
    formData.append("file", file); // <-- phải đúng tên "file"

    const res = await axios.post("/api/upload-file", formData, {
        headers: {
            "Content-Type": "multipart/form-data"
        }
    });

    return res.data;
}



import axios from "axios";

export async function uploadFile(file: File) {
    const formData = new FormData();
    formData.append("file", file); // <-- phải đúng tên "file"

    const res = await axios.post("http://localhost:3001/upload", formData, {
        headers: {
            "Content-Type": "multipart/form-data"
        }
    });

    return res.data;
}

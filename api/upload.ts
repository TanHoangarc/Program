import axios from "axios";

export async function uploadFile(file: File) {
    const formData = new FormData();
    formData.append("file", file); // <-- phải đúng tên "file"

    const res = await axios.post("http://192.168.1.110/upload", formData, {
        headers: {
            "Content-Type": "multipart/form-data"
        }
    });

    return res.data;
}


const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

// --- INICIO DEL DETECTOR ---
if (process.env.GEMINI_API_KEY) {
    console.log("✅ ÉXITO: Archivo .env leído correctamente y llave cargada.");
} else {
    console.log("❌ PELIGRO: El servidor no está leyendo el .env o la llave está vacía.");
}
// --- FIN DEL DETECTOR ---


const app = express();
app.use(cors());
app.use(express.json());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.post('/api/chat', async (req, res) => {
    try {
        const { prompt } = req.body;
        const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite-preview" });
        const result = await model.generateContent(prompt);
        res.json({ respuesta: result.response.text() });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(3000, () => console.log("Servidor en puerto 3000"));
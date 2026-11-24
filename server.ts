import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();
  app.use(express.json());

  // Gemini AI Error Analysis API
  app.post('/api/analyze-errors', async (req, res) => {
    try {
      const { studentName, grade, roundName, score, totalQuestions, incorrectAnswers } = req.body;

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'GEMINI_API_KEY chưa được cấu hình trên server.' });
      }

      const ai = new GoogleGenAI();
      
      const prompt = `Bạn là một giáo viên tiếng Anh chuyên nghiệp và thân thiện cho học sinh Việt Nam. 
Học sinh: ${studentName || 'Học sinh'}
Lớp: ${grade}
Vòng thi: ${roundName}
Kết quả: Đúng ${score}/${totalQuestions} câu.

Dưới đây là các câu trả lời sai của học sinh:
${JSON.stringify(incorrectAnswers, null, 2)}

Hãy phân tích kỹ lưỡng các lỗi sai trên theo từng chủ điểm ngữ pháp/từ vựng, sau đó đưa ra:
1. Nhận xét tổng quan về điểm mạnh và điểm cần lưu ý của học sinh.
2. Phân tích chi tiết từng lỗi sai (vì sao sai, kiến thức đúng cần nhớ là gì).
3. 3-4 lời khuyên và phương pháp cụ thể để học sinh cải thiện phần kiến thức này.

Hãy trả về kết quả định dạng Markdown rõ ràng, thân thiện, khích lệ học sinh bằng tiếng Việt.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      const analysisText = response.text || 'Không thể phân tích kết quả lúc này.';
      res.json({ analysis: analysisText });
    } catch (err: any) {
      console.error('Gemini error:', err);
      res.status(500).json({ error: err.message || 'Lỗi khi gọi Gemini AI phân tích bài làm.' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

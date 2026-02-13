import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";

let _openai: OpenAI | null = null;
let _gemini: GoogleGenAI | null = null;

export function getOpenAI(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;
  if (!_openai) _openai = new OpenAI({ apiKey: key });
  return _openai;
}

export function getGemini(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) return null;
  if (!_gemini) _gemini = new GoogleGenAI({ apiKey: key });
  return _gemini;
}

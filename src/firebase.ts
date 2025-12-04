
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Access import.meta.env safely by casting to any to avoid TypeScript errors in this environment
const env = (import.meta as any).env || {};

// 1. O Vite usa 'import.meta.env' para ler variáveis prefixadas com VITE_ do seu arquivo .env.local
const firebaseConfig = {
  // AQUI O CÓDIGO LÊ AS VARIÁVEIS DO SEU .env.local
  // Fallbacks added for preview environment
  apiKey: env.VITE_FIREBASE_API_KEY || "AIzaSyCWD4oVVXQjkx4S5GyUceYZEC9gXOm-dys",
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || "lojista-vip.firebaseapp.com",
  projectId: env.VITE_FIREBASE_PROJECT_ID || "lojista-vip",
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || "lojista-vip.firebasestorage.app",
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || "136672504878",
  appId: env.VITE_FIREBASE_APP_ID || "1:136672504878:web:9cb15b423ff309dac643bf",
};

// 2. Inicializa o Firebase App
const app = initializeApp(firebaseConfig);

// 3. Exporta os serviços que você vai usar
export const auth = getAuth(app); // Necessário para o Login e Autenticação
export const db = getFirestore(app); // Necessário para o Banco de Dados (Firestore)

export default app;

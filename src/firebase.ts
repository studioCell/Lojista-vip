
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics } from "firebase/analytics";

// Configuração do Firebase fornecida
const firebaseConfig = {
  apiKey: "AIzaSyCWD4oVVXQjkx4S5GyUceYZEC9gXOm-dys",
  authDomain: "lojista-vip.firebaseapp.com",
  projectId: "lojista-vip",
  storageBucket: "lojista-vip.firebasestorage.app",
  messagingSenderId: "136672504878",
  appId: "1:136672504878:web:9cb15b423ff309dac643bf",
  measurementId: "G-JVEXTZDZP8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Exportar os serviços para serem usados no restante do app
export const auth = getAuth(app);
export const db = getFirestore(app);
export { analytics };

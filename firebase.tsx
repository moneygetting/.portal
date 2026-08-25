// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBPCCtbvpd5hoEFdNYbWpM0ZqhRwuT-TRw",
  authDomain: "dotportal-a010b.firebaseapp.com",
  projectId: "dotportal-a010b",
  storageBucket: "dotportal-a010b.firebasestorage.app",
  messagingSenderId: "584554661548",
  appId: "1:584554661548:web:013a7edf9a2da2a1390109",
  measurementId: "G-R90TK9RS9S"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
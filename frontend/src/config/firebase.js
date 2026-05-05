// src/config/firebase.js
// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCutqfQHCX4HYISnfGOj8kBW16Ki39EX2Y",
  authDomain: "grade-and-grind.firebaseapp.com",
  projectId: "grade-and-grind",
  storageBucket: "grade-and-grind.firebasestorage.app",
  messagingSenderId: "194348108727",
  appId: "1:194348108727:web:e9a8419b8a73db05a53632",
  measurementId: "G-3C43NQ6DKJ"
};
const app            = initializeApp(firebaseConfig);
export const auth    = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
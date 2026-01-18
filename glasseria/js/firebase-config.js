// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyCVopVsGyE08C_2qw9eb25ka2CbFpdLRvg",
    authDomain: "izhar-d3157.firebaseapp.com",
    projectId: "izhar-d3157",
    storageBucket: "izhar-d3157.firebasestorage.app",
    messagingSenderId: "357627571852",
    appId: "1:357627571852:web:435217f0b70be489f415a9",
    measurementId: "G-TQET0FR1XC"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firestore
const db = firebase.firestore();

// Initialize Storage
const storage = firebase.storage();

// Collections References
const categoriesCollection = db.collection('glasseria_categories');
const subcategoriesCollection = db.collection('glasseria_subcategories');
const productsCollection = db.collection('glasseria_products');

// Storage References
const storageRef = storage.ref();
const categoriesImagesRef = storageRef.child('glasseria/categories');
const subcategoriesImagesRef = storageRef.child('glasseria/subcategories');
const productsImagesRef = storageRef.child('glasseria/products');

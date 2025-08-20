// script.js (Menggunakan ES Modules)
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { addDoc, collection, deleteDoc, doc, getDocs, getFirestore, onSnapshot, orderBy, query, Timestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- VARIABEL GLOBAL DIDEKLARASIKAN DI SINI ---
let cart = []; 
let allMenuItems = []; 
let currentUserId = null; 
let db = null; 
let auth = null; 
let customerInfoForChat = {}; // Akan diisi dari localStorage atau tetap kosong jika belum ada

const THROTTLE_TIME_MS = 2 * 1000; 
let lastMessageTimestamp = 0;
const CHAT_HISTORY_EXPIRATION_MS = 30 * 60 * 1000; 

document.addEventListener('DOMContentLoaded', () => {
    const backendUrl = 'https://warung-halu-ik5a2yogh-fbryntys-projects.vercel.app';
    const menuList = document.getElementById('menu-list');
    const cartItemsDiv = document.getElementById('cart-items');
    const cartTotalPriceSpan = document.getElementById('cart-total-price');
    const confirmOrderButton = document.getElementById('confirm-order-button');
    const menuPageSection = document.getElementById('menu-page');
    const kontakSection = document.getElementById('kontak'); 
    const cartSummary = document.querySelector('.cart-summary'); 

    const konfirmasiModal = document.getElementById('konfirmasi-modal');
    const konfirmasiFormModal = document.getElementById('konfirmasi-form-modal');
    const konfirmasiModalLoading = document.getElementById('konfirmasi-modal-loading');
    const closeModalButton = document.querySelector('.close-button');

    const modalNamaInput = document.getElementById('modal-nama');
    const modalWhatsappInput = document.getElementById('modal-whatsapp');
    const modalAlamatInput = document.getElementById('modal-alamat');
    const modalCatatanInput = document.getElementById('modal-catatan');
    const modalEmailInput = document.getElementById('modal-email');

    const chatbotForm = document.getElementById('chatbot-form');
    const chatInput = document.getElementById('chat-input'); 
    const chatHistoryDiv = document.getElementById('chat-history');
    const chatThrottleMessage = document.getElementById('chat-throttle-message');

    const feedbackForm = document.getElementById('feedback-form');
    const feedbackNamaInput = document.getElementById('feedback-nama');
    const feedbackEmailInput = document.getElementById('feedback-email');
    const feedbackMessageInput = document.getElementById('feedback-message');
    const feedbackStatusP = document.getElementById('feedback-status');

    const chatIcon = document.getElementById('chat-icon'); 
    const chatbotWidget = document.getElementById('chatbot-widget'); 
    const closeChatButton = document.getElementById('close-chat-button'); 
    const navChatbotLink = document.getElementById('nav-chatbot-link'); 

    const firebaseConfig = {
            apiKey: "AIzaSyAsUDjNZXE6lz4cu9ra3puE8F8lDkgY5NE",
            authDomain: "warung-hallu-1850.firebaseapp.com",
            projectId: "warung-hallu-1850",
            storageBucket: "warung-hallu-1850.firebasestorage.app",
            messagingSenderId: "296719797108",
            appId: "1:296719797108:web:a2ec39f7b66ca816417a21",
            measurementId: "G-2KJ6MDGB76"
        };
    
        const appId = firebaseConfig.projectId || 'default-app-id'; 
        const initialAuthToken = null; 
    
        async function initializeFirebaseAndAuth() {
            console.log('DEBUG: Memulai inisialisasi Firebase...');
            try {
                const app = initializeApp(firebaseConfig); 
                db = getFirestore(app);
                auth = getAuth(app);
                console.log('DEBUG: Firebase App, Firestore, dan Auth berhasil diinisialisasi.');
    
                onAuthStateChanged(auth, async (user) => {
                    if (user) {
                        console.log('DEBUG: onAuthStateChanged - Pengguna DITEMUKAN. UID:', user.uid);
                        currentUserId = user.uid;
                        
                        if (chatHistoryDiv) {
                            chatHistoryDiv.innerHTML = '<p>Memuat riwayat obrolan...</p>';
                        }
                        setupChatHistoryListener(db, currentUserId, appId); 
                        const savedCustomerInfo = localStorage.getItem('customerInfo');
                        if (savedCustomerInfo) {
                            customerInfoForChat = JSON.parse(savedCustomerInfo);
                            if (modalNamaInput) modalNamaInput.value = customerInfoForChat.nama || '';
                            if (modalWhatsappInput) modalWhatsappInput.value = customerInfoForChat.whatsapp || '';
                            if (modalAlamatInput) modalAlamatInput.value = customerInfoForChat.alamat || '';
                            if (modalCatatanInput) modalCatatanInput.value = customerInfoForChat.catatan || ''; 
                        }
    
                        const savedTimestamp = localStorage.getItem('lastMessageTimestamp');
                        if (savedTimestamp) {
                            lastMessageTimestamp = parseInt(savedTimestamp, 10);
                        }
                        loadMenuFromFirestore(); 
                    } else {
                        console.log('DEBUG: onAuthStateChanged - Pengguna TIDAK DITEMUKAN. Mencoba sign in anonim...');
                        try {
                            await signInAnonymously(auth);
                            console.log('DEBUG: Berhasil masuk secara anonim. UID akan tersedia di onAuthStateChanged berikutnya.');
                        } catch (error) {
                            console.error('ERROR: Gagal autentikasi Firebase secara anonim:', error);
                            if (chatHistoryDiv) chatHistoryDiv.innerHTML = '<p style="color: red;">Gagal autentikasi untuk menyimpan riwayat obrolan.</p>';
                        }
                    }
                });
    
            } catch (error) {
                console.error('ERROR: Kesalahan saat menginisialisasi Firebase (initializeApp):', error);
                if (chatHistoryDiv) chatHistoryDiv.innerHTML = '<p style="color: red;">Kesalahan fatal saat menginisialisasi Firebase.</p>';
            }
        }
    
        async function clearChatHistory(firestoreDb, userId, appId) {
            const chatCollectionRef = collection(firestoreDb, `artifacts/${appId}/users/${userId}/chat_history`);
            try {
                const snapshot = await getDocs(chatCollectionRef);
                const deletePromises = [];
                snapshot.forEach((docToDelete) => {
                    deletePromises.push(deleteDoc(doc(firestoreDb, chatCollectionRef.path, docToDelete.id)));
                });
                await Promise.all(deletePromises);
                console.log('DEBUG: Riwayat obrolan berhasil dihapus.');
                if (chatHistoryDiv) {
                    chatHistoryDiv.innerHTML = '<p>Riwayat obrolan telah dihapus.</p>';
                    displayTemporaryBotMessage("Selamat datang di Warung Halu! Saya Virtual Assistant Halu, apakah ada yang bisa kami bantu? 😊");
                }
            } catch (error) {
                console.error('ERROR: Gagal menghapus riwayat obrolan:', error);
            }
        }
    
    function setupChatHistoryListener(firestoreDb, userId, appId) {
        if (!firestoreDb || !userId || !appId) {
            console.error('ERROR: Firestore DB, User ID, atau App ID tidak tersedia untuk listener chat history.');
            return;
        }
        const chatCollectionRef = collection(firestoreDb, `artifacts/${appId}/users/${userId}/chat_history`);
        const q = query(chatCollectionRef, orderBy('timestamp', 'desc')); 
    
        onSnapshot(q, (snapshot) => {
            if (!chatHistoryDiv) return; 
            chatHistoryDiv.innerHTML = ''; 
    
            if (snapshot.empty) {
                if (chatHistoryDiv.children.length === 0 || chatHistoryDiv.textContent.includes('Belum ada obrolan')) {
                    displayTemporaryBotMessage("Selamat datang di Warung Halu! Saya Virtual Assistant Halu, apakah ada yang bisa kami bantu? 😊");
                }
                chatHistoryDiv.innerHTML += '<p>Belum ada obrolan. Ketik pesan untuk memulai.</p>'; 
                return; 
            }
            const lastMessage = snapshot.docs[0].data();
            const lastMessageTime = snapshot.docs[0].data().timestamp.toDate().getTime(); 
            const currentTime = Date.now();
            
            if (currentTime - lastMessageTime > CHAT_HISTORY_EXPIRATION_MS) {
                clearChatHistory(firestoreDb, userId, appId);
                return; 
            }
    
            const messages = snapshot.docs.map(doc => doc.data()).reverse(); 
            messages.forEach(displayChatMessage); 
    
            if(chatHistoryDiv.scrollHeight > chatHistoryDiv.clientHeight) {
                chatHistoryDiv.scrollTop = chatHistoryDiv.scrollHeight;
            }
        }, (error) => {
            console.error('ERROR: Error fetching chat history (onSnapshot):', error);
            if (chatHistoryDiv) chatHistoryDiv.innerHTML = '<p style="color: red;">Gagal memuat riwayat obrolan.</p>';
        });
    }
    
        function displayChatMessage(message) {
            if (!chatHistoryDiv) { 
            console.warn("chatHistoryDiv not found, cannot display message.");
            return;
            }
            const messageRow = document.createElement('div');
            messageRow.classList.add('chat-message', message.sender === 'user' ? 'user' : 'bot');
            
            const messageBubble = document.createElement('div');
            messageBubble.classList.add('message-bubble');
    
            messageBubble.innerText = message.text; 
            messageRow.appendChild(messageBubble);
    
            chatHistoryDiv.appendChild(messageRow);
        }
    
        function displayTemporaryBotMessage(messageText) {
            if (!chatHistoryDiv) return;
            const messageElement = document.createElement('div');
            messageElement.classList.add('flex', 'mb-3', 'justify-start');
            const messageBubble = document.createElement('div');
            messageBubble.classList.add('p-3', 'rounded-lg', 'max-w-[80%]', 'break-words', 'shadow-sm', 'bg-gray-200', 'text-gray-800');
            messageBubble.innerHTML = `<div class="text">${messageText}</div>`;
            messageElement.appendChild(messageBubble);
            chatHistoryDiv.appendChild(messageElement);
            chatHistoryDiv.scrollTop = chatHistoryDiv.scrollHeight; 
        }
    
        async function saveChatMessage(sender, text) {
            if (!db || !currentUserId || !appId) {
                console.error('ERROR: Tidak dapat menyimpan pesan: DB, User ID, atau App ID tidak tersedia.');
                return;
            }
            try {
                const chatCollectionRef = collection(db, `artifacts/${appId}/users/${currentUserId}/chat_history`);
                await addDoc(chatCollectionRef, {
                    sender: sender,
                    text: text,
                    timestamp: new Date()
                });
                console.log('DEBUG: Pesan berhasil disimpan ke Firestore.');
            } catch (error) {
                console.error('ERROR: Gagal menyimpan pesan ke Firestore (addDoc):', error);
            }
        }
    
        async function loadMenuFromFirestore() {
            if (!db || !appId || !menuList) { 
                console.error('ERROR: Firestore DB, App ID, atau menuList tidak tersedia untuk memuat menu.');
                if (menuList) menuList.innerHTML = '<p style="color: red;">Gagal memuat menu: Database tidak siap.</p>';
                return;
            }
            try {
                const menuCollectionPath = `artifacts/${appId}/menu_items`;
                const menuCollectionRef = collection(db, menuCollectionPath);
                const q = query(menuCollectionRef, orderBy('nama', 'asc')); 
    
                const querySnapshot = await getDocs(q);
                allMenuItems = []; 
    
                if (querySnapshot.empty) {
                    if (menuList) menuList.innerHTML = '<p>Belum ada menu yang ditemukan.</p>';
                    return;
                }
    
                querySnapshot.forEach(doc => {
                    const itemData = doc.data();
                    if (!itemData.nama || isNaN(parseFloat(itemData.harga)) || !itemData.kategori) {
                        console.warn(`PERINGATAN: Item menu tidak lengkap, dilewati:`, doc.id);
                        return; 
                    }
                    allMenuItems.push({
                        id: doc.id, 
                        nama: itemData.nama,
                        harga: parseFloat(itemData.harga),
                        deskripsi: itemData.deskripsi || '', 
                        kategori: itemData.kategori,
                        gambar: itemData.gambar || 'https://placehold.co/200x200/cccccc/333333?text=Tidak+Ada+Gambar', 
                        tersedia: itemData.tersedia !== false,
                        pilihan: itemData.pilihan || []
                    });
                });
                displayMenu('semua'); 
                updateCartDisplay(); 
            } catch (error) {
                console.error('ERROR: Gagal memuat menu dari Firestore:', error);
                if (menuList) menuList.innerHTML = '<p style="color: red;">Gagal memuat menu dari Firestore. Periksa koneksi atau izin.</p>';
            }
        }
    
    function displayMenu(category) {
        if (!menuList) return; 
        menuList.innerHTML = '';
        const filteredItems = category === 'semua' ? allMenuItems : allMenuItems.filter(item => item.kategori === category);
    
        filteredItems.forEach(item => {
            const menuItem = document.createElement('div');
            menuItem.classList.add('menu-item');
            const isAvailable = item.tersedia !== false;
            const currentItemInCart = cart.find(cartItem => cartItem.nama === item.nama);
            const currentQuantityInCart = currentItemInCart?.quantity || 0;
    
            let levelSelectorHtml = '';
            if (item.pilihan && Array.isArray(item.pilihan) && item.pilihan.length > 0) {
                const currentLevel = currentItemInCart?.level || item.pilihan[0];
                
                const optionsHtml = item.pilihan.map(level => 
                    `<option value="${level}" ${currentLevel === level ? 'selected' : ''}>${level}</option>`
                ).join('');
    
                levelSelectorHtml = `
                    <div class="level-selector" data-id="${item.nama}">
                        <label>Level Pedas:</label>
                        <select class="level-select" ${!isAvailable ? 'disabled' : ''}>
                            ${optionsHtml}
                        </select>
                    </div>
                `;
            }
    
            menuItem.innerHTML = `
                <img src="${item.gambar || 'https://placehold.co/300x200/cccccc/333333?text=Tidak+Ada+Gambar'}" alt="${item.nama}">
                <div class="menu-details ${isAvailable ? '' : 'unavailable'}">
                    <h3>${item.nama} ${!isAvailable ? '<span style="color: red; font-size: 0.8em;">(Habis)</span>' : ''}</h3>
                    <p>${item.deskripsi || ''}</p>
                    ${levelSelectorHtml} 
                    <div class="price">${formatRupiah(parseFloat(item.harga))}</div>
                    <div class="quantity-control">
                        <button class="quantity-minus" data-id="${item.nama}" ${currentQuantityInCart === 0 ? 'disabled' : ''}>-</button>
                        <input type="number" class="quantity-input" data-id="${item.nama}" value="${currentQuantityInCart}" min="0" ${!isAvailable ? 'disabled' : ''}>
                        <button class="quantity-plus" data-id="${item.nama}" ${!isAvailable ? 'disabled' : ''}>+</button>
                    </div>
                </div>`;
            menuList.appendChild(menuItem);
        });
    
        document.querySelectorAll('.level-select').forEach(select => {
            select.addEventListener('change', (event) => {
                const itemName = event.target.closest('.level-selector').dataset.id;
                const newLevel = event.target.value;
                const itemInCart = cart.find(item => item.nama === itemName);
                if (itemInCart) {
                    itemInCart.level = newLevel;
                    updateCartDisplay();
                }
            });
        });
    
        document.querySelectorAll('.quantity-plus').forEach(b => b.addEventListener('click', e => adjustQuantity(e.target.dataset.id, 1)));
        document.querySelectorAll('.quantity-minus').forEach(b => b.addEventListener('click', e => adjustQuantity(e.target.dataset.id, -1)));
        document.querySelectorAll('.quantity-input').forEach(i => i.addEventListener('change', e => setQuantity(e.target.dataset.id, parseInt(e.target.value, 10))));
    }
    
    function adjustQuantity(itemName, delta) {
        const menuItem = allMenuItems.find(item => item.nama === itemName);
        if (!menuItem || menuItem.tersedia === false) {
            const tempMessage = document.createElement('p');
            tempMessage.style.color = 'red';
            tempMessage.textContent = `Maaf, ${menuItem?.nama || 'Item'} sedang tidak tersedia.`;
            const menuDetailsDiv = document.querySelector(`.menu-item .quantity-control[data-id="${itemName}"]`)?.parentElement;
            if (menuDetailsDiv) {
                menuDetailsDiv.appendChild(tempMessage);
                setTimeout(() => tempMessage.remove(), 3000);
            }
            return;
        }
        const existingItemIndex = cart.findIndex(item => item.nama === itemName);
        let newQuantity = (existingItemIndex > -1 ? cart[existingItemIndex].quantity : 0) + delta;
        setQuantity(itemName, newQuantity);
    }
    
    function setQuantity(itemName, newQuantity) {
        const menuItem = allMenuItems.find(item => item.nama === itemName);
        if (!menuItem) return;
    
        const existingItemIndex = cart.findIndex(item => item.nama === itemName);
        newQuantity = Math.max(0, newQuantity);
    
        if (newQuantity === 0) {
            if (existingItemIndex > -1) cart.splice(existingItemIndex, 1);
        } else {
            if (existingItemIndex > -1) {
                cart[existingItemIndex].quantity = newQuantity;
            } else {
                let level = null;
                if (menuItem.pilihan && Array.isArray(menuItem.pilihan) && menuItem.pilihan.length > 0) {
                    const levelSelector = document.querySelector(`.level-selector[data-id="${itemName}"] .level-select`);
                    if (levelSelector) level = levelSelector.value;
                }
                
                cart.push({ 
                    nama: menuItem.nama, 
                    harga: parseFloat(menuItem.harga), 
                    quantity: newQuantity,
                    level: level
                });
            }
        }
        updateMenuQuantityDisplay(itemName, newQuantity);
        updateCartDisplay();
    }
    function updateMenuQuantityDisplay(itemName, quantity) {
        const quantityInput = document.querySelector(`.quantity-input[data-id="${itemName}"]`);
        if (quantityInput) {
            quantityInput.value = quantity;
        }
        const quantityMinusButton = document.querySelector(`.quantity-minus[data-id="${itemName}"]`);
        if (quantityMinusButton) {
            quantityMinusButton.disabled = quantity === 0;
        }
    }
    
    function updateCartDisplay() {
        if (!cartItemsDiv || !cartTotalPriceSpan || !confirmOrderButton) { 
            console.warn("One or more cart display elements not found.");
            return;
        }
    
        cartItemsDiv.innerHTML = cart.length === 0 ? '<p>Keranjang kosong</p>' :
            cart.map(item => {
                const levelInfo = item.level ? ` (${item.level})` : '';
                return `
                    <div class="cart-item-detail">
                        <span>${item.nama}${levelInfo} (${item.quantity}x)</span>
                        <span>${formatRupiah(item.harga * item.quantity)}</span>
                        <button data-id="${item.nama}">Hapus</button>
                    </div>
                `;
            }).join('');
    
        const subtotal = cart.reduce((sum, item) => sum + (item.harga * item.quantity), 0);
        confirmOrderButton.style.display = cart.length === 0 ? 'none' : 'block';
        cartTotalPriceSpan.textContent = formatRupiah(subtotal); 
    
        cartItemsDiv.querySelectorAll('button').forEach(b => b.addEventListener('click', e => setQuantity(e.target.dataset.id, 0)));
    }
    
        function formatRupiah(angka) {
            if (isNaN(angka)) return 'Rp 0';
            return 'Rp ' + angka.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
        }
    
        if (confirmOrderButton) {
            confirmOrderButton.addEventListener('click', () => {
                if (cart.length === 0) {
                    const tempMessage = document.createElement('p');
                    tempMessage.style.color = 'red';
                    tempMessage.textContent = 'Keranjang belanja Anda kosong. Silakan pilih menu terlebih dahulu.';
                    if (cartSummary) { 
                        cartSummary.appendChild(tempMessage);
                        setTimeout(() => tempMessage.remove(), 3000);
                    } else {
                        console.warn("Element .cart-summary not found for displaying temporary message.");
                    }
                    return;
                }
                if (konfirmasiModal) konfirmasiModal.style.display = 'block';
            });
        }
    
        if (closeModalButton) {
            closeModalButton.addEventListener('click', () => {
                if (konfirmasiModal) konfirmasiModal.style.display = 'none';
                if (konfirmasiFormModal) konfirmasiFormModal.reset();
                if (konfirmasiModalLoading) konfirmasiModalLoading.style.display = 'none';
            });
        }
    
        window.addEventListener('click', (event) => {
            if (event.target === konfirmasiModal) {
                if (konfirmasiModal) konfirmasiModal.style.display = 'none';
                if (konfirmasiFormModal) konfirmasiFormModal.reset();
                if (konfirmasiModalLoading) konfirmasiModalLoading.style.display = 'none';
            }
        });
    
        if (konfirmasiFormModal) {
            konfirmasiFormModal.addEventListener('submit', async (event) => {
                event.preventDefault();
                const nama = modalNamaInput ? modalNamaInput.value : '';
                const whatsapp = modalWhatsappInput ? modalWhatsappInput.value : '';
                const alamat = modalAlamatInput ? modalAlamatInput.value : '';
                const catatan = modalCatatanInput ? modalCatatanInput.value : '';
                const email = modalEmailInput ? modalEmailInput.value : ''; 
    
                customerInfoForChat = { nama, whatsapp, alamat, catatan, email }; 
                localStorage.setItem('customerInfo', JSON.stringify(customerInfoForChat));
    
                if (konfirmasiModalLoading) konfirmasiModalLoading.style.display = 'block';
                if (konfirmasiFormModal) konfirmasiFormModal.style.display = 'none';
    
                try {
                    let subtotal = cart.reduce((sum, item) => sum + (item.harga * item.quantity), 0);
                    const orderDetails = {
                        customer: customerInfoForChat,
                        items: cart,
                        subtotal: subtotal, 
                        total: subtotal,
                        timestamp: Timestamp.now(), 
                        status: 'pending' 
                    };
    
                    const ordersCollectionRef = collection(db, `artifacts/${appId}/orders`);
                    await addDoc(ordersCollectionRef, orderDetails);
    
                    const response = await fetch(`${backendUrl}/api/initiate-order-chat`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(orderDetails), 
                    });
    
                    const data = await response.json();
                    if (response.ok) {
                        await saveChatMessage('bot', data.reply);
                        cart = [];
                        updateCartDisplay();
                        displayMenu(document.querySelector('.tab-button.active')?.dataset.category || 'semua');
    
                        if (konfirmasiModalLoading) {
                            konfirmasiModalLoading.innerHTML = `
                                <p>Pesanan Anda telah diterima!</p>
                                <div style="margin-top: 15px; padding: 15px; background-color: #e0f7fa; border-left: 5px solid #29b6f6; text-align: left;">
                                    <strong>Balasan Chatbot:</strong><br>${data.reply}
                                </div>
                                <button id="konfirmasi-modal-back-to-menu" class="btn-primary" style="margin-top: 20px;">Kembali ke Menu</button>
                            `;
                            const backToMenuButton = document.getElementById('konfirmasi-modal-back-to-menu');
                            if (backToMenuButton) {
                                backToMenuButton.addEventListener('click', () => {
                                    if (konfirmasiModal) konfirmasiModal.style.display = 'none';
                                    if (chatbotWidget) chatbotWidget.classList.remove('hidden');
                                    if (kontakSection) { 
                                        kontakSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                    }
                                    if (chatInput && !chatInput.value.trim()) {
                                        chatInput.value = `Halo, saya ${customerInfoForChat.nama || 'Pelanggan'}. Saya baru saja memesan. Bisakah Anda bantu saya?`;
                                    }
                                    if (chatInput) chatInput.focus(); 
                                });
                            }
                        }
                        console.log("Pesanan berhasil dikonfirmasi dan chat dimulai!");
                    } else {
                        if (konfirmasiModalLoading) konfirmasiModalLoading.innerHTML = `<p style="color: red;">Terjadi kesalahan: ${data.error || 'Server error'}.</p>`;
                        if (konfirmasiFormModal) konfirmasiFormModal.style.display = 'flex';
                    }
                } catch (error) {
                    console.error('Error confirming order:', error);
                    if (konfirmasiModalLoading) konfirmasiModalLoading.innerHTML = '<p style="color: red;">Terjadi kesalahan saat konfirmasi pesanan.</p>';
                    if (konfirmasiFormModal) konfirmasiFormModal.style.display = 'flex';
                }
            });
        }
    
        document.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', (event) => {
                document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
                event.target.classList.add('active');
                displayMenu(event.target.dataset.category);
            });
        });
    
        if (feedbackForm) {
            feedbackForm.addEventListener('submit', async (event) => {
                event.preventDefault();
                const nama = feedbackNamaInput ? feedbackNamaInput.value : '';
                const email = feedbackEmailInput ? feedbackEmailInput.value : '';
                const message = feedbackMessageInput ? feedbackMessageInput.value : '';
                if (!email || !message) {
                    if (feedbackStatusP) {
                        feedbackStatusP.style.color = 'red';
                        feedbackStatusP.textContent = 'Email dan pesan tidak boleh kosong.';
                    }
                    return;
                }
                if (feedbackStatusP) {
                    feedbackStatusP.style.color = 'orange';
                    feedbackStatusP.textContent = 'Mengirim kritik dan saran...';
                }
                try {
                    if (!db || !appId) throw new Error('Firestore tidak siap.');
                    const feedbackCollectionRef = collection(db, `artifacts/${appId}/feedback`);
                    await addDoc(feedbackCollectionRef, { nama: nama || 'Anonim', email, message, timestamp: Timestamp.now() });
                    if (feedbackStatusP) {
                        feedbackStatusP.style.color = 'green';
                        feedbackStatusP.textContent = 'Terima kasih! Kritik dan saran Anda telah terkirim.';
                    }
                    if (feedbackForm) feedbackForm.reset();
                } catch (error) {
                    console.error('Error sending feedback:', error);
                    if (feedbackStatusP) {
                        feedbackStatusP.style.color = 'red';
                        feedbackStatusP.textContent = `Gagal mengirim: ${error.message}`;
                    }
                }
            });
        }
    
    if (chatbotForm) {
        chatbotForm.addEventListener('submit', async (event) => {
            event.preventDefault();
    
            if (!currentUserId) {
                displayTemporaryBotMessage("Koneksi ke chat belum siap. Mohon tunggu sesaat dan coba lagi.");
                return; 
            }
    
            const userMessage = chatInput.value;
            console.log("Pesan Pengguna ke Chatbot:", userMessage);
    
            if (!userMessage.trim()) return;
    
            const currentTime = Date.now();
            if (currentTime - lastMessageTimestamp < THROTTLE_TIME_MS) {
                if (chatThrottleMessage) chatThrottleMessage.style.display = 'block';
                setTimeout(() => { if (chatThrottleMessage) chatThrottleMessage.style.display = 'none'; }, 5000);
                return;
            }
            lastMessageTimestamp = currentTime;
            localStorage.setItem('lastMessageTimestamp', currentTime);
    
            if (!db || !currentUserId || !appId) {
                displayTemporaryBotMessage("Firestore belum siap. Coba lagi sebentar.");
                return;
            }
    
            await saveChatMessage('user', userMessage);
            if (chatInput) chatInput.value = '';
            
            const loadingMessageElement = document.createElement('div');
            loadingMessageElement.id = 'loading-bot-response';
            loadingMessageElement.classList.add('chat-message', 'bot');
            loadingMessageElement.innerHTML = `<div class="text"><em>Hallu sedang mengetik...</em></div>`;
            if (chatHistoryDiv) chatHistoryDiv.appendChild(loadingMessageElement);
            if (chatHistoryDiv) chatHistoryDiv.scrollTop = chatHistoryDiv.scrollHeight;
    
            try {
                const chatHistoryDocs = (await getDocs(query(collection(db, `artifacts/${appId}/users/${currentUserId}/chat_history`), orderBy('timestamp', 'asc')))).docs;
                const chatHistoryContext = chatHistoryDocs.map(doc => doc.data());
    
                const response = await fetch(`${backendUrl}/api/chat`,  {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ customer: customerInfoForChat, message: userMessage, history: chatHistoryContext }),
                });
                
                if (loadingMessageElement) loadingMessageElement.remove();
                
                const data = await response.json();
                if (response.ok) {
                    await saveChatMessage('bot', data.reply); 
                } else {
                    displayTemporaryBotMessage(`Maaf, terjadi kesalahan dari server: ${data.error || 'Unknown error'}.`);
                }
            } catch (error) {
                if (loadingMessageElement) loadingMessageElement.remove();
                console.error('Error sending message to chatbot:', error);
                displayTemporaryBotMessage(`Maaf, terjadi kesalahan koneksi. Silakan coba lagi nanti.`);
            }
        });
    }
    
    if (chatIcon && chatbotWidget && closeChatButton) {
        const openChat = () => {
            if (chatbotWidget) chatbotWidget.classList.remove('hidden');
            if (kontakSection) { 
                kontakSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        };
        const closeChat = () => {
            if (chatbotWidget) chatbotWidget.classList.add('hidden');
        };
        
        chatIcon.addEventListener('click', openChat);
        closeChatButton.addEventListener('click', closeChat);
    
        if (navChatbotLink) {
            navChatbotLink.addEventListener('click', (e) => {
                e.preventDefault();
                openChat();
            });
        }
    }
        initializeFirebaseAndAuth();
        updateCartDisplay(); 
    });
    

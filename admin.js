import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { collection, deleteDoc, doc, getFirestore, limit, onSnapshot, orderBy, query, Timestamp, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

function createConfirmationMessage(order) {
    const itemsList = order.items.map(item => `- ${item.nama} (${item.quantity}x)`).join('\n');
    const message = `Halo Kak ${order.customer.nama}, terima kasih sudah memesan di Warung Halu! 
    \n\nPesanan Anda:\n${itemsList}\n\nTotal: Rp ${order.total.toLocaleString('id-ID')}\n\nPesanan sedang kami siapkan ya. Estimasi selesai sekitar 15-20 menit lagi. Tolong share lokasi ya agar proses pengantaran gampang.`;
    return encodeURIComponent(message);
}

function createDeliveryMessage(customerName) {
    const message = `Halo Kak ${customerName}, pesanan Anda dari Warung Halu sudah selesai dan sedang dalam perjalanan menuju lokasi ya! Mohon ditunggu.`;
    return encodeURIComponent(message);
}

    let db = null;
    let auth = null;
    let currentAdminUserId = null;

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

document.addEventListener('DOMContentLoaded', () => {
    const loginSection = document.getElementById('login-section');
    const dashboardSection = document.getElementById('dashboard-section');
    const loginForm = document.getElementById('login-form');
    const adminEmailInput = document.getElementById('admin-email');
    const adminPasswordInput = document.getElementById('admin-password');
    const loginErrorDisplay = document.getElementById('login-error');
    const adminEmailDisplay = document.getElementById('admin-email-display');
    const logoutButton = document.getElementById('logout-button');
    const ordersList = document.getElementById('orders-list');
    const feedbackList = document.getElementById('feedback-list'); 
    const dashboardErrorOrdersDisplay = document.getElementById('dashboard-error-orders'); 
    const dashboardErrorFeedbackDisplay = document.getElementById('dashboard-error-feedback'); 

    async function initializeFirebaseAdmin() {
        try {
            const app = initializeApp(firebaseConfig);
            db = getFirestore(app);
            auth = getAuth(app);
            onAuthStateChanged(auth, (user) => {
                if (user) {
                    currentAdminUserId = user.uid;
                    adminEmailDisplay.textContent = user.email;
                    showDashboard();
                    setupOrdersListener(db, appId);
                    setupFeedbackListener(db, appId); 
                } else {
                    showLogin();
                }
            });
        } 
        catch (error) {
            console.error('Admin Error: Kesalahan saat menginisialisasi Firebase Admin:', error);
            dashboardErrorOrdersDisplay.textContent = 'Kesalahan fatal saat inisialisasi Firebase. Periksa konsol.';
            dashboardErrorOrdersDisplay.style.display = 'block';
        }
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = adminEmailInput.value;
        const password = adminPasswordInput.value;
        loginErrorDisplay.style.display = 'none';
        loginErrorDisplay.textContent = '';
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error) {
            console.error('Admin Error: Gagal login:', error);
            loginErrorDisplay.textContent = `Login gagal: ${error.message}`;
            loginErrorDisplay.style.display = 'block';
        }
    });
    
    logoutButton.addEventListener('click', async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error('Admin Error: Gagal logout:', error);
            dashboardErrorOrdersDisplay.textContent = `Logout gagal: ${error.message}`;
            dashboardErrorOrdersDisplay.style.display = 'block';
        }
    });

    function showLogin() {
        loginSection.style.display = 'block';
        dashboardSection.style.display = 'none';
        loginErrorDisplay.style.display = 'none';
        loginForm.reset();
    }

    function showDashboard() {
        loginSection.style.display = 'none';
        dashboardSection.style.display = 'block';
        dashboardErrorOrdersDisplay.style.display = 'none';
        dashboardErrorFeedbackDisplay.style.display = 'none';
    }
    // --- Firestore Order Listener ---
    function setupOrdersListener(firestoreDb, appId) {
        if (!firestoreDb || !appId) {
            ordersList.innerHTML = '<p style="color: red;">Gagal memuat pesanan: Database tidak siap.</p>';
            return;
        }
        const ordersCollectionRef = collection(firestoreDb, `artifacts/${appId}/orders`);
        const q = query(ordersCollectionRef, orderBy('timestamp', 'desc'), limit(50)); 
        onSnapshot(q, (snapshot) => {
            ordersList.innerHTML = ''; 
            if (snapshot.empty) {
                ordersList.innerHTML = '<p>Belum ada pesanan baru.</p>';
                return;
            }
            snapshot.forEach(doc => {
                const order = doc.data();
                const orderId = doc.id;
                displayOrder(order, orderId);
            });
        }, (error) => {
            console.error('Admin Error: Error fetching orders:', error);
            dashboardErrorOrdersDisplay.textContent = '<p style="color: red;">Gagal memuat pesanan. Periksa koneksi atau izin Firestore.</p>';
            dashboardErrorOrdersDisplay.style.display = 'block';
        });
    }

    function displayOrder(order, orderId) {
    const orderItem = document.createElement('div');
    orderItem.classList.add('order-item');

    const timestamp = order.timestamp instanceof Timestamp ? order.timestamp.toDate().toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short'}) : 'N/A';
    const totalFormatted = (order.total || 0).toLocaleString('id-ID'); 
    
    const status = order.status || 'pending'; 
    const statusClass = status === 'completed' ? 'status-completed' : 'status-pending';
    const statusText = status === 'completed' ? 'Selesai' : 'Pending';

    let itemsHtml = order.items.map(item => {
        const levelInfo = item.level ? ` (Level ${item.level})` : '';
        return `<li>${item.nama}${levelInfo} (${item.quantity}x)</li>`;
    }).join('');

    const whatsappNumber = order.customer.whatsapp || '';
    let whatsappUrl = '#'; 
    if (whatsappNumber) {
        let cleanPhone = whatsappNumber.replace(/\D/g, '');
        if (cleanPhone.startsWith('0')) {
            cleanPhone = '62' + cleanPhone.substring(1);
        }
        whatsappUrl = `https://wa.me/${cleanPhone}`;
    }

    const confirmationMsg = createConfirmationMessage(order);
    const deliveryMsg = createDeliveryMessage(order.customer.nama);

    let actionButtonsHtml = '';
    if (status === 'pending') {
        actionButtonsHtml = `
            <button class="mark-completed-button" data-id="${orderId}">Tandai Selesai</button>
            <button class="cancel-order-button" data-id="${orderId}">Batalkan Pesanan</button>
        `;
    } else {
        actionButtonsHtml = `
            <button class="delete-order-button" data-id="${orderId}">Hapus Pesanan</button>
        `;
    }

    orderItem.innerHTML = `
        <div class="order-status ${statusClass}">${statusText}</div> 
        <div class="order-header">
            <span>Pesanan ID: ${orderId.substring(0, 8)}...</span>
            <span>${timestamp}</span>
        </div>
        <p><strong>Pelanggan:</strong> ${order.customer.nama}</p>
        <p><strong>WA:</strong> <a href="${whatsappUrl}" target="_blank">${whatsappNumber || '-'}</a></p>
        <p><strong>Catatan:</strong> ${order.customer.catatan || '-'}</p>
        <p><strong>Total Keseluruhan:</strong> Rp ${totalFormatted}</p>
        <p><strong>Item Pesanan:</strong></p>
        <ul class="order-items-list">${itemsHtml}</ul>
        
        <div style="margin-top: 15px; border-top: 1px solid #eee; padding-top: 10px;">
            <p style="font-weight: bold; margin-bottom: 10px;">Kirim Pesan Cepat:</p>
            <a href="${whatsappUrl}?text=${confirmationMsg}" target="_blank" class="quick-message-button" style="background-color: #2196F3;">Konfirmasi Pesanan</a>
            <a href="${whatsappUrl}?text=${deliveryMsg}" target="_blank" class="quick-message-button" style="background-color: #FF9800;">Info Pengantaran</a>
        </div>

        <div class="order-actions">
            ${actionButtonsHtml}
        </div>
    `;
    ordersList.prepend(orderItem); 

    // Event listener untuk tombol-tombol baru
    const markCompletedButton = orderItem.querySelector('.mark-completed-button');
    if (markCompletedButton) {
        markCompletedButton.addEventListener('click', () => markOrderAsCompleted(orderId));
    }

    const cancelOrderButton = orderItem.querySelector('.cancel-order-button');
    if (cancelOrderButton) {
        cancelOrderButton.addEventListener('click', () => {
            // Untuk "Batalkan", kita bisa gunakan fungsi hapus yang sama
            if (confirm('Anda yakin ingin MEMBATALKAN pesanan ini? Aksi ini akan menghapus pesanan dari daftar.')) {
                deleteOrder(orderId);
            }
        });
    }

    const deleteOrderButton = orderItem.querySelector('.delete-order-button');
    if (deleteOrderButton) {
        deleteOrderButton.addEventListener('click', () => deleteOrder(orderId));
    }
}

    async function markOrderAsCompleted(orderId) {
        if (!db || !appId) {
            alert('Kesalahan: Database tidak siap.'); 
            return;
        }
        if (!confirm('Apakah Anda yakin ingin menandai pesanan ini sebagai "Selesai"?')) return;
        try {
            const orderRef = doc(db, `artifacts/${appId}/orders`, orderId);
            await updateDoc(orderRef, { status: 'completed', completedAt: Timestamp.now() });
        } catch (error) {
            alert(`Gagal menandai pesanan sebagai Selesai: ${error.message}.`); 
        }
    }

    async function deleteOrder(orderId) {
        if (!db || !appId) {
            alert('Kesalahan: Database tidak siap.'); 
            return;
        }
        if (!confirm('Apakah Anda yakin ingin MENGHAPUS pesanan ini? Aksi ini tidak dapat dibatalkan.')) return;
        try {
            const orderRef = doc(db, `artifacts/${appId}/orders`, orderId);
            await deleteDoc(orderRef);
            alert('Pesanan berhasil dihapus.');
        } catch (error) {
            alert(`Gagal menghapus pesanan: ${error.message}.`); 
        }
    }

    function setupFeedbackListener(firestoreDb, appId) {
        if (!firestoreDb || !appId) {
            feedbackList.innerHTML = '<p style="color: red;">Gagal memuat kritik & saran: Database tidak siap.</p>';
            return;
        }
        const feedbackCollectionRef = collection(firestoreDb, `artifacts/${appId}/feedback`);
        const q = query(feedbackCollectionRef, orderBy('timestamp', 'desc'), limit(20)); 
        onSnapshot(q, (snapshot) => {
            feedbackList.innerHTML = ''; 
            if (snapshot.empty) {
                feedbackList.innerHTML = '<p>Belum ada kritik & saran baru.</p>';
                return;
            }
            snapshot.forEach(doc => {
                const feedback = doc.data();
                displayFeedback(feedback, doc.id);
            });
        }, (error) => {
            dashboardErrorFeedbackDisplay.textContent = '<p style="color: red;">Gagal memuat kritik & saran.</p>';
            dashboardErrorFeedbackDisplay.style.display = 'block';
        });
    }

    function displayFeedback(feedback, feedbackId) {
        const feedbackItem = document.createElement('div');
        feedbackItem.classList.add('feedback-item'); 
        feedbackItem.innerHTML = `
            <div class="feedback-header">
                <span>ID: ${feedbackId.substring(0, 8)}...</span>
                <span>${feedback.timestamp instanceof Timestamp ? feedback.timestamp.toDate().toLocaleString('id-ID') : 'N/A'}</span>
            </div>
            <p><strong>Dari:</strong> ${feedback.nama || 'Anonim'} (${feedback.email})</p>
            <p><strong>Pesan:</strong> ${feedback.message}</p>
        `;
        feedbackList.prepend(feedbackItem); 
    }   

    initializeFirebaseAdmin();
});
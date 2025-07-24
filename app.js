// Self-invoking function to encapsulate the entire application logic
(() => {
    'use strict';
    document.addEventListener('DOMContentLoaded', () => {
        // --- DATABASE INITIALIZATION ---
        const DB_NAME = 'EduSIAPDB_Final';
        const DB_VERSION = 5; // Version incremented for new features
        let db;

        // Configuration for all object stores and their indexes
        const storeConfig = {
            sekolah: { keyPath: 'id' },
            users: { keyPath: 'id', autoIncrement: true, indexes: { username: { keyPath: 'username', options: { unique: true } } } },
            ptk: { keyPath: 'id', autoIncrement: true, indexes: { nama: 'nama', nuptk: 'nuptk' } },
            siswa: { keyPath: 'id', autoIncrement: true, indexes: { nama: 'nama', nisn: 'nisn', kelasId: 'kelasId' } },
            mutasi: { keyPath: 'id', autoIncrement: true },
            alumni: { keyPath: 'id', autoIncrement: true, indexes: { nama: 'nama' } },
            suratMasuk: { keyPath: 'id', autoIncrement: true },
            suratKeluar: { keyPath: 'id', autoIncrement: true },
            inventaris: { keyPath: 'id', autoIncrement: true, indexes: { nama: 'nama', lokasi: 'lokasi', kondisi: 'kondisi' } },
            stokHarian: { keyPath: 'id', autoIncrement: true, indexes: { nama: 'nama' } },
            spp: { keyPath: 'id', autoIncrement: true, indexes: { nama_siswa: 'nama_siswa' } },
            infaq: { keyPath: 'id', autoIncrement: true },
            gaji: { keyPath: 'id', autoIncrement: true, indexes: { nama_guru: 'nama_guru' } },
            pengeluaran: { keyPath: 'id', autoIncrement: true },
            // NEW & UPDATED STORES
            mapel: { keyPath: 'id', autoIncrement: true, indexes: { kode_mapel: { keyPath: 'kode_mapel', options: { unique: true } } } },
            kelas: { keyPath: 'id', autoIncrement: true, indexes: { nama_kelas: 'nama_kelas' } },
            nilai: { keyPath: 'id', autoIncrement: true, indexes: { siswaId: 'siswaId', mapelId: 'mapelId', jenis: 'jenis' } },
            identitasRapor: { keyPath: 'id' },
            spmb: { keyPath: 'id', autoIncrement: true },
            jadwal: { keyPath: 'id', autoIncrement: true, indexes: { kelasId: 'kelasId', hari: 'hari' } },
            gajiInfal: { keyPath: 'id', autoIncrement: true },
            gajiCatatan: { keyPath: 'id', autoIncrement: true },
        };

        function initDB() {
            return new Promise((resolve, reject) => {
                const request = indexedDB.open(DB_NAME, DB_VERSION);
                request.onerror = (event) => { console.error('Database error:', event.target.errorCode); reject('Database error'); };
                request.onsuccess = (event) => { db = event.target.result; console.log('Database opened successfully.'); resolve(db); };
                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    const tx = event.target.transaction;
                    console.log("Upgrading database from version", event.oldVersion, "to", event.newVersion);

                    Object.entries(storeConfig).forEach(([name, config]) => {
                        let store;
                        if (!db.objectStoreNames.contains(name)) {
                            store = db.createObjectStore(name, { keyPath: config.keyPath, autoIncrement: !!config.autoIncrement });
                            console.log(`Object store '${name}' created.`);
                        } else {
                            store = tx.objectStore(name);
                        }

                        if (config.indexes) {
                            Object.entries(config.indexes).forEach(([indexName, indexConfig]) => {
                                if (!store.indexNames.contains(indexName)) {
                                    if (typeof indexConfig === 'string') { // Simple index
                                        store.createIndex(indexName, indexConfig);
                                    } else { // Complex index with options
                                        store.createIndex(indexName, indexConfig.keyPath, indexConfig.options);
                                    }
                                    console.log(`Index '${indexName}' created on store '${name}'.`);
                                }
                            });
                        }
                    });
                    
                    const userStore = tx.objectStore('users');
                    const checkAdmin = userStore.index('username').get('admin');
                    checkAdmin.onsuccess = () => {
                        if (!checkAdmin.result) {
                            console.log("Seeding default admin user...");
                            userStore.add({ username: 'admin', password: 'admin', role: 'Admin' });
                        }
                    };
                };
            });
        }

        // --- UI ELEMENTS & STATE ---
        const loginScreen = document.getElementById('login-screen');
        const appContainer = document.getElementById('app-container');
        const loginForm = document.getElementById('login-form');
        const loginError = document.getElementById('login-error');
        const headerTitle = document.getElementById('header-title');
        const allNavItems = document.querySelectorAll('.nav-item');
        const homeGrid = document.querySelector('.home-grid');
        const modal = document.getElementById('form-modal');
        const modalTitle = document.getElementById('modal-title');
        const modalBody = document.getElementById('modal-body');
        const modalFooter = document.getElementById('modal-footer');
        const closeModalBtn = document.querySelector('#form-modal .close-button');
        const imageViewerModal = document.getElementById('image-viewer-modal');
        const imageViewerSrc = document.getElementById('image-viewer-src');
        const closeImageViewerBtn = document.querySelector('#image-viewer-modal .close-button');
        const toast = document.getElementById('toast');
        let charts = {};
        let currentPageId = 'home';
        let currentUser = null;
        let themeSwitchElement = null;
        const getCurrentPage = () => currentPageId;

        // --- AUTHENTICATION & SESSION ---
        function showLoginScreen() {
            loginScreen.style.display = 'flex';
            appContainer.style.display = 'none';
        }

        function showAppScreen() {
            loginScreen.style.display = 'none';
            appContainer.style.display = 'flex';
        }
        
        async function handleLogin(e) {
            e.preventDefault();
            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value;
            loginError.textContent = '';

            if (!username || !password) {
                loginError.textContent = 'Username dan password harus diisi.';
                return;
            }

            try {
                const tx = db.transaction('users', 'readonly');
                const store = tx.objectStore('users');
                const index = store.index('username');
                const request = index.get(username);

                request.onsuccess = () => {
                    const user = request.result;
                    if (user && user.password === password) {
                        currentUser = user;
                        sessionStorage.setItem('currentUser', JSON.stringify(user));
                        initializeAppUI();
                    } else {
                        loginError.textContent = 'Username atau password salah.';
                    }
                };
                request.onerror = () => {
                    loginError.textContent = 'Terjadi kesalahan saat login.';
                };
            } catch (err) {
                console.error("Login error:", err);
                loginError.textContent = 'Database tidak siap. Coba lagi.';
            }
        }

        function handleLogout() {
            showConfirmation("Apakah Anda yakin ingin logout?", () => {
                sessionStorage.removeItem('currentUser');
                currentUser = null;
                window.location.reload();
            });
        }

        function checkSession() {
            const userSession = sessionStorage.getItem('currentUser');
            if (userSession) {
                currentUser = JSON.parse(userSession);
                initializeAppUI();
            } else {
                showLoginScreen();
                loginForm.addEventListener('submit', handleLogin);
            }
        }

        // --- ROLE-BASED ACCESS CONTROL (RBAC) ---
        function setupUIAccess() {
            if (!currentUser) return;
            
            const userRole = currentUser.role;
            document.getElementById('user-role-display').textContent = `Anda login sebagai: ${userRole}`;

            allNavItems.forEach(item => {
                const roles = item.dataset.roles;
                if (roles === 'all' || roles.split(',').includes(userRole)) {
                    item.style.display = '';
                } else {
                    item.style.display = 'none';
                }
            });

            const originalMenuCards = [
                { page: 'dashboard', icon: 'fa-tachometer-alt', title: 'Dashboard', roles: 'Admin,Kepala Yayasan,Kepala Sekolah' },
                { page: 'laporan', icon: 'fa-chart-pie', title: 'Laporan', roles: 'Admin,Kepala Yayasan,Kepala Sekolah' },
                { page: 'kesiswaan', icon: 'fa-users', title: 'Kesiswaan', roles: 'Admin,Kepala Sekolah,Guru' },
                { page: 'ptk', icon: 'fa-chalkboard-teacher', title: 'Data PTK', roles: 'Admin,Kepala Sekolah' },
                { page: 'rapor', icon: 'fa-id-card', title: 'Data Rapor', roles: 'Admin,Kepala Sekolah,Guru' },
                { page: 'jadwal', icon: 'fa-calendar-alt', title: 'Jadwal', roles: 'Admin,Kepala Sekolah,Guru' },
                { page: 'keuangan', icon: 'fa-wallet', title: 'Keuangan', roles: 'Admin,Kepala Yayasan,Kepala Sekolah' },
                { page: 'sarpras', icon: 'fa-boxes-stacked', title: 'Sarpras', roles: 'Admin,Kepala Sekolah' },
                { page: 'surat', icon: 'fa-envelope', title: 'Persuratan', roles: 'Admin,Kepala Sekolah' },
                { page: 'pengaturan', icon: 'fa-cog', title: 'Pengaturan', roles: 'Admin' },
                { page: 'akun', icon: 'fa-user-circle', title: 'Akun Saya', roles: 'all' },
            ];
            
            homeGrid.innerHTML = '';
            originalMenuCards.forEach((card, index) => {
                 if (card.roles === 'all' || card.roles.split(',').includes(userRole)) {
                    const cardEl = document.createElement('a');
                    cardEl.className = 'menu-card animate__animated animate__fadeInUp';
                    cardEl.dataset.page = card.page;
                    cardEl.style.animationDelay = `${index * 0.1}s`;
                    cardEl.innerHTML = `
                        <div class="icon-wrapper"><i class="fas ${card.icon}"></i></div>
                        <h3>${card.title}</h3>
                    `;
                    homeGrid.appendChild(cardEl);
                 }
            });
            homeGrid.querySelectorAll('.menu-card').forEach(card => card.addEventListener('click', (e) => { e.preventDefault(); switchPage(e.currentTarget.dataset.page); }));
        }

        // --- THEME MANAGEMENT ---
        function applyTheme(theme) {
            if (theme === 'dark-mode') {
                document.documentElement.classList.add('dark-mode');
                if(themeSwitchElement) themeSwitchElement.querySelector('input').checked = true;
            } else {
                document.documentElement.classList.remove('dark-mode');
                if(themeSwitchElement) themeSwitchElement.querySelector('input').checked = false;
            }
            if (db && currentUser) {
                loadPageData(getCurrentPage());
            }
        }

        function toggleTheme(e) {
            const theme = e.target.checked ? 'dark-mode' : 'light-mode';
            localStorage.setItem('theme', theme);
            applyTheme(theme);
        }

        // --- RESPONSIVE UI LOGIC ---
        function handleResponsiveLayout() {
            if (!themeSwitchElement) return;
            const desktopContainer = document.getElementById('desktop-theme-toggle-container');
            const akunContainer = document.getElementById('akun-theme-toggle-container');

            if (window.innerWidth >= 768) {
                if (desktopContainer && !desktopContainer.contains(themeSwitchElement)) {
                    desktopContainer.appendChild(themeSwitchElement);
                }
            } else {
                if (akunContainer && !akunContainer.contains(themeSwitchElement)) {
                     akunContainer.appendChild(themeSwitchElement);
                }
            }
        }

        // --- NAVIGATION LOGIC ---
        function switchPage(pageId) {
            const targetPage = document.getElementById(`page-${pageId}`);
            if (!targetPage) return;
            
            document.querySelector('.page.active')?.classList.remove('active');
            targetPage.classList.add('active', 'animate__animated', 'animate__fadeIn');
            targetPage.addEventListener('animationend', () => targetPage.classList.remove('animate__animated', 'animate__fadeIn'), { once: true });

            const pageTitleElement = document.querySelector(`.nav-item[data-page="${pageId}"] span`);
            headerTitle.textContent = pageId === 'home' ? 'EduSIAP Mobile' : (pageTitleElement?.textContent || 'EduSIAP');
            
            allNavItems.forEach(item => item.classList.remove('active'));
            document.querySelector(`.nav-item[data-page="${pageId}"]`)?.classList.add('active');
            
            currentPageId = pageId;
            loadPageData(pageId);
        }

        // --- MODAL, CONFIRMATION & TOAST ---
        function openModal(title, formHtml) { 
            modalTitle.textContent = title; 
            modalBody.innerHTML = formHtml; 
            modalFooter.style.display = 'none';
            modalFooter.innerHTML = '';
            modal.style.display = 'flex'; 
        }
        function closeModal() { modal.style.display = 'none'; modalBody.innerHTML = ''; modalFooter.innerHTML = ''; }
        
        function openImageViewer(base64Image) {
            if (base64Image) {
                imageViewerSrc.src = base64Image;
                imageViewerModal.style.display = 'flex';
            } else {
                showToast('Tidak ada bukti gambar untuk ditampilkan.');
            }
        }
        function closeImageViewer() { imageViewerModal.style.display = 'none'; imageViewerSrc.src = ''; }

        function showToast(message, duration = 3000) { toast.textContent = message; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), duration); }
        
        function showConfirmation(message, onConfirm) {
            openModal('Konfirmasi', `<p>${message}</p>`);
            modalFooter.style.display = 'flex';
            modalFooter.innerHTML = `
                <button id="confirm-btn-yes" class="btn btn-danger">Ya</button>
                <button id="confirm-btn-no" class="btn btn-outline-secondary">Batal</button>
            `;
            document.getElementById('confirm-btn-yes').onclick = () => {
                onConfirm();
                closeModal();
            };
            document.getElementById('confirm-btn-no').onclick = closeModal;
        }

        // --- GENERIC DB & HELPER FUNCTIONS ---
        const dbAction = (storeName, mode, action, ...args) => new Promise((resolve, reject) => {
            if (!db) { reject("Database not initialized"); return; }
            try {
                const tx = db.transaction(storeName, mode);
                const store = tx.objectStore(storeName);
                const request = store[action](...args);
                tx.oncomplete = () => resolve(request.result);
                tx.onerror = () => reject(tx.error);
            } catch (err) {
                reject(err);
            }
        });

        const addItem = (store, data) => dbAction(store, 'readwrite', 'add', data);
        const getAllItems = (store) => dbAction(store, 'readonly', 'getAll');
        const getItemById = (store, id) => dbAction(store, 'readonly', 'get', id);
        const updateItem = (store, data) => dbAction(store, 'readwrite', 'put', data);
        const deleteItem = (store, id) => dbAction(store, 'readwrite', 'delete', id);
        const formatCurrency = (val) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val || 0);
        const today = () => new Date().toISOString().slice(0,10);
        const formatBytes = (bytes, decimals = 2) => {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const dm = decimals < 0 ? 0 : decimals;
            const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
        }
        function fileToBase64(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => resolve(reader.result);
                reader.onerror = error => reject(error);
            });
        }
        
        // --- EXPORT & IMPORT HELPERS ---
        async function exportToExcel(data, headers, fileName) {
            try {
                if (data.length === 0) { showToast('Tidak ada data untuk diekspor.'); return; }
                const dataToExport = data.map(item => {
                    const newItem = {};
                    for (const key in headers) {
                        newItem[key] = item[key];
                    }
                    return newItem;
                });
                const worksheet = XLSX.utils.json_to_sheet(dataToExport, { header: Object.keys(headers) });
                XLSX.utils.sheet_add_aoa(worksheet, [Object.values(headers)], { origin: "A1" });
                const workbook = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
                XLSX.writeFile(workbook, fileName);
                showToast('Ekspor ke Excel berhasil!');
            } catch (err) { showToast('Gagal mengekspor data.'); console.error("Excel export error:", err); }
        }
        
        async function exportToPdf(title, elementIdToPrint) {
            try {
                const { jsPDF } = window.jspdf;
                if (typeof html2canvas === 'undefined' || typeof jsPDF === 'undefined') {
                    showToast('Gagal memuat pustaka PDF. Periksa koneksi internet Anda.');
                    return;
                }
                const printElement = document.getElementById(elementIdToPrint);
                if (!printElement) {
                    showToast('Elemen untuk dicetak tidak ditemukan.');
                    return;
                }
                showToast('Membuat PDF...');
                
                await html2canvas(printElement, { 
                    scale: 2, 
                    useCORS: true, 
                    backgroundColor: '#ffffff' 
                }).then(canvas => {
                    const imgData = canvas.toDataURL('image/png');
                    const doc = new jsPDF('p', 'mm', 'a4');
                    const imgProps = doc.getImageProperties(imgData);
                    const pdfWidth = doc.internal.pageSize.getWidth() - 20;
                    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
                    doc.addImage(imgData, 'PNG', 10, 10, pdfWidth, pdfHeight);
                    doc.save(`${title.replace(/ /g, '_').toLowerCase()}.pdf`);
                    showToast('Ekspor ke PDF berhasil!');
                });
            } catch (err) {
                showToast('Gagal mengekspor data PDF.');
                console.error("PDF export error:", err);
            }
        }
        
        function downloadTemplate(headers, fileName) {
            const worksheet = XLSX.utils.aoa_to_sheet([headers]);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');
            XLSX.writeFile(workbook, fileName);
        }

        function handleImport(fileInput, storeName, expectedHeaders, renderer) {
            fileInput.click();
            fileInput.onchange = (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = async (event) => {
                    try {
                        const data = new Uint8Array(event.target.result);
                        const workbook = XLSX.read(data, { type: 'array' });
                        const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
                        if (jsonData.length === 0) { showToast("File kosong atau format tidak sesuai."); return; }
                        const fileHeaders = Object.keys(jsonData[0]);
                        const isValid = expectedHeaders.every(h => fileHeaders.includes(h));
                        if (!isValid) { showToast(`Format template tidak sesuai. Pastikan kolom ${expectedHeaders.join(', ')} ada.`); return; }
                        const tx = db.transaction(storeName, 'readwrite');
                        jsonData.forEach(item => tx.objectStore(storeName).add(item));
                        await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej; });
                        showToast(`Berhasil mengimpor ${jsonData.length} data.`);
                        renderer();
                    } catch (error) { showToast('Gagal memproses file Excel.'); console.error('Import error:', error); } 
                    finally { fileInput.value = ''; }
                };
                reader.readAsArrayBuffer(file);
            };
        }

        // --- PAGE LOAD DISPATCHER ---
        function loadPageData(pageId) {
            Object.values(charts).forEach(chart => chart?.destroy());
            charts = {};
            const isDarkMode = document.documentElement.classList.contains('dark-mode');
            Chart.defaults.color = isDarkMode ? '#B0BEC5' : '#546E7A';
            Chart.defaults.borderColor = isDarkMode ? '#455A64' : '#CFD8DC';

            const pageRenderers = {
                home: renderHomePage,
                dashboard: renderDashboard,
                laporan: renderLaporan,
                pengaturan: renderPengaturan,
                akun: renderAkunPage,
                kesiswaan: renderKesiswaan,
                ptk: renderPtk,
                rapor: renderRapor,
                jadwal: renderJadwal,
                sarpras: renderSarpras,
                keuangan: renderKeuangan,
                surat: renderSurat,
            };
            pageRenderers[pageId]?.();
        }
        
        // --- GENERIC FORM HANDLER & OPENER ---
        async function handleGenericFormSubmit(e, storeName, renderer, fieldSelectors) {
            e.preventDefault();
            const idInput = document.getElementById('item-id');
            const id = idInput ? idInput.value : null;
            
            const data = {};
            for (const key in fieldSelectors) {
                const element = document.getElementById(fieldSelectors[key]);
                if (element) {
                    if (element.type === 'file') {
                        if (element.files && element.files[0]) {
                            data[key] = await fileToBase64(element.files[0]);
                        } else {
                            const existingData = id ? await getItemById(storeName, parseInt(id)) : {};
                            data[key] = existingData[key] || null;
                        }
                    } else if (element.type === 'checkbox') {
                        data[key] = element.checked;
                    } else {
                        data[key] = element.type === 'number' ? Number(element.value) : element.value;
                    }
                }
            }

            try {
                if (id) {
                    data.id = parseInt(id);
                    await updateItem(storeName, data);
                    showToast('Data berhasil diperbarui!');
                } else {
                    await addItem(storeName, data);
                    showToast('Data berhasil ditambahkan!');
                }
                closeModal();
                if (renderer) renderer();
                if (['siswa', 'ptk', 'alumni', 'pengeluaran', 'spp', 'infaq'].includes(storeName)) {
                    renderDashboard();
                    renderLaporan();
                }
            } catch(err) {
                showToast('Gagal menyimpan data!');
                console.error(`Submit error for ${storeName}:`, err);
            }
        }

        async function openGenericForm(id, storeName, title, formHtmlGenerator, submitHandler) {
            const item = id ? await getItemById(storeName, id) : {};
            openModal(id ? `Edit ${title}` : `Tambah ${title}`, await formHtmlGenerator(item));
            const form = document.getElementById('form-dynamic-handler');
            if (form) {
                form.addEventListener('submit', submitHandler);
            }
            const fileInput = form.querySelector('input[type="file"]');
            if (fileInput) {
                const fileNameDisplay = form.querySelector('.file-name');
                if (fileNameDisplay) {
                    fileInput.addEventListener('change', () => {
                        fileNameDisplay.textContent = fileInput.files[0] ? fileInput.files[0].name : 'Pilih file...';
                    });
                }
            }
        }

        // --- RENDER FUNCTIONS ---
        
        async function renderHomePage() {
            try {
                const profile = await getItemById('sekolah', 1);
                document.getElementById('home-welcome-title').textContent = (profile && profile.nama_sekolah) ? `Selamat Datang di ${profile.nama_sekolah}` : 'Selamat Datang!';
            } catch(e){ console.error(e) }
        }
        
        function renderAkunPage() {
            if (currentUser) {
                document.getElementById('akun-username').textContent = currentUser.username;
                document.getElementById('akun-role').textContent = currentUser.role;
                handleResponsiveLayout();
            }
        }

        async function renderDashboard() {
            try {
                const [siswa, ptk, alumni, pengeluaran] = await Promise.all([ getAllItems('siswa'), getAllItems('ptk'), getAllItems('alumni'), getAllItems('pengeluaran') ]);
                document.getElementById('siswa-count').textContent = siswa.filter(s => s.status === 'Aktif').length;
                document.getElementById('ptk-count').textContent = ptk.length;
                document.getElementById('alumni-count').textContent = alumni.length;
                const totalPengeluaran = pengeluaran.reduce((sum, item) => sum + Number(item.jumlah || 0), 0);
                document.getElementById('pengeluaran-count').textContent = formatCurrency(totalPengeluaran);
                
                const ctx = document.getElementById('dataChart').getContext('2d');
                if (charts.dashboard) charts.dashboard.destroy();
                charts.dashboard = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: ['Siswa Aktif', 'PTK', 'Alumni'],
                        datasets: [{
                            label: 'Jumlah Data',
                            data: [siswa.filter(s => s.status === 'Aktif').length, ptk.length, alumni.length],
                            backgroundColor: ['#1E88E5', '#FB8C00', '#8E24AA'],
                            borderRadius: 8,
                        }]
                    },
                    options: { responsive: true, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }, plugins: { legend: { display: false } } }
                });
            } catch(e) { console.error("Dashboard render error:", e); }
        }
        
        async function renderLaporan() {
            try {
                const [sppData, infaqData, pengeluaranData, siswaData, inventarisData, kelasData] = await Promise.all([
                    getAllItems('spp'), getAllItems('infaq'), getAllItems('pengeluaran'), getAllItems('siswa'), getAllItems('inventaris'), getAllItems('kelas')
                ]);
                const totalPemasukan = [...sppData, ...infaqData].reduce((sum, item) => sum + Number(item.jumlah || 0), 0);
                const totalPengeluaran = pengeluaranData.reduce((sum, item) => sum + Number(item.jumlah || 0), 0);
                
                document.getElementById('total-pemasukan').textContent = formatCurrency(totalPemasukan);
                document.getElementById('total-pengeluaran-report').textContent = formatCurrency(totalPengeluaran);
                document.getElementById('laba-rugi').textContent = formatCurrency(totalPemasukan - totalPengeluaran);

                // --- Render Charts ---
                const genderCounts = siswaData.reduce((acc, siswa) => { const gender = siswa.jenis_kelamin || 'N/A'; acc[gender] = (acc[gender] || 0) + 1; return acc; }, {});
                const genderCtx = document.getElementById('genderChart').getContext('2d');
                if (charts.gender) charts.gender.destroy();
                charts.gender = new Chart(genderCtx, { type: 'doughnut', data: { labels: Object.keys(genderCounts), datasets: [{ data: Object.values(genderCounts), backgroundColor: ['#1E88E5', '#E91E63', '#9E9E9E'] }] }, options: { responsive: true, plugins: { legend: { position: 'top' }, title: { display: true, text: 'Demografi Siswa per Gender' } } } });

                const kelasMap = new Map(kelasData.map(k => [k.id, k.nama_kelas]));
                const kelasCounts = siswaData.reduce((acc, siswa) => { const kelasName = kelasMap.get(siswa.kelasId) || 'N/A'; acc[kelasName] = (acc[kelasName] || 0) + 1; return acc; }, {});
                const kelasCtx = document.getElementById('kelasChart').getContext('2d');
                if (charts.kelas) charts.kelas.destroy();
                charts.kelas = new Chart(kelasCtx, { type: 'bar', data: { labels: Object.keys(kelasCounts).sort(), datasets: [{ label: 'Jumlah Siswa', data: Object.values(kelasCounts), backgroundColor: '#00897B' }] }, options: { responsive: true, indexAxis: 'y', plugins: { legend: { display: false }, title: { display: true, text: 'Distribusi Siswa per Kelas' } }, scales: { x: { ticks: { precision: 0 } } } } });

                const sppByMonth = sppData.reduce((acc, item) => { const month = new Date(item.tanggal).toLocaleString('id-ID', { month: 'short', year: 'numeric' }); acc[month] = (acc[month] || 0) + Number(item.jumlah); return acc; }, {});
                const sppCtx = document.getElementById('sppChart').getContext('2d');
                if (charts.spp) charts.spp.destroy();
                charts.spp = new Chart(sppCtx, { type: 'line', data: { labels: Object.keys(sppByMonth), datasets: [{ label: 'Total SPP', data: Object.values(sppByMonth), borderColor: '#43A047', backgroundColor: 'rgba(67, 160, 71, 0.1)', fill: true, tension: 0.4 }] }, options: { responsive: true, plugins: { legend: { display: false } } } });
                
                const infaqByMonth = infaqData.reduce((acc, item) => { const month = new Date(item.tanggal).toLocaleString('id-ID', { month: 'short', year: 'numeric' }); acc[month] = (acc[month] || 0) + Number(item.jumlah); return acc; }, {});
                const infaqCtx = document.getElementById('infaqChart').getContext('2d');
                if (charts.infaq) charts.infaq.destroy();
                charts.infaq = new Chart(infaqCtx, { type: 'line', data: { labels: Object.keys(infaqByMonth), datasets: [{ label: 'Total Infaq', data: Object.values(infaqByMonth), borderColor: '#1E88E5', backgroundColor: 'rgba(30, 136, 229, 0.1)', fill: true, tension: 0.4 }] }, options: { responsive: true, plugins: { legend: { display: false } } } });

                const pengeluaranByMonth = pengeluaranData.reduce((acc, item) => { const month = new Date(item.tanggal).toLocaleString('id-ID', { month: 'short', year: 'numeric' }); acc[month] = (acc[month] || 0) + Number(item.jumlah); return acc; }, {});
                const pengeluaranCtx = document.getElementById('pengeluaranChart').getContext('2d');
                if (charts.pengeluaran) charts.pengeluaran.destroy();
                charts.pengeluaran = new Chart(pengeluaranCtx, { type: 'line', data: { labels: Object.keys(pengeluaranByMonth), datasets: [{ label: 'Total Pengeluaran', data: Object.values(pengeluaranByMonth), borderColor: '#E53935', backgroundColor: 'rgba(229, 57, 53, 0.1)', fill: true, tension: 0.4 }] }, options: { responsive: true, plugins: { legend: { display: false } } } });
                
                const inventarisByKondisi = inventarisData.reduce((acc, item) => { const kondisi = item.kondisi || 'N/A'; acc[kondisi] = (acc[kondisi] || 0) + 1; return acc; }, {});
                const inventarisCtx = document.getElementById('inventarisChart').getContext('2d');
                if (charts.inventaris) charts.inventaris.destroy();
                charts.inventaris = new Chart(inventarisCtx, { type: 'pie', data: { labels: Object.keys(inventarisByKondisi), datasets: [{ data: Object.values(inventarisByKondisi), backgroundColor: ['#43A047', '#FFB300', '#E53935', '#9E9E9E'] }] }, options: { responsive: true, plugins: { legend: { position: 'top' }, title: { display: true, text: 'Kondisi Inventaris' } } } });

            } catch(e) { console.error("Laporan render error:", e); }
        }

        async function renderPengaturan() {
            try {
                const profile = await getItemById('sekolah', 1);
                if (profile) {
                    document.getElementById('nama_sekolah').value = profile.nama_sekolah || '';
                    document.getElementById('npsn').value = profile.npsn || '';
                    document.getElementById('alamat_sekolah').value = profile.alamat_sekolah || '';
                    document.getElementById('akreditasi').value = profile.akreditasi || 'A';
                }
                
                if (navigator.storage && navigator.storage.estimate) {
                    const estimate = await navigator.storage.estimate();
                    const usage = estimate.usage;
                    const quota = estimate.quota;
                    const percentage = quota > 0 ? ((usage / quota) * 100).toFixed(2) : 0;
                    
                    document.getElementById('storage-info').innerHTML = `<p><b>${formatBytes(usage)}</b> dari <b>${formatBytes(quota)}</b> telah digunakan.</p>`;
                    document.getElementById('storage-progress').style.width = `${percentage}%`;
                    document.getElementById('storage-details').textContent = `Sisa penyimpanan: ${formatBytes(quota - usage)}`;
                } else {
                    document.getElementById('storage-info').innerHTML = `<p>API Estimasi Penyimpanan tidak didukung di browser ini.</p>`;
                }
                
                if (currentUser.role === 'Admin') {
                    renderUserManagementTable();
                    renderMapel();
                    renderKelas();
                }

            } catch (e) { console.error("Render Pengaturan error:", e); }
        }
        
        // --- USER MANAGEMENT (Admin Only) ---
        async function renderUserManagementTable() {
            try {
                const users = await getAllItems('users');
                const tableBody = document.getElementById('user-table-body');
                tableBody.innerHTML = '';
                document.getElementById('no-user-data').style.display = users.length <= 1 ? 'block' : 'none';

                users.forEach(user => {
                    const row = tableBody.insertRow();
                    row.innerHTML = `
                        <td>${user.username}</td>
                        <td>${user.role}</td>
                        <td class="action-buttons no-export">
                            <button class="btn-edit" data-id="${user.id}" title="Edit"><i class="fas fa-edit"></i></button>
                            ${user.role !== 'Admin' ? `<button class="btn-delete" data-id="${user.id}" title="Hapus"><i class="fas fa-trash"></i></button>` : ''}
                        </td>
                    `;
                });
            } catch(e) {
                console.error("Render user management error:", e);
            }
        }

        function getUserFormHtml(item = {}) {
            const roles = ['Kepala Yayasan', 'Kepala Sekolah', 'Guru'];
            const roleOptions = roles.map(r => `<option value="${r}" ${item.role === r ? 'selected' : ''}>${r}</option>`).join('');
            return `<form id="form-dynamic-handler">
                <input type="hidden" id="item-id" value="${item.id || ''}">
                <div class="form-group">
                    <label>Username</label>
                    <input type="text" id="user-username" class="form-control" value="${item.username || ''}" required>
                </div>
                <div class="form-group">
                    <label>Password</label>
                    <input type="password" id="user-password" class="form-control" ${item.id ? '' : 'required'} placeholder="${item.id ? 'Kosongkan jika tidak ingin ganti' : ''}">
                </div>
                <div class="form-group">
                    <label>Peran (Role)</label>
                    <select id="user-role" class="form-control" ${item.role === 'Admin' ? 'disabled' : ''}>
                        ${item.role === 'Admin' ? '<option>Admin</option>' : roleOptions}
                    </select>
                </div>
                <button type="submit" class="btn btn-primary btn-block"><i class="fas fa-save"></i> Simpan</button>
            </form>`;
        }

        async function handleUserFormSubmit(e) {
            e.preventDefault();
            const id = document.getElementById('item-id').value;
            const username = document.getElementById('user-username').value.trim();
            const password = document.getElementById('user-password').value;
            const role = document.getElementById('user-role').value;

            if (!username) {
                showToast("Username tidak boleh kosong.");
                return;
            }

            try {
                if (id) {
                    const userId = parseInt(id);
                    const existingUser = await getItemById('users', userId);
                    const dataToUpdate = { ...existingUser, username, role };
                    if (password) {
                        dataToUpdate.password = password;
                    }
                    await updateItem('users', dataToUpdate);
                    showToast("Data pengguna berhasil diperbarui.");
                } else {
                    await addItem('users', { username, password, role });
                    showToast("Pengguna baru berhasil ditambahkan.");
                }
                closeModal();
                renderUserManagementTable();
            } catch (err) {
                if (err.name === 'ConstraintError') {
                    showToast("Gagal menyimpan. Username tersebut sudah digunakan.");
                } else {
                    showToast("Gagal menyimpan data pengguna.");
                }
                console.error("User form submit error:", err);
            }
        }
        
        // --- AUTOCOMPLETE SEARCH HELPER ---
        async function setupAutocomplete(inputId, suggestionsId, dataFetcher, displayFormatter, onSelect) {
            const input = document.getElementById(inputId);
            const suggestionsContainer = document.getElementById(suggestionsId);
            let allData = [];

            const loadData = async () => {
                allData = await dataFetcher();
            };
            
            await loadData(); // Initial data load

            input.addEventListener('input', () => {
                const term = input.value.toLowerCase();
                suggestionsContainer.innerHTML = '';
                if (term.length === 0) {
                    suggestionsContainer.style.display = 'none';
                    return;
                }
                
                const filtered = allData.filter(item => 
                    item.nama.toLowerCase().includes(term) || (item.nisn && item.nisn.includes(term))
                );

                if (filtered.length > 0) {
                    filtered.slice(0, 10).forEach(item => {
                        const div = document.createElement('div');
                        div.innerHTML = displayFormatter(item);
                        div.addEventListener('click', () => {
                            onSelect(item);
                            input.value = item.nama;
                            suggestionsContainer.innerHTML = '';
                            suggestionsContainer.style.display = 'none';
                        });
                        suggestionsContainer.appendChild(div);
                    });
                    suggestionsContainer.style.display = 'block';
                } else {
                    suggestionsContainer.style.display = 'none';
                }
            });

            document.addEventListener('click', (e) => {
                if (e.target.id !== inputId) {
                    suggestionsContainer.style.display = 'none';
                }
            });
            
            return { reload: loadData }; // Return a reload function
        }

        // --- KESISWAAN (ALL TABS) ---
        let siswaSearchAutocomplete;
        async function renderKesiswaan() { 
            renderSiswaAktif(); 
            renderSiswaMutasi(); 
            renderSiswaAlumni();
            renderSPMB();
            renderDaftarUlang();

            if (!siswaSearchAutocomplete) {
                siswaSearchAutocomplete = await setupAutocomplete(
                    'search-siswa', 
                    'search-suggestions-siswa',
                    () => getAllItems('siswa'),
                    (item) => `${item.nama} <small>(${item.nisn || 'NISN Kosong'})</small>`,
                    (item) => {
                        document.getElementById('search-siswa').value = item.nama;
                        renderSiswaAktif();
                    }
                );
            } else {
                siswaSearchAutocomplete.reload();
            }
        };
        
        async function renderSiswaAktif() {
            try {
                const searchTerm = document.getElementById('search-siswa').value.toLowerCase();
                const [allSiswa, allKelas] = await Promise.all([getAllItems('siswa'), getAllItems('kelas')]);
                const kelasMap = new Map(allKelas.map(k => [k.id, k.nama_kelas]));
                
                const filteredData = allSiswa.filter(s => 
                    (s.nama.toLowerCase().includes(searchTerm) || s.nisn?.includes(searchTerm)) && s.status === 'Aktif' 
                );
                const tableBody = document.getElementById('siswa-table-body');
                tableBody.innerHTML = '';
                document.getElementById('no-siswa-data').style.display = filteredData.length === 0 ? 'block' : 'none';
                filteredData.forEach(item => {
                    const row = tableBody.insertRow();
                    row.innerHTML = `
                        <td>${item.nama}</td>
                        <td>${item.nisn || 'N/A'}</td>
                        <td>${item.jenis_kelamin?.charAt(0) || 'N/A'}</td>
                        <td>${kelasMap.get(item.kelasId) || 'N/A'}</td>
                        <td><span class="status-badge status-aktif">${item.status}</span></td>
                        <td class="action-buttons no-export">
                            <button class="btn-edit" data-id="${item.id}" title="Edit"><i class="fas fa-edit"></i></button>
                            <button class="btn-delete" data-id="${item.id}" title="Hapus"><i class="fas fa-trash"></i></button>
                        </td>`;
                });
            } catch (e) { console.error("Render siswa aktif error:", e); }
        }

        async function getSiswaFormHtml(item = {}) {
            const kelasData = await getAllItems('kelas');
            const kelasOptions = kelasData.map(k => `<option value="${k.id}" ${item.kelasId == k.id ? 'selected' : ''}>${k.nama_kelas}</option>`).join('');
            return `<form id="form-dynamic-handler">
                <input type="hidden" id="item-id" value="${item.id || ''}">
                <div class="form-group"><label>Nama Lengkap</label><input type="text" id="siswa-nama" class="form-control" value="${item.nama || ''}" required></div>
                <div class="form-group"><label>NISN</label><input type="text" id="siswa-nisn" class="form-control" value="${item.nisn || ''}"></div>
                <div class="form-group"><label>Kelas</label><select id="siswa-kelasId" class="form-control" required>${kelasOptions}</select></div>
                <div class="form-group"><label>Jenis Kelamin</label><select id="siswa-jk" class="form-control"><option value="Laki-laki" ${item.jenis_kelamin === 'Laki-laki' ? 'selected' : ''}>Laki-laki</option><option value="Perempuan" ${item.jenis_kelamin === 'Perempuan' ? 'selected' : ''}>Perempuan</option></select></div>
                <div class="form-group"><label>Status</label><select id="siswa-status" class="form-control"><option value="Aktif" ${item.status === 'Aktif' ? 'selected' : ''}>Aktif</option><option value="Lulus" ${item.status === 'Lulus' ? 'selected' : ''}>Lulus</option><option value="Pindah" ${item.status === 'Pindah' ? 'selected' : ''}>Pindah</option><option value="Keluar" ${item.status === 'Keluar' ? 'selected' : ''}>Keluar</option></select></div>
                <div class="form-group"><label>Kontak (No. HP/Email)</label><input type="text" id="siswa-kontak" class="form-control" value="${item.kontak || ''}"></div>
                <button type="submit" class="btn btn-primary btn-block"><i class="fas fa-save"></i> Simpan</button>
            </form>`;
        }

        async function renderSiswaMutasi() {
            try {
                const searchTerm = document.getElementById('search-mutasi').value.toLowerCase();
                const allMutasi = await getAllItems('mutasi');
                const filteredData = allMutasi.filter(m => m.nama_siswa.toLowerCase().includes(searchTerm));
                const tableBody = document.getElementById('mutasi-table-body');
                tableBody.innerHTML = '';
                document.getElementById('no-mutasi-data').style.display = filteredData.length === 0 ? 'block' : 'none';
                filteredData.forEach(item => {
                    const row = tableBody.insertRow();
                    const statusClass = item.jenis_mutasi === 'Pindah' ? 'status-pindah' : 'status-keluar';
                    row.innerHTML = `
                        <td>${item.nama_siswa}</td>
                        <td><span class="status-badge ${statusClass}">${item.jenis_mutasi}</span></td>
                        <td>${item.tanggal}</td>
                        <td>${item.keterangan || 'N/A'}</td>
                        <td class="action-buttons no-export">
                            <button class="btn-edit" data-id="${item.id}" title="Edit"><i class="fas fa-edit"></i></button>
                            <button class="btn-delete" data-id="${item.id}" title="Hapus"><i class="fas fa-trash"></i></button>
                        </td>`;
                });
            } catch (e) { console.error("Render siswa mutasi error:", e); }
        }
        
        async function getMutasiFormHtml(item = {}) {
            const [siswaAktif, kelasData] = await Promise.all([getAllItems('siswa'), getAllItems('kelas')]);
            const kelasMap = new Map(kelasData.map(k => [k.id, k.nama_kelas]));
            const siswaOptions = siswaAktif.filter(s => s.status === 'Aktif').map(s => `<option value="${s.nama}" data-id="${s.id}" ${item.nama_siswa === s.nama ? 'selected' : ''}>${s.nama} - ${kelasMap.get(s.kelasId)}</option>`).join('');
            return `<form id="form-dynamic-handler">
                <input type="hidden" id="item-id" value="${item.id || ''}">
                <div class="form-group"><label>Pilih Siswa</label><select id="mutasi-nama" class="form-control" required>${siswaOptions}</select></div>
                <div class="form-group"><label>Jenis Mutasi</label><select id="mutasi-jenis" class="form-control"><option value="Pindah" ${item.jenis_mutasi === 'Pindah' ? 'selected' : ''}>Pindah</option><option value="Keluar" ${item.jenis_mutasi === 'Keluar' ? 'selected' : ''}>Keluar</option></select></div>
                <div class="form-group"><label>Tanggal Mutasi</label><input type="date" id="mutasi-tanggal" class="form-control" value="${item.tanggal || today()}" required></div>
                <div class="form-group"><label>Keterangan</label><textarea id="mutasi-keterangan" class="form-control">${item.keterangan || ''}</textarea></div>
                <button type="submit" class="btn btn-primary btn-block"><i class="fas fa-save"></i> Simpan</button>
            </form>`;
        }

        async function renderSiswaAlumni() {
            try {
                const searchTerm = document.getElementById('search-alumni').value.toLowerCase();
                const allAlumni = await getAllItems('alumni');
                const filteredData = allAlumni.filter(a => a.nama.toLowerCase().includes(searchTerm));
                const tableBody = document.getElementById('alumni-table-body');
                tableBody.innerHTML = '';
                document.getElementById('no-alumni-data').style.display = filteredData.length === 0 ? 'block' : 'none';
                filteredData.forEach(item => {
                    const row = tableBody.insertRow();
                    row.innerHTML = `
                        <td>${item.nama}</td>
                        <td>${item.tahun_lulus}</td>
                        <td>${item.kontak || 'N/A'}</td>
                        <td class="action-buttons no-export">
                            <button class="btn-edit" data-id="${item.id}" title="Edit"><i class="fas fa-edit"></i></button>
                            <button class="btn-delete" data-id="${item.id}" title="Hapus"><i class="fas fa-trash"></i></button>
                        </td>`;
                });
            } catch (e) { console.error("Render alumni error:", e); }
        }
        
        async function getAlumniFormHtml(item = {}) {
            return `<form id="form-dynamic-handler">
                <input type="hidden" id="item-id" value="${item.id || ''}">
                <div class="form-group"><label>Nama Alumni</label><input type="text" id="alumni-nama" class="form-control" value="${item.nama || ''}" required></div>
                <div class="form-group"><label>Tahun Lulus</label><input type="number" id="alumni-tahun" class="form-control" value="${item.tahun_lulus || new Date().getFullYear()}" required></div>
                <div class="form-group"><label>Kontak (No. HP/Email)</label><input type="text" id="alumni-kontak" class="form-control" value="${item.kontak || ''}"></div>
                <button type="submit" class="btn btn-primary btn-block"><i class="fas fa-save"></i> Simpan</button>
            </form>`;
        }
        
        async function renderSPMB() {
            try {
                const calonSiswa = await getAllItems('spmb');
                const tableBody = document.getElementById('spmb-table-body');
                tableBody.innerHTML = '';
                document.getElementById('no-spmb-data').style.display = calonSiswa.length === 0 ? 'block' : 'none';
                calonSiswa.forEach(item => {
                    const row = tableBody.insertRow();
                    const statusBadge = item.status === 'Diterima' ? 'status-aktif' : 'status-pindah';
                    row.innerHTML = `
                        <td>${item.nama}</td>
                        <td>${item.asal_sekolah || 'N/A'}</td>
                        <td><span class="status-badge ${statusBadge}">${item.status}</span></td>
                        <td class="action-buttons no-export">
                            <button class="btn-edit" data-id="${item.id}" title="Edit"><i class="fas fa-edit"></i></button>
                            ${item.status !== 'Diterima' ? `<button class="btn-success" data-action="terima" data-id="${item.id}" title="Terima Siswa"><i class="fas fa-check"></i></button>` : ''}
                            <button class="btn-delete" data-id="${item.id}" title="Hapus"><i class="fas fa-trash"></i></button>
                        </td>`;
                });
            } catch (e) { console.error("Render SPMB error:", e); }
        }

        async function getCalonSiswaFormHtml(item = {}) {
            return `<form id="form-dynamic-handler">
                <input type="hidden" id="item-id" value="${item.id || ''}">
                <div class="form-group"><label>Nama Calon Siswa</label><input type="text" id="spmb-nama" class="form-control" value="${item.nama || ''}" required></div>
                <div class="form-group"><label>Asal Sekolah</label><input type="text" id="spmb-asal" class="form-control" value="${item.asal_sekolah || ''}"></div>
                <div class="form-group"><label>Kontak</label><input type="text" id="spmb-kontak" class="form-control" value="${item.kontak || ''}"></div>
                <div class="form-group"><label>Status</label><select id="spmb-status" class="form-control"><option value="Mendaftar" ${item.status === 'Mendaftar' ? 'selected' : ''}>Mendaftar</option><option value="Diterima" ${item.status === 'Diterima' ? 'selected' : ''}>Diterima</option><option value="Ditolak" ${item.status === 'Ditolak' ? 'selected' : ''}>Ditolak</option></select></div>
                <button type="submit" class="btn btn-primary btn-block"><i class="fas fa-save"></i> Simpan</button>
            </form>`;
        }
        
        async function renderDaftarUlang() {
            // This is a simplified implementation. A real-world scenario would be more complex.
            try {
                const [allSiswa, allKelas] = await Promise.all([getAllItems('siswa'), getAllItems('kelas')]);
                const kelasMap = new Map(allKelas.map(k => [k.id, k.nama_kelas]));
                const siswaAktif = allSiswa.filter(s => s.status === 'Aktif');
                
                const tableBody = document.getElementById('daftar-ulang-table-body');
                tableBody.innerHTML = '';
                document.getElementById('no-daftar-ulang-data').style.display = siswaAktif.length === 0 ? 'block' : 'none';

                siswaAktif.forEach(item => {
                    const row = tableBody.insertRow();
                    row.innerHTML = `
                        <td><input type="checkbox" class="daftar-ulang-check" data-id="${item.id}"></td>
                        <td>${item.nama}</td>
                        <td>${kelasMap.get(item.kelasId) || 'N/A'}</td>
                        <td><span class="status-badge status-pindah">Belum Daftar Ulang</span></td>
                    `;
                });
            } catch (e) { console.error("Render Daftar Ulang error:", e); }
        }

        // --- PTK ---
        async function renderPtk() {
            try {
                const allItems = await getAllItems('ptk');
                const searchTerm = document.getElementById('search-ptk').value.toLowerCase();
                const filterJabatan = document.getElementById('filter-ptk-jabatan').value;
                const jabatanSet = new Set(allItems.map(i => i.jabatan).filter(Boolean));
                const jabatanFilterEl = document.getElementById('filter-ptk-jabatan');
                const currentVal = jabatanFilterEl.value;
                jabatanFilterEl.innerHTML = '<option value="">Semua Jabatan</option>';
                jabatanSet.forEach(l => {
                    const option = document.createElement('option');
                    option.value = l; option.textContent = l;
                    jabatanFilterEl.appendChild(option);
                });
                jabatanFilterEl.value = currentVal;
                const filteredData = allItems.filter(item => 
                    (item.nama.toLowerCase().includes(searchTerm) || item.nuptk?.includes(searchTerm)) &&
                    (!filterJabatan || item.jabatan === filterJabatan)
                );
                const tableBody = document.getElementById('ptk-table-body');
                tableBody.innerHTML = '';
                document.getElementById('no-ptk-data').style.display = filteredData.length === 0 ? 'block' : 'none';
                filteredData.forEach(item => {
                    const row = tableBody.insertRow();
                    row.innerHTML = `
                        <td>${item.nama}</td>
                        <td>${item.nuptk || 'N/A'}</td>
                        <td>${item.jabatan || 'N/A'}</td>
                        <td>${item.kontak || 'N/A'}</td>
                        <td class="action-buttons no-export">
                            <button class="btn-edit" data-id="${item.id}" title="Edit"><i class="fas fa-edit"></i></button>
                            <button class="btn-delete" data-id="${item.id}" title="Hapus"><i class="fas fa-trash"></i></button>
                        </td>`;
                });
            } catch (e) { console.error("Render PTK error", e); }
        }
        
        function getPtkFormHtml(item = {}) {
             return `<form id="form-dynamic-handler">
                <input type="hidden" id="item-id" value="${item.id || ''}">
                <div class="form-group"><label>Nama Lengkap</label><input type="text" id="ptk-nama" class="form-control" value="${item.nama || ''}" required></div>
                <div class="form-group"><label>NUPTK</label><input type="text" id="ptk-nuptk" class="form-control" value="${item.nuptk || ''}"></div>
                <div class="form-group"><label>Jabatan</label><input type="text" id="ptk-jabatan" class="form-control" value="${item.jabatan || ''}" required></div>
                <div class="form-group"><label>Kontak (No. HP/Email)</label><input type="text" id="ptk-kontak" class="form-control" value="${item.kontak || ''}"></div>
                <button type="submit" class="btn btn-primary btn-block"><i class="fas fa-save"></i> Simpan</button>
            </form>`;
        }

        // --- DATA RAPOR ---
        const renderRapor = () => {
            renderIdentitasRapor();
            renderInputNilai();
            renderDaftarNilai();
            renderCetakRapor();
            renderSKL();
        };

        async function renderIdentitasRapor() {
            try {
                const identitas = await getItemById('identitasRapor', 1);
                if (identitas) {
                    document.getElementById('rapor-kepala-sekolah').value = identitas.kepsek || '';
                    document.getElementById('rapor-nip-kepsek').value = identitas.nip || '';
                    document.getElementById('rapor-tanggal-terbit').value = identitas.tanggal || today();
                    document.getElementById('rapor-tempat-terbit').value = identitas.tempat || '';
                }
            } catch (e) { console.error("Error rendering identitas rapor:", e); }
        }

        async function renderInputNilai() {
            const kelasSelect = document.getElementById('filter-input-nilai-kelas');
            const mapelSelect = document.getElementById('filter-input-nilai-mapel');
            const jenisSelect = document.getElementById('filter-input-nilai-jenis');
            const tableBody = document.getElementById('input-nilai-table-body');
            const noDataEl = document.getElementById('no-siswa-nilai-data');

            try {
                const [allSiswa, allMapel, allKelas] = await Promise.all([getAllItems('siswa'), getAllItems('mapel'), getAllItems('kelas')]);
                
                kelasSelect.innerHTML = '<option value="">Pilih Kelas</option>';
                allKelas.forEach(k => kelasSelect.innerHTML += `<option value="${k.id}">${k.nama_kelas}</option>`);

                mapelSelect.innerHTML = '<option value="">Pilih Mata Pelajaran</option>';
                allMapel.forEach(m => mapelSelect.innerHTML += `<option value="${m.id}">${m.nama_mapel}</option>`);

                const updateTable = async () => {
                    const selectedKelasId = kelasSelect.value;
                    const selectedMapelId = mapelSelect.value;
                    const selectedJenis = jenisSelect.value;
                    tableBody.innerHTML = '';

                    if (selectedKelasId && selectedMapelId && selectedJenis) {
                        const filteredSiswa = allSiswa.filter(s => s.kelasId == selectedKelasId && s.status === 'Aktif');
                        noDataEl.style.display = filteredSiswa.length === 0 ? 'block' : 'none';
                        
                        // Get existing values
                        const tx = db.transaction('nilai', 'readonly');
                        const index = tx.objectStore('nilai').index('siswaId');
                        
                        for (const siswa of filteredSiswa) {
                            const row = tableBody.insertRow();
                            const request = index.getAll(siswa.id);
                            request.onsuccess = () => {
                                const existingNilai = request.result.find(n => n.mapelId == selectedMapelId && n.jenis === selectedJenis);
                                row.innerHTML = `
                                    <td>${siswa.nama}</td>
                                    <td>${siswa.nisn || 'N/A'}</td>
                                    <td><input type="number" class="form-control nilai-input" data-siswa-id="${siswa.id}" min="0" max="100" value="${existingNilai ? existingNilai.nilai : ''}" data-existing-id="${existingNilai ? existingNilai.id : ''}"></td>
                                `;
                            };
                        }
                    } else {
                        noDataEl.style.display = 'block';
                    }
                };
                
                kelasSelect.onchange = updateTable;
                mapelSelect.onchange = updateTable;
                jenisSelect.onchange = updateTable;

            } catch (e) { console.error("Error rendering input nilai:", e); }
        }

        async function renderDaftarNilai() {
            try {
                const searchTerm = document.getElementById('search-daftar-nilai').value.toLowerCase();
                const [allNilai, allSiswa, allMapel, allKelas] = await Promise.all([getAllItems('nilai'), getAllItems('siswa'), getAllItems('mapel'), getAllItems('kelas')]);
                const siswaMap = new Map(allSiswa.map(s => [s.id, s]));
                const mapelMap = new Map(allMapel.map(m => [m.id, m.nama_mapel]));
                const kelasMap = new Map(allKelas.map(k => [k.id, k.nama_kelas]));

                const tableBody = document.getElementById('daftar-nilai-table-body');
                tableBody.innerHTML = '';
                
                const filteredData = allNilai.filter(n => {
                    const siswa = siswaMap.get(n.siswaId);
                    return siswa && siswa.nama.toLowerCase().includes(searchTerm);
                });

                document.getElementById('no-daftar-nilai-data').style.display = filteredData.length === 0 ? 'block' : 'none';

                filteredData.forEach(item => {
                    const siswa = siswaMap.get(item.siswaId);
                    if (!siswa) return;
                    const row = tableBody.insertRow();
                    row.innerHTML = `
                        <td>${siswa.nama}</td>
                        <td>${kelasMap.get(siswa.kelasId)}</td>
                        <td>${mapelMap.get(item.mapelId)}</td>
                        <td>${item.jenis}</td>
                        <td>${item.nilai}</td>
                        <td class="action-buttons no-export">
                            <button class="btn-delete" data-id="${item.id}" title="Hapus"><i class="fas fa-trash"></i></button>
                        </td>
                    `;
                });
            } catch (e) { console.error("Error rendering daftar nilai:", e); }
        }

        async function renderCetakRapor() {
             const kelasSelect = document.getElementById(`filter-rapor-kelas`);
             const siswaSelect = document.getElementById(`filter-rapor-siswa`);
             try {
                const [allSiswa, allKelas] = await Promise.all([getAllItems('siswa'), getAllItems('kelas')]);
                kelasSelect.innerHTML = '<option value="">Pilih Kelas</option>';
                allKelas.forEach(k => kelasSelect.innerHTML += `<option value="${k.id}">${k.nama_kelas}</option>`);

                kelasSelect.onchange = () => {
                    const selectedKelasId = kelasSelect.value;
                    siswaSelect.innerHTML = '<option value="">Pilih Siswa</option>';
                    if(selectedKelasId) {
                        allSiswa.filter(s => s.kelasId == selectedKelasId && s.status === 'Aktif').forEach(s => {
                            siswaSelect.innerHTML += `<option value="${s.id}">${s.nama}</option>`;
                        });
                    }
                };
             } catch(e) { console.error(`Error rendering cetak rapor:`, e); }
        }

        async function handleCetakRapor() {
            const siswaId = parseInt(document.getElementById('filter-rapor-siswa').value);
            const jenisRapor = document.getElementById('filter-rapor-jenis').value;
            const previewContainer = document.getElementById('rapor-preview-content');

            if (!siswaId) {
                showToast("Silakan pilih siswa terlebih dahulu.");
                return;
            }

            try {
                showToast("Mempersiapkan rapor...");
                const [siswa, identitas, sekolah, allNilai, allMapel, allKelas] = await Promise.all([
                    getItemById('siswa', siswaId),
                    getItemById('identitasRapor', 1),
                    getItemById('sekolah', 1),
                    getAllItems('nilai'),
                    getAllItems('mapel'),
                    getAllItems('kelas')
                ]);
                
                const kelasMap = new Map(allKelas.map(k => [k.id, k.nama_kelas]));
                const nilaiSiswa = allNilai.filter(n => n.siswaId === siswaId && n.jenis === jenisRapor);
                
                if (nilaiSiswa.length === 0) {
                    previewContainer.innerHTML = `<p class="text-secondary" style="text-align: center;">Tidak ada data nilai ${jenisRapor} untuk siswa ini.</p>`;
                    return;
                }

                const mapelMap = new Map(allMapel.map(m => [m.id, m]));
                let nilaiRows = '';
                nilaiSiswa.forEach(n => {
                    const mapel = mapelMap.get(n.mapelId);
                    nilaiRows += `<tr><td>${mapel.kode_mapel}</td><td>${mapel.nama_mapel}</td><td>${n.nilai}</td></tr>`;
                });

                const raporHtml = `
                    <style>
                        .rapor-table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
                        .rapor-table th, .rapor-table td { border: 1px solid #333; padding: 8px; text-align: left; }
                        .rapor-header { text-align: center; }
                        .rapor-header h3, .rapor-header p { margin: 0; }
                        .rapor-details { margin-top: 20px; }
                        .rapor-details td { padding: 2px 5px; }
                        .rapor-footer { margin-top: 40px; display: flex; justify-content: space-between; }
                        .ttd { text-align: center; }
                    </style>
                    <div class="rapor-header">
                        <h3>LAPORAN HASIL BELAJAR TENGAH SEMESTER (${jenisRapor})</h3>
                        <p>TAHUN PELAJARAN 2024/2025</p>
                    </div>
                    <table class="rapor-details">
                        <tr><td>Nama Sekolah</td><td>: ${sekolah.nama_sekolah || ''}</td><td>Kelas</td><td>: ${kelasMap.get(siswa.kelasId)}</td></tr>
                        <tr><td>Alamat</td><td>: ${sekolah.alamat_sekolah || ''}</td><td>Semester</td><td>: 1 (Ganjil)</td></tr>
                        <tr><td>Nama Siswa</td><td>: ${siswa.nama}</td><td>NISN</td><td>: ${siswa.nisn || ''}</td></tr>
                    </table>
                    <table class="rapor-table">
                        <thead><tr><th>Kode</th><th>Mata Pelajaran</th><th>Nilai</th></tr></thead>
                        <tbody>${nilaiRows}</tbody>
                    </table>
                    <div class="rapor-footer">
                        <div class="ttd">
                            <p>Mengetahui,</p>
                            <p>Orang Tua/Wali</p>
                            <br><br><br>
                            <p>.....................</p>
                        </div>
                        <div class="ttd">
                            <p>${identitas.tempat || 'Kota'}, ${new Date(identitas.tanggal).toLocaleDateString('id-ID', {day:'numeric', month:'long', year:'numeric'})}</p>
                            <p>Kepala Sekolah</p>
                            <br><br><br>
                            <p><b><u>${identitas.kepsek || ''}</u></b></p>
                            <p>NIP. ${identitas.nip || '-'}</p>
                        </div>
                    </div>
                `;
                previewContainer.innerHTML = raporHtml;

            } catch (e) {
                showToast("Gagal membuat pratinjau rapor.");
                console.error("Cetak rapor error:", e);
            }
        }

        async function renderSKL() {
            const siswaSelect = document.getElementById('filter-skl-siswa');
            try {
                const allSiswa = await getAllItems('siswa');
                const siswaLulus = allSiswa.filter(s => s.status === 'Lulus');
                siswaSelect.innerHTML = '<option value="">Pilih Siswa Lulus</option>';
                siswaLulus.forEach(s => siswaSelect.innerHTML += `<option value="${s.id}">${s.nama}</option>`);
            } catch(e) { console.error("Error rendering SKL:", e); }
        }

        // --- JADWAL PELAJARAN ---
        async function renderJadwal() {
            try {
                const [allJadwal, allKelas, allMapel, allPtk] = await Promise.all([
                    getAllItems('jadwal'), getAllItems('kelas'), getAllItems('mapel'), getAllItems('ptk')
                ]);
                
                const kelasSelect = document.getElementById('filter-jadwal-kelas');
                const hariSelect = document.getElementById('filter-jadwal-hari');
                
                const currentKelas = kelasSelect.value;
                kelasSelect.innerHTML = '<option value="">Pilih Kelas</option>';
                allKelas.forEach(k => kelasSelect.innerHTML += `<option value="${k.id}">${k.nama_kelas}</option>`);
                kelasSelect.value = currentKelas;

                const kelasMap = new Map(allKelas.map(k => [k.id, k.nama_kelas]));
                const mapelMap = new Map(allMapel.map(m => [m.id, m.nama_mapel]));
                const ptkMap = new Map(allPtk.map(p => [p.id, p.nama]));

                const filteredJadwal = allJadwal.filter(j => 
                    (!kelasSelect.value || j.kelasId == kelasSelect.value) &&
                    (!hariSelect.value || j.hari === hariSelect.value)
                );

                const tableBody = document.getElementById('jadwal-table-body');
                tableBody.innerHTML = '';
                document.getElementById('no-jadwal-data').style.display = filteredJadwal.length === 0 ? 'block' : 'none';

                filteredJadwal.sort((a,b) => a.jam_ke - b.jam_ke).forEach(item => {
                    const row = tableBody.insertRow();
                    row.innerHTML = `
                        <td>${item.hari}</td>
                        <td>${item.jam_ke}</td>
                        <td>${item.waktu}</td>
                        <td>${mapelMap.get(item.mapelId) || 'N/A'}</td>
                        <td>${ptkMap.get(item.ptkId) || 'N/A'}</td>
                        <td class="action-buttons no-export">
                            <button class="btn-edit" data-id="${item.id}" title="Edit"><i class="fas fa-edit"></i></button>
                            <button class="btn-delete" data-id="${item.id}" title="Hapus"><i class="fas fa-trash"></i></button>
                        </td>`;
                });

            } catch (e) { console.error("Render Jadwal error:", e); }
        }

        async function getJadwalFormHtml(item = {}) {
            const [allKelas, allMapel, allPtk] = await Promise.all([
                getAllItems('kelas'), getAllItems('mapel'), getAllItems('ptk')
            ]);
            const kelasOptions = allKelas.map(k => `<option value="${k.id}" ${item.kelasId == k.id ? 'selected' : ''}>${k.nama_kelas}</option>`).join('');
            const mapelOptions = allMapel.map(m => `<option value="${m.id}" ${item.mapelId == m.id ? 'selected' : ''}>${m.nama_mapel}</option>`).join('');
            const ptkOptions = allPtk.map(p => `<option value="${p.id}" ${item.ptkId == p.id ? 'selected' : ''}>${p.nama}</option>`).join('');
            const hariOptions = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'].map(h => `<option value="${h}" ${item.hari === h ? 'selected' : ''}>${h}</option>`).join('');

            return `<form id="form-dynamic-handler">
                <input type="hidden" id="item-id" value="${item.id || ''}">
                <div class="form-group"><label>Kelas</label><select id="jadwal-kelasId" class="form-control" required>${kelasOptions}</select></div>
                <div class="form-group"><label>Hari</label><select id="jadwal-hari" class="form-control" required>${hariOptions}</select></div>
                <div class="form-group"><label>Mata Pelajaran</label><select id="jadwal-mapelId" class="form-control" required>${mapelOptions}</select></div>
                <div class="form-group"><label>Guru Pengajar</label><select id="jadwal-ptkId" class="form-control" required>${ptkOptions}</select></div>
                <div class="form-group"><label>Jam Ke-</label><input type="number" id="jadwal-jam_ke" class="form-control" value="${item.jam_ke || ''}" required></div>
                <div class="form-group"><label>Waktu (Contoh: 07:00 - 08:30)</label><input type="text" id="jadwal-waktu" class="form-control" value="${item.waktu || ''}" required></div>
                <button type="submit" class="btn btn-primary btn-block"><i class="fas fa-save"></i> Simpan</button>
            </form>`;
        }

        // --- SARPRAS ---
        const renderSarpras = () => { renderInventaris(); renderStokHarian(); };
        
        async function renderInventaris() {
            try {
                const allItems = await getAllItems('inventaris');
                const searchTerm = document.getElementById('search-inventaris').value.toLowerCase();
                const filterLokasi = document.getElementById('filter-inventaris-lokasi').value;
                const filterKondisi = document.getElementById('filter-inventaris-kondisi').value;
                const lokasiSet = new Set(allItems.map(i => i.lokasi).filter(Boolean));
                const lokasiFilterEl = document.getElementById('filter-inventaris-lokasi');
                const currentVal = lokasiFilterEl.value;
                lokasiFilterEl.innerHTML = '<option value="">Semua Lokasi</option>';
                lokasiSet.forEach(l => {
                    const option = document.createElement('option');
                    option.value = l; option.textContent = l;
                    lokasiFilterEl.appendChild(option);
                });
                lokasiFilterEl.value = currentVal;
                const filteredData = allItems.filter(item => 
                    item.nama.toLowerCase().includes(searchTerm) &&
                    (!filterLokasi || item.lokasi === filterLokasi) &&
                    (!filterKondisi || item.kondisi === filterKondisi)
                );
                const tableBody = document.getElementById('inventaris-table-body');
                tableBody.innerHTML = '';
                document.getElementById('no-inventaris-data').style.display = filteredData.length === 0 ? 'block' : 'none';
                filteredData.forEach(item => {
                    const row = tableBody.insertRow();
                    row.innerHTML = `
                        <td>${item.kode || 'N/A'}</td>
                        <td>${item.nama}</td>
                        <td>${item.jumlah || 1}</td>
                        <td>${formatCurrency(item.harga)}</td>
                        <td>${item.lokasi}</td>
                        <td>${item.kondisi}</td>
                        <td>${item.tanggal_pembelian || 'N/A'}</td>
                        <td class="action-buttons no-export">
                            <button class="btn-edit" data-id="${item.id}" title="Edit"><i class="fas fa-edit"></i></button>
                            <button class="btn-delete" data-id="${item.id}" title="Hapus"><i class="fas fa-trash"></i></button>
                        </td>`;
                });
            } catch (e) { console.error("Render inventaris error", e); }
        }

        function getInventarisFormHtml(item = {}) {
            return `<form id="form-dynamic-handler">
                <input type="hidden" id="item-id" value="${item.id || ''}">
                <div class="form-group"><label>Kode Barang</label><input type="text" id="inventaris-kode" class="form-control" value="${item.kode || ''}"></div>
                <div class="form-group"><label>Nama Barang</label><input type="text" id="inventaris-nama" class="form-control" value="${item.nama || ''}" required></div>
                <div class="form-group"><label>Jumlah</label><input type="number" id="inventaris-jumlah" class="form-control" value="${item.jumlah || 1}" required></div>
                <div class="form-group"><label>Harga Satuan (Rp)</label><input type="number" id="inventaris-harga" class="form-control" value="${item.harga || 0}" required></div>
                <div class="form-group"><label>Lokasi</label><input type="text" id="inventaris-lokasi" class="form-control" value="${item.lokasi || ''}" required placeholder="Contoh: Ruang Guru"></div>
                <div class="form-group"><label>Kondisi</label><select id="inventaris-kondisi" class="form-control"><option value="Baik" ${item.kondisi === 'Baik' ? 'selected' : ''}>Baik</option><option value="Rusak Ringan" ${item.kondisi === 'Rusak Ringan' ? 'selected' : ''}>Rusak Ringan</option><option value="Rusak Berat" ${item.kondisi === 'Rusak Berat' ? 'selected' : ''}>Rusak Berat</option></select></div>
                <div class="form-group"><label>Tanggal Pembelian</label><input type="date" id="inventaris-tanggal" class="form-control" value="${item.tanggal_pembelian || today()}" required></div>
                <button type="submit" class="btn btn-primary btn-block"><i class="fas fa-save"></i> Simpan</button>
            </form>`;
        }

        async function renderStokHarian() {
            try {
                const allItems = await getAllItems('stokHarian');
                const tableBody = document.getElementById('stok-harian-table-body');
                tableBody.innerHTML = '';
                document.getElementById('no-stok-data').style.display = allItems.length === 0 ? 'block' : 'none';
                allItems.forEach(item => {
                    const row = tableBody.insertRow();
                    row.innerHTML = `
                        <td>${item.nama}</td>
                        <td>${item.stok}</td>
                        <td class="action-buttons no-export">
                            <button class="btn-edit" data-id="${item.id}" title="Edit"><i class="fas fa-edit"></i></button>
                            <button class="btn-delete" data-id="${item.id}" title="Hapus"><i class="fas fa-trash"></i></button>
                        </td>`;
                });
            } catch (e) { console.error("Render Stok Harian error:", e); }
        }

        function getStokHarianFormHtml(item = {}) {
            return `<form id="form-dynamic-handler">
                <input type="hidden" id="item-id" value="${item.id || ''}">
                <div class="form-group"><label>Nama Barang</label><input type="text" id="stok-nama" class="form-control" value="${item.nama || ''}" required></div>
                <div class="form-group"><label>Jumlah Stok</label><input type="number" id="stok-jumlah" class="form-control" value="${item.stok || 0}" required></div>
                <button type="submit" class="btn btn-primary btn-block"><i class="fas fa-save"></i> Simpan</button>
            </form>`;
        }

        // --- KEUANGAN ---
        const renderKeuangan = () => { renderSpp(); renderInfaq(); renderGajiPokok(); renderGajiInfal(); renderGajiCatatan(); renderPengeluaran(); };

        async function renderSpp() {
            try {
                const searchTerm = document.getElementById('search-spp').value.toLowerCase();
                const allItems = await getAllItems('spp');
                const filteredData = allItems.filter(item => item.nama_siswa.toLowerCase().includes(searchTerm));
                const tableBody = document.getElementById('spp-table-body');
                tableBody.innerHTML = '';
                document.getElementById('no-spp-data').style.display = filteredData.length === 0 ? 'block' : 'none';
                filteredData.forEach(item => {
                    const row = tableBody.insertRow();
                    row.innerHTML = `
                        <td>${item.nama_siswa}</td>
                        <td>${item.keterangan}</td>
                        <td>${formatCurrency(item.jumlah)}</td>
                        <td>${item.tanggal}</td>
                        <td class="no-export">
                            ${item.bukti ? `<button class="btn-view-proof" data-id="${item.id}" data-store="spp"><i class="fas fa-eye"></i></button>` : '-'}
                        </td>
                        <td class="action-buttons no-export">
                            <button class="btn-edit" data-id="${item.id}" title="Edit"><i class="fas fa-edit"></i></button>
                            <button class="btn-delete" data-id="${item.id}" title="Hapus"><i class="fas fa-trash"></i></button>
                        </td>`;
                });
            } catch (e) { console.error("Render SPP error:", e); }
        }

        async function getSppFormHtml(item = {}) {
            const siswaAktif = (await getAllItems('siswa')).filter(s => s.status === 'Aktif');
            const siswaOptions = siswaAktif.map(s => `<option value="${s.nama}" ${item.nama_siswa === s.nama ? 'selected' : ''}>${s.nama}</option>`).join('');
            return `<form id="form-dynamic-handler">
                <input type="hidden" id="item-id" value="${item.id || ''}">
                <div class="form-group"><label>Pilih Siswa</label><select id="spp-nama" class="form-control" required>${siswaOptions}</select></div>
                <div class="form-group"><label>Keterangan</label><input type="text" id="spp-keterangan" class="form-control" value="${item.keterangan || ''}" required placeholder="Contoh: SPP Bulan Juli"></div>
                <div class="form-group"><label>Jumlah (Rp)</label><input type="number" id="spp-jumlah" class="form-control" value="${item.jumlah || ''}" required></div>
                <div class="form-group"><label>Tanggal Pembayaran</label><input type="date" id="spp-tanggal" class="form-control" value="${item.tanggal || today()}" required></div>
                <div class="form-group">
                    <label>Bukti Pembayaran (Opsional)</label>
                    <div class="file-upload-wrapper">
                        <span class="file-name">Pilih file...</span>
                        <label for="spp-bukti" class="btn btn-info btn-upload"><i class="fas fa-upload"></i></label>
                        <input type="file" id="spp-bukti" class="hidden-file-input" accept="image/*">
                    </div>
                </div>
                <button type="submit" class="btn btn-primary btn-block"><i class="fas fa-save"></i> Simpan</button>
            </form>`;
        }

        async function renderInfaq() {
            try {
                const searchTerm = document.getElementById('search-infaq').value.toLowerCase();
                const allItems = await getAllItems('infaq');
                const filteredData = allItems.filter(item => (item.sumber?.toLowerCase().includes(searchTerm) || item.keterangan?.toLowerCase().includes(searchTerm)));
                const tableBody = document.getElementById('infaq-table-body');
                tableBody.innerHTML = '';
                document.getElementById('no-infaq-data').style.display = filteredData.length === 0 ? 'block' : 'none';
                filteredData.forEach(item => {
                    const row = tableBody.insertRow();
                    row.innerHTML = `
                        <td>${item.sumber}</td>
                        <td>${item.keterangan}</td>
                        <td>${formatCurrency(item.jumlah)}</td>
                        <td>${item.tanggal}</td>
                        <td class="no-export">
                            ${item.bukti ? `<button class="btn-view-proof" data-id="${item.id}" data-store="infaq"><i class="fas fa-eye"></i></button>` : '-'}
                        </td>
                        <td class="action-buttons no-export">
                            <button class="btn-edit" data-id="${item.id}" title="Edit"><i class="fas fa-edit"></i></button>
                            <button class="btn-delete" data-id="${item.id}" title="Hapus"><i class="fas fa-trash"></i></button>
                        </td>`;
                });
            } catch (e) { console.error("Render Infaq error:", e); }
        }
        
        function getInfaqFormHtml(item = {}) {
            return `<form id="form-dynamic-handler">
                <input type="hidden" id="item-id" value="${item.id || ''}">
                <div class="form-group"><label>Sumber Infaq</label><input type="text" id="infaq-sumber" class="form-control" value="${item.sumber || ''}" required placeholder="Contoh: Hamba Allah, Nama Donatur"></div>
                <div class="form-group"><label>Keterangan</label><input type="text" id="infaq-keterangan" class="form-control" value="${item.keterangan || ''}" required></div>
                <div class="form-group"><label>Jumlah (Rp)</label><input type="number" id="infaq-jumlah" class="form-control" value="${item.jumlah || ''}" required></div>
                <div class="form-group"><label>Tanggal</label><input type="date" id="infaq-tanggal" class="form-control" value="${item.tanggal || today()}" required></div>
                <div class="form-group">
                    <label>Bukti (Opsional)</label>
                    <div class="file-upload-wrapper">
                        <span class="file-name">Pilih file...</span>
                        <label for="infaq-bukti" class="btn btn-info btn-upload"><i class="fas fa-upload"></i></label>
                        <input type="file" id="infaq-bukti" class="hidden-file-input" accept="image/*">
                    </div>
                </div>
                <button type="submit" class="btn btn-primary btn-block"><i class="fas fa-save"></i> Simpan</button>
            </form>`;
        }

        const renderGajiPokok = () => { /* Placeholder for Gaji Guru functionality */ };
        const renderGajiInfal = () => { /* Placeholder */ };
        const renderGajiCatatan = () => { /* Placeholder */ };
        
        async function renderPengeluaran() {
            try {
                const searchTerm = document.getElementById('search-pengeluaran').value.toLowerCase();
                const allItems = await getAllItems('pengeluaran');
                const filteredData = allItems.filter(item => item.keterangan.toLowerCase().includes(searchTerm));
                const tableBody = document.getElementById('pengeluaran-table-body');
                tableBody.innerHTML = '';
                document.getElementById('no-pengeluaran-data').style.display = filteredData.length === 0 ? 'block' : 'none';
                filteredData.forEach(item => {
                    const row = tableBody.insertRow();
                    row.innerHTML = `
                        <td>${item.keterangan}</td>
                        <td>${formatCurrency(item.jumlah)}</td>
                        <td>${item.tanggal}</td>
                        <td>${item.kategori}</td>
                        <td class="no-export">
                            ${item.bukti ? `<button class="btn-view-proof" data-id="${item.id}" data-store="pengeluaran"><i class="fas fa-eye"></i></button>` : '-'}
                        </td>
                        <td class="action-buttons no-export">
                            <button class="btn-edit" data-id="${item.id}" title="Edit"><i class="fas fa-edit"></i></button>
                            <button class="btn-delete" data-id="${item.id}" title="Hapus"><i class="fas fa-trash"></i></button>
                        </td>`;
                });
            } catch (e) { console.error("Render Pengeluaran error:", e); }
        }

        function getPengeluaranFormHtml(item = {}) {
            return `<form id="form-dynamic-handler">
                <input type="hidden" id="item-id" value="${item.id || ''}">
                <div class="form-group"><label>Keterangan</label><input type="text" id="pengeluaran-keterangan" class="form-control" value="${item.keterangan || ''}" required></div>
                <div class="form-group"><label>Jumlah (Rp)</label><input type="number" id="pengeluaran-jumlah" class="form-control" value="${item.jumlah || ''}" required></div>
                <div class="form-group"><label>Kategori</label><input type="text" id="pengeluaran-kategori" class="form-control" value="${item.kategori || ''}" required placeholder="Contoh: ATK, Listrik, Internet"></div>
                <div class="form-group"><label>Tanggal Pengeluaran</label><input type="date" id="pengeluaran-tanggal" class="form-control" value="${item.tanggal || today()}" required></div>
                 <div class="form-group">
                    <label>Bukti (Opsional)</label>
                    <div class="file-upload-wrapper">
                        <span class="file-name">Pilih file...</span>
                        <label for="pengeluaran-bukti" class="btn btn-info btn-upload"><i class="fas fa-upload"></i></label>
                        <input type="file" id="pengeluaran-bukti" class="hidden-file-input" accept="image/*">
                    </div>
                </div>
                <button type="submit" class="btn btn-primary btn-block"><i class="fas fa-save"></i> Simpan</button>
            </form>`;
        }

        // --- SURAT ---
        const renderSurat = () => { renderSuratMasuk(); renderSuratKeluar(); };
        async function renderGenericSurat(config) {
            try {
                const searchTerm = document.getElementById(config.searchEl).value.toLowerCase();
                const allItems = await getAllItems(config.storeName);
                const filteredData = allItems.filter(item => 
                    (item.perihal.toLowerCase().includes(searchTerm) || item[config.searchKey].toLowerCase().includes(searchTerm))
                );
                const tableBody = document.getElementById(config.tableBodyEl);
                tableBody.innerHTML = '';
                document.getElementById(config.noDataEl).style.display = filteredData.length === 0 ? 'block' : 'none';
                filteredData.forEach(item => {
                    const row = tableBody.insertRow();
                    row.innerHTML = `
                        <td>${item.nomor_surat}</td>
                        <td>${item.tanggal}</td>
                        <td>${item[config.searchKey]}</td>
                        <td>${item.perihal}</td>
                        <td class="action-buttons no-export">
                            <button class="btn-edit" data-id="${item.id}" title="Edit"><i class="fas fa-edit"></i></button>
                            <button class="btn-delete" data-id="${item.id}" title="Hapus"><i class="fas fa-trash"></i></button>
                        </td>`;
                });
            } catch (e) { console.error(`Render error for ${config.storeName}:`, e); }
        }
        
        const renderSuratMasuk = () => renderGenericSurat({ storeName: 'suratMasuk', searchEl: 'search-surat-masuk', tableBodyEl: 'surat-masuk-table-body', noDataEl: 'no-surat-masuk-data', searchKey: 'asal' });
        const renderSuratKeluar = () => renderGenericSurat({ storeName: 'suratKeluar', searchEl: 'search-surat-keluar', tableBodyEl: 'surat-keluar-table-body', noDataEl: 'no-surat-keluar-data', searchKey: 'tujuan' });

        function getSuratFormHtml(item = {}, type) {
            const isMasuk = type === 'masuk';
            return `<form id="form-dynamic-handler">
                <input type="hidden" id="item-id" value="${item.id || ''}">
                <div class="form-group"><label>Nomor Surat</label><input type="text" id="surat-nomor" class="form-control" value="${item.nomor_surat || ''}" required></div>
                <div class="form-group"><label>${isMasuk ? 'Asal' : 'Tujuan'} Surat</label><input type="text" id="surat-asal-tujuan" class="form-control" value="${item[isMasuk ? 'asal' : 'tujuan'] || ''}" required></div>
                <div class="form-group"><label>Perihal</label><input type="text" id="surat-perihal" class="form-control" value="${item.perihal || ''}" required></div>
                <div class="form-group"><label>Tanggal Surat</label><input type="date" id="surat-tanggal" class="form-control" value="${item.tanggal || today()}" required></div>
                <button type="submit" class="btn btn-primary btn-block"><i class="fas fa-save"></i> Simpan</button>
            </form>`;
        }

        // --- MANAJEMEN AKADEMIK (PENGATURAN) ---
        async function renderMapel() {
            try {
                const allMapel = await getAllItems('mapel');
                const tableBody = document.getElementById('mapel-table-body');
                tableBody.innerHTML = '';
                document.getElementById('no-mapel-data').style.display = allMapel.length === 0 ? 'block' : 'none';
                allMapel.forEach(item => {
                    const row = tableBody.insertRow();
                    row.innerHTML = `
                        <td>${item.kode_mapel}</td>
                        <td>${item.nama_mapel}</td>
                        <td class="action-buttons no-export">
                            <button class="btn-edit" data-id="${item.id}" title="Edit"><i class="fas fa-edit"></i></button>
                            <button class="btn-delete" data-id="${item.id}" title="Hapus"><i class="fas fa-trash"></i></button>
                        </td>`;
                });
            } catch (e) { console.error("Render Mapel error:", e); }
        }

        function getMapelFormHtml(item = {}) {
            return `<form id="form-dynamic-handler">
                <input type="hidden" id="item-id" value="${item.id || ''}">
                <div class="form-group"><label>Kode Mata Pelajaran</label><input type="text" id="mapel-kode" class="form-control" value="${item.kode_mapel || ''}" required></div>
                <div class="form-group"><label>Nama Mata Pelajaran</label><input type="text" id="mapel-nama" class="form-control" value="${item.nama_mapel || ''}" required></div>
                <button type="submit" class="btn btn-primary btn-block"><i class="fas fa-save"></i> Simpan</button>
            </form>`;
        }

        async function renderKelas() {
            try {
                const [allKelas, allPtk] = await Promise.all([getAllItems('kelas'), getAllItems('ptk')]);
                const ptkMap = new Map(allPtk.map(p => [p.id, p.nama]));
                const tableBody = document.getElementById('kelas-table-body');
                tableBody.innerHTML = '';
                document.getElementById('no-kelas-data').style.display = allKelas.length === 0 ? 'block' : 'none';
                allKelas.forEach(item => {
                    const row = tableBody.insertRow();
                    row.innerHTML = `
                        <td>${item.nama_kelas}</td>
                        <td>${item.tingkat}</td>
                        <td>${ptkMap.get(item.waliKelasId) || 'Belum diatur'}</td>
                        <td class="action-buttons no-export">
                            <button class="btn-edit" data-id="${item.id}" title="Edit"><i class="fas fa-edit"></i></button>
                            <button class="btn-delete" data-id="${item.id}" title="Hapus"><i class="fas fa-trash"></i></button>
                        </td>`;
                });
            } catch (e) { console.error("Render Kelas error:", e); }
        }

        async function getKelasFormHtml(item = {}) {
            const allPtk = await getAllItems('ptk');
            const ptkOptions = allPtk.map(p => `<option value="${p.id}" ${item.waliKelasId == p.id ? 'selected' : ''}>${p.nama}</option>`).join('');
            return `<form id="form-dynamic-handler">
                <input type="hidden" id="item-id" value="${item.id || ''}">
                <div class="form-group"><label>Nama Kelas (Contoh: X IPA 1)</label><input type="text" id="kelas-nama" class="form-control" value="${item.nama_kelas || ''}" required></div>
                <div class="form-group"><label>Tingkat</label><input type="text" id="kelas-tingkat" class="form-control" value="${item.tingkat || ''}" placeholder="Contoh: X, XI, XII" required></div>
                <div class="form-group"><label>Wali Kelas</label><select id="kelas-waliId" class="form-control"><option value="">Pilih Wali Kelas</option>${ptkOptions}</select></div>
                <button type="submit" class="btn btn-primary btn-block"><i class="fas fa-save"></i> Simpan</button>
            </form>`;
        }

        // --- SETUP EVENT LISTENERS (Centralized) ---
        function setupEventListeners() {
            // Navigation
            allNavItems.forEach(item => item.addEventListener('click', (e) => { e.preventDefault(); switchPage(e.currentTarget.dataset.page); }));

            // Modals & Theme
            closeModalBtn.addEventListener('click', closeModal);
            closeImageViewerBtn.addEventListener('click', closeImageViewer);
            window.addEventListener('click', (event) => { 
                if (event.target == modal) closeModal(); 
                if (event.target == imageViewerModal) closeImageViewer();
            });
            themeSwitchElement.querySelector('input').addEventListener('change', toggleTheme);
            window.addEventListener('resize', handleResponsiveLayout);

            // Tab navigation
            document.querySelectorAll('.tab-nav, .tab-nav-inner').forEach(nav => nav.addEventListener('click', e => {
                const linkClass = nav.classList.contains('tab-nav-inner') ? 'tab-link-inner' : 'tab-link';
                const contentClass = nav.classList.contains('tab-nav-inner') ? 'subtab-content' : 'tab-content';
                const prefix = nav.classList.contains('tab-nav-inner') ? 'subtab-' : 'tab-';

                if (e.target.classList.contains(linkClass)) {
                    e.preventDefault();
                    const tabId = e.target.dataset.tab || e.target.dataset.subtab;
                    nav.querySelectorAll(`.${linkClass}`).forEach(link => link.classList.remove('active'));
                    e.target.classList.add('active');
                    const container = nav.closest(`.${contentClass}, .page`);
                    container.querySelectorAll(`.${contentClass}`).forEach(content => content.classList.remove('active'));
                    const targetTab = container.querySelector(`#${prefix}${tabId}`);
                    if (targetTab) targetTab.classList.add('active');
                }
            }));

            // --- AKUN & AUTH ---
            document.getElementById('btn-logout-akun').addEventListener('click', handleLogout);
            
            // --- PENGATURAN (Admin Only Features) ---
            if (currentUser.role === 'Admin') {
                document.getElementById('form-sekolah').addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const loader = document.getElementById('sekolah-loader');
                    loader.style.display = 'inline-block';
                    const profileData = { id: 1, nama_sekolah: document.getElementById('nama_sekolah').value, npsn: document.getElementById('npsn').value, alamat_sekolah: document.getElementById('alamat_sekolah').value, akreditasi: document.getElementById('akreditasi').value, };
                    try {
                        await updateItem('sekolah', profileData);
                        showToast('Profil sekolah berhasil diperbarui!');
                        await renderHomePage();
                    } catch(err) {
                        showToast('Gagal menyimpan profil.');
                    } finally {
                        loader.style.display = 'none';
                    }
                });
            
                // User Management Listeners
                document.getElementById('btn-add-user').addEventListener('click', () => {
                    openModal('Tambah Pengguna Baru', getUserFormHtml());
                    document.getElementById('form-dynamic-handler').addEventListener('submit', handleUserFormSubmit);
                });
                document.getElementById('user-table-body').addEventListener('click', async (e) => {
                    const btnEdit = e.target.closest('.btn-edit');
                    const btnDelete = e.target.closest('.btn-delete');
                    if (btnEdit) {
                        const user = await getItemById('users', parseInt(btnEdit.dataset.id));
                        openModal('Edit Pengguna', getUserFormHtml(user));
                        document.getElementById('form-dynamic-handler').addEventListener('submit', handleUserFormSubmit);
                    }
                    if (btnDelete) {
                        showConfirmation('Yakin ingin menghapus pengguna ini?', async () => {
                            await deleteItem('users', parseInt(btnDelete.dataset.id));
                            showToast('Pengguna berhasil dihapus.');
                            renderUserManagementTable();
                        });
                    }
                });

                // Akademik Management Listeners
                const mapelFields = { kode_mapel: 'mapel-kode', nama_mapel: 'mapel-nama' };
                document.getElementById('btn-add-mapel').addEventListener('click', () => openGenericForm(null, 'mapel', 'Mata Pelajaran', getMapelFormHtml, (e) => handleGenericFormSubmit(e, 'mapel', renderMapel, mapelFields)));
                document.getElementById('mapel-table-body').addEventListener('click', async (e) => {
                    const btnEdit = e.target.closest('.btn-edit');
                    const btnDelete = e.target.closest('.btn-delete');
                    if (btnEdit) openGenericForm(parseInt(btnEdit.dataset.id), 'mapel', 'Mata Pelajaran', getMapelFormHtml, (e) => handleGenericFormSubmit(e, 'mapel', renderMapel, mapelFields));
                    if (btnDelete) showConfirmation('Yakin hapus mapel ini?', async () => { await deleteItem('mapel', parseInt(btnDelete.dataset.id)); showToast('Mapel dihapus.'); renderMapel(); });
                });

                const kelasFields = { nama_kelas: 'kelas-nama', tingkat: 'kelas-tingkat', waliKelasId: 'kelas-waliId' };
                document.getElementById('btn-add-kelas').addEventListener('click', () => openGenericForm(null, 'kelas', 'Kelas', getKelasFormHtml, (e) => handleGenericFormSubmit(e, 'kelas', renderKelas, kelasFields)));
                document.getElementById('kelas-table-body').addEventListener('click', async (e) => {
                    const btnEdit = e.target.closest('.btn-edit');
                    const btnDelete = e.target.closest('.btn-delete');
                    if (btnEdit) openGenericForm(parseInt(btnEdit.dataset.id), 'kelas', 'Kelas', getKelasFormHtml, (e) => handleGenericFormSubmit(e, 'kelas', renderKelas, kelasFields));
                    if (btnDelete) showConfirmation('Yakin hapus kelas ini?', async () => { await deleteItem('kelas', parseInt(btnDelete.dataset.id)); showToast('Kelas dihapus.'); renderKelas(); });
                });

                // --- BACKUP & RESTORE & REPAIR ---
                document.getElementById('btn-backup-data').addEventListener('click', async () => {
                    try {
                        const backupData = {};
                        for (const storeName of db.objectStoreNames) {
                            backupData[storeName] = await getAllItems(storeName);
                        }
                        const jsonString = JSON.stringify(backupData, null, 2);
                        const blob = new Blob([jsonString], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `edusiap_backup_${new Date().toISOString().slice(0,10)}.json`;
                        a.click();
                        URL.revokeObjectURL(url);
                        showToast('Backup data berhasil diunduh!');
                    } catch (error) { showToast('Gagal melakukan backup data.'); console.error('Backup failed:', error); }
                });
                const restoreInput = document.getElementById('restore-file-input');
                document.getElementById('btn-restore-data').addEventListener('click', () => restoreInput.click());
                restoreInput.addEventListener('change', (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    showConfirmation('PERINGATAN: Merestore data akan menghapus semua data yang ada saat ini (termasuk data pengguna). Anda yakin?', () => {
                        const reader = new FileReader();
                        reader.onload = async (event) => {
                            try {
                                const backupData = JSON.parse(event.target.result);
                                const tx = db.transaction(db.objectStoreNames, 'readwrite');
                                for (const storeName of db.objectStoreNames) {
                                    tx.objectStore(storeName).clear();
                                    if (backupData[storeName]) {
                                        for (const item of backupData[storeName]) {
                                            tx.objectStore(storeName).put(item);
                                        }
                                    }
                                }
                                await new Promise(res => tx.oncomplete = res);
                                showToast('Data berhasil direstore! Aplikasi akan dimuat ulang.');
                                setTimeout(() => window.location.reload(), 2000);
                            } catch (error) { showToast('Gagal merestore data. File tidak valid.'); console.error('Restore failed:', error); } 
                            finally { restoreInput.value = ''; }
                        };
                        reader.readAsText(file);
                    });
                });
                
                const importAllInput = document.getElementById('import-all-data-input');
                document.getElementById('btn-import-all-data').addEventListener('click', () => importAllInput.click());
                importAllInput.addEventListener('change', (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    showConfirmation('PERINGATAN: Ini akan MENGGANTI semua data (siswa, ptk, keuangan, dll) dengan data dari file. Data pengguna tidak akan terpengaruh. Lanjutkan?', () => {
                        const reader = new FileReader();
                        reader.onload = async (event) => {
                            try {
                                const importData = JSON.parse(event.target.result);
                                const storesToImport = Object.keys(importData).filter(name => name !== 'users');
                                const tx = db.transaction(storesToImport, 'readwrite');
                                for (const storeName of storesToImport) {
                                    if(db.objectStoreNames.contains(storeName)) {
                                        tx.objectStore(storeName).clear();
                                        for (const item of importData[storeName]) {
                                            tx.objectStore(storeName).put(item);
                                        }
                                    }
                                }
                                await new Promise(res => tx.oncomplete = res);
                                showToast('Semua data berhasil diimpor! Memuat ulang...');
                                setTimeout(() => window.location.reload(), 2000);
                            } catch (error) { showToast('Gagal mengimpor data. File tidak valid.'); console.error('Master import failed:', error); }
                            finally { importAllInput.value = ''; }
                        };
                        reader.readAsText(file);
                    });
                });

                document.getElementById('btn-repair-app').addEventListener('click', () => {
                    showConfirmation('PERHATIAN! Ini akan menghapus TOTAL database aplikasi. Gunakan hanya jika aplikasi mengalami error parah. Yakin ingin melanjutkan?', async () => {
                        try {
                            db.close();
                            await indexedDB.deleteDatabase(DB_NAME);
                            showToast('Database berhasil dihapus. Aplikasi akan dimuat ulang.');
                            setTimeout(() => window.location.reload(), 2000);
                        } catch (err) {
                            showToast('Gagal memperbaiki aplikasi.');
                            console.error('Repair failed:', err);
                        }
                    });
                });
            }

            // --- KESISWAAN LISTENERS ---
            const siswaFields = { nama: 'siswa-nama', nisn: 'siswa-nisn', kelasId: 'siswa-kelasId', jenis_kelamin: 'siswa-jk', status: 'siswa-status', kontak: 'siswa-kontak' };
            document.getElementById('btn-add-siswa').addEventListener('click', () => openGenericForm(null, 'siswa', 'Data Siswa', getSiswaFormHtml, (e) => handleGenericFormSubmit(e, 'siswa', renderKesiswaan, siswaFields)));
            document.getElementById('siswa-table-body').addEventListener('click', async (e) => {
                const btnEdit = e.target.closest('.btn-edit');
                const btnDelete = e.target.closest('.btn-delete');
                if (btnEdit) {
                    openGenericForm(parseInt(btnEdit.dataset.id), 'siswa', 'Data Siswa', getSiswaFormHtml, (e) => handleGenericFormSubmit(e, 'siswa', renderKesiswaan, siswaFields));
                }
                if (btnDelete) {
                    showConfirmation('Yakin hapus data siswa ini?', async () => {
                        await deleteItem('siswa', parseInt(btnDelete.dataset.id));
                        showToast('Data siswa dihapus.');
                        renderKesiswaan();
                    });
                }
            });
            document.getElementById('btn-export-siswa-excel').addEventListener('click', async () => {
                const data = (await getAllItems('siswa')).filter(s => s.status === 'Aktif');
                const headers = { nama: 'Nama Siswa', nisn: 'NISN', jenis_kelamin: 'Jenis Kelamin', kelasId: 'ID Kelas', status: 'Status', kontak: 'Kontak' };
                exportToExcel(data, headers, 'data_siswa_aktif.xlsx');
            });
            document.getElementById('btn-export-siswa-pdf').addEventListener('click', () => exportToPdf('Laporan Siswa Aktif', 'siswa-table-body'));
            document.getElementById('btn-download-template-siswa').addEventListener('click', () => downloadTemplate(['nama', 'nisn', 'jenis_kelamin', 'kelasId', 'status', 'kontak'], 'template_siswa.xlsx'));
            document.getElementById('btn-import-siswa').addEventListener('click', () => handleImport(document.getElementById('import-siswa-input'), 'siswa', ['nama', 'kelasId', 'status'], renderKesiswaan));
            
            const spmbFields = { nama: 'spmb-nama', asal_sekolah: 'spmb-asal', kontak: 'spmb-kontak', status: 'spmb-status' };
            document.getElementById('btn-add-calon-siswa').addEventListener('click', () => openGenericForm(null, 'spmb', 'Calon Siswa', getCalonSiswaFormHtml, (e) => handleGenericFormSubmit(e, 'spmb', renderSPMB, spmbFields)));
            document.getElementById('spmb-table-body').addEventListener('click', async (e) => {
                const btnEdit = e.target.closest('.btn-edit');
                const btnDelete = e.target.closest('.btn-delete');
                const btnTerima = e.target.closest('[data-action="terima"]');
                if (btnEdit) openGenericForm(parseInt(btnEdit.dataset.id), 'spmb', 'Calon Siswa', getCalonSiswaFormHtml, (e) => handleGenericFormSubmit(e, 'spmb', renderSPMB, spmbFields));
                if (btnDelete) showConfirmation('Yakin hapus data calon siswa ini?', async () => { await deleteItem('spmb', parseInt(btnDelete.dataset.id)); showToast('Data dihapus.'); renderSPMB(); });
                if (btnTerima) {
                    showConfirmation('Yakin ingin menerima siswa ini? Data akan dipindahkan ke Siswa Aktif.', async () => {
                        const calonSiswa = await getItemById('spmb', parseInt(btnTerima.dataset.id));
                        const siswaBaru = {
                            nama: calonSiswa.nama,
                            kontak: calonSiswa.kontak,
                            status: 'Aktif',
                            // Default values, should be edited later
                            nisn: '',
                            kelasId: null, 
                            jenis_kelamin: 'Laki-laki'
                        };
                        await addItem('siswa', siswaBaru);
                        calonSiswa.status = 'Diterima';
                        await updateItem('spmb', calonSiswa);
                        showToast(`${calonSiswa.nama} telah diterima sebagai siswa aktif.`);
                        renderKesiswaan();
                    });
                }
            });

            const mutasiFields = { nama_siswa: 'mutasi-nama', jenis_mutasi: 'mutasi-jenis', tanggal: 'mutasi-tanggal', keterangan: 'mutasi-keterangan' };
            document.getElementById('search-mutasi').addEventListener('input', renderSiswaMutasi);
            document.getElementById('btn-add-mutasi').addEventListener('click', () => openGenericForm(null, 'mutasi', 'Data Mutasi', getMutasiFormHtml, (e) => handleGenericFormSubmit(e, 'mutasi', renderSiswaMutasi, mutasiFields)));
            document.getElementById('mutasi-table-body').addEventListener('click', async (e) => {
                const btnEdit = e.target.closest('.btn-edit');
                const btnDelete = e.target.closest('.btn-delete');
                if (btnEdit) openGenericForm(parseInt(btnEdit.dataset.id), 'mutasi', 'Data Mutasi', getMutasiFormHtml, (e) => handleGenericFormSubmit(e, 'mutasi', renderSiswaMutasi, mutasiFields));
                if (btnDelete) showConfirmation('Yakin hapus data mutasi ini?', async () => { await deleteItem('mutasi', parseInt(btnDelete.dataset.id)); showToast('Data mutasi dihapus.'); renderSiswaMutasi(); });
            });
            document.getElementById('btn-export-mutasi-excel').addEventListener('click', async () => {
                const data = await getAllItems('mutasi');
                const headers = { nama_siswa: 'Nama Siswa', jenis_mutasi: 'Jenis Mutasi', tanggal: 'Tanggal', keterangan: 'Keterangan' };
                exportToExcel(data, headers, 'data_mutasi.xlsx');
            });
            document.getElementById('btn-export-mutasi-pdf').addEventListener('click', () => exportToPdf('Laporan Siswa Mutasi', 'mutasi-table-body'));

            const alumniFields = { nama: 'alumni-nama', tahun_lulus: 'alumni-tahun', kontak: 'alumni-kontak' };
            document.getElementById('search-alumni').addEventListener('input', renderSiswaAlumni);
            document.getElementById('btn-add-alumni').addEventListener('click', () => openGenericForm(null, 'alumni', 'Data Alumni', getAlumniFormHtml, (e) => handleGenericFormSubmit(e, 'alumni', renderSiswaAlumni, alumniFields)));
            document.getElementById('alumni-table-body').addEventListener('click', async (e) => {
                const btnEdit = e.target.closest('.btn-edit');
                const btnDelete = e.target.closest('.btn-delete');
                if (btnEdit) openGenericForm(parseInt(btnEdit.dataset.id), 'alumni', 'Data Alumni', getAlumniFormHtml, (e) => handleGenericFormSubmit(e, 'alumni', renderSiswaAlumni, alumniFields));
                if (btnDelete) showConfirmation('Yakin hapus data alumni ini?', async () => { await deleteItem('alumni', parseInt(btnDelete.dataset.id)); showToast('Data alumni dihapus.'); renderSiswaAlumni(); });
            });
            document.getElementById('btn-export-alumni-excel').addEventListener('click', async () => {
                const data = await getAllItems('alumni');
                const headers = { nama: 'Nama Alumni', tahun_lulus: 'Tahun Lulus', kontak: 'Kontak' };
                exportToExcel(data, headers, 'data_alumni.xlsx');
            });
            document.getElementById('btn-export-alumni-pdf').addEventListener('click', () => exportToPdf('Laporan Alumni', 'alumni-table-body'));
            document.getElementById('btn-download-template-alumni').addEventListener('click', () => downloadTemplate(['nama', 'tahun_lulus', 'kontak'], 'template_alumni.xlsx'));
            document.getElementById('btn-import-alumni').addEventListener('click', () => handleImport(document.getElementById('import-alumni-input'), 'alumni', ['nama', 'tahun_lulus'], renderSiswaAlumni));
            
            // --- PTK LISTENERS ---
            const ptkFields = { nama: 'ptk-nama', nuptk: 'ptk-nuptk', jabatan: 'ptk-jabatan', kontak: 'ptk-kontak' };
            document.getElementById('search-ptk').addEventListener('input', renderPtk);
            document.getElementById('filter-ptk-jabatan').addEventListener('change', renderPtk);
            document.getElementById('btn-add-ptk').addEventListener('click', () => openGenericForm(null, 'ptk', 'Data PTK', getPtkFormHtml, (e) => handleGenericFormSubmit(e, 'ptk', renderPtk, ptkFields)));
            document.getElementById('ptk-table-body').addEventListener('click', async (e) => {
                const btnEdit = e.target.closest('.btn-edit');
                const btnDelete = e.target.closest('.btn-delete');
                if (btnEdit) openGenericForm(parseInt(btnEdit.dataset.id), 'ptk', 'Data PTK', getPtkFormHtml, (e) => handleGenericFormSubmit(e, 'ptk', renderPtk, ptkFields));
                if (btnDelete) showConfirmation('Yakin hapus data PTK ini?', async () => { await deleteItem('ptk', parseInt(btnDelete.dataset.id)); showToast('Data PTK dihapus.'); renderPtk(); });
            });
            document.getElementById('btn-export-ptk-excel').addEventListener('click', async () => {
                const data = await getAllItems('ptk');
                const headers = { nama: 'Nama PTK', nuptk: 'NUPTK', jabatan: 'Jabatan', kontak: 'Kontak' };
                exportToExcel(data, headers, 'data_ptk.xlsx');
            });
            document.getElementById('btn-export-ptk-pdf').addEventListener('click', () => exportToPdf('Laporan Data PTK', 'ptk-table-body'));
            document.getElementById('btn-download-template-ptk').addEventListener('click', () => downloadTemplate(['nama', 'nuptk', 'jabatan', 'kontak'], 'template_ptk.xlsx'));
            document.getElementById('btn-import-ptk').addEventListener('click', () => handleImport(document.getElementById('import-ptk-input'), 'ptk', ['nama', 'jabatan'], renderPtk));

            // --- JADWAL LISTENERS ---
            const jadwalFields = { kelasId: 'jadwal-kelasId', hari: 'jadwal-hari', mapelId: 'jadwal-mapelId', ptkId: 'jadwal-ptkId', jam_ke: 'jadwal-jam_ke', waktu: 'jadwal-waktu' };
            document.getElementById('filter-jadwal-kelas').addEventListener('change', renderJadwal);
            document.getElementById('filter-jadwal-hari').addEventListener('change', renderJadwal);
            document.getElementById('btn-add-jadwal').addEventListener('click', () => openGenericForm(null, 'jadwal', 'Jadwal Pelajaran', getJadwalFormHtml, (e) => handleGenericFormSubmit(e, 'jadwal', renderJadwal, jadwalFields)));
            document.getElementById('jadwal-table-body').addEventListener('click', async (e) => {
                const btnEdit = e.target.closest('.btn-edit');
                const btnDelete = e.target.closest('.btn-delete');
                if (btnEdit) openGenericForm(parseInt(btnEdit.dataset.id), 'jadwal', 'Jadwal Pelajaran', getJadwalFormHtml, (e) => handleGenericFormSubmit(e, 'jadwal', renderJadwal, jadwalFields));
                if (btnDelete) showConfirmation('Yakin hapus jadwal ini?', async () => { await deleteItem('jadwal', parseInt(btnDelete.dataset.id)); showToast('Jadwal dihapus.'); renderJadwal(); });
            });

            // --- SARPRAS LISTENERS ---
            const inventarisFields = { kode: 'inventaris-kode', nama: 'inventaris-nama', jumlah: 'inventaris-jumlah', harga: 'inventaris-harga', lokasi: 'inventaris-lokasi', kondisi: 'inventaris-kondisi', tanggal_pembelian: 'inventaris-tanggal' };
            document.getElementById('search-inventaris').addEventListener('input', renderInventaris);
            document.getElementById('filter-inventaris-lokasi').addEventListener('change', renderInventaris);
            document.getElementById('filter-inventaris-kondisi').addEventListener('change', renderInventaris);
            document.getElementById('btn-add-inventaris').addEventListener('click', () => openGenericForm(null, 'inventaris', 'Data Inventaris', getInventarisFormHtml, (e) => handleGenericFormSubmit(e, 'inventaris', renderInventaris, inventarisFields)));
            document.getElementById('inventaris-table-body').addEventListener('click', async (e) => {
                const btnEdit = e.target.closest('.btn-edit');
                const btnDelete = e.target.closest('.btn-delete');
                if (btnEdit) openGenericForm(parseInt(btnEdit.dataset.id), 'inventaris', 'Data Inventaris', getInventarisFormHtml, (e) => handleGenericFormSubmit(e, 'inventaris', renderInventaris, inventarisFields));
                if (btnDelete) showConfirmation('Yakin hapus data ini?', async () => { await deleteItem('inventaris', parseInt(btnDelete.dataset.id)); showToast('Data inventaris dihapus.'); renderInventaris(); });
            });
            document.getElementById('btn-export-inventaris-excel').addEventListener('click', async () => {
                const data = await getAllItems('inventaris');
                const headers = { kode: 'Kode Barang', nama: 'Nama Barang', jumlah: 'Jumlah', harga: 'Harga', lokasi: 'Lokasi', kondisi: 'Kondisi', tanggal_pembelian: 'Tanggal Pembelian' };
                exportToExcel(data, headers, 'data_inventaris.xlsx');
            });
            document.getElementById('btn-export-inventaris-pdf').addEventListener('click', () => exportToPdf('Laporan Inventaris', 'inventaris-table-body'));

            const stokFields = { nama: 'stok-nama', stok: 'stok-jumlah' };
            document.getElementById('btn-add-stok').addEventListener('click', () => openGenericForm(null, 'stokHarian', 'Stok Barang', getStokHarianFormHtml, (e) => handleGenericFormSubmit(e, 'stokHarian', renderStokHarian, stokFields)));
            document.getElementById('stok-harian-table-body').addEventListener('click', async (e) => {
                const btnEdit = e.target.closest('.btn-edit');
                const btnDelete = e.target.closest('.btn-delete');
                if (btnEdit) openGenericForm(parseInt(btnEdit.dataset.id), 'stokHarian', 'Stok Barang', getStokHarianFormHtml, (e) => handleGenericFormSubmit(e, 'stokHarian', renderStokHarian, stokFields));
                if (btnDelete) showConfirmation('Yakin hapus data ini?', async () => { await deleteItem('stokHarian', parseInt(btnDelete.dataset.id)); showToast('Data stok dihapus.'); renderStokHarian(); });
            });

            // --- KEUANGAN LISTENERS ---
            const sppFields = { nama_siswa: 'spp-nama', keterangan: 'spp-keterangan', jumlah: 'spp-jumlah', tanggal: 'spp-tanggal', bukti: 'spp-bukti' };
            document.getElementById('search-spp').addEventListener('input', renderSpp);
            document.getElementById('btn-add-spp').addEventListener('click', () => openGenericForm(null, 'spp', 'Pembayaran SPP', getSppFormHtml, (e) => handleGenericFormSubmit(e, 'spp', renderSpp, sppFields)));
            document.getElementById('spp-table-body').addEventListener('click', async (e) => {
                const btnEdit = e.target.closest('.btn-edit');
                const btnDelete = e.target.closest('.btn-delete');
                const btnView = e.target.closest('.btn-view-proof');
                if (btnEdit) openGenericForm(parseInt(btnEdit.dataset.id), 'spp', 'Pembayaran SPP', getSppFormHtml, (e) => handleGenericFormSubmit(e, 'spp', renderSpp, sppFields));
                if (btnDelete) showConfirmation('Yakin hapus data ini?', async () => { await deleteItem('spp', parseInt(btnDelete.dataset.id)); showToast('Data dihapus.'); renderSpp(); });
                if (btnView) { const item = await getItemById('spp', parseInt(btnView.dataset.id)); openImageViewer(item.bukti); }
            });
            document.getElementById('btn-export-spp-excel').addEventListener('click', async () => {
                const data = await getAllItems('spp');
                const headers = { nama_siswa: 'Nama Siswa', keterangan: 'Keterangan', jumlah: 'Jumlah', tanggal: 'Tanggal' };
                exportToExcel(data, headers, 'data_pembayaran_spp.xlsx');
            });
            document.getElementById('btn-export-spp-pdf').addEventListener('click', () => exportToPdf('Laporan Pembayaran SPP', 'spp-table-body'));

            const infaqFields = { sumber: 'infaq-sumber', keterangan: 'infaq-keterangan', jumlah: 'infaq-jumlah', tanggal: 'infaq-tanggal', bukti: 'infaq-bukti' };
            document.getElementById('search-infaq').addEventListener('input', renderInfaq);
            document.getElementById('btn-add-infaq').addEventListener('click', () => openGenericForm(null, 'infaq', 'Data Infaq', getInfaqFormHtml, (e) => handleGenericFormSubmit(e, 'infaq', renderInfaq, infaqFields)));
            document.getElementById('infaq-table-body').addEventListener('click', async (e) => {
                const btnEdit = e.target.closest('.btn-edit');
                const btnDelete = e.target.closest('.btn-delete');
                const btnView = e.target.closest('.btn-view-proof');
                if (btnEdit) openGenericForm(parseInt(btnEdit.dataset.id), 'infaq', 'Data Infaq', getInfaqFormHtml, (e) => handleGenericFormSubmit(e, 'infaq', renderInfaq, infaqFields));
                if (btnDelete) showConfirmation('Yakin hapus data ini?', async () => { await deleteItem('infaq', parseInt(btnDelete.dataset.id)); showToast('Data dihapus.'); renderInfaq(); });
                if (btnView) { const item = await getItemById('infaq', parseInt(btnView.dataset.id)); openImageViewer(item.bukti); }
            });
            document.getElementById('btn-export-infaq-excel').addEventListener('click', async () => {
                const data = await getAllItems('infaq');
                const headers = { sumber: 'Sumber Infaq', keterangan: 'Keterangan', jumlah: 'Jumlah', tanggal: 'Tanggal' };
                exportToExcel(data, headers, 'data_infaq.xlsx');
            });
            document.getElementById('btn-export-infaq-pdf').addEventListener('click', () => exportToPdf('Laporan Infaq', 'infaq-table-body'));

            const pengeluaranFields = { keterangan: 'pengeluaran-keterangan', jumlah: 'pengeluaran-jumlah', kategori: 'pengeluaran-kategori', tanggal: 'pengeluaran-tanggal', bukti: 'pengeluaran-bukti' };
            document.getElementById('search-pengeluaran').addEventListener('input', renderPengeluaran);
            document.getElementById('btn-add-pengeluaran').addEventListener('click', () => openGenericForm(null, 'pengeluaran', 'Pengeluaran', getPengeluaranFormHtml, (e) => handleGenericFormSubmit(e, 'pengeluaran', renderPengeluaran, pengeluaranFields)));
            document.getElementById('pengeluaran-table-body').addEventListener('click', async (e) => {
                const btnEdit = e.target.closest('.btn-edit');
                const btnDelete = e.target.closest('.btn-delete');
                const btnView = e.target.closest('.btn-view-proof');
                if (btnEdit) openGenericForm(parseInt(btnEdit.dataset.id), 'pengeluaran', 'Pengeluaran', getPengeluaranFormHtml, (e) => handleGenericFormSubmit(e, 'pengeluaran', renderPengeluaran, pengeluaranFields));
                if (btnDelete) showConfirmation('Yakin hapus data ini?', async () => { await deleteItem('pengeluaran', parseInt(btnDelete.dataset.id)); showToast('Data dihapus.'); renderPengeluaran(); });
                if (btnView) { const item = await getItemById('pengeluaran', parseInt(btnView.dataset.id)); openImageViewer(item.bukti); }
            });
            document.getElementById('btn-export-pengeluaran-excel').addEventListener('click', async () => {
                const data = await getAllItems('pengeluaran');
                const headers = { keterangan: 'Keterangan', jumlah: 'Jumlah', kategori: 'Kategori', tanggal: 'Tanggal' };
                exportToExcel(data, headers, 'data_pengeluaran.xlsx');
            });
            document.getElementById('btn-export-pengeluaran-pdf').addEventListener('click', () => exportToPdf('Laporan Pengeluaran', 'pengeluaran-table-body'));

            // --- SURAT LISTENERS ---
            const suratMasukFields = { nomor_surat: 'surat-nomor', asal: 'surat-asal-tujuan', perihal: 'surat-perihal', tanggal: 'surat-tanggal' };
            document.getElementById('search-surat-masuk').addEventListener('input', renderSuratMasuk);
            document.getElementById('btn-add-surat-masuk').addEventListener('click', () => openGenericForm(null, 'suratMasuk', 'Surat Masuk', (item) => getSuratFormHtml(item, 'masuk'), (e) => handleGenericFormSubmit(e, 'suratMasuk', renderSuratMasuk, suratMasukFields)));
            document.getElementById('surat-masuk-table-body').addEventListener('click', async (e) => {
                const btnEdit = e.target.closest('.btn-edit');
                const btnDelete = e.target.closest('.btn-delete');
                if (btnEdit) openGenericForm(parseInt(btnEdit.dataset.id), 'suratMasuk', 'Surat Masuk', (item) => getSuratFormHtml(item, 'masuk'), (e) => handleGenericFormSubmit(e, 'suratMasuk', renderSuratMasuk, suratMasukFields));
                if (btnDelete) showConfirmation('Yakin hapus data ini?', async () => { await deleteItem('suratMasuk', parseInt(btnDelete.dataset.id)); showToast('Data dihapus.'); renderSuratMasuk(); });
            });
            document.getElementById('btn-export-surat-masuk-excel').addEventListener('click', async () => {
                const data = await getAllItems('suratMasuk');
                const headers = { nomor_surat: 'No. Surat', tanggal: 'Tanggal', asal: 'Asal', perihal: 'Perihal' };
                exportToExcel(data, headers, 'data_surat_masuk.xlsx');
            });
            document.getElementById('btn-export-surat-masuk-pdf').addEventListener('click', () => exportToPdf('Laporan Surat Masuk', 'surat-masuk-table-body'));

            const suratKeluarFields = { nomor_surat: 'surat-nomor', tujuan: 'surat-asal-tujuan', perihal: 'surat-perihal', tanggal: 'surat-tanggal' };
            document.getElementById('search-surat-keluar').addEventListener('input', renderSuratKeluar);
            document.getElementById('btn-add-surat-keluar').addEventListener('click', () => openGenericForm(null, 'suratKeluar', 'Surat Keluar', (item) => getSuratFormHtml(item, 'keluar'), (e) => handleGenericFormSubmit(e, 'suratKeluar', renderSuratKeluar, suratKeluarFields)));
            document.getElementById('surat-keluar-table-body').addEventListener('click', async (e) => {
                const btnEdit = e.target.closest('.btn-edit');
                const btnDelete = e.target.closest('.btn-delete');
                if (btnEdit) openGenericForm(parseInt(btnEdit.dataset.id), 'suratKeluar', 'Surat Keluar', (item) => getSuratFormHtml(item, 'keluar'), (e) => handleGenericFormSubmit(e, 'suratKeluar', renderSuratKeluar, suratKeluarFields));
                if (btnDelete) showConfirmation('Yakin hapus data ini?', async () => { await deleteItem('suratKeluar', parseInt(btnDelete.dataset.id)); showToast('Data dihapus.'); renderSuratKeluar(); });
            });
             document.getElementById('btn-export-surat-keluar-excel').addEventListener('click', async () => {
                const data = await getAllItems('suratKeluar');
                const headers = { nomor_surat: 'No. Surat', tanggal: 'Tanggal', tujuan: 'Tujuan', perihal: 'Perihal' };
                exportToExcel(data, headers, 'data_surat_keluar.xlsx');
            });
            document.getElementById('btn-export-surat-keluar-pdf').addEventListener('click', () => exportToPdf('Laporan Surat Keluar', 'surat-keluar-table-body'));
            
            // --- DATA RAPOR LISTENERS ---
            document.getElementById('form-identitas-rapor').addEventListener('submit', async (e) => {
                e.preventDefault();
                const data = {
                    id: 1,
                    kepsek: document.getElementById('rapor-kepala-sekolah').value,
                    nip: document.getElementById('rapor-nip-kepsek').value,
                    tanggal: document.getElementById('rapor-tanggal-terbit').value,
                    tempat: document.getElementById('rapor-tempat-terbit').value,
                };
                try {
                    await updateItem('identitasRapor', data);
                    showToast('Identitas rapor berhasil disimpan!');
                } catch (err) {
                    showToast('Gagal menyimpan identitas rapor.');
                    console.error('Save identitas rapor error:', err);
                }
            });

            document.getElementById('btn-save-nilai').addEventListener('click', async () => {
                const mapelId = document.getElementById('filter-input-nilai-mapel').value;
                const jenis = document.getElementById('filter-input-nilai-jenis').value;
                if (!mapelId || !jenis) {
                    showToast('Silakan pilih mata pelajaran dan jenis nilai.');
                    return;
                }
                const inputElements = document.querySelectorAll('.nilai-input');
                const tx = db.transaction('nilai', 'readwrite');
                const store = tx.objectStore('nilai');
                let successCount = 0;

                inputElements.forEach(input => {
                    const nilai = input.value;
                    if (nilai) {
                        const siswaId = parseInt(input.dataset.siswaId);
                        const existingId = input.dataset.existingId ? parseInt(input.dataset.existingId) : null;
                        const data = { siswaId, mapelId: parseInt(mapelId), nilai, jenis };
                        if (existingId) {
                            data.id = existingId;
                        }
                        store.put(data);
                        successCount++;
                    }
                });
                
                tx.oncomplete = () => {
                    if (successCount > 0) {
                        showToast(`Berhasil menyimpan ${successCount} data nilai!`);
                        renderDaftarNilai();
                    }
                };
                tx.onerror = () => { showToast('Terjadi kesalahan saat menyimpan nilai.'); };
            });

            document.getElementById('search-daftar-nilai').addEventListener('input', renderDaftarNilai);
            document.getElementById('daftar-nilai-table-body').addEventListener('click', (e) => {
                const btnDelete = e.target.closest('.btn-delete');
                if (btnDelete) {
                    const id = parseInt(btnDelete.dataset.id);
                    showConfirmation('Yakin ingin menghapus data nilai ini?', async () => {
                        await deleteItem('nilai', id);
                        showToast('Data nilai berhasil dihapus.');
                        renderDaftarNilai();
                    });
                }
            });

            document.getElementById('btn-cetak-rapor').addEventListener('click', handleCetakRapor);
            document.getElementById('btn-cetak-skl').addEventListener('click', () => {
                const siswaId = document.getElementById('filter-skl-siswa').value;
                if (!siswaId) {
                    showToast("Pilih siswa terlebih dahulu.");
                    return;
                }
                // Logic to generate and print SKL would go here.
                showToast("Fitur cetak SKL belum diimplementasikan.");
            });
        }

        // --- INITIALIZE APP ---
        function initializeAppUI() {
            showAppScreen();
            
            const tx = db.transaction('sekolah', 'readwrite');
            const store = tx.objectStore('sekolah');
            const countReq = store.count();
            countReq.onsuccess = () => {
                if (countReq.result === 0) {
                    console.log("Seeding initial school profile...");
                    store.put({id: 1, nama_sekolah: "Sekolah Impian Bangsa", npsn: "12345678", alamat_sekolah: "Jl. Pendidikan No. 1", akreditasi: "A"});
                }
            };
            tx.oncomplete = () => {
                handleResponsiveLayout();
                const savedTheme = localStorage.getItem('theme') || 'light-mode';
                applyTheme(savedTheme);
                setupUIAccess();
                setupEventListeners();
                
                const defaultNav = document.querySelector('.nav-item[data-roles*="'+currentUser.role+'"]') || document.querySelector('.nav-item[data-roles="all"]');
                switchPage(defaultNav.dataset.page);
            };
        }
        // Daftarkan service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('service-worker.js')
    .then(reg => console.log('SW berhasil:', reg))
    .catch(err => console.error('SW gagal:', err));
}


        async function startApp() {
            try {
                const themeSwitchTemplate = document.getElementById('theme-switch-template');
                if (themeSwitchTemplate) {
                    themeSwitchElement = themeSwitchTemplate.content.firstElementChild.cloneNode(true);
                }
                await initDB();
                checkSession();
            } catch(err) {
                console.error("Initialization failed:", err);
                document.body.innerHTML = `<div style="padding: 2rem; text-align: center;"><h1>Error</h1><p>Aplikasi tidak dapat dijalankan. Pastikan browser Anda mendukung IndexedDB dan tidak dalam mode private. Coba bersihkan cache jika masalah berlanjut.</p><pre>${err.message || err}</pre></div>`;
            }
        }

        startApp();
    });
})();

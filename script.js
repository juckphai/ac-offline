// ==============================================
// ตัวแปร global (ลบ Firebase ออก)
// ==============================================
let accounts = [];
let currentAccount = null;
let records = [];
let editingIndex = null;
let accountTypes = new Map();
let tempTypeValue = '';
let backupPassword = null;
let summaryContext = {};
let singleDateExportContext = {}; 
let dateRangeExportContext = {};

// ==============================================
// IndexedDB Configuration
// ==============================================
const DB_NAME = 'offline_finance_db';
const DB_VERSION = 1;

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (e) => {
            const db = e.target.result;

            if (!db.objectStoreNames.contains('settings')) {
                db.createObjectStore('settings', { keyPath: 'key' });
            }
            if (!db.objectStoreNames.contains('records')) {
                db.createObjectStore('records', { autoIncrement: true });
            }
            if (!db.objectStoreNames.contains('accountTypes')) {
                db.createObjectStore('accountTypes', { keyPath: 'account' });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// ==============================================
// IndexedDB Save/Load Functions
// ==============================================
async function saveToIndexedDB() {
    const db = await openDB();
    const tx = db.transaction(['settings', 'records', 'accountTypes'], 'readwrite');

    tx.objectStore('settings').put({ key: 'accounts', value: accounts });
    tx.objectStore('settings').put({ key: 'currentAccount', value: currentAccount });
    tx.objectStore('settings').put({ key: 'backupPassword', value: backupPassword });

    const recordStore = tx.objectStore('records');
    recordStore.clear();
    records.forEach(r => recordStore.add(r));

    const typeStore = tx.objectStore('accountTypes');
    typeStore.clear();
    accountTypes.forEach((value, key) => {
        typeStore.put({ account: key, types: value });
    });

    return tx.complete;
}

async function loadFromIndexedDB() {
    const db = await openDB();

    // settings
    const settingsTx = db.transaction('settings', 'readonly');
    const settingsStore = settingsTx.objectStore('settings');

    accounts = (await settingsStore.get('accounts'))?.value || [];
    currentAccount = (await settingsStore.get('currentAccount'))?.value || null;
    backupPassword = (await settingsStore.get('backupPassword'))?.value || null;

    // records
    records = [];
    await new Promise(resolve => {
        const tx = db.transaction('records', 'readonly');
        tx.objectStore('records').openCursor().onsuccess = e => {
            const cursor = e.target.result;
            if (cursor) {
                records.push(cursor.value);
                cursor.continue();
            } else resolve();
        };
    });

    // accountTypes
    accountTypes = new Map();
    await new Promise(resolve => {
        const tx = db.transaction('accountTypes', 'readonly');
        tx.objectStore('accountTypes').openCursor().onsuccess = e => {
            const cursor = e.target.result;
            if (cursor) {
                accountTypes.set(cursor.value.account, cursor.value.types);
                cursor.continue();
            } else resolve();
        };
    });
}

// ==============================================
// ฟังก์ชันช่วยดึงชื่อผู้ใช้ (Audit Trail Helper)
// ==============================================
function getCurrentUserIdentifier() {
    return 'Local User';
}

// ==============================================
// ฟังก์ชันจัดการ Toast Notification
// ==============================================

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    
    // กำหนดสีตามประเภท
    let backgroundColor = '#007bff'; // เริ่มต้นสีน้ำเงิน
    switch(type) {
        case 'success':
            backgroundColor = '#28a745'; // สีเขียว
            break;
        case 'error':
            backgroundColor = '#dc3545'; // สีแดง
            break;
        case 'warning':
            backgroundColor = '#ffc107'; // สีเหลือง
            break;
        case 'income':
            backgroundColor = '#28a745'; // สีเขียวสำหรับรายรับ
            break;
        case 'expense':
            backgroundColor = '#dc3545'; // สีแดงสำหรับรายจ่าย
            break;
        case 'info':
        default:
            backgroundColor = '#007bff'; // สีน้ำเงิน
            break;
    }
    
    // ตั้งค่าข้อความและสี
    toast.textContent = message;
    toast.style.backgroundColor = backgroundColor;
    
    // แสดง toast
    toast.className = "toast-notification show";
    
    // ซ่อน toast หลังจาก 3 วินาที
    setTimeout(function() {
        toast.className = toast.className.replace("show", "");
    }, 3000);
}

// ==============================================
// ฟังก์ชันจัดการเมนู
// ==============================================

function toggleMainSection(sectionId) { 
    console.log('toggleMainSection called:', sectionId);
    
    const section = document.getElementById(sectionId);
    if (!section) {
        console.error('Section not found:', sectionId);
        return;
    }
    
    const header = section.previousElementSibling;
    
    // ตรวจสอบว่าเมนูนี้กำลังเปิดอยู่แล้วหรือไม่
    const isCurrentlyActive = section.classList.contains('active');
    
    // ซ่อนเมนูใหญ่ทั้งหมดก่อน
    const allMainSections = document.querySelectorAll('.main-section-content');
    const allMainHeaders = document.querySelectorAll('.main-section-header');
    
    allMainSections.forEach(section => {
        section.classList.remove('active');
    });
    
    allMainHeaders.forEach(header => {
        header.classList.remove('active');
    });
    
    // ถ้าเมนูนี้ยังไม่เปิดอยู่ ให้เปิดมัน (ถ้ากำลังเปิดอยู่แล้ว จะถูกปิดโดยโค้ดด้านบน)
    if (!isCurrentlyActive) {
        section.classList.add('active');
        if (header) header.classList.add('active');
    }
}

function toggleSubSection(sectionId) {
    console.log('toggleSubSection called:', sectionId);
    
    const section = document.getElementById(sectionId);
    if (!section) {
        console.error('Sub-section not found:', sectionId);
        return;
    }
    
    const header = section.previousElementSibling;
    
    section.classList.toggle('active');
    if (header) header.classList.toggle('active');
}

function closeAllMainSections() {
    const allMainSections = document.querySelectorAll('.main-section-content');
    const allMainHeaders = document.querySelectorAll('.main-section-header');
    
    allMainSections.forEach(section => {
        section.classList.remove('active');
    });
    
    allMainHeaders.forEach(header => {
        header.classList.remove('active');
    });
}

function toggleSection(sectionId) {
    toggleMainSection(sectionId);
}

// ==============================================
// ฟังก์ชันจัดการ Modal
// ==============================================

function openSummaryModal(htmlContent) {
    const modal = document.getElementById('summaryModal');
    const modalBody = document.getElementById('modalBodyContent');
    modalBody.innerHTML = htmlContent;
    modal.style.display = 'flex';
    setupSummaryControlsAndSave();
    showToast("📊 เปิดหน้าต่างสรุปข้อมูลเรียบร้อย", 'info');
}

function closeSummaryModal() { 
    const modal = document.getElementById('summaryModal'); 
    modal.style.display = 'none'; 
}

function openExportOptionsModal() { 
    document.getElementById('exportOptionsModal').style.display = 'flex'; 
    showToast("💾 เปิดหน้าต่างบันทึกข้อมูลเรียบร้อย", 'info');
}

function closeExportOptionsModal() { 
    document.getElementById('exportOptionsModal').style.display = 'none'; 
}

function closeSingleDateExportModal() { 
    document.getElementById('singleDateExportModal').style.display = 'none'; 
}

function closeSingleDateExportFormatModal() { 
    document.getElementById('singleDateExportFormatModal').style.display = 'none'; 
}

function closeFormatModal() { 
    document.getElementById('formatSelectionModal').style.display = 'none'; 
}

function closeExportSingleAccountModal() { 
    document.getElementById('exportSingleAccountModal').style.display = 'none'; 
}

function openSummaryOutputModal() { 
    document.getElementById('summaryOutputModal').style.display = 'flex'; 
}

function closeSummaryOutputModal() { 
    document.getElementById('summaryOutputModal').style.display = 'none'; 
    summaryContext = {}; 
}

function closeDateRangeExportModal() {
    document.getElementById('dateRangeExportModal').style.display = 'none';
    dateRangeExportContext = {};
}

// ==============================================
// ฟังก์ชันจัดการ Summary Modal
// ==============================================

function setupSummaryControlsAndSave() {
    const modalContentContainer = document.querySelector("#summaryModal .modal-content-container");
    const modalBody = document.getElementById("modalBodyContent");
    if (!modalBody || !modalContentContainer) return;

    // --- Font Size Controls ---
    const textElements = modalBody.querySelectorAll('p, h4, strong, th, td, span, div');
    const fsSlider = document.getElementById("summaryFontSizeSlider");
    const fsValueSpan = document.getElementById("summaryFontSizeValue");

    textElements.forEach(el => {
        if (!el.dataset.originalSize) {
            el.dataset.originalSize = parseFloat(window.getComputedStyle(el).fontSize);
        }
    });

    function updateFontSize() {
        const scale = fsSlider.value;
        textElements.forEach(el => {
            const originalSize = parseFloat(el.dataset.originalSize);
            if (originalSize) {
                el.style.fontSize = (originalSize * scale) + 'px';
            }
        });
        fsValueSpan.textContent = "ขนาด: " + Math.round(scale * 100) + "%";
    }
    
    fsSlider.removeEventListener("input", updateFontSize);
    fsSlider.addEventListener("input", updateFontSize);

    // --- Line Height Controls ---
    const lhSlider = document.getElementById("summaryLineHeightSlider");
    const lhValueSpan = document.getElementById("summaryLineHeightValue");

    function updateLineHeight() {
        const lineHeight = lhSlider.value;
        
        // 1. ปรับความสูงบรรทัดของข้อความทั่วไป
        modalBody.style.lineHeight = lineHeight;
        
        // 2. [เพิ่มใหม่] ปรับความสูงของแถวตาราง (td, th) โดยการปรับ Padding
        const tableCells = modalBody.querySelectorAll('th, td');
        tableCells.forEach(cell => {
            // สูตร: ฐาน 4px คูณด้วยค่า Slider
            // เช่น Slider = 1.0 -> padding 4px
            // Slider = 2.0 -> padding 8px
            const calcPadding = 4 * lineHeight; 
            
            // ปรับเฉพาะบน-ล่าง (ซ้าย-ขวาล็อกไว้ที่ 4px หรือตามต้องการ)
            cell.style.padding = `${calcPadding}px 4px`;
            
            // บังคับ line-height ในตารางให้ตาม Slider ด้วย (เผื่อกรณีข้อความยาวตัดบรรทัด)
            cell.style.lineHeight = lineHeight; 
        });

        lhValueSpan.textContent = "ความสูงของบรรทัด: " + lineHeight;
    }
    
    lhSlider.removeEventListener("input", updateLineHeight);
    lhSlider.addEventListener("input", updateLineHeight);
    
    // --- Save as Image Button Logic ---
    const saveBtn = document.getElementById("saveSummaryAsImageBtn");
    const newSaveBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);

    newSaveBtn.addEventListener("click", function() {
        const controlsElement = modalContentContainer.querySelector('.modal-controls');
        
        if (controlsElement) controlsElement.style.display = 'none';
        modalContentContainer.style.padding = '5px 2px';

        html2canvas(modalContentContainer, {
            useCORS: true,
            scale: 4,
            backgroundColor: '#FAFAD2'
        }).then(canvas => {
            const link = document.createElement('a');
            const fileName = `สรุป_${currentAccount || 'account'}_${Date.now()}.png`;
            link.download = fileName;
            link.href = canvas.toDataURL("image/png");
            link.click();
            showToast(`🖼️ บันทึกภาพสรุปเป็น "${fileName}" สำเร็จ`, 'success');
        }).catch(err => {
            console.error("Error creating image:", err);
            showToast("❌ ขออภัย, ไม่สามารถบันทึกเป็นรูปภาพได้", 'error');
        }).finally(() => {
            if (controlsElement) controlsElement.style.display = '';
            modalContentContainer.style.padding = '';
        });
    });        
    
    updateFontSize();
    updateLineHeight();
}

// ==============================================
// ฟังก์ชันจัดการบัญชี
// ==============================================

async function addAccount() { 
    const accountName = prompt("กรุณากรอกชื่อบัญชีใหม่:");
    if (accountName && !accounts.includes(accountName)) { 
        accounts.push(accountName); 
        updateAccountSelect(); 
        updateMultiAccountSelector(); 
        
        // บันทึกไปยัง IndexedDB
        await saveToIndexedDB();
        showToast(`✓ เพิ่มบัญชี "${accountName}" สำเร็จ`, 'success');
    } else { 
        showToast("❌ ชื่อบัญชีซ้ำหรือกรอกข้อมูลไม่ถูกต้อง", 'error'); 
    } 
}

function updateAccountSelect() { 
    const accountSelect = document.getElementById('accountSelect'); 
    accountSelect.innerHTML = '<option value="">เลือกบัญชี</option>'; 
    accounts.forEach(account => { 
        const option = document.createElement('option'); 
        option.value = account; 
        option.textContent = account; 
        accountSelect.appendChild(option); 
    }); 
}

function changeAccount() {
    currentAccount = document.getElementById('accountSelect').value;
    document.getElementById('accountName').textContent = currentAccount || "";
    
    // อัพเดท Type List
    updateTypeList();
    
    // แสดงข้อมูลในตาราง
    displayRecords();
    
    // อัพเดทปุ่มเลือกหลายบัญชี
    updateMultiAccountSelector();
    
    // อัพเดทตัวเลือกนำเข้าข้อมูล
    updateImportAccountSelect();
    
    if (currentAccount) {
        const accountRecords = records.filter(record => record.account === currentAccount);
        console.log(`Loaded ${accountRecords.length} records for account: ${currentAccount}`);
        showToast(`📂 โหลดข้อมูลบัญชี "${currentAccount}" สำเร็จ (${accountRecords.length} รายการ)`, 'success');
    }
    
    // บันทึกสถานะว่าเราเลือกบัญชีนี้ล่าสุด
    saveToIndexedDB();
}

async function editAccount() { 
    if (!currentAccount) { 
        showToast("❌ กรุณาเลือกบัญชีที่ต้องการแก้ไข", 'error'); 
        return; 
    } 
    
    const newAccountName = prompt("กรุณากรอกชื่อบัญชีใหม่:", currentAccount); 
    
    // ตรวจสอบความถูกต้อง
    if (newAccountName && newAccountName !== currentAccount && !accounts.includes(newAccountName)) { 
        const oldAccountName = currentAccount; 
        
        // 2. อัปเดตข้อมูล Local
        const index = accounts.indexOf(oldAccountName); 
        if (index > -1) { 
            accounts[index] = newAccountName; 
            
            // อัปเดตชื่อบัญชีในรายการ Records ทั้งหมด
            records.forEach(record => { 
                if (record.account === oldAccountName) { 
                    record.account = newAccountName; 
                } 
            }); 
            
            // ย้าย Account Types ไปชื่อใหม่
            if (accountTypes.has(oldAccountName)) { 
                const oldTypes = accountTypes.get(oldAccountName); 
                accountTypes.set(newAccountName, oldTypes); 
                accountTypes.delete(oldAccountName); 
            } 
            
            currentAccount = newAccountName; 
            
            // อัปเดตหน้าจอ
            updateAccountSelect(); 
            document.getElementById('accountSelect').value = newAccountName; 
            document.getElementById('accountName').textContent = currentAccount; 
            displayRecords(); 
            updateMultiAccountSelector(); 
            
            showToast(`✓ แก้ไขชื่อบัญชีเป็น "${newAccountName}" สำเร็จ`, 'success'); 
            
            // 3. บันทึกข้อมูลใหม่
            await saveToIndexedDB();
        } 
    } else if (accounts.includes(newAccountName)) {
        showToast("❌ ชื่อบัญชีนี้มีอยู่แล้ว", 'error'); 
    } else { 
        showToast("❌ ยกเลิกการแก้ไขหรือข้อมูลไม่ถูกต้อง", 'error'); 
    } 
}

async function deleteAccount() { 
    if (currentAccount) { 
        const confirmDelete = confirm(`คุณแน่ใจว่าจะลบบัญชี "${currentAccount}" และข้อมูลทั้งหมดในบัญชีนี้หรือไม่?`); 
        
        if (confirmDelete) { 
            const accountToDelete = currentAccount; 
            
            // ลบข้อมูล Local
            const index = accounts.indexOf(accountToDelete); 
            if (index > -1) { 
                accounts.splice(index, 1); 
            } 
            accountTypes.delete(accountToDelete); 
            records = records.filter(rec => rec.account !== accountToDelete); 
            
            // Reset UI
            currentAccount = null; 
            document.getElementById('accountSelect').value = ""; 
            document.getElementById('accountName').textContent = ""; 
            
            updateAccountSelect(); 
            displayRecords(); 
            updateMultiAccountSelector(); 
            
            showToast(`✓ ลบบัญชี "${accountToDelete}" สำเร็จ`, 'success'); 
            
            // บันทึกการเปลี่ยนแปลง
            await saveToIndexedDB();
        } 
    } else { 
        showToast("❌ กรุณาเลือกบัญชีที่ต้องการลบ", 'error'); 
    } 
}

// ==============================================
// ฟังก์ชันจัดการประเภท
// ==============================================

function initializeAccountTypes(accountName) { 
    if (!accountTypes.has(accountName)) { 
        accountTypes.set(accountName, { 
            "รายรับ": ["ถูกหวย", "เติมทุน"], 
            "รายจ่าย": ["ชื้อหวย", "โอนกำไร", "ชื้อกับข้าว"] 
        }); 
    } 
}

function updateTypeList() { 
    const typeList = document.getElementById('typeList'); 
    const typeInput = document.getElementById('type');
    
    if (!currentAccount) { 
        typeList.innerHTML = ''; 
        typeInput.value = '';
        return; 
    } 
    
    initializeAccountTypes(currentAccount); 
    const types = accountTypes.get(currentAccount); 
    typeList.innerHTML = ''; 
    
    // เพิ่มประเภทรายจ่าย
    types["รายจ่าย"].forEach(type => { 
        const option = document.createElement('option'); 
        option.value = type; 
        option.textContent = type; 
        typeList.appendChild(option); 
    }); 
    
    // เพิ่มประเภทรายรับ
    types["รายรับ"].forEach(type => { 
        const option = document.createElement('option'); 
        option.value = type; 
        option.textContent = type; 
        typeList.appendChild(option); 
    }); 
    
    console.log('อัพเดทรายการประเภทเรียบร้อย:', types);
}

function showAllTypes(inputElement) { 
    tempTypeValue = inputElement.value; 
    inputElement.value = ''; 
}

function restoreType(inputElement) { 
    if (inputElement.value === '') { 
        inputElement.value = tempTypeValue; 
    } 
}

async function addNewType() { 
    if (!currentAccount) { showToast("❌ กรุณาเลือกบัญชีก่อนเพิ่มประเภท", 'error'); return; } 
    
    initializeAccountTypes(currentAccount); 
    const types = accountTypes.get(currentAccount); 
    
    const typeName = prompt("กรุณากรอกชื่อประเภทใหม่:"); 
    if (!typeName || typeName.trim() === '') { showToast("❌ กรุณากรอกชื่อประเภท", 'error'); return; }
    
    const category = prompt("เลือกหมวดหมู่ที่จะเพิ่ม (รายรับ/รายจ่าย):"); 
    if (category !== "รายรับ" && category !== "รายจ่าย") { showToast("❌ กรุณากรอก 'รายรับ' หรือ 'รายจ่าย' เท่านั้น", 'error'); return; } 
    
    const trimmedTypeName = typeName.trim();
    if (types[category].includes(trimmedTypeName)) { showToast(`❌ ประเภท "${trimmedTypeName}" มีอยู่แล้ว`, 'error'); return; } 
    
    // เพิ่มประเภทใหม่
    types[category].push(trimmedTypeName); 
    updateTypeList(); 
    document.getElementById('type').value = trimmedTypeName;
    
    // บันทึก
    await saveToIndexedDB();
    showToast(`✓ เพิ่มประเภทสำเร็จ`, 'success');
}

function editType() { 
    if (!currentAccount) { 
        showToast("❌ กรุณาเลือกบัญชีก่อนแก้ไขประเภท", 'error'); 
        return; 
    } 
    
    initializeAccountTypes(currentAccount); 
    const types = accountTypes.get(currentAccount); 
    const typeInput = document.getElementById('type'); 
    const currentType = typeInput.value.trim(); 
    
    if (!currentType) { 
        showToast("❌ กรุณาเลือกหรือพิมพ์ประเภทที่ต้องการแก้ไข", 'error'); 
        return; 
    } 
    
    // หาหมวดหมู่ของประเภทที่ต้องการแก้ไข
    let foundCategory = null; 
    for (const category in types) { 
        if (types[category].includes(currentType)) { 
            foundCategory = category; 
            break; 
        } 
    } 
    
    if (!foundCategory) { 
        showToast("❌ ไม่พบประเภทที่ต้องการแก้ไข", 'error'); 
        return; 
    } 
    
    // ใช้ฟังก์ชันแก้ไขประเภทแบบใหม่
    showEditTypeModal(currentType, foundCategory);
}

// ฟังก์ชันแสดงโมดอลแก้ไขประเภท
function showEditTypeModal(currentType, currentCategory) {
    const modalHTML = `
        <div id="editTypeModal" class="modal-overlay" style="display: flex;">
            <div class="format-modal-content">
                <h3>แก้ไขประเภท: "${currentType}"</h3>
                <div class="entry-form" style="margin-bottom: 20px;">
                    <div class="entry-group">
                        <label for="editTypeName">ชื่อประเภทใหม่:</label>
                        <input type="text" id="editTypeName" value="${currentType}" required>
                    </div>
                    <div class="entry-group">
                        <label for="editTypeCategory">หมวดหมู่:</label>
                        <select id="editTypeCategory" required>
                            <option value="รายรับ" ${currentCategory === 'รายรับ' ? 'selected' : ''}>รายรับ</option>
                            <option value="รายจ่าย" ${currentCategory === 'รายจ่าย' ? 'selected' : ''}>รายจ่าย</option>
                        </select>
                    </div>
                </div>
                <div class="format-modal-buttons">
                    <button onclick="processTypeEdit('${currentType}', '${currentCategory}')" style="background-color: #28a745;">บันทึกการแก้ไข</button>
                    <button onclick="closeEditTypeModal()" class="btn-cancel">ยกเลิก</button>
                </div>
            </div>
        </div>
    `;
    
    // เพิ่มโมดอลลงใน DOM
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHTML;
    document.body.appendChild(modalContainer);
}

// ฟังก์ชันปิดโมดอลแก้ไขประเภท
function closeEditTypeModal() {
    const modal = document.getElementById('editTypeModal');
    if (modal) {
        modal.remove();
    }
}

// ฟังก์ชันประมวลผลการแก้ไขประเภท
async function processTypeEdit(oldType, oldCategory) {
    const newTypeName = document.getElementById('editTypeName').value.trim();
    const newCategory = document.getElementById('editTypeCategory').value;
    
    if (!newTypeName) { showToast("❌ กรุณากรอกชื่อประเภทใหม่", 'error'); return; }
    
    if (newTypeName === oldType && newCategory === oldCategory) {
        showToast("❌ ไม่มีการเปลี่ยนแปลงใดๆ", 'warning');
        closeEditTypeModal();
        return;
    }
    
    initializeAccountTypes(currentAccount);
    const types = accountTypes.get(currentAccount);
    
    if (newTypeName !== oldType) {
        for (const category in types) {
            if (types[category].includes(newTypeName)) {
                showToast(`❌ มีประเภท "${newTypeName}" อยู่แล้ว`, 'error');
                return;
            }
        }
    }
    
    const oldIndex = types[oldCategory].indexOf(oldType);
    if (oldIndex > -1) {
        types[oldCategory].splice(oldIndex, 1);
        if (!types[newCategory]) { types[newCategory] = []; }
        types[newCategory].push(newTypeName);
        
        updateRecordsType(oldType, newTypeName, newCategory);
        updateTypeList();
        document.getElementById('type').value = newTypeName;
        
        closeEditTypeModal();

        // บันทึก
        await saveToIndexedDB();
        showToast(`✓ แก้ไขประเภทสำเร็จ`, 'success');
    }
}

// ฟังก์ชันอัพเดทประเภทในข้อมูลที่บันทึกไว้
function updateRecordsType(oldType, newType, newCategory) {
    let updatedCount = 0;
    
    records.forEach(record => { 
        if (record.account === currentAccount && record.type === oldType) { 
            record.type = newType;
            updatedCount++;
        } 
    });
    
    console.log(`✅ อัพเดทประเภทใน ${updatedCount} รายการ`);
    
    if (updatedCount > 0) {
        displayRecords();
        showToast(`✓ อัพเดทประเภทใน ${updatedCount} รายการที่บันทึกไว้`, 'info');
    }
}

async function deleteType() { 
    if (!currentAccount) { showToast("❌ กรุณาเลือกบัญชี", 'error'); return; } 
    
    initializeAccountTypes(currentAccount); 
    const types = accountTypes.get(currentAccount); 
    const typeInput = document.getElementById('type'); 
    const currentType = typeInput.value.trim(); 
    
    if (!currentType) { showToast("❌ กรุณาเลือกประเภท", 'error'); return; } 
    
    let foundCategory = null; 
    for (const category in types) { 
        if (types[category].includes(currentType)) { foundCategory = category; break; } 
    } 
    
    if (!foundCategory) { showToast("❌ ไม่พบประเภท", 'error'); return; } 
    
    const recordsToDelete = records.filter(record => record.account === currentAccount && record.type === currentType);
    
    if (recordsToDelete.length > 0) {
        const confirmDelete = confirm(`ยืนยันลบประเภท "${currentType}" และ ${recordsToDelete.length} รายการที่เกี่ยวข้อง?`); 
        if (!confirmDelete) return;
        deleteRecordsByType(currentType);
    } else {
        const confirmDelete = confirm(`ยืนยันลบประเภท "${currentType}"?`); 
        if (!confirmDelete) return;
    }
    
    const index = types[foundCategory].indexOf(currentType);
    types[foundCategory].splice(index, 1);
    
    updateTypeList(); 
    typeInput.value = ''; 
    
    // บันทึก
    await saveToIndexedDB();
    showToast(`✓ ลบประเภทสำเร็จ`, 'success');
}

// ฟังก์ชันเสริมสำหรับการจัดการประเภท
function showTypeManagement() {
    if (!currentAccount) {
        showToast("❌ กรุณาเลือกบัญชีก่อน", 'error');
        return;
    }
    
    initializeAccountTypes(currentAccount);
    const types = accountTypes.get(currentAccount);
    
    let typeListHTML = `
        <h3>จัดการประเภท - บัญชี: ${currentAccount}</h3>
        <div style="display: flex; gap: 20px; flex-wrap: wrap;">
            <div style="flex: 1; min-width: 200px;">
                <h4>รายรับ</h4>
                <ul id="incomeTypesList" style="min-height: 100px; border: 1px solid #ccc; padding: 10px; list-style: none;">
    `;
    
    types["รายรับ"].forEach(type => {
        typeListHTML += `
            <li style="padding: 5px; margin: 2px 0; display: flex; justify-content: space-between; align-items: center;">
                <span>${type}</span>
                <div>
                    <button onclick="quickEditType('รายรับ', '${type}')" style="background-color: #ffc107; padding: 2px 8px; font-size: 12px;">แก้ไข</button>
                    <button onclick="quickDeleteType('รายรับ', '${type}')" style="background-color: #dc3545; padding: 2px 8px; font-size: 12px;">ลบ</button>
                </div>
            </li>`;
    });
    
    typeListHTML += `
                </ul>
                <button onclick="quickAddType('รายรับ')" style="width: 100%; margin-top: 5px;">➕ เพิ่มรายรับ</button>
            </div>
            <div style="flex: 1; min-width: 200px;">
                <h4>รายจ่าย</h4>
                <ul id="expenseTypesList" style="min-height: 100px; border: 1px solid #ccc; padding: 10px; list-style: none;">
    `;
    
    types["รายจ่าย"].forEach(type => {
        typeListHTML += `
            <li style="padding: 5px; margin: 2px 0; display: flex; justify-content: space-between; align-items: center;">
                <span>${type}</span>
                <div>
                    <button onclick="quickEditType('รายจ่าย', '${type}')" style="background-color: #ffc107; padding: 2px 8px; font-size: 12px;">แก้ไข</button>
                    <button onclick="quickDeleteType('รายจ่าย', '${type}')" style="background-color: #dc3545; padding: 2px 8px; font-size: 12px;">ลบ</button>
                </div>
            </li>`;
    });
    
    typeListHTML += `
                </ul>
                <button onclick="quickAddType('รายจ่าย')" style="width: 100%; margin-top: 5px;">➕ เพิ่มรายจ่าย</button>
            </div>
        </div>
    `;
    
    openSummaryModal(typeListHTML);
}

// ฟังก์ชันแก้ไขประเภทแบบเร็ว (จาก UI การจัดการ)
function quickEditType(category, typeName) {
    showEditTypeModal(typeName, category);
}

async function quickAddType(category) {
    const typeName = prompt(`กรุณากรอกชื่อประเภท${category}:`);
    if (!typeName || typeName.trim() === '') return;
    
    const trimmedTypeName = typeName.trim();
    initializeAccountTypes(currentAccount);
    const types = accountTypes.get(currentAccount);
    
    if (types[category].includes(trimmedTypeName)) {
        showToast("❌ ประเภทนี้มีอยู่แล้ว", 'error');
        return;
    }
    
    types[category].push(trimmedTypeName);
    updateTypeList();
    
    // บันทึก
    await saveToIndexedDB();
    showToast(`✓ เพิ่มประเภทสำเร็จ`, 'success');
    showTypeManagement(); // รีเฟรช modal
}

async function quickDeleteType(category, typeName) {
    const recordsToDelete = records.filter(record => record.account === currentAccount && record.type === typeName);
    let confirmMessage = recordsToDelete.length > 0 ? 
        `ลบประเภท "${typeName}" และ ${recordsToDelete.length} รายการที่เกี่ยวข้อง?` : 
        `ลบประเภท "${typeName}"?`;

    if (!confirm(confirmMessage)) return;
    
    initializeAccountTypes(currentAccount);
    const types = accountTypes.get(currentAccount);
    const index = types[category].indexOf(typeName);
    
    if (index > -1) {
        if (recordsToDelete.length > 0) { deleteRecordsByType(typeName); }
        types[category].splice(index, 1);
        updateTypeList();
        
        // บันทึก
        await saveToIndexedDB();
        showToast('✓ ลบเรียบร้อย', 'success');
        showTypeManagement();
    }
}

// ฟังก์ชันลบข้อมูลที่บันทึกไว้ตามประเภท
function deleteRecordsByType(typeToDelete) {
    let deletedCount = 0;
    
    // นับจำนวนรายการที่จะลบ
    const recordsToDeleteCount = records.filter(record => 
        record.account === currentAccount && record.type === typeToDelete
    ).length;
    
    // ลบรายการทั้งหมดที่ใช้ประเภทนี้
    records = records.filter(record => 
        !(record.account === currentAccount && record.type === typeToDelete)
    );
    
    deletedCount = recordsToDeleteCount;
    
    console.log(`🗑️ ลบ ${deletedCount} รายการที่ใช้ประเภท "${typeToDelete}"`);
    
    if (deletedCount > 0) {
        displayRecords();
        showToast(`🗑️ ลบ ${deletedCount} รายการที่ใช้ประเภท "${typeToDelete}" ออกแล้ว`, 'info');
    }
    
    return deletedCount;
}

// ==============================================
// ฟังก์ชันจัดการรายการ
// ==============================================

async function addEntry() {
    let entryDateInput = document.getElementById('entryDate').value;
    let entryTimeInput = document.getElementById('entryTime').value;
    const typeInput = document.getElementById('type');
    const typeText = typeInput.value.trim();
    const description = document.getElementById('description').value;
    const amount = parseFloat(document.getElementById('amount').value);
    let datePart, timePart;
    
    // ตั้งค่าวันเวลา
    if (!entryDateInput || !entryTimeInput) {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        datePart = !entryDateInput ? `${y}-${m}-${d}` : entryDateInput;
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        timePart = !entryTimeInput ? `${hh}:${mm}` : entryTimeInput;
    } else {
        datePart = entryDateInput;
        timePart = entryTimeInput;
    }
    
    const dateTime = `${datePart} ${timePart}`;
    
    // Validation Checks
    if (!currentAccount) { showToast("❌ กรุณาเลือกบัญชีก่อนเพิ่มรายการ", 'error'); return; }
    if (!typeText) { showToast("❌ กรุณากรอกประเภท", 'error'); return; }
    if (!description) { showToast("❌ กรุณากรอกรายละเอียด", 'error'); return; }
    if (isNaN(amount) || amount <= 0) { showToast("❌ กรุณากรอกจำนวนเงินที่ถูกต้อง", 'error'); return; }
    
    initializeAccountTypes(currentAccount);
    const types = accountTypes.get(currentAccount);
    let entryCategory = 'expense';
    if (types["รายรับ"].includes(typeText)) {
        entryCategory = 'income';
    }

    const userEmail = getCurrentUserIdentifier();
    const timestamp = new Date().toISOString();
    
    // --- เริ่มกระบวนการเพิ่ม/แก้ไขข้อมูล ---
    
    if (editingIndex !== null) {
        // === กรณีแก้ไข (Edit) ===
        const originalRecord = records[editingIndex];
        records[editingIndex] = { 
            dateTime, 
            type: typeText, 
            description, 
            amount, 
            account: currentAccount,
            createdBy: originalRecord.createdBy || 'Unknown', 
            createdTime: originalRecord.createdTime || timestamp,
            editedBy: userEmail,
            editedTime: timestamp
        };
        editingIndex = null;
        showToast(`✓ แก้ไขข้อมูลเรียบร้อย`, 'info');
    } else {
        // === กรณีสร้างใหม่ (New) ===
        const newRecord = { 
            dateTime, 
            type: typeText, 
            description, 
            amount, 
            account: currentAccount,
            createdBy: userEmail,
            createdTime: timestamp,
            editedBy: null,
            editedTime: null
        };
        records.push(newRecord);

        // Multi-account check
        const selectedCheckboxes = document.querySelectorAll('#multiAccountCheckboxes input:checked');
        selectedCheckboxes.forEach(checkbox => {
            const targetAccount = checkbox.value;
            const clonedRecord = JSON.parse(JSON.stringify(newRecord));
            clonedRecord.account = targetAccount;
            records.push(clonedRecord);
        });
        showToast(`✓ เพิ่มข้อมูลเรียบร้อย`, 'info');
    }
    
    // 1. อัปเดตหน้าจอทันทีเพื่อให้รู้ว่ากดแล้ว
    displayRecords();
    
    // 2. เคลียร์ค่า Input
    document.getElementById('description').value = '';
    document.getElementById('amount').value = '';
    setCurrentDateTime();
    typeInput.value = '';
    document.querySelectorAll('#multiAccountCheckboxes input:checked').forEach(checkbox => {
        checkbox.checked = false;
    });
    updateMultiAccountSelector();

    // 3. บันทึกข้อมูล (Save)
    await saveToIndexedDB();
    
    // แจ้งเตือนเมื่อเสร็จ
    if (entryCategory === 'income') {
        showToast('✅ บันทึกรายรับเสร็จสมบูรณ์', 'success');
    } else {
        showToast('✅ บันทึกรายจ่ายเสร็จสมบูรณ์', 'success');
    }
}

function displayRecords() { 
    const recordBody = document.getElementById('recordBody'); 
    
    // ปรับปรุงส่วนหัวตารางให้สวยงามมีเส้นขอบ
    const theadRow = document.querySelector('#recordTable thead tr');
    if (theadRow && theadRow.children.length === 6) {
        const thUser = document.createElement('th');
        thUser.textContent = 'ผู้บันทึก/แก้ไข';
        
        // ใส่ Style ให้เหมือนกับช่องอื่นๆ ใน HTML
        thUser.style.padding = '8px';
        thUser.style.border = '1px solid #ddd';
        thUser.style.textAlign = 'center';
        thUser.style.width = '15%'; 
        
        // แทรกก่อนปุ่มจัดการ (คอลัมน์สุดท้าย)
        theadRow.insertBefore(thUser, theadRow.lastElementChild);
    } else if (theadRow && theadRow.children.length === 5) {
         // กรณี table header เก่ายังไม่ได้ update
         theadRow.innerHTML = `
            <th style="padding: 8px; border: 1px solid #ddd; text-align: center;">📅 วันเดือนปี</th>
            <th style="padding: 8px; border: 1px solid #ddd; text-align: center;">⏰ เวลา</th>
            <th style="padding: 8px; border: 1px solid #ddd; text-align: center;">📊 ประเภท</th>
            <th style="padding: 8px; border: 1px solid #ddd; text-align: center;">📄 รายละเอียด</th>
            <th style="padding: 8px; border: 1px solid #ddd; text-align: center;">💰 จำนวนเงิน</th>
            <th style="padding: 8px; border: 1px solid #ddd; text-align: center;">ผู้บันทึก/แก้ไข</th>
            <th style="padding: 8px; border: 1px solid #ddd; text-align: center;">🔧 การจัดการ</th>
         `;
    }

    recordBody.innerHTML = ""; 
    const filteredRecords = records.filter(record => record.account === currentAccount) 
    .sort((a, b) => parseLocalDateTime(b.dateTime) - parseLocalDateTime(a.dateTime)); 
    
    filteredRecords.forEach((record, index) => { 
        const originalIndex = records.findIndex(r => r === record); 
        const { formattedDate, formattedTime } = formatDateForDisplay(record.dateTime);
        
        // สร้างข้อความแสดง Audit Trail (ตรวจสอบว่ามีข้อมูลหรือไม่)
        // ถ้าเป็นข้อมูลเก่า record.createdBy จะไม่มีค่า จึงแสดงเป็น '-'
        let auditInfo = `<span style="font-size: 11px; color: #666;">สร้าง: ${record.createdBy || '-'}</span>`;
        
        if (record.editedBy) {
            auditInfo += `<br><span style="font-size: 11px; color: #d9534f;">แก้ไข: ${record.editedBy}</span>`;
        }

        const row = document.createElement('tr'); 
        row.innerHTML = ` 
        <td>${formattedDate}</td> 
        <td>${formattedTime}</td> 
        <td>${record.type}</td> 
        <td>${record.description}</td> 
        <td>${record.amount.toLocaleString()} บาท</td> 
        <td style="line-height: 1.2; text-align: center;">${auditInfo}</td>
        <td> 
        <button onclick="editRecord(${originalIndex})">แก้ไข</button> 
        <button onclick="deleteRecord(${originalIndex})">ลบ</button> 
        </td> 
        `; 
        recordBody.appendChild(row); 
    }); 
    
    if (filteredRecords.length === 0) { 
        const row = document.createElement('tr'); 
        // ปรับ colspan เป็น 7 เพราะเพิ่มมา 1 คอลัมน์
        row.innerHTML = `<td colspan="7" style="text-align: center;">ไม่มีข้อมูล</td>`; 
        recordBody.appendChild(row); 
    } 
}

function editRecord(index) {
    const record = records[index];
    document.getElementById('type').value = record.type;
    document.getElementById('description').value = record.description;
    document.getElementById('amount').value = record.amount;
    const [datePart, timePart] = record.dateTime.split(' ');
    document.getElementById('entryDate').value = datePart;
    document.getElementById('entryTime').value = timePart;
    editingIndex = index;
    updateMultiAccountSelector();
    showToast("📝 กำลังแก้ไขรายการ...", 'info');
}

async function deleteRecord(index) { 
    if (!confirm('ยืนยันลบรายการนี้?')) return;

    const record = records[index];

    // ลบจาก UI ทันที
    records.splice(index, 1);
    displayRecords();

    // บันทึกไปยัง IndexedDB
    await saveToIndexedDB();
    showToast('🗑️ ลบข้อมูลสำเร็จ', 'success');
}

function toggleRecordsVisibility() { 
    const detailsSection = document.getElementById('detailsSection'); 
    if (detailsSection.style.display === 'none' || detailsSection.style.display === '') { 
        detailsSection.style.display = 'block'; 
        showToast("📋 แสดงรายการทั้งหมดเรียบร้อย", 'success');
    } else { 
        detailsSection.style.display = 'none'; 
        showToast("📋 ซ่อนรายการทั้งหมดเรียบร้อย", 'info');
    } 
}

async function deleteRecordsByDate() {
    const dateInput = document.getElementById('deleteByDateInput');
    const selectedDate = dateInput.value;
    if (!currentAccount) { showToast("❌ กรุณาเลือกบัญชีที่ต้องการลบข้อมูลก่อน", 'error'); return; }
    if (!selectedDate) { showToast("❌ กรุณาเลือกวันที่ที่ต้องการลบข้อมูล", 'error'); return; }
    
    const recordsToDelete = records.filter(record => {
        if (record.account !== currentAccount) return false;
        const recordDateOnly = record.dateTime.split(' ')[0];
        return recordDateOnly === selectedDate;
    });
    
    if (recordsToDelete.length === 0) {
        showToast(`❌ ไม่พบข้อมูลในบัญชี "${currentAccount}" ของวันที่ ${selectedDate}`, 'error');
        return;
    }
    
    const confirmDelete = confirm(
        `คุณแน่ใจหรือไม่ว่าจะลบข้อมูลทั้งหมด ${recordsToDelete.length} รายการ ของวันที่ ${selectedDate}?\n\n*** การกระทำนี้ไม่สามารถย้อนกลับได้! ***`
    );
    
    if (confirmDelete) {
        // 1. กรองเอาเฉพาะข้อมูลที่ไม่ใช่วันที่เลือก (เสมือนการลบ)
        records = records.filter(record => !recordsToDelete.includes(record));
        
        // 2. อัปเดตหน้าจอ
        displayRecords();
        dateInput.value = ''; 

        // 3. บันทึก
        await saveToIndexedDB();
        showToast(`✅ ลบข้อมูลวันที่ ${selectedDate} สำเร็จ`, 'success');
    }
}

// ==============================================
// ฟังก์ชันจัดการบัญชีหลายบัญชี
// ==============================================

function updateMultiAccountSelector() { 
    const selectorDiv = document.getElementById('multiAccountSelector'); 
    const checkboxesDiv = document.getElementById('multiAccountCheckboxes'); 
    checkboxesDiv.innerHTML = ''; 
    if (accounts.length > 1 && editingIndex === null) { 
        selectorDiv.style.display = 'block'; 
        accounts.forEach(acc => { 
            if (acc !== currentAccount) { 
                const itemDiv = document.createElement('div'); 
                itemDiv.className = 'checkbox-item'; 
                const checkbox = document.createElement('input'); 
                checkbox.type = 'checkbox'; 
                checkbox.id = `acc-check-${acc}`; 
                checkbox.value = acc; 
                const label = document.createElement('label'); 
                label.htmlFor = `acc-check-${acc}`; 
                label.textContent = acc; 
                itemDiv.appendChild(checkbox); 
                itemDiv.appendChild(label); 
                checkboxesDiv.appendChild(itemDiv); 
            } 
        }); 
    } else { 
        selectorDiv.style.display = 'none'; 
    } 
}

// ==============================================
// ฟังก์ชันนำเข้าข้อมูลจากบัญชีอื่น
// ==============================================

function updateImportAccountSelect() {
    const importSelect = document.getElementById('importAccountSelect');
    const importButton = document.querySelector('#import-from-account-section button');
    importSelect.innerHTML = '';
    const otherAccounts = accounts.filter(acc => acc !== currentAccount);
    
    if (otherAccounts.length === 0 || !currentAccount) {
        importSelect.innerHTML = '<option value="">ไม่มีบัญชีอื่นให้เลือก</option>';
        importSelect.disabled = true;
        if (importButton) importButton.disabled = true;
    } else {
        importSelect.disabled = false;
        if (importButton) importButton.disabled = false;
        importSelect.innerHTML = '<option value="">-- เลือกบัญชี --</option>';
        otherAccounts.forEach(acc => {
            const option = document.createElement('option');
            option.value = acc;
            option.textContent = acc;
            importSelect.appendChild(option);
        });
    }
}

async function importEntriesFromAccount() {
    const sourceAccount = document.getElementById('importAccountSelect').value;
    const importDateStr = document.getElementById('importDate').value;

    if (!currentAccount) {
        showToast("❌ กรุณาเลือกบัญชีปัจจุบัน (บัญชีปลายทาง) ก่อน", 'error');
        return;
    }
    if (!sourceAccount) {
        showToast("❌ กรุณาเลือกบัญชีต้นทางที่ต้องการดึงข้อมูล", 'error');
        return;
    }
    if (!importDateStr) {
        showToast("❌ กรุณาเลือกวันที่ของข้อมูลที่ต้องการดึง", 'error');
        return;
    }

    const recordsToImport = records.filter(record => {
        return record.account === sourceAccount && record.dateTime.startsWith(importDateStr);
    });

    if (recordsToImport.length === 0) {
        showToast(`❌ ไม่พบข้อมูลในบัญชี "${sourceAccount}" ของวันที่ ${importDateStr}`, 'error');
        return;
    }

    const confirmImport = confirm(`พบ ${recordsToImport.length} รายการในบัญชี "${sourceAccount}" ของวันที่ ${importDateStr}\n\nคุณต้องการคัดลอกรายการทั้งหมดมายังบัญชี "${currentAccount}" หรือไม่? (ข้อมูลซ้ำจะถูกข้าม)`);

    if (confirmImport) {
        let importedCount = 0;
        let skippedCount = 0;
        
        recordsToImport.forEach(recordToAdd => {
            const isDuplicate = records.some(existingRecord => 
                existingRecord.account === currentAccount &&
                existingRecord.dateTime === recordToAdd.dateTime &&
                existingRecord.amount === recordToAdd.amount &&
                existingRecord.description === recordToAdd.description &&
                existingRecord.type === recordToAdd.type
            );
            if (!isDuplicate) {
                const newEntry = { ...recordToAdd, account: currentAccount };
                records.push(newEntry);
                importedCount++;
            } else {
                skippedCount++;
            }
        });
        
        displayRecords();
        
        // บันทึกข้อมูล
        await saveToIndexedDB();

        showToast(`✓ คัดลอกข้อมูลสำเร็จ! เพิ่ม ${importedCount} รายการใหม่, ข้าม ${skippedCount} รายการที่ซ้ำซ้อน`, 'success');
    }
}

// ==============================================
// ฟังก์ชันจัดการข้อมูลสรุป
// ==============================================

function parseDateInput(dateStr) {
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return null;
    }
    const [year, month, day] = dateStr.split('-');
    return new Date(year, month - 1, day);
}

// ==============================================
// ฟังก์ชันเสริมสำหรับจัดการ Time Zone
// ==============================================

function parseLocalDateTime(dateTimeStr) {
    if (!dateTimeStr) return new Date();
    
    try {
        const [datePart, timePart] = dateTimeStr.split(' ');
        const [year, month, day] = datePart.split('-').map(Number);
        const [hours, minutes] = timePart.split(':').map(Number);
        
        return new Date(year, month - 1, day, hours, minutes);
    } catch (error) {
        console.error('Error parsing date:', dateTimeStr, error);
        return new Date();
    }
}

function formatDateForDisplay(dateTimeStr) {
    const date = parseLocalDateTime(dateTimeStr);
    const formattedDate = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
    const formattedTime = `${String(date.getHours()).padStart(2, '0')}.${String(date.getMinutes()).padStart(2, '0')} น.`;
    return { formattedDate, formattedTime };
}

function generateSummaryData(startDate, endDate) {
    if (!currentAccount) { 
        console.error("❌ ไม่มีบัญชีปัจจุบันในการสรุปข้อมูล");
        showToast("❌ ไม่พบบัญชีที่เลือก", 'error'); 
        return null; 
    }
    
    if (!accountTypes.has(currentAccount)) {
        console.log(`⚠️ สร้างประเภทบัญชีใหม่สำหรับ: ${currentAccount}`);
        initializeAccountTypes(currentAccount);
    }
    
    const summary = { 
        income: {}, 
        expense: {}, 
        totalIncome: 0, 
        totalExpense: 0, 
        incomeCount: 0, 
        expenseCount: 0 
    };
    
    const periodRecords = []; 
    let totalBalance = 0; 
    const accountSpecificTypes = accountTypes.get(currentAccount);
    
    console.log(`🔍 เริ่มสรุปข้อมูลสำหรับบัญชี: ${currentAccount}`);
    console.log(`📅 ช่วงวันที่: ${startDate} ถึง ${endDate}`);
    
    // ✅ คำนวณยอดคงเหลือทั้งหมด (ถึงวันที่สิ้นสุด)
    records.forEach(record => {
        if (record.account !== currentAccount) return;
        
        const recordDate = parseLocalDateTime(record.dateTime);
        if (recordDate <= endDate) {
            if (accountSpecificTypes["รายรับ"].includes(record.type)) { 
                totalBalance += record.amount; 
            } else if (accountSpecificTypes["รายจ่าย"].includes(record.type)) { 
                totalBalance -= record.amount; 
            }
        }
    });
    
    // ✅ คำนวณสรุปในช่วงวันที่เลือก
    records.forEach(record => {
        if (record.account !== currentAccount) return;
        
        const recordDate = parseLocalDateTime(record.dateTime);
        if (!(recordDate >= startDate && recordDate <= endDate)) return;
        
        periodRecords.push(record);
        
        if (accountSpecificTypes["รายรับ"].includes(record.type)) {
            summary.totalIncome += record.amount; 
            summary.incomeCount++;
            
            if (!summary.income[record.type]) {
                summary.income[record.type] = { amount: 0, count: 0 };
            }
            summary.income[record.type].amount += record.amount; 
            summary.income[record.type].count++;
            
        } else if (accountSpecificTypes["รายจ่าย"].includes(record.type)) {
            summary.totalExpense += record.amount; 
            summary.expenseCount++;
            
            if (!summary.expense[record.type]) {
                summary.expense[record.type] = { amount: 0, count: 0 };
            }
            summary.expense[record.type].amount += record.amount; 
            summary.expense[record.type].count++;
        }
    });
    
    // ✅ เรียงลำดับรายการตามเวลา
    periodRecords.sort((a, b) => parseLocalDateTime(a.dateTime) - parseLocalDateTime(b.dateTime));
    
    console.log(`✅ สรุปข้อมูลสำเร็จ: ${periodRecords.length} รายการ`);
    console.log(`💰 รายรับ: ${summary.totalIncome}, รายจ่าย: ${summary.totalExpense}`);
    
    return { summary, periodRecords, totalBalance };
}

function buildOriginalSummaryHtml(context) {
    const { summaryResult, title, dateString, remark, transactionDaysInfo, type, thaiDateString, headerLine1, headerLine2, headerLine3, daysDiff, activeDays, showDetails } = context;
    const { summary, periodRecords, totalBalance } = summaryResult;
    
    let incomeHTML = ''; 
    for (const typeKey in summary.income) { 
        incomeHTML += `<p>- ${typeKey} : ${summary.income[typeKey].count} ครั้ง เป็นเงิน ${summary.income[typeKey].amount.toLocaleString()} บาท</p>`; 
    }
    
    let expenseHTML = ''; 
    for (const typeKey in summary.expense) { 
        expenseHTML += `<p>- ${typeKey} : ${summary.expense[typeKey].count} ครั้ง เป็นเงิน ${summary.expense[typeKey].amount.toLocaleString()} บาท</p>`; 
    }
    
    let recordsHTML = '';
    // ✅ เงื่อนไขใหม่: แสดงตารางถ้าเป็น (วันนี้/รายวัน) หรือ (ช่วงวันที่ และ ติ๊กเลือกแสดงรายละเอียด)
    if ((type === 'today' || type === 'byDayMonth' || (type === 'range' && showDetails)) && periodRecords.length > 0) {
        recordsHTML = ` 
        <div style="margin-top: 20px;"> 
        <h4 style="border-bottom: 1px solid #ddd; padding-bottom: 5px;">${headerLine3 || 'รายละเอียดรายการ'}</h4> 
        <table style="width: 100%; border-collapse: collapse; margin-top: 10px;"> 
        <thead><tr style="background-color: #f2f2f2;">
        <th style="padding: 8px; border: 1px solid #ddd; text-align: center;">วัน/เวลา</th>
        <th style="padding: 8px; border: 1px solid #ddd; text-align: center;">ประเภท</th>
        <th style="padding: 8px; border: 1px solid #ddd; text-align: center;">รายละเอียด</th>
        <th style="padding: 8px; border: 1px solid #ddd; text-align: center;">จำนวนเงิน</th>
        </tr></thead> 
        <tbody> 
        ${periodRecords.map(record => {
            const { formattedDate, formattedTime } = formatDateForDisplay(record.dateTime);
            const isIncome = accountTypes.get(currentAccount)["รายรับ"].includes(record.type); 
            const color = isIncome ? "#4CAF50" : "#F44336";
            
            // ✅ ถ้าเป็นช่วงวันที่ ให้แสดงทั้ง "วันที่" และ "เวลา"
            const displayTime = (type === 'range') ? `${formattedDate} ${formattedTime}` : formattedTime;

            return `<tr>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${displayTime}</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${record.type}</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${record.description}</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: center; color: ${color}; font-weight: bold;">${record.amount.toLocaleString()}</td>
            </tr>`;
        }).join('')} 
        </tbody> 
        </table> 
        </div>`;
    }
    
    let comparisonText = ''; let comparisonColor = ''; let differenceAmount = 0;
    if (summary.totalIncome > summary.totalExpense) {
        differenceAmount = summary.totalIncome - summary.totalExpense;
        comparisonText = `รายได้มากกว่ารายจ่าย = ${differenceAmount.toLocaleString()} บาท`;
        comparisonColor = 'blue';
    } else if (summary.totalIncome < summary.totalExpense) {
        differenceAmount = summary.totalExpense - summary.totalIncome;
        comparisonText = `รายจ่ายมากกว่ารายได้ = ${differenceAmount.toLocaleString()} บาท`;
        comparisonColor = 'red';
    } else {
        comparisonText = 'รายได้เท่ากับรายจ่าย';
        comparisonColor = 'black';
    }
    
    let summaryLineHTML;
    if (summary.totalIncome === 0 && summary.totalExpense === 0) {
         summaryLineHTML = `<p style="color: green; font-weight: bold;">${headerLine1} ไม่มีธุรกรรมการเงิน</p>`;
    } else {
         summaryLineHTML = `<p style="color: ${comparisonColor}; font-weight: bold;">${headerLine1} ${comparisonText}</p>`;
    }
    
    let totalBalanceLine;
    if (type === 'range' || type === 'all') {
        totalBalanceLine = `<p><span style="color: blue; font-size: 14px; font-weight: bold;">${headerLine2} = </span><span style="color: ${totalBalance >= 0 ? 'green' : 'red'}; font-size: 16px; font-weight: bold;">${totalBalance.toLocaleString()}</span> บาท</p>`
    } else {
        totalBalanceLine = `<p><span style="color: blue; font-size: 14px; font-weight: bold;">เงินในบัญชีถึงวันนี้มี = </span><span style="color: ${totalBalance >= 0 ? 'green' : 'red'}; font-size: 16px; font-weight: bold;">${totalBalance.toLocaleString()}</span> บาท</p>`
    }
    
    const totalTransactionCount = summary.incomeCount + summary.expenseCount;
    const summaryDateTime = new Date().toLocaleString("th-TH", { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'}) + ' น.';
    
    let averageHtml = '';
    if (activeDays && activeDays >= 1) { 
        const netTotal = summary.totalIncome - summary.totalExpense;
        const avgNet = netTotal / activeDays; 
        let avgText = "";
        let avgColor = "";

        if (avgNet > 0) {
            avgText = `รายได้มากกว่ารายจ่ายเฉลี่ย : ${avgNet.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} บาท/วัน`;
            avgColor = "blue";
        } else if (avgNet < 0) {
            avgText = `รายจ่ายมากกว่ารายได้เฉลี่ย : ${Math.abs(avgNet).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} บาท/วัน`;
            avgColor = "red";
        } else {
            avgText = `รายได้เท่ากับรายจ่ายเฉลี่ย : 0.00 บาท/วัน`;
            avgColor = "black";
        }

        averageHtml = `
        <hr style="border: 0.5px solid green;">
        <p><span style="color: #673ab7; font-weight: bold;">สรุปค่าเฉลี่ย (คำนวณจาก ${activeDays} วันที่ทำธุรกรรม) :</span></p>
        <p style="margin-left: 10px; color: ${avgColor}; font-weight: bold;">- ${avgText}</p>
        `;
    }
    
    return ` 
    <p><strong>ชื่อบัญชี:</strong> ${currentAccount}</p> 
    <p><strong>สรุปเมื่อวันที่ : </strong> ${summaryDateTime}</p> 
    <p><strong>${title} : </strong> ${thaiDateString}</p> 
    ${transactionDaysInfo ? transactionDaysInfo : ''} 
    <hr style="border: 0.5px solid green;">
    <p><strong>รายรับ : </strong> ${summary.incomeCount} ครั้ง เป็นเงิน ${summary.totalIncome.toLocaleString()} บาท</p>${incomeHTML} 
    <hr style="border: 0.5px solid green;">
    <p><strong>รายจ่าย : </strong> ${summary.expenseCount} ครั้ง เป็นเงิน ${summary.totalExpense.toLocaleString()} บาท</p>${expenseHTML} 
    <hr style="border: 0.5px solid green;">
    ${summaryLineHTML} 
    ${totalBalanceLine} 
    
    <p>
      <span style="color: blue; font-size: clamp(12px, 2vw, 16px); font-weight: bold;">
        ธุรกรรมทั้งหมด :
      </span>
      <span style="font-size: clamp(14px, 2.2vw, 20px); font-weight: bold;">
        ${totalTransactionCount} ครั้ง (รายรับ ${summary.incomeCount} + รายจ่าย ${summary.expenseCount})
      </span>
    </p>

    ${averageHtml}
    
    <p>ข้อความเพิ่ม : <span style="color: orange;">${remark}</span></p> 
    ${recordsHTML}`;
}

function buildPdfSummaryHtml(context) {
    const { summaryResult, title, dateString, remark, transactionDaysInfo, type, thaiDateString, headerLine1, headerLine2, headerLine3, daysDiff, activeDays } = context;
    const { summary, periodRecords, totalBalance } = summaryResult;
    
    let incomeHTML = ''; 
    for (const type in summary.income) { 
        incomeHTML += `<p style="margin-left: 15px; line-height: 0.5;">- ${type} : ${summary.income[type].count} ครั้ง เป็นเงิน ${summary.income[type].amount.toLocaleString()} บาท</p>`; 
    }
    
    let expenseHTML = ''; 
    for (const type in summary.expense) { 
        expenseHTML += `<p style="margin-left: 15px; line-height: 0.5;">- ${type} : ${summary.expense[type].count} ครั้ง เป็นเงิน ${summary.expense[type].amount.toLocaleString()} บาท</p>`; 
    }
    
    let recordsHTML = '';
    if (periodRecords.length > 0) {
        recordsHTML = ` 
        <div style="margin-top: 20px;"> 
        <h4>รายละเอียดธุรกรรม</h4> 
        <table style="width: 100%; border-collapse: collapse; margin-top: 10px; text-align: center;">
        <thead>
        <tr style="background-color: #f2f2f2;">
        <th style="width: 15%; padding: 4px; border: 1px solid #ddd;">วันเดือนปี</th>
        <th style="width: 10%; padding: 4px; border: 1px solid #ddd;">เวลา</th>
        <th style="width: 15%; padding: 4px; border: 1px solid #ddd;">ประเภท</th>
        <th style="width: 30%; padding: 4px; border: 1px solid #ddd;">รายละเอียด</th>
        <th style="width: 15%; padding: 4px; border: 1px solid #ddd;">จำนวนเงิน</th>
        </tr>
        </thead>
        <tbody>
        ${periodRecords.map(record => {
            const { formattedDate, formattedTime } = formatDateForDisplay(record.dateTime);
            const isIncome = accountTypes.get(currentAccount)["รายรับ"].includes(record.type); 
            const color = isIncome ? "#4CAF50" : "#F44336";
            
            return `
            <tr>
            <td style="padding: 4px; border: 1px solid #ddd; word-wrap: break-word;">${formattedDate}</td>
            <td style="padding: 4px; border: 1px solid #ddd; word-wrap: break-word;">${formattedTime}</td>
            <td style="padding: 4px; border: 1px solid #ddd; word-wrap: break-word;">${record.type}</td>
            <td style="padding: 4px; border: 1px solid #ddd; word-wrap: break-word;">${record.description}</td>
            <td style="padding: 4px; border: 1px solid #ddd; color: ${color}; font-weight: bold; word-wrap: break-word;">${record.amount.toLocaleString()}</td>
            </tr>`;
        }).join('')} 
        </tbody> 
        </table> 
        </div>`;
    }
    
    let comparisonText = ''; let comparisonColor = ''; let differenceAmount = 0;
    if (summary.totalIncome > summary.totalExpense) {
        differenceAmount = summary.totalIncome - summary.totalExpense;
        comparisonText = `รายได้มากกว่ารายจ่าย = ${differenceAmount.toLocaleString()} บาท`;
        comparisonColor = 'blue';
    } else if (summary.totalIncome < summary.totalExpense) {
        differenceAmount = summary.totalExpense - summary.totalIncome;
        comparisonText = `รายจ่ายมากกว่ารายได้ = ${differenceAmount.toLocaleString()} บาท`;
        comparisonColor = 'red';
    } else {
        comparisonText = 'รายได้เท่ากับรายจ่าย';
        comparisonColor = 'black';
    }
    
    let summaryLineHTML;
    if (summary.totalIncome === 0 && summary.totalExpense === 0) {
        summaryLineHTML = `<p style="color: green; font-weight: bold; line-height: 0.5;">${headerLine1} ไม่มีธุรกรรมการเงิน</p>`;
    } else {
        summaryLineHTML = `<p style="color: ${comparisonColor}; font-weight: bold; line-height: 0.5;">${headerLine1} ${comparisonText}</p>`;
    }
    
    let totalBalanceLine;
    if (type === 'range' || type === 'all') {
        totalBalanceLine = `<p style="line-height: 0.5;"><b>${headerLine2} = </b><b style="color: ${totalBalance >= 0 ? 'green' : 'red'}; font-size: 1.1em;">${totalBalance.toLocaleString()}</b> บาท</p>`
    } else {
        totalBalanceLine = `<p style="line-height: 0.5;"><b>เงินในบัญชีถึงวันนี้มี = </b><b style="color: ${totalBalance >= 0 ? 'green' : 'red'}; font-size: 1.1em;">${totalBalance.toLocaleString()}</b> บาท</p>`
    }
    
    const totalTransactionCount = summary.incomeCount + summary.expenseCount;
    const summaryDateTime = new Date().toLocaleString("th-TH", { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'}) + ' น.';
    
    // --- ส่วนที่แก้ไขใหม่: คำนวณค่าเฉลี่ยแบบบรรทัดเดียว (PDF Style) ---
    let averageHtml = '';
    if (activeDays && activeDays >= 1) { // ตรวจสอบ activeDays
        const netTotal = summary.totalIncome - summary.totalExpense;
        const avgNet = netTotal / activeDays; // หารด้วย activeDays
        let avgText = "";
        let avgColor = "";

        if (avgNet > 0) {
            avgText = `รายได้มากกว่ารายจ่ายเฉลี่ย : ${avgNet.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} บาท/วัน`;
            avgColor = "blue";
        } else if (avgNet < 0) {
            avgText = `รายจ่ายมากกว่ารายได้เฉลี่ย : ${Math.abs(avgNet).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} บาท/วัน`;
            avgColor = "red";
        } else {
            avgText = `รายได้เท่ากับรายจ่ายเฉลี่ย : 0.00 บาท/วัน`;
            avgColor = "black";
        }

        averageHtml = `
        <hr style="border: 0.5px solid green;">
        <p style="line-height: 0.5;"><strong>สรุปค่าเฉลี่ย (คำนวณจาก ${activeDays} วันที่ทำธุรกรรม) :</strong></p>
        <p style="margin-left: 15px; line-height: 0.5; color: ${avgColor}; font-weight: bold;">- ${avgText}</p>
        `;
    }
    // ------------------------------------
    
    return ` 
    <p style="line-height: 0.5;"><strong>ชื่อบัญชี:</strong> ${currentAccount}</p> 
    <p style="line-height: 0.5;"><strong>สรุปเมื่อวันที่ : </strong> ${summaryDateTime}</p> 
    <p style="line-height: 0.5;"><strong>${title} : </strong> ${thaiDateString}</p> 
    ${transactionDaysInfo ? transactionDaysInfo.replace(/<p/g, '<p style="line-height: 0.5;"') : ''} 
    <hr style="border: 0.5px solid green;">
    <p style="line-height: 0.5;"><strong>รายรับ : </strong> ${summary.incomeCount} ครั้ง เป็นเงิน ${summary.totalIncome.toLocaleString()} บาท</p>
    ${incomeHTML} 
    <hr style="border: 0.5px solid green;">
    <p style="line-height: 0.5;"><strong>รายจ่าย : </strong> ${summary.expenseCount} ครั้ง เป็นเงิน ${summary.totalExpense.toLocaleString()} บาท</p>
    ${expenseHTML} 
    <hr style="border: 0.5px solid green;">
    ${summaryLineHTML} 
    ${totalBalanceLine} 
    
    <p style="line-height: 0.5;"><strong>ธุรกรรมทั้งหมด : </strong> ${totalTransactionCount} ครั้ง (รวมรับ-จ่าย)</p>
    
    ${averageHtml}

    <p style="line-height: 0.5;"><b>ข้อความเพิ่ม : </b><span style="color: orange;">${remark}</span></p> 
    ${recordsHTML}
    `;
}

function handleSummaryOutput(choice) {
    if (!summaryContext || !summaryContext.summaryResult) {
        console.error("Summary context is missing. Cannot proceed.");
        closeSummaryOutputModal();
        return;
    }
    
    if (choice === 'display') {
        const htmlForDisplay = buildOriginalSummaryHtml(summaryContext);
        openSummaryModal(htmlForDisplay);
    } else if (choice === 'xlsx') {
        // เพิ่ม activeDays เข้ามาใน destructuring
        const { summaryResult, title, dateString, remark, transactionDaysInfo, periodName, daysDiff, activeDays } = summaryContext;
        // ส่ง activeDays ไปยังฟังก์ชัน export
        exportSummaryToXlsx(summaryResult, title, dateString, remark, transactionDaysInfo, periodName, daysDiff, activeDays);
        showToast(`📊 สรุปข้อมูลบันทึกเป็นไฟล์ XLSX สำเร็จ`, 'success');
    } else if (choice === 'pdf') {
        const printContainer = document.getElementById('print-container');
        if (printContainer) {
            const htmlWithDetailsForPdf = buildPdfSummaryHtml(summaryContext);
            printContainer.innerHTML = `<div class="summaryResult">${htmlWithDetailsForPdf}</div>`;
            
            // ซ่อน Toast ก่อนพิมพ์
            const toast = document.getElementById('toast');
            if (toast) {
                toast.style.display = 'none';
            }
            
            // ใช้ setTimeout เพื่อให้แน่ใจว่า DOM อัพเดทเสร็จก่อนพิมพ์
            setTimeout(() => { 
                window.print(); 
                
                // แสดง Toast หลังจากพิมพ์เสร็จ (รอให้หน้าต่างพิมพ์ปิด)
                setTimeout(() => {
                    if (toast) {
                        toast.style.display = '';
                    }
                    showToast(`📄 สรุปข้อมูลบันทึกเป็นไฟล์ PDF สำเร็จ`, 'success');
                }, 1000);
            }, 250);
        }
    }
    closeSummaryOutputModal();
}

function summarizeToday() {
    if (!currentAccount) { 
        showToast("❌ กรุณาเลือกบัญชีก่อน", 'error'); 
        return; 
    }
    const startDate = new Date(new Date().setHours(0, 0, 0, 0));
    const endDate = new Date(new Date().setHours(23, 59, 59, 999));
    const summaryResult = generateSummaryData(startDate, endDate);
    if (!summaryResult) return;
    const remarkInput = prompt("กรุณากรอกหมายเหตุ (ถ้าไม่กรอกจะใช้ 'No comment'):", "No comment") || "No comment";
    const thaiDate = new Date(startDate);
    const thaiDateString = `${thaiDate.getDate()} ${thaiDate.toLocaleString('th-TH', { month: 'long' })} ${thaiDate.getFullYear() + 543}`;
    summaryContext = {
        summaryResult, type: 'today', title: "สรุปข้อมูลของวันที่", dateString: new Date(startDate).toLocaleDateString('en-CA'), thaiDateString: thaiDateString, remark: remarkInput, periodName: 'วันนี้', headerLine1: 'สรุปวันนี้ :', headerLine3: `รายละเอียดวันนี้ : ${thaiDateString}`
    };
    openSummaryOutputModal();
    showToast("📊 สรุปข้อมูลวันนี้เรียบร้อย", 'success');
}

function summarizeByDayMonth() {
    if (!currentAccount) { 
        showToast("❌ กรุณาเลือกบัญชีก่อน", 'error'); 
        return; 
    }
    const dayMonthInput = document.getElementById('customDayMonth').value;
    const selectedDate = parseDateInput(dayMonthInput);
    if (!selectedDate) { 
        showToast("❌ กรุณาเลือกวันที่ให้ถูกต้อง", 'error'); 
        return; 
    }
    const startDate = new Date(selectedDate.setHours(0, 0, 0, 0));
    const endDate = new Date(selectedDate.setHours(23, 59, 59, 999));
    const summaryResult = generateSummaryData(startDate, endDate);
    if (!summaryResult) return;
    const remarkInput = prompt("กรุณากรอกหมายเหตุ (ถ้าไม่กรอกจะใช้ 'No comment'):", "No comment") || "No comment";
    const thaiDate = new Date(startDate);
    const thaiDateString = `${thaiDate.getDate()} ${thaiDate.toLocaleString('th-TH', { month: 'long' })} ${thaiDate.getFullYear() + 543}`;
    summaryContext = {
        summaryResult, type: 'byDayMonth', title: "สรุปข้อมูลของวันที่", dateString: dayMonthInput, thaiDateString: thaiDateString, remark: remarkInput, periodName: dayMonthInput.replace(/-/g, '_'), headerLine1: 'สรุป :', headerLine3: `รายละเอียดวันที่เลือก : ${thaiDateString}`
    };
    openSummaryOutputModal();
    showToast("📊 สรุปข้อมูลวันที่เลือกเรียบร้อย", 'success');
}

function summarize() {
    if (!currentAccount) { 
        showToast("❌ กรุณาเลือกบัญชีก่อน", 'error'); 
        return; 
    }
    const startDateStr = document.getElementById('startDate').value;
    const endDateStr = document.getElementById('endDate').value;
    const startDate = parseDateInput(startDateStr); 
    const endDate = parseDateInput(endDateStr);
    
    if (!startDate || !endDate) { 
        showToast("❌ กรุณาเลือกวันที่ให้ครบถ้วน", 'error'); 
        return; 
    }
    if (startDate > endDate) { 
        showToast("❌ วันที่เริ่มต้นต้องมาก่อนวันที่สิ้นสุด", 'error'); 
        return; 
    }
    
    const adjustedEndDate = new Date(endDate);
    adjustedEndDate.setHours(23, 59, 59, 999);
    const summaryResult = generateSummaryData(startDate, adjustedEndDate);
    if (!summaryResult) return;
    
    // คำนวณจำนวนวันทั้งหมดในช่วงเวลา
    const daysDiff = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
    
    // คำนวณวันที่ทำธุรกรรมจริง (Active Days)
    const transactionDays = new Set(summaryResult.periodRecords.map(r => parseLocalDateTime(r.dateTime).toDateString()));
    const activeDays = transactionDays.size;

    const transactionDaysInfo = `<p style="font-size: 16px; color: blue; font-weight: bold;">จำนวน ${daysDiff} วัน</p><p style="font-size: 16px; color: #333; font-weight: bold;">ทำธุรกรรม ${activeDays} วัน, ไม่ได้ทำ ${daysDiff - activeDays} วัน</p>`;
    const remarkInput = prompt("กรุณากรอกหมายเหตุ (ถ้าไม่กรอกจะใช้ 'No comment'):", "No comment") || "No comment";
    const thaiDateString = `${startDate.toLocaleDateString('th-TH', {day: 'numeric', month: 'long', year: 'numeric'})} ถึง ${endDate.toLocaleDateString('th-TH', {day: 'numeric', month: 'long', year: 'numeric'})}`;
    
    // ✅ ส่วนที่เพิ่ม: รับค่า Checkbox ว่าต้องการแสดงรายละเอียดหรือไม่
    const showDetailsCheckbox = document.getElementById('showDetailsRange');
    const showDetails = showDetailsCheckbox ? showDetailsCheckbox.checked : false;

    // เพิ่ม activeDays และ showDetails เข้าไปใน object
    summaryContext = {
        summaryResult, 
        type: 'range', 
        title: "สรุปวันที่", 
        dateString: `${startDateStr} to ${endDateStr}`, 
        thaiDateString: thaiDateString, 
        remark: remarkInput, 
        transactionDaysInfo: transactionDaysInfo, 
        periodName: `จาก${startDateStr.replace(/-/g, '_')}_ถึง${endDateStr.replace(/-/g, '_')}`, 
        headerLine1: 'สรุป :', 
        headerLine2: 'เงินในบัญชีถึงวันนี้มี',
        daysDiff: daysDiff,
        activeDays: activeDays, // ส่งค่าวันที่ทำจริงไปด้วย
        showDetails: showDetails, // ✅ ส่งค่าการแสดงรายละเอียดไปด้วย
        headerLine3: `รายละเอียดรายการ (${thaiDateString})` // ✅ เพิ่มหัวข้อสำหรับตาราง
    };
    openSummaryOutputModal();
    showToast("📊 สรุปข้อมูลตามช่วงวันที่เรียบร้อย", 'success');
}

function summarizeAll() {
    if (!currentAccount) { 
        showToast("❌ กรุณาเลือกบัญชีก่อน", 'error'); 
        return; 
    }
    const accountRecords = records.filter(r => r.account === currentAccount);
    if (accountRecords.length === 0) { 
        showToast("❌ ไม่มีข้อมูลในบัญชีนี้ให้สรุป", 'error'); 
        return; 
    }
    const allDates = accountRecords.map(r => parseLocalDateTime(r.dateTime));
    const startDate = new Date(Math.min.apply(null, allDates)); 
    const endDate = new Date(Math.max.apply(null, allDates));
    startDate.setHours(0, 0, 0, 0); 
    const adjustedEndDate = new Date(endDate);
    adjustedEndDate.setHours(23, 59, 59, 999);
    const summaryResult = generateSummaryData(startDate, adjustedEndDate);
    if (!summaryResult) return;
    
    // คำนวณจำนวนวันทั้งหมด
    const daysDiff = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
    
    // คำนวณวันที่ทำธุรกรรมจริง (Active Days)
    const transactionDays = new Set(summaryResult.periodRecords.map(r => parseLocalDateTime(r.dateTime).toDateString()));
    const activeDays = transactionDays.size;

    const transactionDaysInfo = `<p style="font-size: 16px; color: blue; font-weight: bold;">รวมเป็นเวลา ${daysDiff} วัน</p><p style="font-size: 16px; color: #333; font-weight: bold;">ทำธุรกรรม ${activeDays} วัน, ไม่ได้ทำ ${daysDiff - activeDays} วัน</p>`;
    const remarkInput = prompt("กรุณากรอกหมายเหตุ (ถ้าไม่กรอกจะใช้ 'No comment'):", "No comment") || "No comment";
    const startDateStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
    const endDateStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
    const thaiDateString = `${startDate.toLocaleDateString('th-TH', {day: 'numeric', month: 'long', year: 'numeric'})} ถึง ${endDate.toLocaleDateString('th-TH', {day: 'numeric', month: 'long', year: 'numeric'})}`;
    
    // เพิ่ม activeDays เข้าไปใน object
    summaryContext = {
        summaryResult, 
        type: 'all', 
        title: "สรุปข้อมูลทั้งหมดตั้งแต่", 
        dateString: `${startDateStr} to ${endDateStr}`, 
        thaiDateString: thaiDateString, 
        remark: remarkInput, 
        transactionDaysInfo: transactionDaysInfo, 
        periodName: 'ทั้งหมด', 
        headerLine1: 'สรุป :', 
        headerLine2: 'เงินคงเหลือในบัญชีทั้งหมด',
        daysDiff: daysDiff,
        activeDays: activeDays // ส่งค่าวันที่ทำจริงไปด้วย
    };
    openSummaryOutputModal();
    showToast("📊 สรุปข้อมูลทั้งหมดเรียบร้อย", 'success');
}

// ==============================================
// ฟังก์ชันจัดการการส่งออกข้อมูล
// ==============================================

function saveToFile() { 
    closeExportOptionsModal(); 
    if (accounts.length === 0) { 
        showToast("❌ ไม่มีบัญชีให้บันทึก", 'error'); 
        return; 
    } 
    document.getElementById('formatSelectionModal').style.display = 'flex'; 
    showToast("📁 กำลังเปิดหน้าต่างบันทึกไฟล์...", 'info');
}

function exportSelectedAccount() { 
    closeExportOptionsModal(); 
    if (!currentAccount) { 
        showToast("❌ กรุณาเลือกบัญชีที่ต้องการบันทึกก่อน", 'error'); 
        return; 
    } 
    document.getElementById('exportSingleAccountModal').style.display = 'flex'; 
    showToast("📁 กำลังเปิดหน้าต่างบันทึกบัญชี...", 'info');
}

function initiateSingleDateExport() {
    if (!currentAccount) {
        showToast("❌ กรุณาเลือกบัญชีที่ต้องการบันทึกก่อน", 'error');
        return;
    }
    closeExportOptionsModal();
    document.getElementById('singleDateAccountName').textContent = currentAccount;
    document.getElementById('exportSingleDate').value = new Date().toISOString().slice(0, 10);
    document.getElementById('singleDateExportModal').style.display = 'flex';
    showToast("📅 กำลังเปิดหน้าต่างบันทึกข้อมูลรายวัน...", 'info');
}

function processSingleDateExport() {
    const selectedDateStr = document.getElementById('exportSingleDate').value;
    if (!selectedDateStr) {
        showToast("❌ กรุณาเลือกวันที่ที่ต้องการบันทึก", 'error');
        return;
    }
    const filteredRecords = records.filter(record => {
        return record.account === currentAccount && record.dateTime.startsWith(selectedDateStr);
    });
    if (filteredRecords.length === 0) {
        showToast(`❌ ไม่พบข้อมูลในบัญชี "${currentAccount}" ในวันที่ ${selectedDateStr}`, 'error');
        return;
    }
    singleDateExportContext = {
        records: filteredRecords,
        selectedDate: selectedDateStr,
    };
    closeSingleDateExportModal();
    document.getElementById('singleDateExportFormatModal').style.display = 'flex';
    showToast(`✅ พบข้อมูล ${filteredRecords.length} รายการสำหรับวันที่ ${selectedDateStr}`, 'success');
}

function initiateDateRangeExport() {
    if (!currentAccount) {
        showToast("❌ กรุณาเลือกบัญชีที่ต้องการบันทึกก่อน", 'error');
        return;
    }
    
    closeExportOptionsModal();
    setupDateRangeModal();
    document.getElementById('dateRangeExportModal').style.display = 'flex';
    showToast("📅 กำลังเปิดหน้าต่างบันทึกข้อมูลตามช่วงวันที่...", 'info');
}

function setupDateRangeModal() {
    document.getElementById('dateRangeAccountName').textContent = currentAccount;
    
    const accountRecords = records.filter(record => record.account === currentAccount);
    
    // วันที่สิ้นสุดเป็นวันปัจจุบัน
    const endDateValue = new Date().toISOString().slice(0, 10);
    
    // วันที่เริ่มต้นเป็น 2 วันที่ผ่านมา
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 2); // ลบ 2 วัน
    const startDateValue = startDate.toISOString().slice(0, 10);
    
    document.getElementById('exportStartDate').value = startDateValue;
    document.getElementById('exportEndDate').value = endDateValue;
}

function processDateRangeExport() {
    const validationResult = validateDateRangeInput();
    if (!validationResult.isValid) {
        showToast(validationResult.message, 'error');
        return;
    }
    
    const { startDateStr, endDateStr, startDate, endDate } = validationResult;
    
    const filteredRecords = filterRecordsByDateRange(startDate, endDate);
    
    if (filteredRecords.length === 0) {
        showNoDataAlert(startDateStr, endDateStr);
        return;
    }
    
    exportDateRangeAsJson(filteredRecords, startDateStr, endDateStr);
    closeDateRangeExportModal();
}

async function exportDateRangeAsJson(filteredRecords, startDate, endDate) {
    const defaultFileName = `${currentAccount}_${startDate}_ถึง_${endDate}`;
    const fileName = prompt("กรุณากรอกชื่อไฟล์ (ไม่ต้องใส่นามสกุล):", defaultFileName);
    
    if (!fileName) {
        showToast("❌ ยกเลิกการบันทึกไฟล์", 'info');
        return;
    }
    
    // ✅ บันทึกข้อมูลประเภทบัญชีด้วย
    const accountTypesData = accountTypes.get(currentAccount) || { "รายรับ": [], "รายจ่าย": [] };
    
    const exportData = {
        accountName: currentAccount,
        isDateRangeExport: true,
        exportStartDate: startDate,
        exportEndDate: endDate,
        exportTimestamp: new Date().toISOString(),
        recordCount: filteredRecords.length,
        records: filteredRecords,
        // ✅ เพิ่มข้อมูลประเภทบัญชี
        accountTypes: accountTypesData
    };
    
    let dataString = JSON.stringify(exportData, null, 2);
    
    if (backupPassword) {
        showToast('🔐 กำลังเข้ารหัสข้อมูล...', 'info');
        try {
            const encryptedObject = await encryptData(dataString, backupPassword);
            dataString = JSON.stringify(encryptedObject, null, 2);
        } catch (e) {
            showToast('❌ การเข้ารหัสล้มเหลว!', 'error');
            return;
        }
    }
    
    try {
        const blob = new Blob([dataString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${fileName}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showToast(`✅ บันทึกข้อมูลช่วงวันที่ ${startDate} ถึง ${endDate} เป็น JSON เรียบร้อย\nจำนวนรายการ: ${filteredRecords.length} รายการ`, 'success');
    } catch (error) {
        console.error("Error downloading file:", error);
        showToast("❌ เกิดข้อผิดพลาดในการบันทึกไฟล์: " + error.message, 'error');
    }
}

// ==============================================
// ฟังก์ชันจัดการไฟล์ (บันทึก/โหลด)
// ==============================================

async function saveDataAndShowToast(entryCategory = 'neutral') { 
    // บันทึกไปยัง IndexedDB
    await saveToIndexedDB();
    
    // ใช้ฟังก์ชัน showToast แทนการจัดการ toast โดยตรง
    let message = '✓ บันทึกข้อมูลสำเร็จแล้ว';
    let type = 'info';
    
    if (entryCategory === 'income') { 
        message = '✓ บันทึกรายรับสำเร็จ';
        type = 'income';
    } else if (entryCategory === 'expense') { 
        message = '✓ บันทึกรายจ่ายสำเร็จ';
        type = 'expense';
    }
    
    showToast(message, type);
}

async function handleSaveAs(format) {
    closeFormatModal();
    const formatLower = format.toLowerCase().trim();
    const fileName = prompt("กรุณากรอกชื่อไฟล์สำหรับบันทึกข้อมูล (ไม่ต้องใส่นามสกุล):", "ข้อมูลทุกบัญชี");
    if (!fileName) {
        showToast("❌ ยกเลิกการบันทึกไฟล์", 'info');
        return;
    }
    const now = new Date();
    const dateTimeString = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    
    if (formatLower === 'json') {
        const fullFileName = `${fileName}_${dateTimeString}.json`;
        const data = { accounts, currentAccount, records, accountTypes: Array.from(accountTypes.entries()), backupPassword: null };
        let dataString = JSON.stringify(data, null, 2);
        if (backupPassword) {
            showToast('🔐 กำลังเข้ารหัสข้อมูล...', 'info');
            try {
                const encryptedObject = await encryptData(dataString, backupPassword);
                dataString = JSON.stringify(encryptedObject, null, 2);
            } catch (e) {
                showToast('❌ การเข้ารหัสล้มเหลว!', 'error'); 
                return;
            }
        }
        const blob = new Blob([dataString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = fullFileName; a.click();
        URL.revokeObjectURL(url);
        showToast(`✅ บันทึกข้อมูลทั้งหมดเป็น JSON เรียบร้อย\nไฟล์: ${fullFileName}`, 'success');
    } else if (formatLower === 'csv') {
        const fullFileName = `${fileName}_${dateTimeString}.csv`;
        let csvData = [];
        csvData.push(['###ALL_ACCOUNTS_BACKUP_CSV###']);
        csvData.push(['###ACCOUNTS_LIST###', ...accounts]);
        csvData.push(['###ACCOUNT_TYPES_START###']);
        for (const [accName, typesObj] of accountTypes.entries()) {
            initializeAccountTypes(accName);
            const currentTypes = accountTypes.get(accName);
            if (currentTypes.รายรับ && currentTypes.รายรับ.length > 0) csvData.push([accName, 'รายรับ', ...currentTypes.รายรับ]);
            if (currentTypes.รายจ่าย && currentTypes.รายจ่าย.length > 0) csvData.push([accName, 'รายจ่าย', ...currentTypes.รายจ่าย]);
        }
        csvData.push(['###ACCOUNT_TYPES_END###']);
        csvData.push(['###DATA_START###']);
        // ✅ ปรับปรุง: เพิ่มคอลัมน์ Audit Trail ใน CSV
        csvData.push(["วันที่", "เวลา", "ประเภท", "รายละเอียด", "จำนวนเงิน (บาท)", "บัญชี", "สร้างโดย", "แก้ไขล่าสุดโดย"]);
        const allSortedRecords = [...records].sort((a, b) => parseLocalDateTime(a.dateTime) - parseLocalDateTime(b.dateTime));
        allSortedRecords.forEach(record => {
            const { formattedDate, formattedTime } = formatDateForDisplay(record.dateTime);
            // ✅ ปรับปรุง: เพิ่มข้อมูลผู้สร้างและผู้แก้ไข
            csvData.push([
                formattedDate, 
                formattedTime, 
                record.type, 
                record.description, 
                record.amount, 
                record.account,
                record.createdBy || '-',
                record.editedBy || '-'
            ]);
        });
        let csvContent = Papa.unparse(csvData, { header: false });
        const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = fullFileName;
        link.click();
        URL.revokeObjectURL(link.href);
        showToast(`✅ บันทึกข้อมูลทั้งหมดลงในไฟล์ CSV "${fullFileName}" เรียบร้อยแล้ว`, 'success');
    }
}

async function handleExportSelectedAs(format) {
    closeExportSingleAccountModal();
    if (!currentAccount) {
        showToast("❌ เกิดข้อผิดพลาด: ไม่พบบัญชีที่เลือก", 'error');
        return;
    }
    const fileName = prompt(`กรุณากรอกชื่อไฟล์สำหรับบัญชี ${currentAccount} (ไม่ต้องใส่นามสกุล):`, currentAccount);
    if (!fileName) {
        showToast("❌ ยกเลิกการบันทึกไฟล์", 'info');
        return;
    }
    const now = new Date();
    const dateTimeString = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    
    if (format === 'json') {
        const fullFileName = `${fileName}_${dateTimeString}.json`;
        const accountData = {
            accountName: currentAccount,
            records: records.filter(record => record.account === currentAccount),
            accountTypes: accountTypes.get(currentAccount) || { "รายรับ": [], "รายจ่าย": [] }
        };
        let dataString = JSON.stringify(accountData, null, 2);
        if (backupPassword) {
            showToast('🔐 กำลังเข้ารหัสข้อมูล...', 'info');
            try {
                const encryptedObject = await encryptData(dataString, backupPassword);
                dataString = JSON.stringify(encryptedObject, null, 2);
            } catch (e) {
                showToast('❌ การเข้ารหัสล้มเหลว!', 'error'); 
                return;
            }
        }
        const blob = new Blob([dataString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = fullFileName; a.click();
        URL.revokeObjectURL(url);
        showToast(`✅ บันทึกบัญชี "${currentAccount}" เป็น JSON เรียบร้อย\nไฟล์: ${fullFileName}`, 'success');
    } else if (format === 'csv') {
        const fullFileName = `${fileName}_${dateTimeString}.csv`;
        initializeAccountTypes(currentAccount);
        const accountCurrentTypes = accountTypes.get(currentAccount);
        let excelData = [];
        excelData.push([`ชื่อบัญชี: ${currentAccount}`]);
        excelData.push(['###ACCOUNT_TYPES###']);
        excelData.push(['รายรับ', ...(accountCurrentTypes['รายรับ'] || [])]);
        excelData.push(['รายจ่าย', ...(accountCurrentTypes['รายจ่าย'] || [])]);
        excelData.push(['###DATA_START###']);
        // ✅ ปรับปรุง: เพิ่มคอลัมน์ Audit Trail
        excelData.push(["วันที่", "เวลา", "ประเภท", "รายละเอียด", "จำนวนเงิน (บาท)", "ผู้สร้าง", "ผู้แก้ไข"]);
        const filteredRecords = records.filter(record => record.account === currentAccount).sort((a, b) => parseLocalDateTime(a.dateTime) - parseLocalDateTime(b.dateTime));
        filteredRecords.forEach(record => {
            const { formattedDate, formattedTime } = formatDateForDisplay(record.dateTime);
            // ✅ ปรับปรุง: เพิ่มข้อมูลผู้สร้างและผู้แก้ไข
            excelData.push([
                formattedDate, 
                formattedTime, 
                record.type, 
                record.description, 
                record.amount,
                record.createdBy || '-',
                record.editedBy || '-'
            ]);
        });
        let csvContent = Papa.unparse(excelData, { header: false });
        const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = fullFileName; link.click();
        setTimeout(() => URL.revokeObjectURL(link.href), 100);
        showToast(`✅ บันทึกบัญชี "${currentAccount}" เป็น CSV เรียบร้อย\nไฟล์: ${fullFileName}`, 'success');
    }
}

async function handleSingleDateExportAs(format) {
    closeSingleDateExportFormatModal();
    const { records: filteredRecords, selectedDate } = singleDateExportContext;
    
    if (!filteredRecords || filteredRecords.length === 0) {
        showToast("❌ เกิดข้อผิดพลาด: ไม่พบข้อมูลที่จะบันทึก", 'error');
        return;
    }
    const fileName = prompt(`กรุณากรอกชื่อไฟล์ (ไม่ต้องใส่นามสกุล):`, `${currentAccount}_${selectedDate}`);
    if (!fileName) {
        showToast("❌ ยกเลิกการบันทึกไฟล์", 'info');
        return;
    }
    const fullFileName = `${fileName}.${format}`;
    
    if (format === 'json') {
        const exportData = {
            accountName: currentAccount,
            isDailyExport: true,
            exportDate: selectedDate,
            records: filteredRecords
        };
        let dataString = JSON.stringify(exportData, null, 2);
        if (backupPassword) {
            showToast('🔐 กำลังเข้ารหัสข้อมูล...', 'info');
            try {
                const encryptedObject = await encryptData(dataString, backupPassword);
                dataString = JSON.stringify(encryptedObject, null, 2);
            } catch (e) {
                showToast('❌ การเข้ารหัสล้มเหลว!', 'error'); 
                return;
            }
        }
        const blob = new Blob([dataString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = fullFileName; a.click();
        URL.revokeObjectURL(url);
        showToast(`✅ บันทึกข้อมูลวันที่ ${selectedDate} เป็น JSON เรียบร้อย\nไฟล์: ${fullFileName}`, 'success');

    } else if (format === 'xlsx') {
        const wb = XLSX.utils.book_new();
        
        let excelData = [];
        
        excelData.push([`ชื่อบัญชี: ${currentAccount}`]);
        excelData.push([`วันที่ส่งออก: ${selectedDate}`]);
        excelData.push([]);
        
        // ✅ ปรับปรุง: เพิ่มคอลัมน์ Audit Trail
        excelData.push(["วันที่", "เวลา", "ประเภท", "รายละเอียด", "จำนวนเงิน (บาท)", "ผู้สร้าง", "ผู้แก้ไข"]);
        
        const sortedRecords = [...filteredRecords].sort((a, b) => parseLocalDateTime(a.dateTime) - parseLocalDateTime(b.dateTime));
        
        sortedRecords.forEach(record => {
            const { formattedDate, formattedTime } = formatDateForDisplay(record.dateTime);
            // ✅ ปรับปรุง: เพิ่มข้อมูลผู้สร้างและผู้แก้ไข
            excelData.push([
                formattedDate, 
                formattedTime, 
                record.type, 
                record.description, 
                record.amount,
                record.createdBy || '-',
                record.editedBy || '-'
            ]);
        });
        
        const ws = XLSX.utils.aoa_to_sheet(excelData);
        
        // ✅ ปรับปรุง: ปรับความกว้างคอลัมน์เพิ่มเติม
        const colWidths = [
            {wch: 12},
            {wch: 10},
            {wch: 15},
            {wch: 30},
            {wch: 15},
            {wch: 20},
            {wch: 20}
        ];
        ws['!cols'] = colWidths;
        
        ws['!pageSetup'] = {
            orientation: 'landscape',
            paperSize: 9,
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 0,
            margins: {
                left: 0.7, right: 0.7,
                top: 0.75, bottom: 0.75,
                header: 0.3, footer: 0.3
            }
        };
        
        XLSX.utils.book_append_sheet(wb, ws, "ข้อมูลบัญชี");
        
        XLSX.writeFile(wb, fullFileName);
        showToast(`✅ บันทึกข้อมูลวันที่ ${selectedDate} เป็น XLSX เรียบร้อย\nไฟล์: ${fullFileName}`, 'success');
    }
    singleDateExportContext = {};
}

// ==============================================
// ฟังก์ชันจัดการการนำเข้าไฟล์
// ==============================================

async function loadFromFile(event) {
    const file = event.target.files[0]; 
    if (!file) { return; }
    const reader = new FileReader();
    const fileName = file.name.toLowerCase();

    if (fileName.endsWith('.csv')) {
        reader.onload = (e) => loadFromCsv(e.target.result);
        reader.readAsText(file, 'UTF-8');
        showToast("📂 กำลังโหลดข้อมูลจากไฟล์ CSV...", 'info');
    } else if (fileName.endsWith('.json')) {
        reader.onload = async (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                let finalDataToMerge = null;
                
                // ตรวจสอบการเข้ารหัส
                if (importedData && importedData.isEncrypted === true) {
                    const password = prompt("ไฟล์นี้ถูกเข้ารหัส กรุณากรอกรหัสผ่านเพื่อถอดรหัส:");
                    if (!password) { 
                        showToast("❌ ยกเลิกการนำเข้าไฟล์", 'info'); 
                        event.target.value = ''; 
                        return; 
                    }
                    showToast('🔓 กำลังถอดรหัส...', 'info');
                    const decryptedString = await decryptData(importedData, password);
                    if (decryptedString) {
                        finalDataToMerge = JSON.parse(decryptedString);
                        showToast('✅ ถอดรหัสสำเร็จ!', 'success');
                    } else {
                        showToast("❌ ถอดรหัสล้มเหลว! รหัสผ่านอาจไม่ถูกต้อง", 'error'); 
                        event.target.value = ''; 
                        return;
                    }
                } else {
                    finalDataToMerge = importedData;
                }
                
                // ✅ การประมวลผลไฟล์ตามประเภท
                if (finalDataToMerge.accounts && Array.isArray(finalDataToMerge.accounts)) {
                    // ไฟล์บันทึกข้อมูลทั้งหมด
                    if(confirm("ไฟล์นี้เป็นไฟล์บันทึกข้อมูล JSON ทั้งหมด ต้องการโหลดข้อมูลทั้งหมดทับของเดิมหรือไม่?")) {
                        accounts = finalDataToMerge.accounts;
                        records = finalDataToMerge.records;
                        accountTypes = new Map(finalDataToMerge.accountTypes);
                        currentAccount = finalDataToMerge.currentAccount;
                        showToast("✅ โหลดข้อมูลทั้งหมดจาก JSON สำเร็จ", 'success');
                    }
                } else if (finalDataToMerge.isDailyExport === true) {
                    // ไฟล์ข้อมูลรายวัน
                    const { accountName, exportDate, records: recordsToAdd } = finalDataToMerge;
                    const confirmMsg = `ไฟล์นี้มีข้อมูลของวันที่ ${exportDate} จำนวน ${recordsToAdd.length} รายการ สำหรับบัญชี "${accountName}"\n\nกด OK เพื่อ "เพิ่ม" รายการเหล่านี้ลงในบัญชี (ข้อมูลซ้ำจะถูกข้าม)\nกด Cancel เพื่อยกเลิก`;
                    if (confirm(confirmMsg)) {
                        processDateRangeImport(finalDataToMerge);
                    }
                } else if (finalDataToMerge.isDateRangeExport === true) {
                    // ✅ ไฟล์ข้อมูลตามช่วงวันที่ - แก้ไขให้รองรับข้อมูลประเภท
                    const { accountName, exportStartDate, exportEndDate, records: recordsToAdd, accountTypes: importedAccountTypes } = finalDataToMerge;
                    const confirmMsg = `ไฟล์นี้มีข้อมูลของบัญชี "${accountName}" ระหว่างวันที่ ${exportStartDate} ถึง ${exportEndDate} จำนวน ${recordsToAdd.length} รายการ\n\n✅ ไฟล์นี้มีข้อมูลประเภทบัญชีพร้อมใช้งาน\n\nกด OK เพื่อ "เพิ่ม" รายการเหล่านี้ลงในบัญชี (ข้อมูลซ้ำจะถูกข้าม)\nกด Cancel เพื่อยกเลิก`;
                    
                    if (confirm(confirmMsg)) {
                        processDateRangeImport({
                            accountName: accountName,
                            exportStartDate: exportStartDate,
                            exportEndDate: exportEndDate,
                            records: recordsToAdd,
                            accountTypes: importedAccountTypes
                        });
                    }
                } else if (finalDataToMerge.accountName) {
                    // ไฟล์ข้อมูลบัญชีเดียว
                    const confirmMsg = `ไฟล์นี้เป็นข้อมูลของบัญชี "${finalDataToMerge.accountName}"\n\nกด OK เพื่อ "แทนที่" ข้อมูลทั้งหมดของบัญชีนี้\nกด Cancel เพื่อยกเลิก`;
                    if (confirm(confirmMsg)) {
                        if (!accounts.includes(finalDataToMerge.accountName)) {
                            accounts.push(finalDataToMerge.accountName);
                        }
                        records = records.filter(r => r.account !== finalDataToMerge.accountName);
                        records.push(...(finalDataToMerge.records || []));
                        accountTypes.set(finalDataToMerge.accountName, finalDataToMerge.accountTypes || { "รายรับ": [], "รายจ่าย": [] });
                        currentAccount = finalDataToMerge.accountName;
                        showToast(`✅ แทนที่ข้อมูลบัญชี "${finalDataToMerge.accountName}" สำเร็จ`, 'success');
                    }
                } else {
                    throw new Error("รูปแบบไฟล์ JSON ไม่ถูกต้อง");
                }
                
                // ✅ อัพเดท UI หลังโหลดข้อมูล
                updateAccountSelect();
                if (currentAccount) {
                    document.getElementById('accountSelect').value = currentAccount;
                }
                changeAccount();
                await saveToIndexedDB(); // บันทึกไป IndexedDB
                updateMultiAccountSelector();
               
                
            } catch (error) {
                showToast("❌ ไฟล์ JSON ไม่ถูกต้องหรือเสียหาย: " + error.message, 'error');
            }
        };
        reader.readAsText(file);
    } else {
        showToast("❌ กรุณาเลือกไฟล์ .json หรือ .csv เท่านั้น", 'error');
    }
    reader.onerror = () => showToast("❌ เกิดข้อผิดพลาดในการอ่านไฟล์", 'error');
    event.target.value = '';
}

async function processDateRangeImport(importedData) {
    const { accountName, exportStartDate, exportEndDate, records: recordsToAdd, accountTypes: importedAccountTypes } = importedData;
    
    // ... (Logic เดิมในการ Merge Records) ...
    if (!accounts.includes(accountName)) { accounts.push(accountName); }
    if (importedAccountTypes) { accountTypes.set(accountName, importedAccountTypes); }
    else { initializeAccountTypes(accountName); }
    
    let addedCount = 0;
    let skippedCount = 0;
    
    recordsToAdd.forEach(recordToAdd => {
        // ... (Logic เช็คซ้ำเดิม) ...
        const isDuplicate = records.some(existingRecord =>
            existingRecord.account === accountName &&
            existingRecord.dateTime === recordToAdd.dateTime &&
            existingRecord.amount === recordToAdd.amount &&
            existingRecord.description === recordToAdd.description &&
            existingRecord.type === recordToAdd.type
        );
        if (!isDuplicate) {
            records.push({ ...recordToAdd, account: accountName });
            addedCount++;
        } else {
            skippedCount++;
        }
    });
    
    currentAccount = accountName;
    updateAccountSelect();
    document.getElementById('accountSelect').value = currentAccount;
    changeAccount();
    
    // บันทึกข้อมูล
    await saveToIndexedDB();
    showToast(`✅ เติมข้อมูลสำเร็จ! (${addedCount} รายการ)`, 'success');
}

function loadFromCsv(csvText) {
    let csvImportData = { 
        isFullBackup: false, 
        isDailyExport: false, 
        isDateRangeExport: false,
        accountName: '', 
        exportDate: '', 
        exportStartDate: '',
        exportEndDate: '',
        types: { "รายรับ": [], "รายจ่าย": [] }, 
        records: [] 
    };
    let inTypesSection = false;
    let inDataSection = false;
    let dataHeaderPassed = false;
    
    Papa.parse(csvText, {
        skipEmptyLines: true,
        step: function(results) {
            const row = results.data;
            const firstCell = (row[0] || '').trim();
            
            if (firstCell === '###ALL_ACCOUNTS_BACKUP_CSV###') {
                csvImportData.isFullBackup = true;
                return;
            }
            if (firstCell.startsWith('isDailyExport:')) {
                csvImportData.isDailyExport = true;
                csvImportData.exportDate = firstCell.split(':')[1].trim();
                return;
            }
            if (firstCell.startsWith('isDateRangeExport:')) {
                csvImportData.isDateRangeExport = true;
                const dateRange = firstCell.split(':')[1].trim();
                const [startDate, endDate] = dateRange.split(' to ');
                csvImportData.exportStartDate = startDate;
                csvImportData.exportEndDate = endDate;
                return;
            }
            if (firstCell === '###ACCOUNT_TYPES_START###') {
                inTypesSection = true; return;
            }
            if (firstCell === '###ACCOUNT_TYPES_END###') {
                inTypesSection = false; return;
            }
            if (firstCell === '###DATA_START###') {
                inDataSection = true; return;
            }
            
            if (inTypesSection && row.length >= 3) {
                const accName = row[0];
                const category = row[1];
                const types = row.slice(2).filter(t => t.trim() !== '');
                if (!csvImportData.accountName) csvImportData.accountName = accName;
                if (category === 'รายรับ' || category === 'รายจ่าย') csvImportData.types[category] = types;
                return;
            }
            
            if (inDataSection) {
                if (!dataHeaderPassed) { dataHeaderPassed = true; return; }
                if (row.length >= 5) {
                    const [dateStr, timeStr, type, description, amountStr] = row;
                    const amount = parseFloat(amountStr.replace(/[^\d.-]/g, ''));
                    if (!isNaN(amount)) {
                        const [day, month, year] = dateStr.split('/');
                        const formattedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
                        const timeParts = timeStr.replace(' น.', '').split('.');
                        const formattedTime = `${timeParts[0].padStart(2, '0')}:${timeParts[1].padStart(2, '0')}`;
                        const dateTime = `${formattedDate} ${formattedTime}`;
                        csvImportData.records.push({
                            dateTime, type, description, amount,
                            account: csvImportData.accountName
                        });
                    }
                }
            }
        },
        complete: async function() {
            if (csvImportData.isFullBackup) {
                // กรณี CSV แบบ Backup ทั้งหมด
                 if(confirm("ไฟล์นี้เป็นไฟล์ CSV Backup ทั้งหมด ต้องการโหลดทับหรือไม่?")) {
                    showToast('⚠️ แนะนำให้ใช้ไฟล์ JSON สำหรับการกู้คืนข้อมูลทั้งหมด', 'warning');
                 }
            } else if (csvImportData.isDailyExport) {
                // กรณี CSV รายวัน
                const { accountName, exportDate, records: recordsToAdd } = csvImportData;
                 const confirmMsg = `ไฟล์ CSV นี้นำเข้าข้อมูลวันที่ ${exportDate} ของบัญชี "${accountName}" จำนวน ${recordsToAdd.length} รายการ\n\nกด OK เพื่อเพิ่มรายการ`;
                 if (confirm(confirmMsg)) {
                     processDateRangeImport({
                        accountName: accountName,
                        // วันที่อาจต้องปรับจูนตามข้อมูลจริง
                        exportStartDate: exportDate, 
                        exportEndDate: exportDate,
                        records: recordsToAdd
                    });
                 }
            } else if (csvImportData.isDateRangeExport) {
                 // กรณี CSV ช่วงวันที่ (ที่คุณเพิ่มมา)
                const { accountName, exportStartDate, exportEndDate, records: recordsToAdd } = csvImportData;
                const confirmMsg = `ไฟล์ CSV นี้นำเข้าข้อมูลช่วงวันที่ ${exportStartDate} ถึง ${exportEndDate} จำนวน ${recordsToAdd.length} รายการ\n\nกด OK เพื่อเพิ่มรายการ`;
                
                if (confirm(confirmMsg)) {
                    processDateRangeImport({
                        accountName: accountName,
                        exportStartDate: exportStartDate,
                        exportEndDate: exportEndDate,
                        records: recordsToAdd
                    });
                }
            } else if (csvImportData.accountName) {
                // กรณี CSV บัญชีเดียว (Single Account)
                 const confirmMsg = `ไฟล์ CSV นี้เป็นข้อมูลบัญชี "${csvImportData.accountName}"\nกด OK เพื่อ "แทนที่" ข้อมูลบัญชีนี้ทั้งหมด`;
                 if (confirm(confirmMsg)) {
                    if (!accounts.includes(csvImportData.accountName)) {
                        accounts.push(csvImportData.accountName);
                    }
                    records = records.filter(r => r.account !== csvImportData.accountName);
                    records.push(...(csvImportData.records || []));
                    
                    // ตั้งค่า Type ถ้ามีมาใน CSV
                    if(csvImportData.types["รายรับ"].length > 0 || csvImportData.types["รายจ่าย"].length > 0) {
                         accountTypes.set(csvImportData.accountName, csvImportData.types);
                    } else {
                         initializeAccountTypes(csvImportData.accountName);
                    }

                    currentAccount = csvImportData.accountName;
                    updateAccountSelect();
                    document.getElementById('accountSelect').value = currentAccount;
                    changeAccount();
                    
                    // บันทึกข้อมูล
                    await saveToIndexedDB();
                    showToast(`✅ นำเข้าข้อมูล CSV บัญชี "${csvImportData.accountName}" สำเร็จ`, 'success');
                 }
            } else {
                showToast('❌ รูปแบบไฟล์ CSV ไม่ถูกต้อง', 'error');
            }
        }
    });
}

// ==============================================
// ฟังก์ชันจัดการรหัสผ่าน
// ==============================================

async function saveBackupPassword(e) {
    e.preventDefault();
    const newPassword = document.getElementById('backup-password').value;
    const confirmPassword = document.getElementById('backup-password-confirm').value;
    if (newPassword !== confirmPassword) {
        showToast('❌ รหัสผ่านไม่ตรงกัน', 'error');
        return;
    }
    backupPassword = newPassword.trim() || null;
    
    // บันทึก
    await saveToIndexedDB();
    showToast('✅ บันทึกรหัสผ่านเรียบร้อย', 'success');
    
    document.getElementById('backup-password').value = '';
    document.getElementById('backup-password-confirm').value = '';
    renderBackupPasswordStatus();
}

function renderBackupPasswordStatus() {
    const statusEl = document.getElementById('password-status');
    if (backupPassword) {
        statusEl.textContent = 'สถานะ: มีการตั้งรหัสผ่านแล้ว';
        statusEl.style.color = 'green';
    } else {
        statusEl.textContent = 'สถานะ: ยังไม่มีการตั้งรหัสผ่าน (ไฟล์บันทึกข้อมูลจะไม่ถูกเข้ารหัส)';
        statusEl.style.color = '#f5a623';
    }
}

// ==============================================
// ฟังก์ชันการเข้ารหัส
// ==============================================

function arrayBufferToBase64(buffer) { 
    let binary = ''; 
    const bytes = new Uint8Array(buffer); 
    const len = bytes.byteLength; 
    for (let i = 0; i < len; i++) { 
        binary += String.fromCharCode(bytes[i]); 
    } 
    return window.btoa(binary); 
}

function base64ToArrayBuffer(base64) { 
    const binary_string = window.atob(base64); 
    const len = binary_string.length; 
    const bytes = new Uint8Array(len); 
    for (let i = 0; i < len; i++) { 
        bytes[i] = binary_string.charCodeAt(i); 
    } 
    return bytes.buffer; 
}

async function deriveKey(password, salt) { 
    const enc = new TextEncoder(); 
    const keyMaterial = await window.crypto.subtle.importKey('raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveKey']); 
    return window.crypto.subtle.deriveKey({ 
        "name": 'PBKDF2', 
        salt: salt, 
        "iterations": 100000, 
        "hash": 'SHA-256' 
    }, keyMaterial, { 
        "name": 'AES-GCM', 
        "length": 256 
    }, true, [ 
        "encrypt", 
        "decrypt" 
    ] ); 
}

async function encryptData(dataString, password) { 
    const salt = window.crypto.getRandomValues(new Uint8Array(16)); 
    const iv = window.crypto.getRandomValues(new Uint8Array(12)); 
    const key = await deriveKey(password, salt); 
    const enc = new TextEncoder(); 
    const encodedData = enc.encode(dataString); 
    const encryptedContent = await window.crypto.subtle.encrypt({ 
        name: 'AES-GCM', 
        iv: iv 
    }, key, encodedData); 
    return { 
        isEncrypted: true, 
        salt: arrayBufferToBase64(salt), 
        iv: arrayBufferToBase64(iv), 
        encryptedData: arrayBufferToBase64(encryptedContent) 
    }; 
}

async function decryptData(encryptedPayload, password) { 
    try { 
        const salt = base64ToArrayBuffer(encryptedPayload.salt); 
        const iv = base64ToArrayBuffer(encryptedPayload.iv); 
        const data = base64ToArrayBuffer(encryptedPayload.encryptedData); 
        const key = await deriveKey(password, salt); 
        const decryptedContent = await window.crypto.subtle.decrypt({ 
            name: 'AES-GCM', 
            iv: iv 
        }, key, data); 
        const dec = new TextDecoder(); 
        return dec.decode(decryptedContent); 
    } catch (e) { 
        console.error("Decryption failed:", e); 
        return null; 
    } 
}

// ==============================================
// ฟังก์ชันส่งออก Summary เป็น XLSX
// ==============================================

function exportSummaryToXlsx(summaryResult, title, dateString, remark, transactionDaysInfo = null, periodName, daysDiff = 0, activeDays = 0) {
    const { summary, periodRecords, totalBalance } = summaryResult;
    
    const wb = XLSX.utils.book_new();
    
    let excelData = [];
    
    const summaryDateTime = new Date().toLocaleString("th-TH", { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit'
    }) + ' น.';
    
    excelData.push(['สรุปข้อมูลบัญชี']);
    excelData.push(['ชื่อบัญชี:', currentAccount]);
    excelData.push(['สรุปเมื่อวันที่:', summaryDateTime]);
    excelData.push([`${title} :`, dateString]);
    excelData.push([]);
    
    if (transactionDaysInfo) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = transactionDaysInfo;
        const pElements = tempDiv.querySelectorAll('p');
        pElements.forEach(p => {
            excelData.push([p.innerText]);
        });
        excelData.push([]);
    }
    
    excelData.push(['รายรับ :', `${summary.incomeCount} ครั้ง เป็นเงิน ${summary.totalIncome.toLocaleString()} บาท`]);
    for (const type in summary.income) {
        excelData.push([`- ${type} : ${summary.income[type].count} ครั้ง เป็นเงิน ${summary.income[type].amount.toLocaleString()} บาท`]);
    }
    excelData.push([]);
    
    excelData.push(['รายจ่าย :', `${summary.expenseCount} ครั้ง เป็นเงิน ${summary.totalExpense.toLocaleString()} บาท`]);
    for (const type in summary.expense) {
        excelData.push([`- ${type} : ${summary.expense[type].count} ครั้ง เป็นเงิน ${summary.expense[type].amount.toLocaleString()} บาท`]);
    }
    excelData.push([]);
    
    const netAmount = summary.totalIncome - summary.totalExpense;
    let comparisonText = '';
    
    if (summary.totalIncome > summary.totalExpense) {
        comparisonText = `รายได้มากกว่ารายจ่าย = ${netAmount.toLocaleString()} บาท`;
    } else if (summary.totalIncome < summary.totalExpense) {
        comparisonText = `รายจ่ายมากกว่ารายได้ = ${Math.abs(netAmount).toLocaleString()} บาท`;
    } else {
        comparisonText = 'รายได้เท่ากับรายจ่าย';
    }
    
    if (summary.totalIncome === 0 && summary.totalExpense === 0) {
        excelData.push(['สรุป :', 'ไม่มีธุรกรรมการเงิน']);
    } else {
        excelData.push(['สรุป :', comparisonText]);
    }
    
    if (periodName === 'ทั้งหมด' || periodName.includes('ถึง')) {
        excelData.push(['เงินในบัญชีถึงวันนี้มี =', `${totalBalance.toLocaleString()} บาท`]);
    } else {
        excelData.push(['เงินคงเหลือในบัญชีทั้งหมด =', `${totalBalance.toLocaleString()} บาท`]);
    }

    const totalTransactionCount = summary.incomeCount + summary.expenseCount;
    excelData.push(['ธุรกรรมทั้งหมด :', `${totalTransactionCount} ครั้ง`]);
    
    // --- ส่วนที่แก้ไขใหม่: ค่าเฉลี่ยใน Excel (ใช้ activeDays) ---
    if (activeDays && activeDays >= 1) {
        const netTotal = summary.totalIncome - summary.totalExpense;
        const avgNet = netTotal / activeDays; // หารด้วย activeDays
        let avgText = "";

        if (avgNet > 0) {
            avgText = `รายได้มากกว่ารายจ่ายเฉลี่ย : ${avgNet.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} บาท/วัน`;
        } else if (avgNet < 0) {
            avgText = `รายจ่ายมากกว่ารายได้เฉลี่ย : ${Math.abs(avgNet).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} บาท/วัน`;
        } else {
            avgText = `รายได้เท่ากับรายจ่ายเฉลี่ย : 0.00 บาท/วัน`;
        }

        excelData.push([]);
        excelData.push([`สรุปค่าเฉลี่ย (คำนวณจาก ${activeDays} วันที่ทำธุรกรรม) :`]);
        excelData.push([`- ${avgText}`]);
    }
    // ---------------------------------------
    
    excelData.push(['ข้อความเพิ่ม :', remark]);
    excelData.push([]);
    
    if (periodRecords.length > 0) {
        excelData.push(['--- รายการธุรกรรม ---']);
        excelData.push(['วันที่', 'เวลา', 'ประเภท', 'รายละเอียด', 'จำนวนเงิน (บาท)']);
        
        periodRecords.forEach(record => {
            const { formattedDate, formattedTime } = formatDateForDisplay(record.dateTime);
            
            excelData.push([
                formattedDate, 
                formattedTime, 
                record.type, 
                record.description, 
                record.amount.toLocaleString()
            ]);
        });
    }
    
    const ws = XLSX.utils.aoa_to_sheet(excelData);
    
    const colWidths = [
        {wch: 15},
        {wch: 30},
        {wch: 15},
        {wch: 30},
        {wch: 20}
    ];
    ws['!cols'] = colWidths;
    
    ws['!pageSetup'] = {
        orientation: 'portrait',
        paperSize: 9,
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: {
            left: 0.7, right: 0.7,
            top: 0.75, bottom: 0.75,
            header: 0.3, footer: 0.3
        }
    };
    
    if (!ws['!merges']) ws['!merges'] = [];
    ws['!merges'].push({s: {r: 0, c: 0}, e: {r: 0, c: 4}});
    
    XLSX.utils.book_append_sheet(wb, ws, "สรุปข้อมูลบัญชี");
    
    const fileName = `สรุป_${currentAccount}_${periodName}_${new Date().getTime()}.xlsx`;
    
    XLSX.writeFile(wb, fileName);
}

// ==============================================
// ฟังก์ชันจัดการ PWA
// ==============================================

function hideInstallPrompt() { 
    const installGuide = document.getElementById('install-guide'); 
    if (installGuide) { 
        installGuide.style.display = 'none'; 
    } 
}

// ==============================================
// ฟังก์ชันเสริมสำหรับการส่งออกตามช่วงวันที่
// ==============================================

function validateDateRangeInput() {
    const startDateStr = document.getElementById('exportStartDate').value;
    const endDateStr = document.getElementById('exportEndDate').value;
    
    if (!startDateStr || !endDateStr) {
        return { isValid: false, message: "❌ กรุณาเลือกวันที่เริ่มต้นและวันที่สิ้นสุด" };
    }
    
    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    
    if (startDate > endDate) {
        return { isValid: false, message: "❌ วันที่เริ่มต้นต้องมาก่อนวันที่สิ้นสุด" };
    }
    
    return { 
        isValid: true, 
        startDateStr, 
        endDateStr, 
        startDate, 
        endDate: new Date(endDate.setHours(23, 59, 59, 999))
    };
}

function filterRecordsByDateRange(startDate, endDate) {
    return records.filter(record => {
        if (record.account !== currentAccount) return false;
        
        const recordDate = parseLocalDateTime(record.dateTime);
        return recordDate >= startDate && recordDate <= endDate;
    });
}

function showNoDataAlert(startDateStr, endDateStr) {
    showToast(`❌ ไม่พบข้อมูลในบัญชี "${currentAccount}" ระหว่างวันที่ ${startDateStr} ถึง ${endDateStr}`, 'error');
}

// ==============================================
// ฟังก์ชันตั้งค่าวันที่และเวลาปัจจุบัน
// ==============================================

function setCurrentDateTime() {
    const now = new Date();
    
    // ตั้งค่าวันที่ (รูปแบบ YYYY-MM-DD)
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    document.getElementById('entryDate').value = `${year}-${month}-${day}`;
    
    // ตั้งค่าเวลา (รูปแบบ HH:MM)
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    document.getElementById('entryTime').value = `${hours}:${minutes}`;
}

// ==============================================
// ฟังก์ชันจัดการปุ่ม Enter ในฟอร์มเพิ่มข้อมูล
// ==============================================

function setupEnterKeyForAddEntry() {
    const amountInput = document.getElementById('amount');
    const typeInput = document.getElementById('type');
    const descriptionInput = document.getElementById('description');
    
    // สร้าง Array ของ Input ที่ต้องการให้กด Enter เพื่อ Add Entry
    const inputs = [amountInput, typeInput, descriptionInput];
    
    inputs.forEach(input => {
        if (input) {
            input.addEventListener('keydown', function(event) {
                // ตรวจสอบว่าเป็นการกดปุ่ม Enter (keyCode 13 หรือ key 'Enter')
                if (event.key === 'Enter' || event.keyCode === 13) {
                    // ป้องกันการทำงานเริ่มต้นของเบราว์เซอร์ (เช่น การ Submit Form)
                    event.preventDefault(); 
                    
                    // เรียกใช้ฟังก์ชันเพิ่มรายการ
                    addEntry();
                    
                    // หากต้องการให้ Type Input คืนค่าเดิมหลังกด Enter 
                    // สามารถเรียกใช้ restoreType() ได้ที่นี่ (ถ้าต้องการ)
                    if (input.id === 'type') {
                        restoreType(typeInput);
                    }
                }
            });
        }
    });
}

// ==============================================
// ฟังก์ชัน Sync Status (Offline-only)
// ==============================================

function updateSyncStatus() {
    const el = document.getElementById('sync-status');
    if (!el) return;
    el.textContent = '📴 Offline (IndexedDB)';
    el.style.color = '#777';
}

// ==============================================
// ฟังก์ชันเริ่มต้น
// ==============================================

document.addEventListener('DOMContentLoaded', async () => {
    // โหลดข้อมูลจาก IndexedDB
    await loadFromIndexedDB();
    
    // อัพเดท UI
    updateAccountSelect();
    
    // ตั้งค่าบัญชีปัจจุบัน
    if (currentAccount && accounts.includes(currentAccount)) {
        document.getElementById('accountSelect').value = currentAccount;
    } else if (accounts.length > 0) {
        currentAccount = accounts[0];
        document.getElementById('accountSelect').value = currentAccount;
    }
    
    // เปลี่ยนบัญชีและแสดงข้อมูล
    changeAccount();
    
    // แสดงสถานะ Offline
    updateSyncStatus();
    showToast('📴 Offline mode (IndexedDB)', 'info');
    
    // ตั้งค่า UI อื่นๆ
    document.getElementById('detailsSection').style.display = 'none';
    setCurrentDateTime();
    
    // ตั้งค่าอีเวนต์ลิสเซนเนอร์
    document.getElementById('backup-password-form').addEventListener('submit', saveBackupPassword);
    document.getElementById('show-backup-password').addEventListener('change', (e) => {
        document.getElementById('backup-password').type = e.target.checked ? 'text' : 'password';
        document.getElementById('backup-password-confirm').type = e.target.checked ? 'text' : 'password';
    });
    
    window.addEventListener('click', (event) => {
        const modal = document.getElementById('summaryModal');
        if (event.target == modal) { 
            closeSummaryModal(); 
        }
    });
    
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone || localStorage.getItem('pwa_installed') === 'true') {
        hideInstallPrompt();
    }
    
    // ตั้งค่าปุ่ม Enter
    setupEnterKeyForAddEntry(); 
    
    // เปิดเมนูบัญชี
    setTimeout(() => {
        toggleMainSection('account-section');
    }, 500);
});

window.addEventListener('appinstalled', () => { 
    console.log('App was installed.'); 
    hideInstallPrompt(); 
    localStorage.setItem('pwa_installed', 'true'); 
    showToast('✅ ติดตั้งแอปพลิเคชันสำเร็จ!', 'success');
});
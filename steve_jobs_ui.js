const fs = require('fs');
let content = fs.readFileSync('src/app/admin/page.tsx', 'utf8');

// Replace Staff Header
const oldStaffHeaderRegex = /<div className="px-6 py-4 border-b dark:border-gray-700 flex flex-wrap gap-4 justify-between items-center bg-gray-50\/50 dark:bg-gray-800\/50">[\s\S]*?<button[\s\S]*?onClick=\{async \(\) => \{[\s\S]*?＋ 新規スタッフ追加\s*<\/button>\s*<\/div>/;

const newStaffHeader = `<div className="px-5 py-3 border-b dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <h2 className="font-semibold text-gray-800 dark:text-gray-200">スタッフ管理</h2>
                            <input
                                type="month"
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                className="border border-gray-200 dark:border-gray-700 rounded-full px-3 py-1 text-xs focus:outline-none font-bold text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            />
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-3">
                            <input 
                                type="text" 
                                placeholder="🔍 スタッフ検索" 
                                className="border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-xs rounded-full bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 w-36 focus:outline-none focus:ring-1 focus:ring-gray-300 transition-all font-medium" 
                                value={staffSearchQuery} 
                                onChange={(e) => setStaffSearchQuery(e.target.value)}
                            />
                            <select 
                                value={staffSortOption} 
                                onChange={(e) => setStaffSortOption(e.target.value as any)}
                                className="border-none bg-transparent text-gray-500 dark:text-gray-400 focus:outline-none font-medium text-xs cursor-pointer hover:text-gray-900 transition-colors"
                            >
                                <option value="sales_desc">売上順▼</option>
                                <option value="totalSales_desc">累計順▼</option>
                                <option value="name_asc">五十音▲</option>
                            </select>
                            <button
                                onClick={async () => {
                                    const name = window.prompt('追加するスタッフ名(※マイページのIDになります)を入力してください');
                                    if (!name) return;
                                    const password = window.prompt(\`\${name}さんの ログインパスワード を設定してください\`);
                                    if (!password) return;
                                    const email = window.prompt(\`\${name}さんの 給与明細送信先メールアドレス を入力してください（任意）\`) || '';
                                    try {
                                        await fetch(GAS_URL, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'text/plain' },
                                            body: JSON.stringify({ action: 'addStaff', name, password, email })
                                        });
                                        alert(\`\${name}さんを登録しました。マイページからIDとパスワードを利用してログイン可能です。\`);
                                        setStaffEmails(prev => ({ ...prev, [name]: email }));
                                        fetchStaffList();
                                    } catch (e) {
                                        alert('エラーが発生しました。');
                                    }
                                }}
                                className="px-4 py-1.5 bg-[#1c1c1e] dark:bg-white text-white dark:text-[#1c1c1e] rounded-full text-xs font-bold hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors shadow-sm ml-1">
                                ＋ 新規追加
                            </button>
                        </div>
                    </div>`;


// Replace Customer Header
const oldCustomerHeaderRegex = /<div className="px-6 py-4 border-b dark:border-gray-700 flex flex-col gap-4 bg-gray-50\/50 dark:bg-gray-800\/50">[\s\S]*?<button[\s\S]*?onClick=\{async \(\) => \{[\s\S]*?＋ 新規のお客様を追加\s*<\/button>\s*<\/div>\s*<\/div>/;

const newCustomerHeader = `<div className="px-5 py-3 border-b dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                        <h2 className="font-semibold text-gray-800 dark:text-gray-200 whitespace-nowrap">お客様管理</h2>
                        
                        <div className="flex flex-wrap items-center gap-3 text-sm">
                            <input 
                                type="text" 
                                placeholder="🔍 名前・電話番号検索" 
                                className="border border-gray-200 dark:border-gray-700 px-3 py-1.5 rounded-full bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 w-48 focus:outline-none focus:ring-1 focus:ring-gray-300 transition-all font-medium text-xs" 
                                value={customerSearchQuery} 
                                onChange={(e) => setCustomerSearchQuery(e.target.value)}
                            />
                            
                            <label className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 font-medium cursor-pointer hover:text-gray-900 transition-colors mr-2">
                                <input 
                                    type="checkbox" 
                                    checked={showBlacklistOnly} 
                                    onChange={(e) => setShowBlacklistOnly(e.target.checked)} 
                                    className="rounded border-gray-300 text-gray-900 dark:text-white focus:ring-gray-900 w-3.5 h-3.5"
                                />
                                <span className="text-[11px]">🚫 除外</span>
                            </label>

                            <div className="flex items-center gap-1.5 text-[11px] font-medium text-gray-400 dark:text-gray-500 border-l dark:border-gray-700 pl-3">
                                <span title="前払いボーナス設定" className="text-sm">🎁</span>
                                <input type="number" value={bonusThreshold} onChange={e => setBonusThreshold(Number(e.target.value))} className="w-12 px-1 py-0.5 border dark:border-gray-700 rounded bg-transparent text-center focus:outline-none" />
                                <span>円=</span>
                                <input type="number" value={bonusRate} onChange={e => setBonusRate(Number(e.target.value))} className="w-8 px-1 py-0.5 border dark:border-gray-700 rounded bg-transparent text-center focus:outline-none" />
                                <span>%</span>
                                <button onClick={() => {
                                    localStorage.setItem('depositBonusThreshold', String(bonusThreshold));
                                    localStorage.setItem('depositBonusRate', String(bonusRate));
                                }} className="text-[10px] ml-1 text-gray-400 hover:text-indigo-600 font-bold transition-colors">設定保持</button>
                            </div>

                            <select
                                value={customerSortBy}
                                onChange={(e) => setCustomerSortBy(e.target.value as CustomerSortOption)}
                                className="border-none bg-transparent text-gray-500 dark:text-gray-400 focus:outline-none font-medium text-xs cursor-pointer hover:text-gray-900 dark:hover:text-gray-200 transition-colors ml-2"
                            >
                                <option value="deposit">前払い有▼</option>
                                <option value="paid_desc">支払額▼</option>
                                <option value="registered_asc">登録古▲</option>
                                <option value="registered_desc">登録新▼</option>
                                <option value="number_asc">番号順▲</option>
                                <option value="name_asc">五十音▲</option>
                            </select>

                            <button
                                onClick={async () => {
                                    const name = window.prompt('新しいお客様名を入力してください');
                                    if (name) {
                                        const phone = window.prompt(\`\${name} 様の電話番号を入力してください（任意）\`) || '';
                                        setDeposits(prev => ({ ...prev, [name]: 0 }));
                                        if (phone) setCustomerPhones(prev => ({ ...prev, [name]: phone }));
                                        try {
                                            await fetch(GAS_URL, {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'text/plain' },
                                                body: JSON.stringify({ action: 'addCustomer', customerName: name, customerPhone: phone })
                                            });
                                        } catch (e) { console.error(e); }
                                    }
                                }}
                                className="px-4 py-1.5 ml-2 bg-[#1c1c1e] dark:bg-white text-white dark:text-[#1c1c1e] rounded-full text-xs font-bold hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors shadow-sm">
                                ＋ 新規追加
                            </button>
                        </div>
                    </div>`;


content = content.replace(oldStaffHeaderRegex, newStaffHeader);
content = content.replace(oldCustomerHeaderRegex, newCustomerHeader);

// make sure plus icon regex worked
const oldBtn = />[^<]*?新規スタッフ追加[^<]*?</;
content = content.replace(oldBtn, '>＋ 新規追加<');

fs.writeFileSync('src/app/admin/page.tsx', content);

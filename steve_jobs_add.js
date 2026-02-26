const fs = require('fs');
let content = fs.readFileSync('src/app/admin/page.tsx', 'utf8');

const oldStaffTable = /<tbody className="divide-y divide-gray-100 dark:divide-gray-700">[\n\s]*\{staffStats\.length === 0 && \(/;

const newStaffTable = \<tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                <tr className="bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-700">
                                    <td colSpan={4} className="px-6 py-4">
                                        <div className="flex flex-wrap items-center gap-3">
                                            <span className="text-xs font-bold text-gray-500 dark:text-gray-400 mr-2">✨ クイック追加</span>
                                            <input 
                                                type="text" 
                                                id="quickStaffName" 
                                                placeholder="スタッフ名 (必須)" 
                                                className="border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-sm rounded bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all font-medium"
                                            />
                                            <input 
                                                type="text" 
                                                id="quickStaffPass" 
                                                placeholder="ログインパスワード (必須)" 
                                                className="border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-sm rounded bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all font-medium"
                                            />
                                            <input 
                                                type="email" 
                                                id="quickStaffEmail" 
                                                placeholder="メールアドレス (任意)" 
                                                className="border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-sm rounded bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all font-medium w-48"
                                            />
                                            <button 
                                                onClick={async () => {
                                                    const n = (document.getElementById('quickStaffName') as HTMLInputElement).value;
                                                    const p = (document.getElementById('quickStaffPass') as HTMLInputElement).value;
                                                    const e = (document.getElementById('quickStaffEmail') as HTMLInputElement).value;
                                                    if(!n || !p) return alert('スタッフ名とパスワードは必須です');
                                                    try {
                                                        const btn = document.getElementById('quickStaffBtn') as HTMLButtonElement;
                                                        btn.disabled = true;
                                                        btn.innerText = '追加中...';
                                                        await fetch(GAS_URL, { method:'POST', body:JSON.stringify({action:'addStaff', name:n, password:p, email:e})});
                                                        setStaffEmails(prev => ({...prev, [n]:e}));
                                                        fetchStaffList();
                                                        (document.getElementById('quickStaffName') as HTMLInputElement).value = '';
                                                        (document.getElementById('quickStaffPass') as HTMLInputElement).value = '';
                                                        (document.getElementById('quickStaffEmail') as HTMLInputElement).value = '';
                                                        btn.disabled = false;
                                                        btn.innerText = '＋ 追加する';
                                                    } catch(err) { 
                                                        alert('エラーが発生しました'); 
                                                        const btn = document.getElementById('quickStaffBtn') as HTMLButtonElement;
                                                        btn.disabled = false;
                                                        btn.innerText = '＋ 追加する';
                                                    }
                                                }}
                                                id="quickStaffBtn"
                                                className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 font-bold px-4 py-1.5 rounded-lg text-sm hover:bg-gray-800 dark:hover:bg-white transition-colors shadow-sm whitespace-nowrap"
                                            >
                                                ＋ 追加する
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                                {staffStats.length === 0 && (\;

content = content.replace(oldStaffTable, newStaffTable);

const oldCustTable = /<tbody className="divide-y divide-gray-100 dark:divide-gray-700">[\n\s]*\{customerList\.length === 0 \? \(/;

const newCustTable = \<tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                <tr className="bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-700">
                                    <td colSpan={6} className="px-6 py-4 text-left">
                                        <div className="flex flex-wrap items-center gap-3">
                                            <span className="text-xs font-bold text-gray-500 dark:text-gray-400 mr-2">✨ クイック追加</span>
                                            <input 
                                                type="text" 
                                                id="quickCustName" 
                                                placeholder="お客様名 (必須)" 
                                                className="border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-sm rounded bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all font-medium w-40"
                                            />
                                            <input 
                                                type="text" 
                                                id="quickCustPhone" 
                                                placeholder="電話番号 (任意)" 
                                                className="border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-sm rounded bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all font-medium w-40"
                                            />
                                            <button 
                                                onClick={async () => {
                                                    const n = (document.getElementById('quickCustName') as HTMLInputElement).value;
                                                    const p = (document.getElementById('quickCustPhone') as HTMLInputElement).value;
                                                    if(!n) return alert('お客様名は必須です');
                                                    
                                                    const btn = document.getElementById('quickCustBtn') as HTMLButtonElement;
                                                    btn.disabled = true;
                                                    btn.innerText = '追加中...';

                                                    setDeposits(prev => ({...prev, [n]:0}));
                                                    if(p) setCustomerPhones(prev => ({...prev, [n]:p}));
                                                    try {
                                                        await fetch(GAS_URL, { method:'POST', body:JSON.stringify({action:'addCustomer', customerName:n, customerPhone:p})});
                                                        fetchDeposits(); // reload the whole list to get the ID and sorted position right
                                                        (document.getElementById('quickCustName') as HTMLInputElement).value = '';
                                                        (document.getElementById('quickCustPhone') as HTMLInputElement).value = '';
                                                        btn.disabled = false;
                                                        btn.innerText = '＋ 追加する';
                                                    } catch(err) { 
                                                        console.error(err); 
                                                        alert('エラーが発生しました');
                                                        btn.disabled = false;
                                                        btn.innerText = '＋ 追加する';
                                                    }
                                                }}
                                                id="quickCustBtn"
                                                className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 font-bold px-4 py-1.5 rounded-lg text-sm hover:bg-gray-800 dark:hover:bg-white transition-colors shadow-sm whitespace-nowrap"
                                            >
                                                ＋ 追加する
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                                {customerList.length === 0 ? (\;

content = content.replace(oldCustTable, newCustTable);

// Add styling block for headers
const oldStaffBtn = /<button[\s\S]*?onClick=\{async \(\) => \{[\s\S]*?const name = window\.prompt\([\s\S]*?＋ 新規追加\s*<\/button>/g;
content = content.replace(oldStaffBtn, '');

// Clean any leftover empty divs or gaps next to the Select
// We can just rely on TSX to format it mostly, but let's be safe.

fs.writeFileSync('src/app/admin/page.tsx', content);

const fs = require('fs');

let content = fs.readFileSync('src/app/admin/page.tsx', 'utf8');

// Add states
if (!content.includes('const [staffSearchQuery')) {
    content = content.replace(
        "const [activeTab, setActiveTab] = useState<'sales' | 'staff' | 'deposit'>('sales');",
        "const [activeTab, setActiveTab] = useState<'sales' | 'staff' | 'deposit'>('sales');\n    const [staffSearchQuery, setStaffSearchQuery] = useState('');\n    const [staffSortOption, setStaffSortOption] = useState<'sales_desc' | 'totalSales_desc' | 'name_asc'>('sales_desc');\n    const [customerSearchQuery, setCustomerSearchQuery] = useState('');\n    const [showBlacklistOnly, setShowBlacklistOnly] = useState(false);"
    );
}

// Update staffStats
const oldStaffStatsStr = `    const staffStats = Array.from(staffStatsMap.entries())
        .map(([name, stats]) => ({ name, ...stats }))
        .sort((a, b) => b.sales - a.sales);`;

const newStaffStatsStr = `    let staffStats = Array.from(staffStatsMap.entries())
        .map(([name, stats]) => ({ name, ...stats }));
        
    // 検索フィルタ
    if (staffSearchQuery.trim()) {
        staffStats = staffStats.filter(s => s.name.toLowerCase().includes(staffSearchQuery.toLowerCase()));
    }
    
    // ソート
    staffStats.sort((a, b) => {
        if (staffSortOption === 'sales_desc') return b.sales - a.sales;
        if (staffSortOption === 'totalSales_desc') return b.totalSales - a.totalSales;
        return a.name.localeCompare(b.name, 'ja');
    });`;

content = content.replace(oldStaffStatsStr, newStaffStatsStr);

// Update customerList filtering
const oldCustomerListStr = `        if (customerSortBy === 'name_asc') {
            return a.name.localeCompare(b.name, 'ja');
        }
        return 0;
    });`;
const newCustomerListStr = `        if (customerSortBy === 'name_asc') {
            return a.name.localeCompare(b.name, 'ja');
        }
        return 0;
    }).filter(customer => {
        // ブラックリスト絞り込み
        if (showBlacklistOnly && (!customer.phone || !blacklistedPhones.includes(customer.phone))) return false;
        // 検索
        if (customerSearchQuery.trim()) {
            const query = customerSearchQuery.trim().toLowerCase();
            return customer.name.toLowerCase().includes(query) || (customer.phone && customer.phone.includes(query));
        }
        return true;
    });`;
content = content.replace(oldCustomerListStr, newCustomerListStr);

// Update Staff Tab UI
const oldStaffHeader = `<div className="px-6 py-4 border-b flex flex-wrap gap-4 justify-between items-center bg-gray-50/50">
                        <div className="flex items-center gap-4">
                            <h2 className="font-semibold text-gray-800">スタッフ一覧と報酬管理</h2>
                            <input
                                type="month"
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none font-bold text-gray-700 bg-white"
                            />
                        </div>`;

const newStaffHeader = `<div className="px-6 py-4 border-b flex flex-wrap gap-4 justify-between items-center bg-gray-50/50">
                        <div className="flex flex-wrap items-center gap-4">
                            <h2 className="font-semibold text-gray-800">スタッフ一覧と報酬管理</h2>
                            <input
                                type="month"
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none font-bold text-gray-700 bg-white"
                            />
                            <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    placeholder="🔍 名前で検索..." 
                                    className="border border-gray-300 lg:w-[150px] w-full px-2 py-1 text-sm rounded bg-white text-gray-700" 
                                    value={staffSearchQuery} 
                                    onChange={(e) => setStaffSearchQuery(e.target.value)}
                                />
                                <select 
                                    value={staffSortOption} 
                                    onChange={(e) => setStaffSortOption(e.target.value as any)}
                                    className="border border-gray-300 px-2 py-1 text-sm rounded bg-white text-gray-700"
                                >
                                    <option value="sales_desc">今月の売上順</option>
                                    <option value="totalSales_desc">累計の売上順</option>
                                    <option value="name_asc">名前順</option>
                                </select>
                            </div>
                        </div>`;
content = content.replace(oldStaffHeader, newStaffHeader);

// Update Customer Tab UI
const oldCustomerHeader = `<div className="px-6 py-4 border-b flex flex-wrap justify-between items-center gap-4 bg-gray-50/50">
                        <div className="flex items-center gap-4">
                            <h2 className="font-semibold text-gray-800">お客様管理 (前払いデポジット含む)</h2>
                        </div>
                        <div className="flex flex-wrap items-center gap-4">`;

const newCustomerHeader = `<div className="px-6 py-4 border-b flex flex-col gap-4 bg-gray-50/50">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                            <h2 className="font-semibold text-gray-800">お客様管理 (前払いデポジット含む)</h2>
                            <div className="flex gap-3 items-center flex-wrap">
                                <input 
                                    type="text" 
                                    placeholder="🔍 名前や電話番号で検索..." 
                                    className="border border-gray-300 px-3 py-1.5 text-sm rounded bg-white text-gray-700 min-w-[200px]" 
                                    value={customerSearchQuery} 
                                    onChange={(e) => setCustomerSearchQuery(e.target.value)}
                                />
                                <label className="flex items-center gap-1.5 text-sm text-gray-700 font-bold hover:text-gray-900 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={showBlacklistOnly} 
                                        onChange={(e) => setShowBlacklistOnly(e.target.checked)} 
                                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-600 w-4 h-4"
                                    />
                                    🚫 ブラックリストのみ表示
                                </label>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-4 mt-2">`;
content = content.replace(oldCustomerHeader, newCustomerHeader);

// Dark mode replacements (robust ones)
const darkReplacements = [
    { from: /text-gray-900(?!( dark:))/g, to: 'text-gray-900 dark:text-gray-100' },
    { from: /text-gray-800(?!( dark:))/g, to: 'text-gray-800 dark:text-gray-200' },
    { from: /text-gray-700(?!( dark:))/g, to: 'text-gray-700 dark:text-gray-300' },
    { from: /text-gray-600(?!( dark:))/g, to: 'text-gray-600 dark:text-gray-400' },
    { from: /text-gray-500(?!( dark:))/g, to: 'text-gray-500 dark:text-gray-400' },
    { from: /text-gray-400(?!( dark:))/g, to: 'text-gray-400 dark:text-gray-500' },
    { from: /bg-white(?!( dark:))/g, to: 'bg-white dark:bg-gray-800' },
    { from: /bg-gray-50\/50(?!( dark:))/g, to: 'bg-gray-50/50 dark:bg-gray-800/50' },
    { from: /bg-gray-50(?!\/| dark:)/g, to: 'bg-gray-50 dark:bg-gray-900' },
    { from: /bg-gray-100(?!( dark:))/g, to: 'bg-gray-100 dark:bg-gray-700' },
    { from: /border-gray-100(?!( dark:))/g, to: 'border-gray-100 dark:border-gray-700' },
    { from: /border-gray-200(?!( dark:))/g, to: 'border-gray-200 dark:border-gray-700' },
    { from: /border-gray-300(?!( dark:))/g, to: 'border-gray-300 dark:border-gray-600' },
    { from: /border-b(?!\-| dark:)/g, to: 'border-b dark:border-gray-700' },
    { from: /divide-gray-100(?!( dark:))/g, to: 'divide-gray-100 dark:divide-gray-700' },
    { from: /divide-gray-200(?!( dark:))/g, to: 'divide-gray-200 dark:divide-gray-700' },
    { from: /bg-transparent(?!( dark:))/g, to: 'bg-transparent dark:text-white dark:border-none' },
];

let replaced = content;
for (const rule of darkReplacements) {
    replaced = replaced.replace(rule.from, rule.to);
}

fs.writeFileSync('src/app/admin/page.tsx', replaced);
console.log('Successfully updated page.tsx with features and dark mode.');

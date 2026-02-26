const fs = require('fs');
let content = fs.readFileSync('src/app/admin/page.tsx', 'utf8');

content = content.replace(
    /const staffStats = Array\.from\(staffStatsMap\.entries\(\)\)[\s\S]*?\.sort\(\(a, b\) => b\.sales - a\.sales\);/,
    `let staffStats = Array.from(staffStatsMap.entries())
        .map(([name, stats]) => ({ name, ...stats }));

    if (staffSearchQuery.trim()) {
        staffStats = staffStats.filter(s => s.name.toLowerCase().includes(staffSearchQuery.toLowerCase()));
    }
    
    staffStats.sort((a, b) => {
        if (staffSortOption === 'sales_desc') return b.sales - a.sales;
        if (staffSortOption === 'totalSales_desc') return b.totalSales - a.totalSales;
        return a.name.localeCompare(b.name, 'ja');
    });`
);

content = content.replace(
    /if \(customerSortBy === 'name_asc'\) \{[\s\S]*?return a\.name\.localeCompare\(b\.name, 'ja'\);[\s\S]*?\}[\s\S]*?return 0;[\s\S]*?\}\);/,
    `if (customerSortBy === 'name_asc') {
            return a.name.localeCompare(b.name, 'ja');
        }
        return 0;
    }).filter(customer => {
        if (showBlacklistOnly && (!customer.phone || !blacklistedPhones.includes(customer.phone))) return false;
        if (customerSearchQuery.trim()) {
            const query = customerSearchQuery.trim().toLowerCase();
            return customer.name.toLowerCase().includes(query) || (customer.phone && customer.phone.includes(query));
        }
        return true;
    });`
);

content = content.replace(
    /<div className="flex items-center gap-4">[\s\S]*?<h2 className="font-semibold text-gray-800 dark:text-gray-200">スタッフ一覧と報酬管理<\/h2>[\s\S]*?<input[\s\S]*?type="month"[\s\S]*?value=\{selectedMonth\}[\s\S]*?onChange=\{\(e\) => setSelectedMonth\(e\.target\.value\)\}[\s\S]*?className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm focus:outline-none font-bold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800"[\s\S]*?\/>[\s\S]*?<\/div>/,
    `<div className="flex flex-wrap items-center gap-4">
                            <h2 className="font-semibold text-gray-800 dark:text-gray-200">スタッフ一覧と報酬管理</h2>
                            <input
                                type="month"
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm focus:outline-none font-bold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800"
                            />
                            <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    placeholder="🔍 名前で検索..." 
                                    className="border border-gray-300 dark:border-gray-600 lg:w-[150px] w-full px-2 py-1 text-sm rounded bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300" 
                                    value={staffSearchQuery} 
                                    onChange={(e) => setStaffSearchQuery(e.target.value)}
                                />
                                <select 
                                    value={staffSortOption} 
                                    onChange={(e) => setStaffSortOption(e.target.value as any)}
                                    className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-sm rounded bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                                >
                                    <option value="sales_desc">今月の売上順</option>
                                    <option value="totalSales_desc">累計の売上順</option>
                                    <option value="name_asc">名前順</option>
                                </select>
                            </div>
                        </div>`
);

content = content.replace(
    /<div className="px-6 py-4 border-b dark:border-gray-700 flex flex-wrap justify-between items-center gap-4 bg-gray-50\/50 dark:bg-gray-800\/50">[\s\S]*?<div className="flex items-center gap-4">[\s\S]*?<h2 className="font-semibold text-gray-800 dark:text-gray-200">お客様管理 \(前払いデポジット含む\)<\/h2>[\s\S]*?<\/div>[\s\S]*?<div className="flex flex-wrap items-center gap-4">/,
    `<div className="px-6 py-4 border-b dark:border-gray-700 flex flex-col gap-4 bg-gray-50/50 dark:bg-gray-800/50">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                            <h2 className="font-semibold text-gray-800 dark:text-gray-200">お客様管理 (前払いデポジット含む)</h2>
                            <div className="flex gap-3 items-center flex-wrap">
                                <input 
                                    type="text" 
                                    placeholder="🔍 名前や電話番号で検索..." 
                                    className="border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm rounded bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 min-w-[200px]" 
                                    value={customerSearchQuery} 
                                    onChange={(e) => setCustomerSearchQuery(e.target.value)}
                                />
                                <label className="flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300 font-bold hover:text-gray-900 cursor-pointer">
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
                        <div className="flex flex-wrap items-center justify-end gap-4 mt-2">`
);

fs.writeFileSync('src/app/admin/page.tsx', content);
console.log('Done replacement!');

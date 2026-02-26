const fs = require('fs');
let content = fs.readFileSync('src/app/admin/page.tsx', 'utf8');

// 1. Fix totalPaid condition
content = content.replace(
    /if \(r\.isPaid\) \{\s*current\.totalPaid \+= r\.totalSales;\s*\}/,
    'current.totalPaid += r.totalSales; // isPaidに関わらず累計へ加算'
);

// 2. Move Staff Quick Add
const staffQuickAddRegex = /<tr className="bg-gray-50\/50 dark:bg-gray-800\/50 border-b border-gray-100 dark:border-gray-700">[\s\S]*?<\/tr>/;
const staffQuickAddMatch = content.match(staffQuickAddRegex);

if (staffQuickAddMatch) {
    const quickAddHtml = staffQuickAddMatch[0];
    content = content.replace(quickAddHtml, '');
    
    // Insert before the <tr> in <thead> for staff
    const staffTheadRegex = /<thead className="bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-b dark:border-gray-700">\s*<tr>\s*<th className="px-6 py-3 font-medium">スタッフ名<\/th>/;
    
    content = content.replace(staffTheadRegex, (match) => {
        return <thead className="bg-transparent text-gray-600 dark:text-gray-400 border-b dark:border-gray-700">\n                                 + quickAddHtml + \n                                <tr className="bg-gray-50 dark:bg-gray-900">\n                                    <th className="px-6 py-3 font-medium">スタッフ名</th>;
    });
}

// 3. Move Cust Quick Add
// Since the regex could match the remaining one, let's just find it by searching for id="quickCustName" container tr
const custQuickAddRegex = /<tr className="bg-gray-50\/50 dark:bg-gray-800\/50 border-b border-gray-100 dark:border-gray-700">\s*<td colSpan=\{6\}[\s\S]*?id="quickCustBtn"[\s\S]*?<\/button>\s*<\/div>\s*<\/td>\s*<\/tr>/;
const custQuickAddMatch = content.match(custQuickAddRegex);

if (custQuickAddMatch) {
    const quickAddHtml = custQuickAddMatch[0];
    content = content.replace(quickAddHtml, '');
    
    // Insert before the <tr> in <thead> for cust
    const custTheadRegex = /<thead className="bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-b dark:border-gray-700">\s*<tr>\s*<th className="px-6 py-3 font-medium">No\.<\/th>\s*<th className="px-6 py-3 font-medium">お客様名<\/th>/;
    
    content = content.replace(custTheadRegex, (match) => {
        return <thead className="bg-transparent text-gray-600 dark:text-gray-400 border-b dark:border-gray-700">\n                                 + quickAddHtml + \n                                <tr className="bg-gray-50 dark:bg-gray-900">\n                                    <th className="px-6 py-3 font-medium">No.</th>\n                                    <th className="px-6 py-3 font-medium">お客様名</th>;
    });
}

fs.writeFileSync('src/app/admin/page.tsx', content);

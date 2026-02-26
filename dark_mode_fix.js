const fs = require('fs');

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
    { from: /bg-indigo-50(?!( dark:))/g, to: 'bg-indigo-50 dark:bg-indigo-900/30' },
    { from: /border-gray-100(?!( dark:))/g, to: 'border-gray-100 dark:border-gray-700' },
    { from: /border-gray-200(?!( dark:))/g, to: 'border-gray-200 dark:border-gray-700' },
    { from: /border-gray-300(?!( dark:))/g, to: 'border-gray-300 dark:border-gray-600' },
    { from: /border-b(?!\-| dark:)/g, to: 'border-b dark:border-gray-700' },
    { from: /divide-gray-100(?!( dark:))/g, to: 'divide-gray-100 dark:divide-gray-700' },
    { from: /divide-gray-200(?!( dark:))/g, to: 'divide-gray-200 dark:divide-gray-700' },
    { from: /text-\[\#1c1c1e\](?!( dark:))/g, to: 'text-[#1c1c1e] dark:text-white' },
];

function applyDarkMode(filePath) {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf8');
    let replaced = content;
    for (const rule of darkReplacements) {
        replaced = replaced.replace(rule.from, rule.to);
    }
    // Clean up any double classes if they leaked previously or run multiple times
    replaced = replaced.replace(/dark:text-gray-400 dark:text-gray-500/g, 'dark:text-gray-400')
        .replace(/dark:[a-z]+-[a-z0-9]+(\/[0-9]+)? dark:[a-z]+-[a-z0-9]+(\/[0-9]+)?/g, m => m.split(' ')[0])
        .replace(/dark:text-white dark:border-none/g, 'dark:text-white');
    fs.writeFileSync(filePath, replaced);
    console.log('Applied dark mode to', filePath);
}

applyDarkMode('src/app/page.tsx');
applyDarkMode('src/components/ReportForm.tsx');
applyDarkMode('src/app/mypage/page.tsx');

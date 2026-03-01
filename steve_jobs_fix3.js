const fs = require('fs');
let content = fs.readFileSync('src/app/admin/page.tsx', 'utf8');

content = content.replace(/border-b dark:border-gray-700lue-200/g, 'border-blue-200');

fs.writeFileSync('src/app/admin/page.tsx', content);

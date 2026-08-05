const fs = require('fs');
const file = 'app/dashboard/sales/daraz/average-sales-price/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Remove sticky from thead
content = content.replace(/<thead className=\"bg-gray-50 dark:bg-zinc-800 sticky top-0 z-30 shadow-sm text-xs uppercase tracking-wider text-gray-500\">/g, '<thead className=\"text-xs uppercase tracking-wider text-gray-500\">');

// 2. Add sticky top-0, z-30, and background to ALL th elements natively
content = content.replace(/<th (.*?) className=\"(.*?)\">/g, (match, p1, p2) => {
    // Avoid double-adding
    if(p2.includes('sticky top-0')) return match;
    const cleanClass = p2.replace('bg-gray-50 dark:bg-zinc-800', '').replace('bg-gray-50 dark:bg-zinc-800', '').trim();
    return `<th ${p1} className=\"${cleanClass} sticky top-0 z-30 bg-gray-50 dark:bg-zinc-800 shadow-sm border-b dark:border-zinc-800\">`;
});
content = content.replace(/<th className=\"(.*?)\">/g, (match, p1) => {
    if(match.includes('key=')) return match; // Handled by first rule if it existed
    if(p1.includes('sticky top-0')) return match;
    const cleanClass = p1.replace(/bg-gray-50 dark:bg-zinc-800/g, '').trim();
    return `<th className=\"${cleanClass} sticky top-0 z-30 bg-gray-50 dark:bg-zinc-800 shadow-[0_1px_0_0_#e5e7eb] dark:shadow-[0_1px_0_0_#27272a]\">`;
});

// 3. Setup sticky left columns S.N., Img, Product.
// Headers:
// We need to target the first 3 <th> elements and add sticky left, z-40.
// S.N (w-12 = 48px)
content = content.replace(/<th className=\"w-12 text-center p-3 text-left font-medium align-middle(.*?)">S\.N<\/th>/, '<th className=\"w-12 text-center p-3 font-medium align-middle sticky left-0 top-0 z-40 bg-gray-50 dark:bg-zinc-800 shadow-[1px_1px_0_0_#e5e7eb] dark:shadow-[1px_1px_0_0_#27272a]\">S.N</th>');
// Img (w-16 = 64px) -> left: 48px
content = content.replace(/<th className=\"w-16 text-center p-3 text-left font-medium align-middle(.*?)">Img<\/th>/, '<th className=\"w-16 text-center p-3 font-medium align-middle sticky left-[48px] top-0 z-40 bg-gray-50 dark:bg-zinc-800 shadow-[1px_1px_0_0_#e5e7eb] dark:shadow-[1px_1px_0_0_#27272a]\">Img</th>');
// Product (w-64 = 256px) -> left: 48+64 = 112px
content = content.replace(/<th className=\"w-64 p-3 text-left font-medium align-middle(.*?)">Product<\/th>/, '<th className=\"w-64 p-3 text-left font-medium align-middle sticky left-[112px] top-0 z-40 bg-gray-50 dark:bg-zinc-800 shadow-[1px_1px_0_0_#e5e7eb] dark:shadow-[1px_1px_0_0_#27272a]\">Product</th>');

// Data cells in the same column order:
// 1. S.N. td
content = content.replace(/<td className=\"text-center text-gray-500 p-4 align-middle\">\{\(\(currentPage - 1\) \* itemsPerPage\) \+ index \+ 1\}<\/td>/g, '<td className=\"text-center text-gray-500 p-4 align-middle sticky left-0 z-20 bg-white dark:bg-zinc-900 border-r dark:border-zinc-800\">{((currentPage - 1) * itemsPerPage) + index + 1}</td>');
// 2. Img td
content = content.replace(/<td className=\"text-center p-4 align-middle\">\s+<div className=\"w-10 h-10 relative/g, '<td className=\"text-center p-4 align-middle sticky left-[48px] z-20 bg-white dark:bg-zinc-900 border-r dark:border-zinc-800\">\n                                                <div className=\"w-10 h-10 relative');
// 3. Product td
content = content.replace(/<td className=\"p-4 align-middle\">\s+<div className=\"font-medium text-gray-900 dark:text-gray-100 truncate w-60\" title=\{item\.product_name\}>\{item\.product_name\}<\/div>\s+<\/td>/g, '<td className=\"p-4 align-middle sticky left-[112px] z-20 bg-white dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-800 border-r dark:border-zinc-800 group-hover:bg-gray-50 dark:group-hover:bg-zinc-800 shadow-[1px_0_0_0_#e5e7eb] dark:shadow-[1px_0_0_0_#27272a]\">\n                                                <div className=\"font-medium text-gray-900 dark:text-gray-100 truncate w-60\" title={item.product_name}>{item.product_name}</div>\n                                            </td>');

// 4. Color map for stores
// Find the span containing the store name display.
// Currently it is: <span className="text-[9.5px] text-gray-500 font-semibold uppercase tracking-wider mt-1 border border-gray-200 dark:border-gray-700 px-1 rounded-sm" title={sku || ''}>
// We will replace the entire line with a dynamic evaluation.
content = content.replace(/<span className=\"text-\[9\.5px\] text-gray-500 font-semibold uppercase tracking-wider mt-1 border border-gray-200 dark:border-gray-700 px-1 rounded-sm\" title=\{sku \|\| \'\'\}>\s+\{\{\'(.*?)\'(.*?)\}\s+<\/span>/, (match) => {
    return `
    {(() => {
        const storeAlias = {'Bagmati Online': 'Bagmati', 'Ram': 'Balaju', 'Lamichhane Suppliers': 'Cosmetics', 'Bagmati Traders': 'BTAS'}[liveDetails.store_name] || liveDetails.store_name;
        const colorClass = {
            'Bagmati': 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-400 dark:border-teal-800',
            'Balaju': 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800',
            'Cosmetics': 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200 dark:bg-fuchsia-950/40 dark:text-fuchsia-400 dark:border-fuchsia-800',
            'BTAS': 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800'
        }[storeAlias] || 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-zinc-800 dark:text-gray-400 dark:border-gray-700';
        return (
            <span className={\`text-[9.5px] font-bold uppercase tracking-wider mt-1 border px-1.5 py-0.5 rounded shadow-sm \${colorClass}\`} title={sku || ''}>
                {storeAlias}
            </span>
        );
    })()}
    `;
});

fs.writeFileSync(file, content);
console.log('Fixed sticky layouts and added dynamic color mappings.');

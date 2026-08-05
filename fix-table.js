const fs = require('fs');
const file = 'app/dashboard/sales/daraz/average-sales-price/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace table components with raw HTML
content = content.replace(/import \{.*?Table\, TableBody\, TableCell\, TableHead\, TableHeader\, TableRow.*?\} from '@\/components\/ui-shim'/, match => match.replace(/Table(Body|Cell|Head|Header|Row)?,? /g, ''));
content = content.replace(/<Table className=\"(.*?)\">/g, '<table className=\"$1 border-collapse relative\">');
content = content.replace(/<\/Table>/g, '</table>');
content = content.replace(/<TableHeader className=\"(.*?)\">/g, '<thead className=\"$1\">');
content = content.replace(/<\/TableHeader>/g, '</thead>');
content = content.replace(/<TableBody>/g, '<tbody>');
content = content.replace(/<\/TableBody>/g, '</tbody>');

content = content.replace(/<TableRow>/g, '<tr className=\"border-b dark:border-zinc-800\">');
content = content.replace(/<TableRow key=\{(.*?)\} className=\{(.*?)\}>/g, '<tr key={$1} className={$2}>');
content = content.replace(/<TableRow key=\{(.*?)\} className=\"(.*?)\">/g, '<tr key={$1} className=\"$2\">');
content = content.replace(/<\/TableRow>/g, '</tr>');

content = content.replace(/<TableHead className=\"(.*?)\">/g, '<th className=\"$1 p-3 text-left font-medium align-middle\">');
content = content.replace(/<\/TableHead>/g, '</th>');

content = content.replace(/<TableCell className=\"(.*?)\">/g, '<td className=\"$1 p-4 align-middle\">');
content = content.replace(/<TableCell colSpan=\{(.*?)\} className=\"(.*?)\">/g, '<td colSpan={$1} className=\"$2 p-4 align-middle\">');
content = content.replace(/<TableCell key=\{(.*?)\} className=\"(.*?)\">/g, '<td key={$1} className=\"$2 p-4 align-middle\">');
content = content.replace(/<\/TableCell>/g, '</td>');

// Add alias display naming logic
content = content.replace(/\{liveDetails\.store_name\}/g, `{{'Bagmati Online': 'Bagmati', 'Ram': 'Balaju', 'Lamichhane Suppliers': 'Cosmetics', 'Bagmati Traders': 'BTAS'}[liveDetails.store_name] || liveDetails.store_name}`);

fs.writeFileSync(file, content);
console.log('Fixed page.tsx table components and mapped alias names.');
